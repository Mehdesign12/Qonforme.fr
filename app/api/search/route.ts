import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { joinedOne } from "@/lib/treasury/credited"
import { likePattern, type SearchResults } from "@/lib/search/types"

export const dynamic = "force-dynamic"

const LIMIT = 6

/**
 * GET /api/search?q=…
 * Clients par nom, factures et devis par numéro ou par client. Requêtes
 * séparées (.ilike / .in) plutôt qu'un filtre .or() construit à la main :
 * une virgule ou une parenthèse dans la saisie ne peut pas casser la requête.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const q = (new URL(request.url).searchParams.get("q") || "").trim().slice(0, 80)
  const out: SearchResults = { clients: [], invoices: [], quotes: [] }
  if (q.length < 2) return NextResponse.json(out)
  const pat = likePattern(q)

  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, city, email")
    .eq("user_id", user.id)
    .eq("is_archived", false)
    .ilike("name", pat)
    .order("name")
    .limit(LIMIT)
  out.clients = (clients ?? []).map((c) => ({ id: c.id, name: c.name, sub: [c.city, c.email].filter(Boolean).join(" · ") }))
  const clientIds = out.clients.map((c) => c.id)

  type Doc = { id: string; total_ttc: number; status: string; client: { name?: string } | { name?: string }[] | null } & Record<string, unknown>
  const docs = async (table: "invoices" | "quotes", numKey: "invoice_number" | "quote_number") => {
    const cols = `id, ${numKey}, status, total_ttc, client:clients(name)`
    const byNumber = supabase.from(table).select(cols).eq("user_id", user.id).ilike(numKey, pat).order("created_at", { ascending: false }).limit(LIMIT)
    const byClient = clientIds.length
      ? supabase.from(table).select(cols).eq("user_id", user.id).in("client_id", clientIds).order("created_at", { ascending: false }).limit(LIMIT)
      : null
    const [a, b] = await Promise.all([byNumber, byClient ?? Promise.resolve({ data: [] as Doc[] })])
    const seen = new Set<string>()
    return ([...(a.data ?? []), ...(b.data ?? [])] as unknown as Doc[])
      .filter((d) => (seen.has(d.id) ? false : (seen.add(d.id), true)))
      .slice(0, LIMIT)
      .map((d) => ({ id: d.id, number: String(d[numKey]), client: joinedOne(d.client)?.name ?? "", amount: Number(d.total_ttc) || 0, status: d.status }))
  }
  ;[out.invoices, out.quotes] = await Promise.all([docs("invoices", "invoice_number"), docs("quotes", "quote_number")])

  return NextResponse.json(out)
}
