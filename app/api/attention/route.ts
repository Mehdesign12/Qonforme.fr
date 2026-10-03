import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  ATTENTION_LIMIT, STALE_DAYS,
  draftItem, mergeAttention, overdueItem, quoteItem, shiftDays, todayParis,
  type AttentionData,
} from "@/components/search/model"
import { invoiceNumberLabel } from "@/lib/utils/document-numbering"

export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" }

function clientName(rel: unknown): string | null {
  const c = Array.isArray(rel) ? rel[0] : rel
  return c && typeof c === "object" && "name" in c ? String((c as { name: unknown }).name ?? "") || null : null
}

// GET /api/attention — ce qui demande l'attention de l'utilisateur (cloche) :
// factures en retard, devis envoyés sans réponse depuis plus de 7 jours,
// brouillons de plus de 7 jours. 8 éléments au plus, avec les totaux.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401, headers: NO_STORE })
  }

  const today = todayParis()
  const cutoff = shiftDays(today, -STALE_DAYS)

  const [overdueRes, quotesRes, invDraftsRes, quoteDraftsRes] = await Promise.all([
    // En retard : marquée « overdue », ou émise, non réglée et échue (heure de Paris)
    supabase
      .from("invoices")
      .select("id, invoice_number, total_ttc, due_date, client:clients(name)", { count: "exact" })
      .eq("user_id", user.id)
      .or(`status.eq.overdue,and(status.in.(sent,pending,received,accepted),due_date.lt.${today})`)
      .order("due_date", { ascending: true })
      .limit(ATTENTION_LIMIT),
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

  const overdue = (overdueRes.data ?? []).map((r) => overdueItem({
    id: r.id as string,
    number: invoiceNumberLabel(r.invoice_number as string | null),
    client: clientName(r.client),
    amount: Number(r.total_ttc ?? 0),
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

  const counts = {
    overdue: overdueRes.count ?? overdue.length,
    quotes: quotesRes.count ?? quotes.length,
    drafts: (invDraftsRes.count ?? 0) + (quoteDraftsRes.count ?? 0),
  }
  const body: AttentionData = {
    items: mergeAttention(overdue, quotes, drafts),
    counts,
    total: counts.overdue + counts.quotes + counts.drafts,
  }
  return NextResponse.json(body, { headers: NO_STORE })
}
