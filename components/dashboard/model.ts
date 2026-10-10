/**
 * Tableau de bord — calculs purs, partagés par la page réelle (données Supabase,
 * voir data.ts) et par la démo (lib/demo/data.ts, voir demo-data.ts) : les deux
 * passent par buildDashboardView(), donc affichent les mêmes indicateurs,
 * calculés de la même façon (règle « Mode démo » de CLAUDE.md).
 *
 * Ne montre que des chiffres vrais : « Facturé » (factures émises, par date
 * d'émission) ; « encaissé » seulement pour les paiements datés (`paid_at`,
 * écrit depuis le 10/10/2026 quand l'artisan marque une facture payée,
 * lib/utils/payment-date.ts) — une facture payée sans date n'est comptée dans
 * aucune période ; « À échoir sous 30 jours » est la somme des factures en
 * cours dont l'échéance tombe dans les 30 jours (la prévision est à /tresorerie).
 */
import { canRemindInvoice } from "@/lib/utils/document-status"
import { invoiceNumberLabel } from "@/lib/utils/document-numbering"
import { parisDayOf as parisDay } from "@/lib/utils/paris-date"
import {
  inscriptionSteps, pendingInscriptionStep, type InscriptionState, type InscriptionStep,
} from "@/lib/onboarding/inscription"

export type DashMode = "app" | "demo"

/** Période du premier indicateur (contrôle segmenté « Ce mois / Trimestre / Année », paramètre `?periode=`). */
export type DashPeriod = "mois" | "trimestre" | "annee"
export const DASH_PERIODS: { key: DashPeriod; label: string; noun: string }[] = [
  { key: "mois", label: "Ce mois", noun: "mois" },
  { key: "trimestre", label: "Trimestre", noun: "trimestre" },
  { key: "annee", label: "Année", noun: "année" },
]
export function parsePeriod(value: unknown): DashPeriod {
  return value === "trimestre" || value === "annee" ? value : "mois"
}

/** Factures émises et non réglées. `overdue` est posé par chaque relance : il en fait partie. */
export const OPEN_INVOICE_STATUSES = ["sent", "pending", "received", "accepted", "overdue"] as const
/** Factures émises comptées dans « Facturé » (ni brouillon, ni annulée, ni rejetée, ni annulée par avoir). */
export const ISSUED_INVOICE_STATUSES = [...OPEN_INVOICE_STATUSES, "paid"] as const

/* ------------------------------------------------------------------ */
/* Entrées                                                             */
/* ------------------------------------------------------------------ */

export interface DashInvoice {
  id: string
  /** Vide pour un brouillon (numéro attribué à l'émission). */
  invoice_number: string | null
  status: string
  issue_date: string
  due_date: string | null
  total_ttc: number
  client_name: string | null
  client_city: string | null
  client_email: string | null
  reminder_1_sent_at?: string | null
  reminder_2_sent_at?: string | null
  /** Retenue de garantie (formule Artisan) : due seulement à sa libération, hors des montants à encaisser. */
  retention_amount?: number
}

export interface DashQuote {
  id: string
  quote_number: string
  status: string
  valid_until: string | null
  total_ttc: number
  client_name: string | null
}

export interface DashboardInput {
  mode: DashMode
  period?: DashPeriod
  /** Aujourd'hui, AAAA-MM-JJ, heure de Paris. */
  today: string
  firstName: string
  company: {
    name: string | null
    siren: string | null
    address: string | null
    zip_code: string | null
    city: string | null
  } | null
  /** Nombre total de factures et de devis (null si la lecture a échoué). */
  counts: { invoices: number | null; quotes: number | null }
  /** Factures émises depuis le 1er du mois M-6 ou le 1er janvier si plus tôt (graphique, premier indicateur, voir issuedSince). */
  issued: { issue_date: string; total_ttc: number }[]
  /** Démo : historique mensuel fourni pour les mois passés (le mois en cours reste calculé). */
  monthlyHistory?: { month: string; value: number; count?: number }[]
  open: DashInvoice[]
  /** `paid_at` : date du paiement saisie (absente pour les paiements marqués avant le 10/10/2026). */
  paid: { total_ttc: number; client_id: string | null; client_name: string | null; paid_at?: string | null }[]
  drafts: DashInvoice[]
  /** Cinq dernières factures créées. */
  recent: DashInvoice[]
  /** Devis envoyés ou acceptés, pas encore convertis en facture. */
  quotes: DashQuote[]
  /** Clients actifs sans SIREN (null si inconnu). */
  clientsWithoutSiren: number | null
  /** Inscription à terminer : tuile « Terminer votre inscription » d'un compte neuf. */
  inscription?: DashInscription | null
}

/* ------------------------------------------------------------------ */
/* Sortie                                                              */
/* ------------------------------------------------------------------ */

export interface ChartMonth {
  key: string
  short: string
  long: string
  value: number
  count: number | null
  /** Mois en cours, encore incomplet. */
  current: boolean
  /** Dernier mois complet : mis en avant, montant affiché. */
  highlight: boolean
}

export interface RecentRow {
  id: string
  href: string
  number: string
  clientName: string | null
  clientCity: string | null
  dueDate: string | null
  total: number
  status: string
  /** Jours de retard (facture en cours dont l'échéance est passée), sinon null. */
  lateDays: number | null
}

export type TodoTone = "warn" | "info" | "neutral"
export type TodoIcon = "clock" | "quote-check" | "quote-clock" | "draft" | "list"

export interface TodoItem {
  key: string
  tone: TodoTone
  icon: TodoIcon
  title: string
  meta: string
  /** Page qui permet de traiter la tâche (ligne entière sur mobile). */
  href: string
  action:
    | { kind: "remind"; invoiceId: string; invoiceNumber: string; clientName: string }
    | { kind: "link"; label: string }
}

export interface DashboardView {
  mode: DashMode
  period: DashPeriod
  today: string
  dateLong: string
  dateShort: string
  firstName: string
  companyName: string | null
  isNewAccount: boolean
  kpi: {
    month: { amount: number; count: number; prevAmount: number; prevMonthName: string; deltaPct: number | null }
    /** Premier indicateur selon la période choisie (« Facturé ce mois | ce trimestre | cette année »). */
    period: { label: string; amount: number; count: number; prevAmount: number; prevLabel: string | null; deltaPct: number | null }
    open: { amount: number; count: number }
    /** Encaissé sur la période choisie, d'après les dates de paiement saisies ; null sans aucune date. */
    collected: { amount: number; count: number; label: string } | null
    late: { amount: number; count: number; oldestDays: number }
    dueSoon: { amount: number; count: number; untilLabel: string }
    quotesPending: number
  }
  /** Part du montant émis déjà réglée (payé / (payé + en cours)), null sans données. */
  recoveryRate: number | null
  chart: ChartMonth[]
  recent: RecentRow[]
  todos: TodoItem[]
  topClients: { key: string; name: string; total: number; href: string | null }[]
  reform: { sirenOk: boolean; addressOk: boolean; clientsWithoutSiren: number | null }
  /** Tuile « Relancer » (mobile) : la facture en retard, la liste filtrée ou la liste. */
  remindHref: string
  /** Inscription à terminer (fenêtre « Bienvenue » passée), sinon null. */
  inscription: DashInscription | null
}

/* ------------------------------------------------------------------ */
/* Inscription en deux champs : fenêtre « Bienvenue » et tuile          */
/* ------------------------------------------------------------------ */

/** Étape restante de l'inscription, pour la tuile « Terminer votre inscription ». */
export interface DashInscription {
  step: InscriptionStep
  /** Numéro de l'étape restante (à partir de 1) et nombre d'étapes affichées. */
  number: number
  total: number
}

/** Ce que la page sait du compte pour décider d'ouvrir la fenêtre « Bienvenue ». */
export interface InscriptionFacts extends InscriptionState {
  /** Compte créé par l'inscription en deux champs (`user_metadata.signup_wizard`). */
  wizard: boolean
  /** Fenêtre fermée par « Passer au tableau de bord » (`user_metadata.signup_window_closed`). */
  windowClosed: boolean
  /** Réouverture demandée par la tuile (`?inscription=reprendre`). */
  resume: boolean
}

/**
 * Étape restante qui concerne le tableau de bord : toujours pour un compte sans
 * entreprise ; pour un compte de l'inscription en deux champs, l'étape métier
 * ou prénom qui manque. Un compte plus ancien n'est jamais relancé ici.
 */
export function inscriptionTile(f: InscriptionFacts): DashInscription | null {
  const step = pendingInscriptionStep(f)
  if (!step || (f.company && !f.wizard)) return null
  const steps = inscriptionSteps(f.profileAvailable)
  return { step, number: Math.max(1, steps.indexOf(step) + 1), total: steps.length }
}

/**
 * Ouverture de la fenêtre : étape restante, compte sans document (ou sans
 * entreprise), et fenêtre jamais fermée, sauf réouverture par la tuile.
 * `isNewAccount` : ni devis ni facture (faux si la lecture a échoué).
 */
export function inscriptionWindowOpen(f: InscriptionFacts, isNewAccount: boolean): boolean {
  if (!inscriptionTile(f)) return false
  if (f.company && !isNewAccount) return false
  return f.resume || !f.windowClosed
}

/* ------------------------------------------------------------------ */
/* Dates (chaînes AAAA-MM-JJ, calculées en UTC pour éviter les décalages) */
/* ------------------------------------------------------------------ */

const WEEKDAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"]
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"]
const MONTHS_SHORT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."]

/** Aujourd'hui à Paris (AAAA-MM-JJ), heure d'été comprise. */
export function todayInParis(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now)
}

function parts(iso: string): [number, number, number] {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number)
  return [y, m, d]
}

function utc(iso: string): number {
  const [y, m, d] = parts(iso)
  return Date.UTC(y, m - 1, d)
}

function isoOf(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

/** Nombre de jours de `from` à `to` (positif si `to` est après). */
export function daysBetween(from: string, to: string): number {
  return Math.round((utc(to) - utc(from)) / 86_400_000)
}

export function addDays(iso: string, days: number): string {
  return isoOf(utc(iso) + days * 86_400_000)
}

/** Clé AAAA-MM du mois décalé de `delta` mois. */
export function monthKey(iso: string, delta = 0): string {
  const [y, m] = parts(iso)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return d.toISOString().slice(0, 7)
}

/** Première date d'émission à lire : le 1er du mois M-6 (graphique) ou le 1er janvier si plus tôt (indicateur « Année »). */
export function issuedSince(today: string): string {
  const sixMonths = `${monthKey(today, -6)}-01`
  const january = `${today.slice(0, 4)}-01-01`
  return january < sixMonths ? january : sixMonths
}

/** « Jeudi 1er octobre 2026 » (ou sans l'année). */
export function formatLongDate(iso: string, withYear = true): string {
  const [y, m, d] = parts(iso)
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  const day = d === 1 ? "1er" : String(d)
  const text = `${weekday} ${day} ${MONTHS[m - 1]}${withYear ? ` ${y}` : ""}`
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** « 12 oct. » */
export function formatShortDate(iso: string): string {
  const [, m, d] = parts(iso)
  return `${d === 1 ? "1er" : d}\u00a0${MONTHS_SHORT[m - 1]}`
}

function monthLabels(key: string): { short: string; long: string; name: string } {
  const [y, m] = key.split("-").map(Number)
  const name = MONTHS[m - 1]
  const short = m === 5 || m === 6 || m === 8 ? name : MONTHS_SHORT[m - 1]
  return {
    short: short.charAt(0).toUpperCase() + short.slice(1),
    long: `${name.charAt(0).toUpperCase() + name.slice(1)} ${y}`,
    name,
  }
}

/* ------------------------------------------------------------------ */
/* Nombres                                                             */
/* ------------------------------------------------------------------ */

const sum = (list: { total_ttc: number }[]) =>
  Math.round(list.reduce((s, x) => s + (Number(x.total_ttc) || 0), 0) * 100) / 100

/** Montant exigible d'une facture ouverte : TTC moins la retenue de garantie, due seulement à sa libération. */
const dueOf = (inv: { total_ttc: number; retention_amount?: number }) =>
  Math.max(0, Math.round(((Number(inv.total_ttc) || 0) - (Number(inv.retention_amount) || 0)) * 100) / 100)
const sumDue = (list: { total_ttc: number; retention_amount?: number }[]) =>
  Math.round(list.reduce((s, x) => s + dueOf(x), 0) * 100) / 100

/** « 14,3 k€ », « 850 € » (axes et étiquettes du graphique). */
export function formatCompactEuro(value: number): string {
  if (value === 0) return "0"
  if (Math.abs(value) >= 1000) {
    const k = value / 1000
    return `${k.toLocaleString("fr-FR", { maximumFractionDigits: Number.isInteger(k) ? 0 : 1 })}\u00a0k€`
  }
  return `${Math.round(value).toLocaleString("fr-FR")}\u00a0€`
}

/** Graduation « ronde » de l'axe : 4 intervalles égaux couvrant le maximum. */
export function niceScale(max: number): { top: number; ticks: number[] } {
  if (max <= 0) return { top: 4000, ticks: [4000, 3000, 2000, 1000, 0] }
  const raw = max / 4
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const residual = raw / magnitude
  const nice = residual <= 1 ? 1 : residual <= 2 ? 2 : residual <= 2.5 ? 2.5 : residual <= 5 ? 5 : 10
  const step = nice * magnitude
  return { top: step * 4, ticks: [4, 3, 2, 1, 0].map((i) => step * i) }
}

export const plural = (n: number, one: string, many: string) => (n > 1 ? many : one)

/* ------------------------------------------------------------------ */
/* Liens (réel ou démo)                                                */
/* ------------------------------------------------------------------ */

/** Chemin réel → chemin de la démo (la démo n'a pas de page de modification : on ouvre la fiche). */
export function demoPath(path: string): string {
  if (path === "/dashboard") return "/demo"
  const edit = path.match(/^\/(invoices|quotes)\/([^/?]+)\/edit$/)
  if (edit) return `/demo/${edit[1]}/${edit[2]}`
  return "/demo" + path
}

export function hrefFor(mode: DashMode, path: string): string {
  return mode === "demo" ? demoPath(path) : path
}

/* ------------------------------------------------------------------ */
/* Construction de la vue                                              */
/* ------------------------------------------------------------------ */

const isOpen = (status: string) => (OPEN_INVOICE_STATUSES as readonly string[]).includes(status)

export function buildDashboardView(input: DashboardInput): DashboardView {
  const { today, mode } = input
  const href = (path: string) => hrefFor(mode, path)
  const fmt = (n: number) =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(n)

  /* ── Totaux mensuels facturés (historique fourni par la démo pour les mois passés) ── */
  const currentKey = monthKey(today)
  const prevKey = monthKey(today, -1)
  const monthTotal = (key: string): { value: number; count: number | null } => {
    const history = key === currentKey ? undefined : input.monthlyHistory?.find((h) => h.month === key)
    if (history) return { value: history.value, count: history.count ?? null }
    const ofMonth = input.issued.filter((inv) => inv.issue_date?.startsWith(key))
    return { value: sum(ofMonth), count: ofMonth.length }
  }
  const totalOf = (keys: string[]) =>
    keys.reduce(
      (acc, k) => {
        const t = monthTotal(k)
        return { value: Math.round((acc.value + t.value) * 100) / 100, count: acc.count + (t.count ?? 0) }
      },
      { value: 0, count: 0 },
    )

  /* ── Graphique : 6 mois complets + le mois en cours ── */
  const chart: ChartMonth[] = Array.from({ length: 7 }, (_, i) => {
    const key = monthKey(today, i - 6)
    const labels = monthLabels(key)
    const total = monthTotal(key)
    return {
      key,
      short: labels.short,
      long: labels.long,
      value: total.value,
      count: total.count,
      current: key === currentKey,
      highlight: key === prevKey,
    }
  })
  const monthNow = chart[6]
  const monthPrev = chart[5]
  const pct = (now: number, prev: number) => (now > 0 && prev > 0 ? Math.round(((now - prev) / prev) * 100) : null)
  const deltaPct = pct(monthNow.value, monthPrev.value)

  /* ── Premier indicateur selon la période (trimestre civil, année civile) ── */
  const period = input.period ?? "mois"
  const monthIndex = Number(today.slice(5, 7)) - 1
  const monthsBack = (from: number, n: number) => Array.from({ length: n }, (_, i) => monthKey(today, from - i))
  let periodKpi: DashboardView["kpi"]["period"]
  if (period === "trimestre") {
    const inQuarter = monthIndex % 3
    const now = totalOf(monthsBack(0, inQuarter + 1))
    const prev = totalOf(monthsBack(-inQuarter - 1, 3))
    periodKpi = { label: "Facturé ce trimestre", amount: now.value, count: now.count, prevAmount: prev.value, prevLabel: "le trimestre précédent", deltaPct: pct(now.value, prev.value) }
  } else if (period === "annee") {
    const now = totalOf(monthsBack(0, monthIndex + 1))
    // Pas de comparaison à l'année précédente : ses factures ne sont pas lues
    periodKpi = { label: "Facturé cette année", amount: now.value, count: now.count, prevAmount: 0, prevLabel: null, deltaPct: null }
  } else {
    periodKpi = {
      label: "Facturé ce mois", amount: monthNow.value, count: monthNow.count ?? 0,
      prevAmount: monthPrev.value, prevLabel: monthLabels(prevKey).name, deltaPct,
    }
  }

  /* ── Factures en cours, en retard, à échoir ── */
  const open = input.open.filter((i) => isOpen(i.status))
  const lateDaysOf = (inv: DashInvoice) =>
    inv.due_date && inv.due_date < today ? daysBetween(inv.due_date, today) : null
  const late = open
    .filter((i) => lateDaysOf(i) !== null)
    .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""))
  const limit30 = addDays(today, 30)
  const dueSoon = open.filter(
    (i) => !late.includes(i) && i.due_date && i.due_date >= today && i.due_date <= limit30,
  )
  const oldestDays = late.reduce((max, i) => Math.max(max, lateDaysOf(i) ?? 0), 0)

  /* ── Encaissé sur la période : paiements datés seulement (heure de Paris) ── */
  const periodStart = period === "annee"
    ? `${today.slice(0, 4)}-01-01`
    : period === "trimestre"
      ? `${today.slice(0, 4)}-${String(monthIndex - (monthIndex % 3) + 1).padStart(2, "0")}-01`
      : `${today.slice(0, 7)}-01`
  const dated = input.paid.filter((p) => p.paid_at)
  const inPeriod = dated.filter((p) => {
    const day = parisDay(p.paid_at!)
    return day >= periodStart && day <= today
  })
  const collected = dated.length === 0
    ? null
    : {
        amount: sum(inPeriod),
        count: inPeriod.length,
        label: period === "annee" ? "cette année" : period === "trimestre" ? "ce trimestre" : "ce mois",
      }

  /* ── Recouvrement : part réglée du montant émis (payé + en cours) ── */
  const paidTotal = sum(input.paid)
  const openTotal = sumDue(open)
  const recoveryRate = paidTotal + openTotal > 0 ? Math.round((paidTotal / (paidTotal + openTotal)) * 100) : null

  /* ── À faire, à partir des seules données réelles ── */
  const todos: TodoItem[] = []
  for (const inv of late.slice(0, 3)) {
    const days = lateDaysOf(inv)
    const client = inv.client_name ?? "le client"
    const canRemind =
      mode === "demo" ||
      (canRemindInvoice(inv.status) && !!inv.client_email && !inv.reminder_2_sent_at)
    todos.push({
      key: `late-${inv.id}`,
      tone: "warn",
      icon: "clock",
      title: `Relancer ${client}`,
      meta: `${fmt(dueOf(inv))} · échue depuis ${days}\u00a0j`,
      href: href(`/invoices/${inv.id}`),
      action: canRemind
        ? { kind: "remind", invoiceId: inv.id, invoiceNumber: invoiceNumberLabel(inv.invoice_number), clientName: client }
        : { kind: "link", label: "Ouvrir" },
    })
  }
  if (late.length > 3) {
    const rest = late.length - 3
    todos.push({
      key: "late-more",
      tone: "warn",
      icon: "list",
      title: `${rest} autre${rest > 1 ? "s" : ""} facture${rest > 1 ? "s" : ""} en retard`,
      meta: fmt(sumDue(late.slice(3))),
      href: href("/invoices?filtre=retard"),
      action: { kind: "link", label: "Voir" },
    })
  }

  const toInvoice = input.quotes.filter((q) => q.status === "accepted")
  if (toInvoice.length === 1) {
    const q = toInvoice[0]
    todos.push({
      key: `quote-accepted-${q.id}`,
      tone: "info",
      icon: "quote-check",
      title: `Facturer le devis ${q.quote_number}`,
      meta: `${q.client_name ?? "Client"} · ${fmt(q.total_ttc)}`,
      href: href(`/quotes/${q.id}`),
      action: { kind: "link", label: "Ouvrir" },
    })
  } else if (toInvoice.length > 1) {
    todos.push({
      key: "quotes-accepted",
      tone: "info",
      icon: "quote-check",
      title: `${toInvoice.length} devis acceptés à facturer`,
      meta: fmt(sum(toInvoice)),
      href: href("/quotes"),
      action: { kind: "link", label: "Voir" },
    })
  }

  const limit7 = addDays(today, 7)
  const expiring = input.quotes
    .filter((q) => q.status === "sent" && q.valid_until && q.valid_until >= today && q.valid_until <= limit7)
    .sort((a, b) => (a.valid_until ?? "").localeCompare(b.valid_until ?? ""))
  for (const q of expiring.slice(0, 2)) {
    const days = daysBetween(today, q.valid_until as string)
    const when = days === 0 ? "aujourd'hui" : days === 1 ? "demain" : `dans ${days}\u00a0jours`
    todos.push({
      key: `quote-expiring-${q.id}`,
      tone: "neutral",
      icon: "quote-clock",
      title: `Devis ${q.quote_number} expire`,
      meta: `${q.client_name ?? "Client"} · ${when}`,
      href: href(`/quotes/${q.id}`),
      action: { kind: "link", label: "Ouvrir" },
    })
  }

  if (input.drafts.length === 1) {
    const d = input.drafts[0]
    todos.push({
      key: `draft-${d.id}`,
      tone: "neutral",
      icon: "draft",
      title: d.invoice_number ? `Facture ${d.invoice_number} en brouillon` : "Facture en brouillon",
      meta: `${d.client_name ?? "Client"} · ${fmt(d.total_ttc)}`,
      href: href(`/invoices/${d.id}/edit`),
      action: { kind: "link", label: "Finaliser" },
    })
  } else if (input.drafts.length > 1) {
    todos.push({
      key: "drafts",
      tone: "neutral",
      icon: "draft",
      title: `${input.drafts.length} factures en brouillon`,
      meta: `À vérifier puis envoyer · ${fmt(sum(input.drafts))}`,
      href: href("/invoices?filtre=brouillons"),
      action: { kind: "link", label: "Voir" },
    })
  }

  /* ── Meilleurs clients (montant payé) ── */
  const byClient = new Map<string, { key: string; name: string; total: number; clientId: string | null }>()
  for (const inv of input.paid) {
    const key = inv.client_id ?? inv.client_name ?? "?"
    const entry = byClient.get(key)
    if (entry) entry.total += Number(inv.total_ttc) || 0
    else byClient.set(key, { key, name: inv.client_name ?? "Client inconnu", total: Number(inv.total_ttc) || 0, clientId: inv.client_id })
  }
  const topClients = Array.from(byClient.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)
    .map((c) => ({ key: c.key, name: c.name, total: c.total, href: c.clientId ? href(`/clients/${c.clientId}`) : null }))

  /* ── Tuile « Relancer » (mobile) ── */
  const remindHref = late.length === 1 ? href(`/invoices/${late[0].id}`) : href("/invoices?filtre=retard")

  const company = input.company
  const isNewAccount = input.counts.invoices === 0 && input.counts.quotes === 0

  return {
    mode,
    period,
    today,
    dateLong: formatLongDate(today),
    dateShort: formatLongDate(today, false),
    firstName: input.firstName.trim(),
    companyName: company?.name?.trim() || null,
    isNewAccount,
    kpi: {
      month: {
        amount: monthNow.value,
        count: monthNow.count ?? 0,
        prevAmount: monthPrev.value,
        prevMonthName: monthLabels(prevKey).name,
        deltaPct,
      },
      period: periodKpi,
      open: { amount: openTotal, count: open.length },
      collected,
      late: { amount: sumDue(late), count: late.length, oldestDays },
      dueSoon: { amount: sumDue(dueSoon), count: dueSoon.length, untilLabel: formatShortDate(limit30) },
      quotesPending: input.quotes.filter((q) => q.status === "sent").length,
    },
    recoveryRate,
    chart,
    recent: input.recent.map((inv) => ({
      id: inv.id,
      href: href(`/invoices/${inv.id}`),
      number: invoiceNumberLabel(inv.invoice_number),
      clientName: inv.client_name,
      clientCity: inv.client_city,
      dueDate: inv.due_date,
      total: Number(inv.total_ttc) || 0,
      status: inv.status,
      lateDays: isOpen(inv.status) ? lateDaysOf(inv) : null,
    })),
    todos,
    topClients,
    reform: {
      sirenOk: /^\d{9}$/.test((company?.siren ?? "").replace(/\s/g, "")),
      addressOk: !!(company?.address?.trim() && company?.zip_code?.trim() && company?.city?.trim()),
      clientsWithoutSiren: input.clientsWithoutSiren,
    },
    remindHref,
    inscription: input.inscription ?? null,
  }
}
