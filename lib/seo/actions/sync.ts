/**
 * Mise à jour des constats après une évaluation des règles :
 * - un seul constat ouvert par règle et par page (index unique partiel
 *   seo_findings_open_key) : s'il existe et que sa règle est toujours vraie,
 *   ses chiffres sont mis à jour ;
 * - Search Console : une seule règle par page. Si un constat ouvert de la page
 *   est toujours vrai, il est gardé et aucun autre n'est créé (pas d'alternance
 *   quand la règle la plus grave change d'un passage à l'autre) ;
 * - un constat ouvert passe « résolu de lui-même » seulement si sa propre règle
 *   a été jugée sur cette page pendant le passage et n'y est plus vraie (sans
 *   Search Console, page sans réponse ou lien non revérifié : il reste tel quel,
 *   une donnée absente n'est pas une amélioration). Exception : un constat de
 *   title, description, H1 ou balise canonique dont la page a quitté le plan du
 *   site (lu avec succès) se résout, motif « Page retirée du plan du site » ;
 * - un constat fait ou ignoré ne revient pas avant 30 jours pour la même
 *   règle et la même page.
 *
 * `planFindingSync` est pur (testé) ; `applyFindingSync` écrit.
 */
import { must, type SeoDb } from "@/lib/seo/db"
import type { FindingStatus } from "@/lib/seo/types"
import { mapPool } from "@/lib/seo/audit/fetcher"
import { appendHistory } from "@/lib/seo/actions/history"
import { readAllRows } from "@/lib/seo/actions/paginate"
import { exclusiveGroupOf, type FindingCandidate, type FindingRule } from "@/lib/seo/actions/rules"

/** Délai avant qu'un constat fait ou ignoré puisse revenir. */
export const SNOOZE_DAYS = 30

export interface ExistingFinding {
  id: string
  rule: string
  path: string
  status: FindingStatus
  done_at: string | null
  ignored_at: string | null
  history: unknown
}

export interface SyncPlan {
  inserts: FindingCandidate[]
  updates: { id: string; candidate: FindingCandidate }[]
  /** Constats à résoudre ; `note` : motif affiché dans l'historique (résolution sans évaluation de la règle). */
  resolves: (ExistingFinding & { note?: string })[]
  snoozed: { candidate: FindingCandidate; until: string }[]
}

const keyOf = (rule: string, path: string) => `${rule}|${path}`

export function planFindingSync(
  existing: ExistingFinding[],
  candidates: FindingCandidate[],
  opts: {
    now: Date
    evaluatedRules: FindingRule[]
    /** Toutes les règles vraies du passage (par défaut : `candidates`). */
    valid?: FindingCandidate[]
    /** Règle jugée sur cette page pendant le passage (par défaut : toute règle de `evaluatedRules`). */
    isEvaluated?: (rule: string, path: string) => boolean
    /** Motif d'une résolution sans évaluation (page retirée du plan du site), ou null. */
    outOfScope?: (rule: string, path: string) => string | null
  },
): SyncPlan {
  const snoozeMs = SNOOZE_DAYS * 86_400_000
  const nowMs = opts.now.getTime()
  const open = new Map<string, ExistingFinding>()
  const recent = new Map<string, number>() // clé → fin du délai (ms)

  existing.forEach((f) => {
    const key = keyOf(f.rule, f.path)
    if (f.status === "open") {
      open.set(key, f)
      return
    }
    const at = f.status === "done" ? f.done_at : f.status === "ignored" ? f.ignored_at : null
    const t = at ? Date.parse(at) : NaN
    if (!Number.isNaN(t) && t + snoozeMs > nowMs) recent.set(key, Math.max(recent.get(key) ?? 0, t + snoozeMs))
  })

  // Toutes les règles vraies : un constat ouvert toujours vrai est mis à jour, jamais résolu.
  const valid = new Map<string, FindingCandidate>()
  ;(opts.valid ?? candidates).forEach((c) => {
    if (!valid.has(keyOf(c.rule, c.path))) valid.set(keyOf(c.rule, c.path), c)
  })
  candidates.forEach((c) => {
    if (!valid.has(keyOf(c.rule, c.path))) valid.set(keyOf(c.rule, c.path), c)
  })

  const plan: SyncPlan = { inserts: [], updates: [], resolves: [], snoozed: [] }
  const keptGroups = new Set<string>()
  open.forEach((f, key) => {
    const c = valid.get(key)
    if (!c) return
    plan.updates.push({ id: f.id, candidate: c })
    const group = exclusiveGroupOf(f)
    if (group) keptGroups.add(group)
  })

  const seen = new Set<string>()
  candidates.forEach((c) => {
    const key = keyOf(c.rule, c.path)
    if (seen.has(key)) return
    seen.add(key)
    if (open.has(key)) return // déjà mis à jour ci-dessus
    const group = exclusiveGroupOf(c)
    if (group && keptGroups.has(group)) return // un constat ouvert de la page reste vrai : il est gardé
    const until = recent.get(key)
    if (until !== undefined) {
      plan.snoozed.push({ candidate: c, until: new Date(until).toISOString() })
      return
    }
    plan.inserts.push(c)
  })

  const evaluated = new Set<string>(opts.evaluatedRules)
  open.forEach((f, key) => {
    if (valid.has(key) || !evaluated.has(f.rule)) return
    if (!opts.isEvaluated || opts.isEvaluated(f.rule, f.path)) {
      plan.resolves.push(f)
      return
    }
    const note = opts.outOfScope?.(f.rule, f.path) ?? null
    if (note) plan.resolves.push({ ...f, note })
  })
  return plan
}

/**
 * Constats ouverts, et faits ou ignorés depuis moins de 30 jours : filtrés
 * par la base (les constats plus anciens ne sont jamais lus) et lus en entier
 * par tranches triées sur l'identifiant (jamais tronqués en silence).
 */
export async function loadExistingFindings(db: SeoDb, now: Date): Promise<ExistingFinding[]> {
  const columns = "id, rule, path, status, done_at, ignored_at, history"
  const since = new Date(now.getTime() - SNOOZE_DAYS * 86_400_000).toISOString()
  const [open, done, ignored] = await Promise.all([
    readAllRows<ExistingFinding>(
      (from, to) => db.from("seo_findings").select(columns).eq("status", "open").order("id").range(from, to),
      "les constats à faire",
    ),
    readAllRows<ExistingFinding>(
      (from, to) => db.from("seo_findings").select(columns).eq("status", "done").gte("done_at", since).order("id").range(from, to),
      "les actions faites récemment",
    ),
    readAllRows<ExistingFinding>(
      (from, to) => db.from("seo_findings").select(columns).eq("status", "ignored").gte("ignored_at", since).order("id").range(from, to),
      "les constats ignorés récemment",
    ),
  ])
  return open.concat(done, ignored)
}

function isUniqueViolation(error: { code?: string | null } | null | undefined): boolean {
  return error?.code === "23505"
}

export interface SyncResult {
  inserted: number
  updated: number
  resolved: number
  snoozed: number
}

export async function applyFindingSync(db: SeoDb, plan: SyncPlan, now: Date): Promise<SyncResult> {
  const at = now.toISOString()
  const toRow = (c: FindingCandidate) => ({
    rule: c.rule,
    path: c.path,
    page_type: c.page_type,
    title: c.title,
    explanation: c.explanation,
    recommendation: c.recommendation,
    severity: c.severity,
    source: c.source,
    effort_minutes: c.effort_minutes,
    metrics: c.metrics,
    status: "open",
    detected_at: at,
    last_seen_at: at,
    history: [{ at, event: "detected" }],
  })

  let inserted = 0
  if (plan.inserts.length > 0) {
    const res = await db.from("seo_findings").insert(plan.inserts.map(toRow))
    if (!res.error) inserted = plan.inserts.length
    else if (isUniqueViolation(res.error)) {
      // Un constat ouvert est apparu entre-temps (« Rouvrir ») : on insère un par un, sans doublon.
      for (const c of plan.inserts) {
        const one = await db.from("seo_findings").insert(toRow(c))
        if (!one.error) inserted++
        else if (!isUniqueViolation(one.error)) must(one, "l'enregistrement des constats")
      }
    } else must(res, "l'enregistrement des constats")
  }

  await mapPool(plan.updates, 4, async ({ id, candidate: c }) => {
    must(
      await db
        .from("seo_findings")
        .update({
          title: c.title,
          page_type: c.page_type,
          explanation: c.explanation,
          recommendation: c.recommendation,
          severity: c.severity,
          effort_minutes: c.effort_minutes,
          metrics: c.metrics,
          last_seen_at: at,
        })
        .eq("id", id)
        .eq("status", "open"),
      "la mise à jour des constats",
    )
  })

  await mapPool(plan.resolves, 4, async (f) => {
    must(
      await db
        .from("seo_findings")
        .update({ status: "resolved", resolved_at: at, history: appendHistory(f.history, f.note ? { at, event: "resolved", note: f.note } : { at, event: "resolved" }) })
        .eq("id", f.id)
        .eq("status", "open"),
      "la résolution des constats",
    )
  })

  return { inserted, updated: plan.updates.length, resolved: plan.resolves.length, snoozed: plan.snoozed.length }
}
