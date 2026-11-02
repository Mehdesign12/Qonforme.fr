/**
 * Lecture des compteurs du parcours (devis, factures) de plusieurs comptes d'un coup, côté serveur
 * (clé service_role, page admin seulement). Les lectures sont paginées : PostgREST plafonne une
 * réponse à 1 000 lignes, et un plafond silencieux ferait passer un compte actif pour un compte vide.
 *
 * **Une erreur de lecture n'est jamais lue comme « zéro »** (règle de CLAUDE.md sur l'abonnement) :
 * la fonction rend `null`, et l'écran affiche « Indisponible ».
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import type { ProgressCounts } from "@/lib/admin/onboarding-progress"

const PAGE = 1000
/** Garde-fou : au-delà, on s'arrête plutôt que de boucler. */
const MAX_PAGES = 20
/** Taille d'un lot d'identifiants dans le filtre `in` (longueur d'adresse raisonnable). */
const ID_CHUNK = 100

type Row = { user_id: string; status?: string | null }

async function fetchRows(db: SupabaseClient, table: "quotes" | "invoices", ids: string[], withStatus: boolean): Promise<Row[] | null> {
  const rows: Row[] = []
  for (let from = 0, page = 0; page < MAX_PAGES; page += 1, from += PAGE) {
    const { data, error } = await db
      .from(table)
      .select(withStatus ? "user_id, status" : "user_id")
      .in("user_id", ids)
      .range(from, from + PAGE - 1)
    if (error) return null
    const list = (data ?? []) as unknown as Row[]
    rows.push(...list)
    if (list.length < PAGE) return rows
  }
  return null // plus de MAX_PAGES × PAGE lignes : on ne sait pas, donc on ne dit rien
}

/** Compteurs par compte, ou null si une lecture a échoué. `siren` vient d'ailleurs (page des entreprises). */
export async function fetchProgressCounts(
  db: SupabaseClient,
  userIds: string[],
  sirenByUser: Map<string, string | null>,
): Promise<Map<string, ProgressCounts> | null> {
  const counts = new Map<string, ProgressCounts>()
  for (const id of userIds) {
    counts.set(id, { siren: sirenByUser.get(id) ?? null, quotes: 0, quotesSent: 0, invoices: 0, invoicesSent: 0 })
  }
  for (let i = 0; i < userIds.length; i += ID_CHUNK) {
    const chunk = userIds.slice(i, i + ID_CHUNK)
    const [quotes, invoices] = await Promise.all([fetchRows(db, "quotes", chunk, true), fetchRows(db, "invoices", chunk, true)])
    if (!quotes || !invoices) return null
    for (const q of quotes) {
      const c = counts.get(q.user_id)
      if (!c) continue
      c.quotes += 1
      if (q.status && q.status !== "draft") c.quotesSent += 1
    }
    for (const inv of invoices) {
      const c = counts.get(inv.user_id)
      if (!c) continue
      c.invoices += 1
      if (inv.status && inv.status !== "draft") c.invoicesSent += 1
    }
  }
  return counts
}
