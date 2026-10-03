import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  ATTENTION_LIMIT, STALE_DAYS,
  draftItem, mergeAttention, overdueItem, quoteItem, shiftDays, todayParis, transferItem,
  type AttentionData, type AttentionItem,
} from "@/components/search/model"
import { invoiceNumberLabel } from "@/lib/utils/document-numbering"
import { isMissingSchemaError } from "@/lib/supabase/schema-guard"
import { PAYABLE_STATUSES } from "@/lib/payment-link/rules"
import { DECLARATIONS_TABLE } from "@/lib/payment-link/types"

export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" }

function clientName(rel: unknown): string | null {
  const c = Array.isArray(rel) ? rel[0] : rel
  return c && typeof c === "object" && "name" in c ? String((c as { name: unknown }).name ?? "") || null : null
}

type Supabase = Awaited<ReturnType<typeof createClient>>

/**
 * Virements déclarés par un client sur la page de règlement, pas encore
 * écartés, sur une facture toujours à encaisser. Facultatif : table absente
 * (migration pas encore appliquée) ou erreur → rien, la cloche reste utilisable.
 */
async function loadTransfers(supabase: Supabase, userId: string): Promise<{ items: AttentionItem[]; count: number }> {
  // Au plus une déclaration ouverte par facture (index unique) : 50 suffisent largement
  const { data: decls, error } = await supabase
    .from(DECLARATIONS_TABLE)
    .select("id, invoice_id, amount, transfer_date")
    .eq("user_id", userId)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(50)
  if (error) {
    if (!isMissingSchemaError(error)) console.error("[attention] virements déclarés", error)
    return { items: [], count: 0 }
  }
  if (!decls?.length) return { items: [], count: 0 }

  const { data: invoices, error: invErr } = await supabase
    .from("invoices")
    .select("id, invoice_number, client:clients(name)")
    .eq("user_id", userId)
    .in("id", Array.from(new Set(decls.map((d) => d.invoice_id as string))))
    .in("status", [...PAYABLE_STATUSES])
  if (invErr) {
    console.error("[attention] factures des virements déclarés", invErr)
    return { items: [], count: 0 }
  }
  const byId = new Map((invoices ?? []).map((i) => [i.id as string, i]))
  const open = decls.filter((d) => byId.has(d.invoice_id as string))
  const items = open.slice(0, ATTENTION_LIMIT).map((d) => {
    const inv = byId.get(d.invoice_id as string)!
    return transferItem({
      id: d.id as string,
      number: String(inv.invoice_number ?? "Facture"),
      client: clientName(inv.client),
      amount: Number(d.amount ?? 0),
      transferDate: String(d.transfer_date),
    }, `/invoices/${d.invoice_id}`)
  })
  return { items, count: open.length }
}

// GET /api/attention — ce qui demande l'attention de l'utilisateur (cloche) :
// virements déclarés par un client, factures en retard, devis envoyés sans
// réponse depuis plus de 7 jours, brouillons de plus de 7 jours. 8 éléments au
// plus, avec les totaux.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401, headers: NO_STORE })
  }

  const today = todayParis()
  const cutoff = shiftDays(today, -STALE_DAYS)
  const transfersPromise = loadTransfers(supabase, user.id).catch(() => ({ items: [] as AttentionItem[], count: 0 }))

  const [overdueRes, quotesRes, invDraftsRes, quoteDraftsRes] = await Promise.all([
    // En retard : marquée « overdue », ou émise, non réglée et échue (heure de Paris)
    // Avec la retenue de garantie quand sa colonne existe : elle n'est pas en retard, elle est due à sa libération
    (async () => {
      const run = (cols: string) => supabase
        .from("invoices")
        .select(cols, { count: "exact" })
        .eq("user_id", user.id)
        .or(`status.eq.overdue,and(status.in.(sent,pending,received,accepted),due_date.lt.${today})`)
        .order("due_date", { ascending: true })
        .limit(ATTENTION_LIMIT)
      const withRetention = await run("id, invoice_number, total_ttc, retention_amount, due_date, client:clients(name)")
      return withRetention.error && isMissingSchemaError(withRetention.error)
        ? run("id, invoice_number, total_ttc, due_date, client:clients(name)")
        : withRetention
    })(),
    // Devis envoyés sans réponse (sans date d'envoi : la date d'émission en tient lieu)
    supabase
      .from("quotes")
      .select("id, quote_number, sent_at, issue_date, client:clients(name)", { count: "exact" })
      .eq("user_id", user.id)
      .eq("status", "sent")
      .or(`sent_at.lt.${cutoff},and(sent_at.is.null,issue_date.lt.${cutoff})`)
      .order("issue_date", { ascending: true })
      .limit(ATTENTION_LIMIT),
    supabase
      .from("invoices")
      .select("id, invoice_number, created_at, client:clients(name)", { count: "exact" })
      .eq("user_id", user.id)
      .eq("status", "draft")
      .lt("created_at", cutoff)
      .order("created_at", { ascending: true })
      .limit(ATTENTION_LIMIT),
    supabase
      .from("quotes")
      .select("id, quote_number, created_at, client:clients(name)", { count: "exact" })
      .eq("user_id", user.id)
      .eq("status", "draft")
      .lt("created_at", cutoff)
      .order("created_at", { ascending: true })
      .limit(ATTENTION_LIMIT),
  ])

  const failed = overdueRes.error ?? quotesRes.error ?? invDraftsRes.error ?? quoteDraftsRes.error
  if (failed) {
    console.error("[attention]", failed)
    return NextResponse.json({ error: "Impossible de charger les éléments à surveiller." }, { status: 500, headers: NO_STORE })
  }

  // Sélection construite dynamiquement (avec ou sans retenue) : lignes non typées par le client
  type OverdueRow = { id: string; invoice_number: string | null; total_ttc: number | null; retention_amount?: number | null; due_date: string | null; client: unknown }
  const overdue = ((overdueRes.data ?? []) as unknown as OverdueRow[]).map((r) => overdueItem({
    id: r.id as string,
    number: invoiceNumberLabel(r.invoice_number as string | null),
    client: clientName(r.client as Parameters<typeof clientName>[0]),
    amount: Math.max(0, Number(r.total_ttc ?? 0) - Number(r.retention_amount ?? 0)),
    dueDate: (r.due_date as string | null) ?? null,
  }, today, `/invoices/${r.id}`))

  const quotes = (quotesRes.data ?? []).map((r) => quoteItem({
    id: r.id as string,
    number: r.quote_number as string,
    client: clientName(r.client),
    sentDay: String(r.sent_at ?? r.issue_date).slice(0, 10),
  }, today, `/quotes/${r.id}`))

  const drafts = [
    ...(invDraftsRes.data ?? []).map((r) => ({
      day: String(r.created_at).slice(0, 10),
      item: draftItem({ id: r.id as string, kind: "invoice", number: (r.invoice_number as string | null) ?? null, client: clientName(r.client), createdDay: String(r.created_at).slice(0, 10) }, today, `/invoices/${r.id}`),
    })),
    ...(quoteDraftsRes.data ?? []).map((r) => ({
      day: String(r.created_at).slice(0, 10),
      item: draftItem({ id: r.id as string, kind: "quote", number: r.quote_number as string, client: clientName(r.client), createdDay: String(r.created_at).slice(0, 10) }, today, `/quotes/${r.id}`),
    })),
  ].sort((a, b) => a.day.localeCompare(b.day)).map((x) => x.item)

  const transfers = await transfersPromise
  const counts = {
    overdue: overdueRes.count ?? overdue.length,
    quotes: quotesRes.count ?? quotes.length,
    drafts: (invDraftsRes.count ?? 0) + (quoteDraftsRes.count ?? 0),
    transfers: transfers.count,
  }
  const body: AttentionData = {
    items: mergeAttention(overdue, quotes, drafts, transfers.items),
    counts,
    total: counts.overdue + counts.quotes + counts.drafts + counts.transfers,
  }
  return NextResponse.json(body, { headers: NO_STORE })
}
