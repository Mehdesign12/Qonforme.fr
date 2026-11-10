/**
 * Faits par compte pour les emails de reprise (lib/onboarding/reprise.ts) et
 * pour l'envoi à la main depuis l'admin. Une lecture en échec n'est jamais lue
 * comme « rien » : le lot est sauté à ce passage.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { isMissingSchemaError } from "@/lib/supabase/schema-guard"
import { hasSiren } from "@/lib/admin/onboarding-progress"
import type { DraftQuoteFact } from "@/lib/email/templates/reprise"

type DbError = { message: string; code?: string }

export interface RepriseFacts {
  hasSiren: boolean
  oldestDraftQuote: (DraftQuoteFact & { createdAt: string }) | null
  quotesSent: number
  draftQuotes: number
  quotesAwaiting: number
  /** Modèles de reprise déjà au journal (envoyés ou en cours). */
  repriseSent: Set<string>
  /** Dernier email du journal (ISO), tous types confondus. */
  lastEmailAt: string | null
}

async function selectAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: DbError | null }>,
): Promise<{ rows: T[]; error: DbError | null }> {
  const rows: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await page(from, from + 999)
    if (error) return { rows, error }
    rows.push(...((data ?? []) as T[]))
    if (!data || data.length < 1000) return { rows, error: null }
  }
}

/**
 * `journal: false` : la table account_emails n'existe pas encore (migration),
 * la reprise ne part pas (on ne saurait pas éviter un doublon).
 */
export async function loadRepriseFacts(
  admin: SupabaseClient,
  userIds: string[],
): Promise<{ facts: Map<string, RepriseFacts>; journal: boolean; error: DbError | null }> {
  const facts = new Map<string, RepriseFacts>()
  for (const id of userIds) {
    facts.set(id, { hasSiren: false, oldestDraftQuote: null, quotesSent: 0, draftQuotes: 0, quotesAwaiting: 0, repriseSent: new Set(), lastEmailAt: null })
  }
  if (userIds.length === 0) return { facts, journal: true, error: null }

  const [companies, quotes, log] = await Promise.all([
    selectAll<{ user_id: string; siren: string | null }>((f, t) =>
      admin.from("companies").select("user_id,siren").in("user_id", userIds).range(f, t)),
    selectAll<{ id: string; user_id: string; status: string; quote_number: string | null; total_ttc: number | null; client_id: string | null; created_at: string }>((f, t) =>
      admin.from("quotes").select("id,user_id,status,quote_number,total_ttc,client_id,created_at").in("user_id", userIds).order("created_at").range(f, t)),
    selectAll<{ user_id: string; template: string; category: string; sent_at: string; status: string }>((f, t) =>
      admin.from("account_emails").select("user_id,template,category,sent_at,status").in("user_id", userIds).range(f, t)),
  ])

  const journal = !(log.error && isMissingSchemaError(log.error))
  const error = companies.error ?? quotes.error ?? (journal ? log.error : null)
  if (error) return { facts, journal, error }

  for (const c of companies.rows) {
    const f = facts.get(c.user_id)
    if (f) f.hasSiren = hasSiren(c.siren)
  }

  const draftClientIds = new Set<string>()
  for (const q of quotes.rows) {
    const f = facts.get(q.user_id)
    if (!f) continue
    if (q.status === "draft") {
      f.draftQuotes++
      if (!f.oldestDraftQuote) {
        f.oldestDraftQuote = { id: q.id, number: q.quote_number, clientName: null, totalTtc: q.total_ttc, clientHasEmail: false, createdAt: q.created_at }
        if (q.client_id) draftClientIds.add(q.client_id)
        ;(f.oldestDraftQuote as { clientId?: string | null }).clientId = q.client_id
      }
    } else {
      f.quotesSent++
      if (q.status === "sent") f.quotesAwaiting++
    }
  }

  if (draftClientIds.size) {
    const { data, error: clientError } = await admin.from("clients").select("id,name,email").in("id", Array.from(draftClientIds))
    if (clientError) return { facts, journal, error: clientError }
    const byId = new Map(((data ?? []) as { id: string; name: string | null; email: string | null }[]).map((c) => [c.id, c]))
    for (const f of Array.from(facts.values())) {
      const q = f.oldestDraftQuote as (DraftQuoteFact & { clientId?: string | null }) | null
      const client = q?.clientId ? byId.get(q.clientId) : undefined
      if (q && client) {
        q.clientName = client.name
        q.clientHasEmail = !!client.email?.trim()
      }
    }
  }

  if (journal) {
    for (const row of log.rows) {
      const f = facts.get(row.user_id)
      if (!f) continue
      if (row.category === "reprise") f.repriseSent.add(row.template)
      if (row.status !== "failed" && (!f.lastEmailAt || row.sent_at > f.lastEmailAt)) f.lastEmailAt = row.sent_at
    }
  }
  return { facts, journal, error: null }
}
