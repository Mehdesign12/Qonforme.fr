/**
 * Tableau de bord — lecture des données réelles (Server Component).
 *
 * Toutes les requêtes partent en parallèle et sont filtrées par user_id.
 * Une requête en échec laisse sa partie vide sans bloquer la page ; une
 * erreur sur les compteurs n'affiche jamais à tort l'écran d'un compte neuf.
 */
import type { createClient } from "@/lib/supabase/server"
import {
  ISSUED_INVOICE_STATUSES, OPEN_INVOICE_STATUSES, buildDashboardView, issuedSince,
  type DashInvoice, type DashPeriod, type DashQuote, type DashboardInput, type DashboardView,
} from "@/components/dashboard/model"

type ClientJoin = { name?: string | null; city?: string | null; email?: string | null } | null

/** Une jointure PostgREST peut arriver en objet ou en tableau selon le schéma. */
function one(join: unknown): ClientJoin {
  if (Array.isArray(join)) return (join[0] as ClientJoin) ?? null
  return (join as ClientJoin) ?? null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toInvoice(row: any): DashInvoice {
  const client = one(row.client)
  return {
    id: row.id,
    invoice_number: row.invoice_number ?? null, // brouillon : numéro attribué à l'envoi
    status: row.status,
    issue_date: row.issue_date,
    due_date: row.due_date ?? null,
    total_ttc: Number(row.total_ttc) || 0,
    client_name: client?.name ?? null,
    client_city: client?.city ?? null,
    client_email: client?.email ?? null,
    reminder_1_sent_at: row.reminder_1_sent_at ?? null,
    reminder_2_sent_at: row.reminder_2_sent_at ?? null,
  }
}

const INVOICE_FIELDS = "id, invoice_number, status, issue_date, due_date, total_ttc, client:clients(name, city, email)"

export async function getDashboardView({
  supabase,
  userId,
  firstName,
  company,
  today,
  period,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>
  userId: string | null
  firstName: string
  company: DashboardInput["company"]
  today: string
  period: DashPeriod
}): Promise<DashboardView> {
  const empty: DashboardInput = {
    mode: "app",
    period,
    today,
    firstName,
    company,
    counts: { invoices: null, quotes: null },
    issued: [],
    open: [],
    paid: [],
    drafts: [],
    recent: [],
    quotes: [],
    clientsWithoutSiren: null,
  }
  if (!userId) return buildDashboardView(empty)

  const since = issuedSince(today)

  try {
    const [issued, open, paid, drafts, recent, quotes, invoiceCount, quoteCount, clients] = await Promise.all([
      supabase.from("invoices").select("issue_date, total_ttc")
        .eq("user_id", userId).in("status", [...ISSUED_INVOICE_STATUSES]).gte("issue_date", since),
      supabase.from("invoices").select(`${INVOICE_FIELDS}, reminder_1_sent_at, reminder_2_sent_at`)
        .eq("user_id", userId).in("status", [...OPEN_INVOICE_STATUSES]),
      supabase.from("invoices").select("total_ttc, client_id, client:clients(name)")
        .eq("user_id", userId).eq("status", "paid"),
      supabase.from("invoices").select(INVOICE_FIELDS)
        .eq("user_id", userId).eq("status", "draft").order("created_at", { ascending: false }),
      supabase.from("invoices").select(INVOICE_FIELDS)
        .eq("user_id", userId).order("created_at", { ascending: false }).limit(5),
      supabase.from("quotes").select("id, quote_number, status, valid_until, total_ttc, client:clients(name)")
        .eq("user_id", userId).in("status", ["sent", "accepted"]).is("converted_invoice_id", null),
      supabase.from("invoices").select("id", { count: "exact", head: true }).eq("user_id", userId),
      supabase.from("quotes").select("id", { count: "exact", head: true }).eq("user_id", userId),
      supabase.from("clients").select("siren").eq("user_id", userId).eq("is_archived", false),
    ])

    for (const [name, res] of Object.entries({ issued, open, paid, drafts, recent, quotes, invoiceCount, quoteCount, clients })) {
      if (res.error) console.error(`[dashboard] lecture « ${name} » en échec :`, res.error.message)
    }

    return buildDashboardView({
      ...empty,
      counts: {
        invoices: invoiceCount.error ? null : invoiceCount.count ?? 0,
        quotes: quoteCount.error ? null : quoteCount.count ?? 0,
      },
      issued: (issued.data ?? []).map((r) => ({ issue_date: r.issue_date, total_ttc: Number(r.total_ttc) || 0 })),
      open: (open.data ?? []).map(toInvoice),
      paid: (paid.data ?? []).map((r) => ({
        total_ttc: Number(r.total_ttc) || 0,
        client_id: (r.client_id as string | null) ?? null,
        client_name: one(r.client)?.name ?? null,
      })),
      drafts: (drafts.data ?? []).map(toInvoice),
      recent: (recent.data ?? []).map(toInvoice),
      quotes: (quotes.data ?? []).map((q): DashQuote => ({
        id: q.id,
        quote_number: q.quote_number ?? "",
        status: q.status,
        valid_until: q.valid_until ?? null,
        total_ttc: Number(q.total_ttc) || 0,
        client_name: one(q.client)?.name ?? null,
      })),
      clientsWithoutSiren: clients.error
        ? null
        : (clients.data ?? []).filter((c) => !String(c.siren ?? "").trim()).length,
    })
  } catch (err) {
    console.error("[dashboard] lecture impossible :", err)
    return buildDashboardView(empty)
  }
}
