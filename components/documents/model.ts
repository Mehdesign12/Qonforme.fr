/**
 * Modèle commun aux éditeurs de documents (facture, devis, bon de commande),
 * réels et démo : types, calculs, validation et contrôles avant envoi.
 *
 * Aucune logique d'API ici : chaque formulaire garde ses propres appels
 * (création, modification, envoi, mur de paiement) et ne délègue que l'état
 * et le rendu. Les trois documents partagent ainsi le même écran.
 */
import { calculateLineTotals, calculateInvoiceTotals, formatCurrency } from "@/lib/utils/invoice"
import type { ProductSuggestion } from "@/components/products/ProductCombobox"

export type DocKind = "invoice" | "quote" | "purchase_order"
export type VatRate = 0 | 5.5 | 10 | 20

export interface DocLine {
  id: string
  description: string
  quantity: string
  unit_price_ht: string
  vat_rate: VatRate
}

/** État du formulaire. Chaque document n'utilise que ses propres dates. */
export interface DocForm {
  client_id: string
  issue_date: string
  /** Facture : échéance. */
  due_date: string
  /** Devis : date de validité. */
  valid_until: string
  /** Bon de commande : livraison souhaitée (facultative). */
  delivery_date: string
  /** Bon de commande : référence fournie par le client (facultative). */
  reference: string
  notes: string
  lines: DocLine[]
}

/** Client tel que renvoyé par GET /api/clients (champs utiles à l'écran). */
export interface DocClient {
  id: string
  name: string
  siren?: string | null
  email?: string | null
  address?: string | null
  zip_code?: string | null
  city?: string | null
}

/** Entreprise de l'utilisateur (GET /api/company), pour l'aperçu et les contrôles. */
export interface DocCompany {
  name?: string | null
  siren?: string | null
  vat_number?: string | null
  address?: string | null
  zip_code?: string | null
  city?: string | null
  iban?: string | null
  legal_notice?: string | null
  logo_url?: string | null
}

export interface ComputedLine {
  totalHT: number
  totalVAT: number
  totalTTC: number
}

export interface DocTotals {
  subtotal_ht: number
  total_vat: number
  total_ttc: number
}

/* ------------------------------------------------------------------ */
/* Libellés par type de document                                       */
/* ------------------------------------------------------------------ */

export const DOC_TEXT: Record<DocKind, {
  /** « la facture », « le devis »… */
  the: string
  /** Titre imprimé sur l'aperçu. */
  paperTitle: string
  newTitle: string
  sendLabel: string
  checklistTitle: string
  secondDateLabel: string
  notesPlaceholder: string
}> = {
  invoice: {
    the: "la facture",
    paperTitle: "Facture",
    newTitle: "Nouvelle facture",
    sendLabel: "Envoyer la facture",
    checklistTitle: "Prête à l'envoi",
    secondDateLabel: "Échéance",
    notesPlaceholder: "Paiement par virement bancaire sous 30 jours. Pénalités de retard : 3 fois le taux légal.",
  },
  quote: {
    the: "le devis",
    paperTitle: "Devis",
    newTitle: "Nouveau devis",
    sendLabel: "Envoyer le devis",
    checklistTitle: "Avant l'envoi",
    secondDateLabel: "Valable jusqu'au",
    notesPlaceholder: "Devis valable 30 jours. Acompte de 30 % à la commande.",
  },
  purchase_order: {
    the: "le bon de commande",
    paperTitle: "Bon de commande",
    newTitle: "Nouveau bon de commande",
    sendLabel: "Envoyer le bon de commande",
    checklistTitle: "Avant l'envoi",
    secondDateLabel: "Livraison souhaitée",
    notesPlaceholder: "Conditions de livraison, modalités de paiement, remarques particulières…",
  },
}

/* ------------------------------------------------------------------ */
/* Dates                                                               */
/* ------------------------------------------------------------------ */

/**
 * Date du jour décalée de `days` jours, au format AAAA-MM-JJ. Appelée au
 * montage du formulaire (jamais au chargement du module) pour ne pas rester
 * figée sur la veille dans un onglet ouvert à cheval sur minuit.
 */
export function isoDateIn(days = 0): string {
  return new Date(Date.now() + days * 86400000).toISOString().split("T")[0]
}

function parseIso(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

/** « 1er oct. 2026 », « 12 oct. 2026 ». */
export function formatDayFr(iso: string): string {
  const d = parseIso(iso)
  if (!d) return ""
  const month = new Intl.DateTimeFormat("fr-FR", { month: "short" }).format(d)
  const day = d.getDate() === 1 ? "1er" : String(d.getDate())
  return `${day} ${month} ${d.getFullYear()}`
}

/** Nombre de jours entre deux dates AAAA-MM-JJ (null si l'une manque). */
export function daysBetween(from: string, to: string): number | null {
  const a = parseIso(from)
  const b = parseIso(to)
  if (!a || !b) return null
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

/* ------------------------------------------------------------------ */
/* Lignes et totaux                                                    */
/* ------------------------------------------------------------------ */

export function newLine(): DocLine {
  return { id: crypto.randomUUID(), description: "", quantity: "1", unit_price_ht: "", vat_rate: 20 }
}

/** Ligne issue du catalogue : même libellé que l'ancien formulaire (nom — description). */
export function lineFromProduct(product: ProductSuggestion): DocLine {
  return {
    id: crypto.randomUUID(),
    description: product.name + (product.description ? ` — ${product.description}` : ""),
    quantity: "1",
    unit_price_ht: String(product.unit_price_ht),
    vat_rate: product.vat_rate as VatRate,
  }
}

/** Ligne enregistrée (API) → ligne éditable. */
export function lineFromSaved(l: { description: string; quantity: number; unit_price_ht: number; vat_rate: number }): DocLine {
  return {
    id: crypto.randomUUID(),
    description: l.description,
    quantity: String(l.quantity),
    unit_price_ht: String(l.unit_price_ht),
    vat_rate: l.vat_rate as VatRate,
  }
}

export function num(value: string): number {
  return parseFloat(value) || 0
}

export function computeLines(lines: DocLine[]): ComputedLine[] {
  return lines.map((line) => calculateLineTotals(num(line.quantity), num(line.unit_price_ht), line.vat_rate))
}

export function computeTotals(computed: ComputedLine[]): DocTotals {
  return calculateInvoiceTotals(computed.map((l) => ({ total_ht: l.totalHT, total_vat: l.totalVAT, total_ttc: l.totalTTC })))
}

/** TVA ventilée par taux (aperçu : « TVA 10 % », « TVA 20 % »). */
export function vatBreakdown(lines: DocLine[], computed: ComputedLine[]): { rate: VatRate; amount: number }[] {
  const byRate = new Map<VatRate, number>()
  lines.forEach((line, i) => {
    if (computed[i].totalHT === 0) return
    byRate.set(line.vat_rate, (byRate.get(line.vat_rate) ?? 0) + computed[i].totalVAT)
  })
  return Array.from(byRate.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([rate, amount]) => ({ rate, amount: Math.round(amount * 100) / 100 }))
}

/** Lignes au format attendu par les routes (totaux recalculés côté client, comme avant). */
export function toPayloadLines(lines: DocLine[], computed: ComputedLine[]) {
  return lines.map((line, i) => ({
    description: line.description.trim(),
    quantity: num(line.quantity),
    unit_price_ht: num(line.unit_price_ht),
    vat_rate: line.vat_rate,
    total_ht: computed[i].totalHT,
    total_vat: computed[i].totalVAT,
    total_ttc: computed[i].totalTTC,
  }))
}

/** « 12 × 48,00 € · TVA 10 % » (lignes compactes sur mobile). */
export function lineSummary(line: DocLine): string {
  const qty = num(line.quantity)
  const qtyLabel = Number.isInteger(qty) ? String(qty) : String(qty).replace(".", ",")
  return `${qtyLabel} × ${formatCurrency(num(line.unit_price_ht))} · TVA ${formatRate(line.vat_rate)}`
}

/** 5.5 → « 5,5 % ». */
export function formatRate(rate: number): string {
  return `${String(rate).replace(".", ",")} %`
}

/* ------------------------------------------------------------------ */
/* Validation (messages identiques aux anciens formulaires)            */
/* ------------------------------------------------------------------ */

export function validateDoc(kind: DocKind, form: DocForm): Record<string, string> {
  const errs: Record<string, string> = {}
  if (!form.client_id) errs.client_id = "Client requis"
  if (!form.issue_date) errs.issue_date = "Date d'émission requise"
  if (kind === "invoice" && !form.due_date) errs.due_date = "Date d'échéance requise"
  if (kind === "quote" && !form.valid_until) errs.valid_until = "Date de validité requise"
  form.lines.forEach((line, i) => {
    if (!line.description.trim()) errs[`line_${i}_desc`] = "Description requise"
    if (!line.quantity || parseFloat(line.quantity) <= 0) errs[`line_${i}_qty`] = "Quantité invalide"
    if (line.unit_price_ht === "" || parseFloat(line.unit_price_ht) < 0) errs[`line_${i}_price`] = "Prix invalide"
  })
  return errs
}

export function lineHasError(errors: Record<string, string>, index: number): boolean {
  return Boolean(errors[`line_${index}_desc`] || errors[`line_${index}_qty`] || errors[`line_${index}_price`])
}

/* ------------------------------------------------------------------ */
/* Contrôles avant envoi — uniquement des vérifications réelles        */
/* ------------------------------------------------------------------ */

export type CheckState = "ok" | "todo" | "info"

export interface DocCheck {
  key: string
  label: string
  state: CheckState
  /** Faux : contrôle indicatif, non compté (ex. SIREN d'un particulier). */
  required: boolean
}

export function secondDateOf(kind: DocKind, form: DocForm): string {
  if (kind === "invoice") return form.due_date
  if (kind === "quote") return form.valid_until
  return form.delivery_date
}

export function buildChecks(
  kind: DocKind,
  form: DocForm,
  client: DocClient | null,
  company: DocCompany | null,
  computed: ComputedLine[],
): DocCheck[] {
  const checks: DocCheck[] = []
  const check = (key: string, ok: boolean, done: string, todo: string) =>
    checks.push({ key, label: ok ? done : todo, state: ok ? "ok" : "todo", required: true })

  check("client", Boolean(client), "Client choisi", "Choisir un client")

  // Les routes d'envoi refusent un client sans adresse email (422)
  check(
    "email",
    Boolean(client?.email),
    "E-mail du client renseigné",
    client ? "Ajouter l'e-mail du client dans sa fiche" : "E-mail du client à renseigner",
  )

  // SIREN : obligatoire pour un client professionnel, sans objet pour un particulier.
  // L'application ne distingue pas les deux : contrôle indicatif, non bloquant.
  if (client) {
    checks.push({
      key: "siren",
      label: client.siren ? "SIREN du client renseigné" : "Pas de SIREN : à ajouter si le client est un professionnel",
      state: client.siren ? "ok" : "info",
      required: false,
    })
  }

  const filled = form.lines.filter((l, i) => l.description.trim() && computed[i].totalHT > 0).length
  const incomplete = form.lines.some((l) => !l.description.trim() || l.unit_price_ht === "" || num(l.quantity) <= 0)
  check(
    "lines",
    filled > 0 && !incomplete,
    "Au moins une prestation chiffrée",
    filled > 0 ? "Compléter la ligne inachevée" : "Ajouter une prestation chiffrée",
  )

  if (kind === "purchase_order") {
    check("dates", Boolean(form.issue_date), "Date d'émission renseignée", "Renseigner la date d'émission")
  } else {
    const gap = daysBetween(form.issue_date, secondDateOf(kind, form))
    const ok = gap !== null && gap >= 0
    if (kind === "invoice") check("dates", ok, "Échéance après la date d'émission", "Renseigner une échéance après la date d'émission")
    else check("dates", ok, "Validité après la date d'émission", "Renseigner une validité après la date d'émission")
  }

  // Mentions de l'émetteur (SIREN et adresse) : imprimées depuis Paramètres › Entreprise
  if (company) {
    const complete = Boolean(company.name && company.siren && company.address && company.city)
    check("company", complete, "Vos coordonnées et votre SIREN", "Compléter vos coordonnées (Paramètres › Entreprise)")
  }

  return checks
}

/** Sous-titre d'un client : SIREN (pro) ou ville / email. */
export function clientSubtitle(client: DocClient): string {
  if (client.siren) {
    const siren = formatSiren(client.siren)
    return client.city ? `SIREN ${siren} · ${client.city}` : `SIREN ${siren}`
  }
  return [client.city, client.email].filter(Boolean).join(" · ") || "Coordonnées à compléter"
}

/** SIREN groupé par 3 (« 948 211 375 »). */
export function formatSiren(siren: string | null | undefined): string {
  const s = (siren ?? "").replace(/\s/g, "")
  return s.length === 9 ? `${s.slice(0, 3)} ${s.slice(3, 6)} ${s.slice(6)}` : s
}

/**
 * Liste des clients complétée du client du document s'il n'y figure pas
 * (client archivé, absent de GET /api/clients) : le brouillon garde son client.
 */
export function withDocClient(clients: DocClient[], client: DocClient | null | undefined): DocClient[] {
  if (!client?.id || clients.some((c) => c.id === client.id)) return clients
  return [...clients, client]
}
