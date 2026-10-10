import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { invoiceNumberLabel } from "@/lib/utils/document-numbering"
import {
  EMPTY_RESULTS, OPEN_INVOICE_STATUSES, SEARCH_LIMIT, SEARCH_MIN,
  clientMeta, type DocHit, type SearchResults,
} from "@/components/search/model"

export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" }

// Échappe les jokers de LIKE (% _ \) : « 50% » cherche « 50% », pas « 50… ».
function likePattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
}

// Clause ilike pour .or(), motif toujours entre guillemets doubles : PostgREST
// utilise ',' '(' ')' '.' ':' comme séparateurs, et un terme tapé par
// l'utilisateur peut en contenir (même règle que app/api/products/route.ts).
function ilikeClause(column: string, pattern: string): string {
  return `${column}.ilike."${pattern.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
}

// La jointure client:clients(name) arrive en objet (ou en tableau selon le typage).
function clientName(rel: unknown): string | null {
  const c = Array.isArray(rel) ? rel[0] : rel
  return c && typeof c === "object" && "name" in c ? String((c as { name: unknown }).name ?? "") || null : null
}

// GET /api/search?q= — factures, devis et clients de l'utilisateur (5 par groupe)
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401, headers: NO_STORE })
  }

  const q = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 80)
  if (q.length < SEARCH_MIN) return NextResponse.json(EMPTY_RESULTS, { headers: NO_STORE })

  const like = likePattern(q)
  // « 948 211 375 » doit trouver le SIREN enregistré sans espaces
  const sirenLike = /^[\d\s]+$/.test(q) ? likePattern(q.replace(/\s/g, "")) : like

  // 1. Clients : ceux dont le nom correspond (pour retrouver leurs documents,
  //    archivés compris) et ceux à afficher (nom, SIREN ou ville, non archivés).
  const [byName, clientsRes] = await Promise.all([
    supabase.from("clients").select("id").eq("user_id", user.id).ilike("name", like).limit(50),
    supabase
      .from("clients")
      .select("id, name, city, siren")
      .eq("user_id", user.id)
      .eq("is_archived", false)
      .or([ilikeClause("name", like), ilikeClause("siren", sirenLike), ilikeClause("city", like)].join(","))
      .order("name", { ascending: true })
      .limit(SEARCH_LIMIT),
  ])
  if (byName.error || clientsRes.error) {
    console.error("[search] clients", byName.error ?? clientsRes.error)
    return NextResponse.json({ error: "La recherche n'a pas abouti. Réessayez." }, { status: 500, headers: NO_STORE })
  }

  const ids = (byName.data ?? []).map((c) => c.id as string)
  const docFilter = (numberColumn: string) =>
    [ilikeClause(numberColumn, like), ...(ids.length ? [`client_id.in.(${ids.join(",")})`] : [])].join(",")
  const hitIds = (clientsRes.data ?? []).map((c) => c.id as string)

  // 2. Documents (numéro ou nom du client) et encours des clients affichés
  const [invRes, quoRes, openRes] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, invoice_number, status, total_ttc, client:clients(name)")
      .eq("user_id", user.id)
      .or(docFilter("invoice_number"))
      .order("issue_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(SEARCH_LIMIT),
    supabase
      .from("quotes")
      .select("id, quote_number, status, total_ttc, client:clients(name)")
      .eq("user_id", user.id)
      .or(docFilter("quote_number"))
      .order("issue_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(SEARCH_LIMIT),
    hitIds.length
      ? supabase
          .from("invoices")
          .select("client_id, total_ttc")
          .eq("user_id", user.id)
          .in("client_id", hitIds)
          .in("status", [...OPEN_INVOICE_STATUSES])
      : Promise.resolve({ data: [] as { client_id: string; total_ttc: number }[], error: null }),
  ])
  if (invRes.error || quoRes.error || openRes.error) {
    console.error("[search] documents", invRes.error ?? quoRes.error ?? openRes.error)
    return NextResponse.json({ error: "La recherche n'a pas abouti. Réessayez." }, { status: 500, headers: NO_STORE })
  }

  const open = new Map<string, { count: number; amount: number }>()
  for (const row of openRes.data ?? []) {
    const cur = open.get(row.client_id as string) ?? { count: 0, amount: 0 }
    open.set(row.client_id as string, { count: cur.count + 1, amount: cur.amount + Number(row.total_ttc ?? 0) })
  }

  const results: SearchResults = {
    invoices: (invRes.data ?? []).map((r): DocHit => ({
      id: r.id as string,
      number: invoiceNumberLabel(r.invoice_number as string | null),
      client: clientName(r.client),
      amount: Number(r.total_ttc ?? 0),
      status: r.status as string,
      href: `/invoices/${r.id}`,
    })),
    quotes: (quoRes.data ?? []).map((r): DocHit => ({
      id: r.id as string,
      number: r.quote_number as string,
      client: clientName(r.client),
      amount: Number(r.total_ttc ?? 0),
      status: r.status as string,
      href: `/quotes/${r.id}`,
    })),
    clients: (clientsRes.data ?? []).map((c) => {
      const o = open.get(c.id as string) ?? { count: 0, amount: 0 }
      return {
        id: c.id as string,
        name: c.name as string,
        meta: clientMeta({ city: c.city as string | null, siren: c.siren as string | null, openCount: o.count, openAmount: o.amount }),
        href: `/clients/${c.id}`,
      }
    }),
  }

  return NextResponse.json(results, { headers: NO_STORE })
}
