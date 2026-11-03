/**
 * Parcours d'un nouvel inscrit, lu dans la base (aucun cookie, aucun accord) : où en est chaque
 * compte, et lesquels ont besoin d'aide. Sert la colonne « Parcours » d'Admin › Utilisateurs.
 *
 * Cinq étapes, des gestes réels lus en base (pas des événements du navigateur) :
 *  1. Entreprise : un SIREN de 9 chiffres est enregistré ;
 *  2. Devis créé ; 3. Devis envoyé (statut autre que brouillon) ;
 *  4. Facture créée ; 5. Facture envoyée (émise : statut autre que brouillon).
 * Les étapes sont indépendantes : un artisan peut créer une facture sans devis.
 */

export const PROGRESS_STEPS = [
  { key: "company", label: "Entreprise" },
  { key: "quote_created", label: "Devis créé" },
  { key: "quote_sent", label: "Devis envoyé" },
  { key: "invoice_created", label: "Facture créée" },
  { key: "invoice_sent", label: "Facture envoyée" },
] as const

export type ProgressStepKey = (typeof PROGRESS_STEPS)[number]["key"]

/** Ce que la base dit d'un compte. */
export interface ProgressCounts {
  siren: string | null
  quotes: number
  quotesSent: number
  invoices: number
  invoicesSent: number
}

/** `complete` : première facture envoyée ; `needs_help` : sans entreprise, ou sans devis ni facture créés, depuis plus d'un jour ; `in_progress` : le reste. */
export type ProgressStatus = "complete" | "needs_help" | "in_progress"

export interface Progress {
  /** Une case par étape, dans l'ordre de `PROGRESS_STEPS`. */
  done: boolean[]
  completed: number
  total: number
  status: ProgressStatus
  /** Première étape non franchie (nulle si tout est fait). */
  next: string | null
  /** Étape où l'aide est attendue (« Entreprise » ou « Devis créé »), seulement si `needs_help`. */
  stuckAt: string | null
  /** Jours entiers depuis l'inscription. */
  ageDays: number
}

/** Un compte de moins de ce nombre de jours n'est pas « bloqué » : il n'a pas eu le temps. */
export const HELP_AFTER_DAYS = 1

const DAY_MS = 24 * 60 * 60 * 1000

export function hasSiren(siren: string | null | undefined): boolean {
  return /^\d{9}$/.test((siren ?? "").replace(/\s/g, ""))
}

export function computeProgress(counts: ProgressCounts, createdAt: string | null | undefined, now: number = Date.now()): Progress {
  const done = [
    hasSiren(counts.siren),
    counts.quotes > 0,
    counts.quotesSent > 0,
    counts.invoices > 0,
    counts.invoicesSent > 0,
  ]
  const completed = done.filter(Boolean).length
  const created = createdAt ? new Date(createdAt).getTime() : NaN
  const ageDays = Number.isFinite(created) ? Math.max(0, Math.floor((now - created) / DAY_MS)) : 0

  const firstMissing = done.findIndex((d) => !d)
  const next = firstMissing === -1 ? null : PROGRESS_STEPS[firstMissing].label

  let status: ProgressStatus = "in_progress"
  let stuckAt: string | null = null
  if (done[4]) {
    status = "complete"
  } else if (ageDays >= HELP_AFTER_DAYS && (!done[0] || (!done[1] && !done[3]))) {
    // Bloqué avant sa première valeur : pas d'entreprise, ou ni devis ni facture créés
    status = "needs_help"
    stuckAt = !done[0] ? PROGRESS_STEPS[0].label : PROGRESS_STEPS[1].label
  }
  return { done, completed, total: PROGRESS_STEPS.length, status, next, stuckAt, ageDays }
}

/** « 3 j », « aujourd'hui » : l'âge du compte, pour dire depuis quand il est bloqué. */
export function ageLabel(ageDays: number): string {
  return ageDays <= 0 ? "aujourd'hui" : `${ageDays} j`
}
