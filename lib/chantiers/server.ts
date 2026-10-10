import type { SupabaseClient } from "@supabase/supabase-js"
import { joinedOne } from "@/lib/treasury/credited"
import type { Chantier, ChantierDoc, ChantierLot, ChantierStatus } from "@/lib/chantiers/metrics"

const CHANTIER_COLUMNS =
  "id, name, client_id, address, start_date, end_date, status, lots, retenue_garantie, retenue_rate, autoliquidation, notes, client:clients(name)"

type Row = {
  id: string; name: string; client_id: string | null; address: string | null
  start_date: string | null; end_date: string | null; status: ChantierStatus
  lots: ChantierLot[] | null; retenue_garantie: boolean; retenue_rate: number
  autoliquidation: boolean; notes: string | null
  client: { name?: string } | { name?: string }[] | null
}

/**
 * Chantiers de l'utilisateur, avec leurs devis et factures rattachés.
 * `id` : un seul chantier (null s'il n'existe pas ou n'appartient pas à l'utilisateur).
 */
export async function loadChantiers(
  supabase: SupabaseClient,
  userId: string,
  id?: string,
): Promise<{ chantiers: Chantier[]; error: string | null }> {
  let q = supabase.from("chantiers").select(CHANTIER_COLUMNS).eq("user_id", userId)
  q = id ? q.eq("id", id) : q.neq("status", "archived").order("created_at", { ascending: false })
  const { data, error } = await q
  if (error) return { chantiers: [], error: error.message }
  const rows = (data ?? []) as unknown as Row[]
  const ids = rows.map((r) => r.id)
  if (!ids.length) return { chantiers: [], error: null }

  const [quotes, invoices] = await Promise.all([
    supabase.from("quotes").select("id, quote_number, status, issue_date, subtotal_ht, total_ttc, chantier_id").eq("user_id", userId).in("chantier_id", ids),
    supabase.from("invoices").select("id, invoice_number, status, issue_date, subtotal_ht, total_ttc, chantier_id").eq("user_id", userId).in("chantier_id", ids),
  ])
  if (quotes.error) return { chantiers: [], error: quotes.error.message }
  if (invoices.error) return { chantiers: [], error: invoices.error.message }

  const docs = (list: Record<string, unknown>[] | null, numKey: string) => {
    const by: Record<string, ChantierDoc[]> = {}
    for (const d of list ?? []) {
      const cid = d.chantier_id as string
      ;(by[cid] ||= []).push({
        id:          d.id as string,
        number:      d[numKey] as string,
        status:      d.status as string,
        issue_date:  d.issue_date as string,
        subtotal_ht: Number(d.subtotal_ht) || 0,
        total_ttc:   Number(d.total_ttc) || 0,
      })
    }
    for (const k of Object.keys(by)) by[k].sort((a, b) => (b.issue_date || "").localeCompare(a.issue_date || ""))
    return by
  }
  const qBy = docs(quotes.data, "quote_number")
  const iBy = docs(invoices.data, "invoice_number")

  return {
    error: null,
    chantiers: rows.map((r) => ({
      id:               r.id,
      name:             r.name,
      client_id:        r.client_id,
      client_name:      joinedOne(r.client)?.name ?? null,
      address:          r.address,
      start_date:       r.start_date,
      end_date:         r.end_date,
      status:           r.status,
      lots:             Array.isArray(r.lots) ? r.lots : [],
      retenue_garantie: r.retenue_garantie,
      retenue_rate:     Number(r.retenue_rate) || 0,
      autoliquidation:  r.autoliquidation,
      notes:            r.notes,
      quotes:           qBy[r.id] ?? [],
      invoices:         iBy[r.id] ?? [],
    })),
  }
}

const STATUSES: ChantierStatus[] = ["todo", "active", "done", "archived"]
const isDate = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)

/**
 * Valide le corps d'une création ou d'une modification.
 * `partial` : seuls les champs présents sont validés et renvoyés.
 */
export function parseChantierBody(body: Record<string, unknown>, partial: boolean): { data: Record<string, unknown>; error: string | null } {
  const out: Record<string, unknown> = {}
  const has = (k: string) => Object.prototype.hasOwnProperty.call(body, k)

  if (!partial || has("name")) {
    const name = String(body.name ?? "").trim()
    if (!name) return { data: out, error: "Donnez un nom au chantier" }
    out.name = name.slice(0, 160)
  }
  if (has("client_id")) out.client_id = body.client_id ? String(body.client_id) : null
  if (has("address")) out.address = String(body.address ?? "").trim().slice(0, 300) || null
  for (const k of ["start_date", "end_date"]) {
    if (!has(k)) continue
    if (body[k] && !isDate(body[k])) return { data: out, error: "Date invalide" }
    out[k] = body[k] || null
  }
  if (out.start_date && out.end_date && String(out.end_date) < String(out.start_date)) {
    return { data: out, error: "La fin prévue précède le début" }
  }
  if (has("status")) {
    if (!STATUSES.includes(body.status as ChantierStatus)) return { data: out, error: "Statut inconnu" }
    out.status = body.status
  }
  if (has("lots")) {
    if (!Array.isArray(body.lots)) return { data: out, error: "Lots invalides" }
    out.lots = body.lots
  }
  if (has("retenue_garantie")) out.retenue_garantie = !!body.retenue_garantie
  if (has("retenue_rate")) {
    const r = Number(body.retenue_rate)
    if (!(r >= 0 && r <= 5)) return { data: out, error: "La retenue de garantie est plafonnée à 5 %" }
    out.retenue_rate = r
  }
  if (has("autoliquidation")) out.autoliquidation = !!body.autoliquidation
  if (has("notes")) out.notes = String(body.notes ?? "").trim().slice(0, 2000) || null
  return { data: out, error: null }
}
