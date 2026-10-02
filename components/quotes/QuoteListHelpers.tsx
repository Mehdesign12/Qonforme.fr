/**
 * Calculs et formats partagés par la liste et la fiche des devis, réelles et
 * démo (règle « Mode démo » de CLAUDE.md : mêmes briques, même rendu).
 *
 * Tout ce qui s'affiche ici se déduit des données réelles d'un devis : statut
 * (draft, sent, accepted, rejected), dates, lignes, facture de conversion.
 * Pas de « vu par le client » ni de signature en ligne : ces fonctions ne
 * sont pas livrées. « Expiré » n'est pas un statut, seulement un rappel tiré
 * de la date de validité d'un devis envoyé.
 */

export type QuoteStatus = "draft" | "sent" | "accepted" | "rejected"

const MS_DAY = 86_400_000

const MONTHS_SHORT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."]
const MONTHS_LONG = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"]

const pad = (n: number) => String(n).padStart(2, "0")

/** « AAAA-MM-JJ » → date locale à minuit (pas de décalage UTC sur les dates sans heure). */
export function parseDay(d: string): Date {
  const [y, m, dd] = d.slice(0, 10).split("-").map(Number)
  return new Date(y, (m || 1) - 1, dd || 1)
}

/** Date du jour au format « AAAA-MM-JJ », dans le fuseau du navigateur. */
export function todayISO(): string {
  const n = new Date()
  return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`
}

/** Décale une date « AAAA-MM-JJ » de `days` jours. */
export function addDays(d: string, days: number): string {
  const x = parseDay(d)
  x.setDate(x.getDate() + days)
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`
}

/** Nombre de jours de `from` à `to` (négatif si `to` est passé). */
export function daysBetween(from: string, to: string): number {
  return Math.round((parseDay(to).getTime() - parseDay(from).getTime()) / MS_DAY)
}

const dayLabel = (n: number) => (n === 1 ? "1er" : String(n))

/** « 29 sept. », « 1er oct. » — formats écrits à la main : identiques côté serveur et navigateur. */
export function shortDate(d: string): string {
  const x = parseDay(d)
  return `${dayLabel(x.getDate())} ${MONTHS_SHORT[x.getMonth()]}`
}

/** « 28 septembre 2026 » (ou « 28 septembre » sans l'année). */
export function longDate(d: string, withYear = true): string {
  const x = parseDay(d)
  return `${dayLabel(x.getDate())} ${MONTHS_LONG[x.getMonth()]}${withYear ? ` ${x.getFullYear()}` : ""}`
}

function parisParts(iso: string) {
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(iso))
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ""
  return { day: `${get("year")}-${get("month")}-${get("day")}`, year: get("year"), time: `${get("hour")}:${get("minute")}` }
}

/** Jour (AAAA-MM-JJ, heure de Paris) d'un horodatage. */
export function parisDay(iso: string): string {
  return parisParts(iso).day
}

/** Horodatage (created_at, sent_at) en heure de Paris : « 28 sept. 2026, 09:12 ». */
export function dateTime(iso: string): string {
  const p = parisParts(iso)
  return `${shortDate(p.day)} ${p.year}, ${p.time}`
}

/** « 5,5 » pour un taux de TVA. */
export function fmtRate(rate: number): string {
  return String(rate).replace(".", ",")
}

/** Montant sans symbole, deux décimales (aperçu papier) : « 3 960,00 ». */
export function fmtAmount(n: number): string {
  return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

/** Quantité : « 85 », « 1,5 ». */
export function fmtQty(n: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 3 }).format(n)
}

/** Unité accordée : « 4 jours », « 2 forfaits » (les symboles m², ml, h restent tels quels). */
export function fmtUnit(quantity: number, unit: string | null | undefined): string {
  if (!unit) return ""
  return /^[a-zà-ÿ]{3,}$/i.test(unit) && quantity >= 2 && !unit.endsWith("s") ? `${unit}s` : unit
}

/** « 2 devis », « 3 prestations »… */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n > 1 ? many : one}`
}

/* ------------------------------------------------------------------ */
/* Objet du devis                                                      */
/* ------------------------------------------------------------------ */

type SubjectSource = { subject?: string | null; lines?: { description?: string | null }[] | null }

/**
 * Objet affiché à côté du client. Un devis réel n'a pas de champ « objet » :
 * on reprend la première prestation (et le nombre d'autres lignes).
 */
export function quoteSubject(q: SubjectSource, withCount = true): string {
  if (q.subject) return q.subject
  const lines = (q.lines ?? []).filter((l) => l.description?.trim())
  if (lines.length === 0) return "Devis sans prestation"
  const first = lines[0].description!.trim()
  if (!withCount || lines.length === 1) return first
  return `${first}, et ${plural(lines.length - 1, "autre ligne", "autres lignes")}`
}

/** Titre « Client · objet » : l'objet prend une minuscule après le point médian (« isolation des combles »). */
export function quoteTitle(clientName: string | null | undefined, q: SubjectSource): string {
  let subject = quoteSubject(q, false)
  if (clientName && /^[A-ZÀ-Ý][a-zà-ÿ]/.test(subject)) subject = subject[0].toLowerCase() + subject.slice(1)
  return clientName ? `${clientName} · ${subject}` : subject
}

/** SIREN « 948 211 375 », SIRET « 948 211 375 00012 » (espaces insécables). */
export function fmtSiren(v: string): string {
  const d = v.replace(/\s/g, "")
  if (/^\d{9}$/.test(d)) return `${d.slice(0, 3)}\u00a0${d.slice(3, 6)}\u00a0${d.slice(6)}`
  if (/^\d{14}$/.test(d)) return `${d.slice(0, 3)}\u00a0${d.slice(3, 6)}\u00a0${d.slice(6, 9)}\u00a0${d.slice(9)}`
  return v
}

/* ------------------------------------------------------------------ */
/* Validité et suite à donner                                          */
/* ------------------------------------------------------------------ */

/** Jours restants avant la fin de validité d'un devis envoyé (null pour les autres statuts). */
export function daysLeft(q: { status: QuoteStatus; valid_until: string }, today: string): number | null {
  if (q.status !== "sent" || !q.valid_until) return null
  return daysBetween(today, q.valid_until)
}

export function isExpired(q: { status: QuoteStatus; valid_until: string }, today: string): boolean {
  const d = daysLeft(q, today)
  return d !== null && d < 0
}

/** Rappel d'échéance : « Expire dans 3 jours », « Expiré le 4 oct. ». Null s'il reste plus de 7 jours. */
export function expiryHint(q: { status: QuoteStatus; valid_until: string }, today: string): string | null {
  const d = daysLeft(q, today)
  if (d === null || d > 7) return null
  if (d < 0) return `Expiré le ${shortDate(q.valid_until)}`
  if (d === 0) return "Expire aujourd'hui"
  if (d === 1) return "Expire demain"
  return `Expire dans ${d} jours`
}

export interface QuoteNextStep {
  text: string
  tone: "default" | "warn"
}

/** Colonne « Suite » de la liste : la prochaine étape, calculée. */
export function quoteNextStep(
  q: { status: QuoteStatus; valid_until: string; converted: boolean; converted_invoice_number?: string | null },
  today: string,
): QuoteNextStep {
  switch (q.status) {
    case "draft":
      return { text: "Terminer et envoyer", tone: "default" }
    case "sent": {
      const hint = expiryHint(q, today)
      return hint ? { text: hint, tone: "warn" } : { text: "En attente de réponse", tone: "default" }
    }
    case "accepted":
      if (q.converted) return { text: q.converted_invoice_number ? `Facturé ${q.converted_invoice_number}` : "Facturé", tone: "default" }
      return { text: "À facturer", tone: "default" }
    case "rejected":
      return { text: "Sans suite", tone: "default" }
  }
}

/** Taux de TVA présents sur les lignes : « TVA 10 % », « TVA 10 % et 20 % ». */
export function vatRatesLabel(lines: { vat_rate: number }[]): string {
  const rates = Array.from(new Set(lines.map((l) => Number(l.vat_rate)))).sort((a, b) => a - b)
  if (rates.length === 0) return "TVA"
  if (rates.length > 2) return "plusieurs taux de TVA"
  return `TVA ${rates.map((r) => `${fmtRate(r)} %`).join(" et ")}`
}

/** TVA par taux (aperçu papier et récapitulatif mobile). */
export function vatBreakdown(lines: { vat_rate: number; total_ht: number; total_vat?: number | null }[]): { rate: number; amount: number }[] {
  const map = new Map<number, number>()
  for (const l of lines) {
    const rate = Number(l.vat_rate)
    const amount = l.total_vat ?? (Number(l.total_ht) * rate) / 100
    map.set(rate, (map.get(rate) ?? 0) + amount)
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([rate, amount]) => ({ rate, amount: Math.round(amount * 100) / 100 }))
}

/** Recherche sans accents ni casse. */
export function normalizeSearch(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()
}
