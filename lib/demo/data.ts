/**
 * Données fictives de la démo (/demo/*), communes à toutes ses pages pour que
 * les mêmes clients, factures et devis se retrouvent d'un écran à l'autre.
 *
 * Reprises du canevas (entreprise « Garnier Plâtrerie Isolation ») et ramenées
 * à ce que l'application sait faire aujourd'hui : statuts réels du code, pas de
 * transmission ni de paiement partiel (fonctions non livrées, DECISIONS § 10).
 * Le chantier en sous-traitance de la formule Artisan (acompte, deux situations
 * avec retenue de garantie, autoliquidation) est calculé par lib/artisan, comme
 * dans l'application (lib/demo/chantiers.ts le regroupe).
 *
 * Aucune donnée réelle : les SIREN affichés ne passent volontairement pas la
 * clé de contrôle, les emails sont en @example.com (domaine réservé).
 * Montants calculés à partir des lignes (HT, TVA, TTC toujours cohérents).
 */
import type { InvoiceStatus, QuoteStatus } from "@/types"
import type { ReminderSettings } from "@/lib/reminders/settings"
import {
  computeDeposit, computeSituation, depositGroups, previousProgress,
  type BillingContext, type BillingLine, type DeductedRecord,
} from "@/lib/artisan/billing"
import { applyRetention } from "@/lib/artisan/retention"
import { fromCents } from "@/lib/artisan/money"

/** « Aujourd'hui » de la démo (jeudi 1er octobre 2026, comme le canevas). */
export const DEMO_TODAY = "2026-10-01"

export const DEMO_COMPANY = {
  name: "Garnier Plâtrerie Isolation",
  owner: "Thomas Garnier",
  siren: "948211375",
  vat_number: "FR32948211375",
  address: "14 rue des Lices",
  zip_code: "49100",
  city: "Angers",
  email: "contact@garnier-platrerie.example.com",
  phone: "02 41 00 00 00",
  iban: "FR76 0000 0000 0000 0000 0000 000",
  invoice_prefix: "F",
  payment_terms: "30 jours",
}

/* ------------------------------------------------------------------ */
/* Clients                                                             */
/* ------------------------------------------------------------------ */

export interface DemoClient {
  id: string
  name: string
  /** Type de clientèle, pour les filtres et les sous-titres. */
  kind: "pro" | "particulier" | "public"
  /** Activité ou qualité (sous-titre). */
  activity: string
  contact: string
  siren?: string
  email: string
  phone: string
  address: string
  zip_code: string
  city: string
}

export const DEMO_CLIENTS: DemoClient[] = [
  { id: "bati-ouest", name: "Bâti Ouest SAS", kind: "pro", activity: "Entreprise générale", contact: "Marc Delorme", siren: "501234567", email: "compta@bati-ouest.example.com", phone: "02 40 00 00 01", address: "4 quai de la Loire", zip_code: "44000", city: "Nantes" },
  { id: "sci-tilleuls", name: "SCI Les Tilleuls", kind: "pro", activity: "Société civile immobilière", contact: "Sophie Aubert", siren: "812345671", email: "gestion@sci-tilleuls.example.com", phone: "02 40 00 00 02", address: "18 allée des Tilleuls", zip_code: "44300", city: "Nantes" },
  { id: "mercier", name: "Syndic Mercier & Fils", kind: "pro", activity: "Syndic de copropriété", contact: "Hélène Mercier", siren: "433210988", email: "syndic@mercier.example.com", phone: "02 41 00 00 03", address: "9 boulevard Foch", zip_code: "49000", city: "Angers" },
  { id: "arvel", name: "Groupe Arvel Construction", kind: "pro", activity: "Entreprise générale", contact: "Paul Arvel", siren: "390112234", email: "factures@arvel.example.com", phone: "02 41 00 00 04", address: "ZA de la Bergerie", zip_code: "49300", city: "Cholet" },
  { id: "habitat-loire", name: "Habitat Loire Construction", kind: "pro", activity: "Constructeur de maisons", contact: "Julie Brosset", siren: "529871345", email: "achats@habitat-loire.example.com", phone: "02 41 00 00 05", address: "3 rue du Port", zip_code: "49400", city: "Saumur" },
  { id: "clos", name: "Copropriété Le Clos", kind: "pro", activity: "Syndicat de copropriétaires", contact: "Syndic Mercier & Fils", email: "le-clos@mercier.example.com", phone: "02 41 00 00 06", address: "21 rue du Clos", zip_code: "49000", city: "Angers" },
  { id: "verdier", name: "Cabinet Verdier Architectes", kind: "pro", activity: "Architecte", contact: "Léa Verdier", email: "agence@verdier.example.com", phone: "02 41 00 00 07", address: "6 place du Ralliement", zip_code: "49100", city: "Angers" },
  { id: "morel", name: "Atelier Morel", kind: "pro", activity: "Menuiserie", contact: "Étienne Morel", siren: "811234562", email: "atelier@morel.example.com", phone: "02 41 00 00 08", address: "12 rue de la Roë", zip_code: "49100", city: "Angers" },
  { id: "trelaze", name: "Mairie de Trélazé", kind: "public", activity: "Collectivité", contact: "Service technique", siren: "214903533", email: "technique@trelaze.example.com", phone: "02 41 00 00 09", address: "Place de la Mairie", zip_code: "49800", city: "Trélazé" },
  { id: "fontaine", name: "Claire Fontaine", kind: "particulier", activity: "Particulier", contact: "Claire Fontaine", email: "claire.fontaine@example.com", phone: "06 00 00 00 10", address: "7 rue des Lilas", zip_code: "49240", city: "Avrillé" },
  { id: "lambert", name: "M. et Mme Lambert", kind: "particulier", activity: "Particuliers", contact: "Nadia Lambert", email: "lambert@example.com", phone: "06 00 00 00 11", address: "28 chemin des Vignes", zip_code: "49130", city: "Les Ponts-de-Cé" },
  { id: "pichon", name: "M. Pichon", kind: "particulier", activity: "Particulier", contact: "Bernard Pichon", email: "b.pichon@example.com", phone: "06 00 00 00 12", address: "5 impasse des Saules", zip_code: "49070", city: "Beaucouzé" },
]

export function demoClient(id: string): DemoClient {
  const c = DEMO_CLIENTS.find((x) => x.id === id)
  if (!c) throw new Error(`Client de démo inconnu : ${id}`)
  return c
}

/* ------------------------------------------------------------------ */
/* Catalogue                                                           */
/* ------------------------------------------------------------------ */

export interface DemoProduct {
  id: string
  name: string
  description: string | null
  category: "Plâtrerie" | "Isolation" | "Forfaits"
  unit: string
  unit_price_ht: number
  vat_rate: 0 | 5.5 | 10 | 20
  reference: string | null
  is_active: boolean
}

export const DEMO_PRODUCTS: DemoProduct[] = [
  { id: "ba13", name: "Fourniture et pose de plaques de plâtre BA13", description: "Vissées sur ossature existante", category: "Plâtrerie", unit: "m²", unit_price_ht: 22, vat_rate: 10, reference: "PL-01", is_active: true },
  { id: "cloison", name: "Cloison sur ossature métallique 72/48", description: "Une plaque BA13 de chaque côté, laine minérale 45 mm", category: "Plâtrerie", unit: "m²", unit_price_ht: 48, vat_rate: 10, reference: "PL-02", is_active: true },
  { id: "doublage", name: "Doublage isolant collé 10+80", description: "Complexe plâtre et polystyrène", category: "Plâtrerie", unit: "m²", unit_price_ht: 36, vat_rate: 10, reference: "PL-03", is_active: true },
  { id: "bandes", name: "Bandes et enduits, finition prête à peindre", description: null, category: "Plâtrerie", unit: "m²", unit_price_ht: 10, vat_rate: 10, reference: "PL-04", is_active: true },
  { id: "faux-plafond", name: "Faux plafond suspendu", description: "Ossature et plaques BA13", category: "Plâtrerie", unit: "m²", unit_price_ht: 42, vat_rate: 10, reference: "PL-05", is_active: true },
  { id: "lissage", name: "Enduit de lissage sur plafond", description: null, category: "Plâtrerie", unit: "m²", unit_price_ht: 14, vat_rate: 10, reference: "PL-06", is_active: true },
  { id: "combles", name: "Isolation des combles perdus, laine soufflée 300 mm", description: "R = 7 m².K/W", category: "Isolation", unit: "m²", unit_price_ht: 36, vat_rate: 5.5, reference: "IS-01", is_active: true },
  { id: "rampants", name: "Isolation des rampants, laine de verre 200 mm", description: null, category: "Isolation", unit: "m²", unit_price_ht: 54, vat_rate: 5.5, reference: "IS-02", is_active: true },
  { id: "depose", name: "Dépose et évacuation de l'ancienne isolation", description: null, category: "Isolation", unit: "m²", unit_price_ht: 8, vat_rate: 10, reference: "IS-03", is_active: true },
  { id: "deplacement", name: "Déplacement", description: null, category: "Forfaits", unit: "forfait", unit_price_ht: 40, vat_rate: 20, reference: "FO-01", is_active: true },
  { id: "echafaudage", name: "Location d'échafaudage", description: null, category: "Forfaits", unit: "jour", unit_price_ht: 85, vat_rate: 20, reference: "FO-02", is_active: true },
  { id: "benne", name: "Évacuation des gravats, benne 10 m³", description: null, category: "Forfaits", unit: "forfait", unit_price_ht: 260, vat_rate: 20, reference: "FO-03", is_active: true },
  { id: "main-oeuvre", name: "Main d'œuvre horaire, plâtrier qualifié", description: null, category: "Forfaits", unit: "h", unit_price_ht: 46, vat_rate: 20, reference: "FO-04", is_active: true },
  { id: "staff", name: "Corniche en staff (ancienne gamme)", description: "Retirée du catalogue", category: "Plâtrerie", unit: "ml", unit_price_ht: 28, vat_rate: 10, reference: "PL-99", is_active: false },
]

/* ------------------------------------------------------------------ */
/* Lignes et totaux                                                    */
/* ------------------------------------------------------------------ */

export interface DemoLine {
  id: string
  description: string
  quantity: number
  unit: string
  unit_price_ht: number
  vat_rate: 0 | 5.5 | 10 | 20
  total_ht: number
  total_vat: number
  total_ttc: number
  /** Autoliquidation (sous-traitance du BTP) : TVA due par le client. */
  vat_treatment?: "autoliquidation_btp"
  /** Situation de travaux : avancement de la ligne du devis. */
  progress?: BillingLine["progress"]
  /** Reprise d'un acompte. */
  deposit_of?: BillingLine["deposit_of"]
}

const round2 = (n: number) => Math.round(n * 100) / 100

function line(id: string, productId: string, quantity: number): DemoLine {
  const p = DEMO_PRODUCTS.find((x) => x.id === productId)!
  const total_ht = round2(quantity * p.unit_price_ht)
  const total_vat = round2((total_ht * p.vat_rate) / 100)
  return {
    id, description: p.name, quantity, unit: p.unit, unit_price_ht: p.unit_price_ht, vat_rate: p.vat_rate,
    total_ht, total_vat, total_ttc: round2(total_ht + total_vat),
  }
}

function totals(lines: DemoLine[]) {
  const subtotal_ht = round2(lines.reduce((s, l) => s + l.total_ht, 0))
  const total_vat = round2(lines.reduce((s, l) => s + l.total_vat, 0))
  return { subtotal_ht, total_vat, total_ttc: round2(subtotal_ht + total_vat) }
}

/* ------------------------------------------------------------------ */
/* Factures                                                            */
/* ------------------------------------------------------------------ */

export interface DemoInvoice {
  id: string
  /** Vide pour un brouillon : le numéro est attribué à l'émission. */
  invoice_number: string | null
  client_id: string
  client: DemoClient
  /** Objet du chantier (sous-titre des listes). */
  subject: string
  status: InvoiceStatus
  issue_date: string
  due_date: string
  sent_at?: string
  paid_at?: string
  lines: DemoLine[]
  subtotal_ht: number
  total_vat: number
  total_ttc: number
  notes?: string
  quote_number?: string
  /** Relances déjà parties (journal), selon DEMO_REMINDER_SETTINGS. */
  reminders?: { stage: string; origin: string; sent_at: string }[]
  /** Formule Artisan : nature (acompte, situation, solde), contexte et retenue de garantie. */
  invoice_kind?: "deposit" | "situation" | "final"
  billing_context?: BillingContext
  retention_amount?: number
}

/* ------------------------------------------------------------------ */
/* Chantier en sous-traitance (formule Artisan)                        */
/* ------------------------------------------------------------------ */

/*
 * Garnier intervient en sous-traitance du Groupe Arvel Construction (lot
 * plâtrerie d'une résidence) : devis signé en autoliquidation, acompte de
 * 20 %, situation n° 1 à 35 % puis n° 2 par ligne, retenue de garantie de 5 %.
 * Tous les montants sortent de lib/artisan/billing.ts, comme dans l'application.
 */
export const DEMO_SUB_CHANTIER_ID = "clos-fleuri"
const SUB_QUOTE_NUMBER = "D-2026-024"
const SUB_QUOTE_DATE = "2026-06-30"

function autoliquidation(l: DemoLine): DemoLine {
  return { ...l, vat_rate: 0, total_vat: 0, total_ttc: l.total_ht, vat_treatment: "autoliquidation_btp" }
}

/** Ligne calculée par lib/artisan → ligne de démo. */
function fromBilling(l: BillingLine): DemoLine {
  return {
    ...l,
    id: l.id,
    unit: l.unit ?? "",
    vat_rate: l.vat_rate as DemoLine["vat_rate"],
    vat_treatment: l.vat_treatment === "autoliquidation_btp" ? "autoliquidation_btp" : undefined,
  }
}

function must<T extends { ok: boolean }>(r: T | { ok: false; error: string }): T {
  if (!r.ok) throw new Error(`Démo Artisan : ${(r as { error: string }).error}`)
  return r as T
}

const SUB_QUOTE_LINES: DemoLine[] = [
  autoliquidation(line("1", "cloison", 420)),
  autoliquidation(line("2", "doublage", 380)),
  autoliquidation(line("3", "bandes", 800)),
  autoliquidation(line("4", "faux-plafond", 160)),
]

function subContractInvoices(): DemoInvoice[] {
  const client = demoClient("arvel")
  const subject = "Résidence Le Clos Fleuri · lot plâtrerie"
  const totals = (lines: DemoLine[]) => {
    const subtotal_ht = round2(lines.reduce((s, l) => s + l.total_ht, 0))
    const total_vat = round2(lines.reduce((s, l) => s + l.total_vat, 0))
    return { subtotal_ht, total_vat, total_ttc: round2(subtotal_ht + total_vat) }
  }
  const quoteRef = (ht: number) => ({ id: SUB_QUOTE_NUMBER.toLowerCase(), number: SUB_QUOTE_NUMBER, issue_date: SUB_QUOTE_DATE, total_ht: ht, total_ttc: ht })
  const chantier = { id: DEMO_SUB_CHANTIER_ID, name: "Résidence Le Clos Fleuri" }
  const contractHt = round2(SUB_QUOTE_LINES.reduce((s, l) => s + l.total_ht, 0))

  // Acompte de 20 % à la signature
  const dep = must(computeDeposit(SUB_QUOTE_LINES, { mode: "percent", percent: 20 }, { quoteNumber: SUB_QUOTE_NUMBER }))
  const depLines = dep.lines.map(fromBilling)
  const depositInv: DemoInvoice = {
    id: "f-2026-0124", invoice_number: "F-2026-0124", client_id: client.id, client, subject: `${subject} · acompte 20 %`,
    status: "paid", issue_date: "2026-07-10", due_date: "2026-07-10", sent_at: "2026-07-10", paid_at: "2026-07-16",
    lines: depLines, ...totals(depLines), quote_number: SUB_QUOTE_NUMBER,
    notes: "Acompte payable à réception, par virement.",
    invoice_kind: "deposit",
    billing_context: { v: 1, kind: "deposit", quote: quoteRef(contractHt), chantier, deposit: { mode: "percent", percent: 20, requested_ttc: null }, deductions: [], retention: null },
    retention_amount: 0,
  }
  const depositRecord = { invoice_id: depositInv.id, number: "F-2026-0124", issue_date: "2026-07-10", groups: depositGroups(dep.lines) }

  // Situation n° 1 : 35 % partout, acompte repris au prorata, retenue de 5 %
  const s1 = must(computeSituation(SUB_QUOTE_LINES, { global: 35 }, previousProgress(4, []), { records: [depositRecord], deducted: [] }))
  const s1Ret = applyRetention(s1.ttc, "retenue", 5)
  const s1Lines = s1.lines.map(fromBilling)
  const situation1: DemoInvoice = {
    id: "f-2026-0130", invoice_number: "F-2026-0130", client_id: client.id, client, subject: `${subject} · situation n° 1`,
    status: "paid", issue_date: "2026-08-31", due_date: "2026-09-30", sent_at: "2026-08-31", paid_at: "2026-09-28",
    lines: s1Lines, ...totals(s1Lines), quote_number: SUB_QUOTE_NUMBER,
    invoice_kind: "situation",
    billing_context: {
      v: 1, kind: "situation", quote: quoteRef(contractHt), chantier,
      situation: { number: 1, final: false, contract_ht: fromCents(s1.contract_ht), previous_ht: 0, cumulative_ht: fromCents(s1.cumulative_ht), amount_ht: fromCents(s1.amount_ht), cumulative_percent: s1.cumulative_percent },
      deductions: s1.deductions, retention: s1Ret,
    },
    retention_amount: s1Ret?.amount ?? 0,
  }

  // Situation n° 2 : avancement par ligne
  const deducted: DeductedRecord[] = s1.deductions.map((d) => ({ invoice_id: d.invoice_id, groups: d.groups }))
  const s2 = must(computeSituation(SUB_QUOTE_LINES, [{ percent: 80 }, { percent: 70 }, { percent: 55 }, { percent: 40 }], previousProgress(4, [{ lines: s1.lines }]), { records: [depositRecord], deducted }))
  const s2Ret = applyRetention(s2.ttc, "retenue", 5)
  const s2Lines = s2.lines.map(fromBilling)
  const situation2: DemoInvoice = {
    id: "f-2026-0137", invoice_number: "F-2026-0137", client_id: client.id, client, subject: `${subject} · situation n° 2`,
    status: "sent", issue_date: "2026-09-30", due_date: "2026-10-30", sent_at: "2026-09-30",
    lines: s2Lines, ...totals(s2Lines), quote_number: SUB_QUOTE_NUMBER,
    invoice_kind: "situation",
    billing_context: {
      v: 1, kind: "situation", quote: quoteRef(contractHt), chantier,
      situation: { number: 2, final: false, contract_ht: fromCents(s2.contract_ht), previous_ht: fromCents(s2.previous_ht), cumulative_ht: fromCents(s2.cumulative_ht), amount_ht: fromCents(s2.amount_ht), cumulative_percent: s2.cumulative_percent },
      deductions: s2.deductions, retention: s2Ret,
    },
    retention_amount: s2Ret?.amount ?? 0,
  }
  return [situation2, situation1, depositInv]
}

/** Acompte, situations n° 1 et n° 2 du chantier en sous-traitance (du plus récent au plus ancien). */
export const DEMO_SUB_INVOICES: DemoInvoice[] = subContractInvoices()

function invoice(
  n: string, clientId: string, subject: string, status: InvoiceStatus,
  issue: string, due: string, lines: DemoLine[], extra: Partial<DemoInvoice> = {},
): DemoInvoice {
  return {
    id: n.toLowerCase(), invoice_number: n, client_id: clientId, client: demoClient(clientId), subject, status,
    issue_date: issue, due_date: due, lines, ...totals(lines), ...extra,
  }
}

/** Brouillon : pas encore de numéro, il sera attribué à l'émission (lib/utils/document-numbering.ts). */
function draftInvoice(
  id: string, clientId: string, subject: string, issue: string, due: string, lines: DemoLine[],
): DemoInvoice {
  return { ...invoice(id, clientId, subject, "draft", issue, due, lines), id, invoice_number: null }
}

/** Du plus récent au plus ancien. */
export const DEMO_INVOICES: DemoInvoice[] = [
  // Brouillons : sans numéro tant qu'ils ne sont pas envoyés
  draftInvoice("brouillon-morel", "morel", "Reprise de plafond et finitions", "2026-10-01", "2026-10-31",
    [line("1", "lissage", 24), line("2", "bandes", 24), line("3", "deplacement", 1)]),
  draftInvoice("brouillon-bati-ouest", "bati-ouest", "Résidence Les Tilleuls · lot 4", "2026-09-29", "2026-10-29",
    [line("1", "doublage", 120), line("2", "cloison", 72), line("3", "bandes", 192)]),
  invoice("F-2026-0144", "clos", "Ravalement intérieur · solde", "sent", "2026-10-01", "2026-10-31",
    [line("1", "main-oeuvre", 38), line("2", "bandes", 64), line("3", "echafaudage", 2)], { sent_at: "2026-10-01", quote_number: "D-2026-029" }),
  invoice("F-2026-0143", "habitat-loire", "Extension maison individuelle", "sent", "2026-09-30", "2026-10-30",
    [line("1", "cloison", 54), line("2", "bandes", 54), line("3", "deplacement", 1)], { sent_at: "2026-09-30", quote_number: "D-2026-028" }),
  DEMO_SUB_INVOICES[0],
  invoice("F-2026-0142", "bati-ouest", "Résidence Les Tilleuls · lot 3", "sent", "2026-09-12", "2026-10-12",
    [line("1", "doublage", 210), line("2", "cloison", 120), line("3", "bandes", 330)], { sent_at: "2026-09-12" }),
  invoice("F-2026-0141", "sci-tilleuls", "Rénovation du hall", "sent", "2026-09-15", "2026-10-15",
    [line("1", "faux-plafond", 64), line("2", "lissage", 64), line("3", "bandes", 128), line("4", "echafaudage", 4)], { sent_at: "2026-09-15", quote_number: "D-2026-030" }),
  invoice("F-2026-0140", "mercier", "Cage d'escalier B", "sent", "2026-09-09", "2026-10-09",
    [line("1", "ba13", 86), line("2", "bandes", 86), line("3", "echafaudage", 3)], { sent_at: "2026-09-09" }),
  invoice("F-2026-0139", "arvel", "Lot cloisons et doublages", "overdue", "2026-08-20", "2026-09-19",
    [line("1", "cloison", 28), line("2", "doublage", 22), line("3", "bandes", 50)], {
      sent_at: "2026-08-20", quote_number: "D-2026-027",
      reminders: [
        { stage: "before_3", origin: "auto", sent_at: "2026-09-16T07:05:00Z" },
        { stage: "after_7", origin: "auto", sent_at: "2026-09-26T07:05:00Z" },
      ],
    }),
  invoice("F-2026-0136", "morel", "Reprise de plafond", "overdue", "2026-08-27", "2026-09-26",
    [line("1", "lissage", 10), line("2", "deplacement", 1)], {
      sent_at: "2026-08-27",
      reminders: [{ stage: "before_3", origin: "auto", sent_at: "2026-09-23T07:05:00Z" }],
    }),
  invoice("F-2026-0135", "clos", "Ravalement intérieur · acompte 30 %", "sent", "2026-09-05", "2026-10-05",
    [line("1", "main-oeuvre", 26)], { sent_at: "2026-09-05", quote_number: "D-2026-029" }),
  invoice("F-2026-0134", "bati-ouest", "Résidence Les Tilleuls · lot 2", "sent", "2026-08-12", "2026-10-11",
    [line("1", "doublage", 96), line("2", "bandes", 96), line("3", "benne", 1)], { sent_at: "2026-08-12" }),
  invoice("F-2026-0133", "verdier", "Agencement de bureaux", "sent", "2026-09-01", "2026-11-01",
    [line("1", "cloison", 16), line("2", "deplacement", 1)], { sent_at: "2026-09-01" }),
  DEMO_SUB_INVOICES[1],
  invoice("F-2026-0138", "fontaine", "Isolation des combles", "paid", "2026-08-05", "2026-09-04",
    [line("1", "depose", 45), line("2", "combles", 45)], { sent_at: "2026-08-05", paid_at: "2026-08-29", quote_number: "D-2026-026" }),
  DEMO_SUB_INVOICES[2],
  invoice("F-2026-0127", "bati-ouest", "Résidence Les Tilleuls · lot 1", "paid", "2026-07-08", "2026-08-07",
    [line("1", "ba13", 120), line("2", "bandes", 120)], { sent_at: "2026-07-08", paid_at: "2026-08-03" }),
  invoice("F-2026-0118", "mercier", "Cage d'escalier A", "paid", "2026-06-24", "2026-07-24",
    [line("1", "ba13", 110), line("2", "bandes", 110), line("3", "echafaudage", 4)], { sent_at: "2026-06-24", paid_at: "2026-07-20" }),
  invoice("F-2026-0099", "habitat-loire", "Extension · lot cloisons, phase 1", "paid", "2026-05-28", "2026-06-27",
    [line("1", "cloison", 120), line("2", "bandes", 240), line("3", "benne", 1)], { sent_at: "2026-05-28", paid_at: "2026-06-24" }),
]

export function demoInvoice(id: string): DemoInvoice | undefined {
  return DEMO_INVOICES.find((i) => i.id === id || i.invoice_number === id)
}

/* ------------------------------------------------------------------ */
/* Devis                                                               */
/* ------------------------------------------------------------------ */

export interface DemoQuote {
  id: string
  quote_number: string
  client_id: string
  client: DemoClient
  subject: string
  status: QuoteStatus
  issue_date: string
  valid_until: string
  lines: DemoLine[]
  subtotal_ht: number
  total_vat: number
  total_ttc: number
  notes?: string
  /** Facture issue de la conversion du devis accepté. */
  converted_invoice_number?: string
}

function quote(
  n: string, clientId: string, subject: string, status: QuoteStatus,
  issue: string, until: string, lines: DemoLine[], extra: Partial<DemoQuote> = {},
): DemoQuote {
  return {
    id: n.toLowerCase(), quote_number: n, client_id: clientId, client: demoClient(clientId), subject, status,
    issue_date: issue, valid_until: until, lines, ...totals(lines), ...extra,
  }
}

export const DEMO_QUOTES: DemoQuote[] = [
  quote("D-2026-036", "habitat-loire", "Extension maison individuelle · lot cloisons, phase 2", "draft", "2026-09-29", "2026-10-29",
    [line("1", "cloison", 180), line("2", "bandes", 360), line("3", "benne", 1)]),
  quote("D-2026-035", "lambert", "Isolation des combles perdus, 85 m²", "sent", "2026-09-28", "2026-10-28",
    [line("1", "depose", 85), line("2", "combles", 85), line("3", "deplacement", 1)]),
  quote("D-2026-034", "mercier", "Cage d'escalier C · reprise des plafonds", "sent", "2026-09-26", "2026-10-26",
    [line("1", "faux-plafond", 92), line("2", "lissage", 92), line("3", "echafaudage", 6)]),
  quote("D-2026-033", "bati-ouest", "Résidence Les Tilleuls · doublage cage d'ascenseur", "accepted", "2026-09-24", "2026-10-24",
    [line("1", "doublage", 140), line("2", "bandes", 140), line("3", "echafaudage", 4)]),
  quote("D-2026-032", "verdier", "Cloisons amovibles, bureaux du 2e étage", "rejected", "2026-09-22", "2026-10-22",
    [line("1", "cloison", 48), line("2", "bandes", 48)]),
  quote("D-2026-031", "morel", "Cloison de séparation de l'atelier", "sent", "2026-09-04", "2026-10-04",
    [line("1", "cloison", 24), line("2", "bandes", 24), line("3", "deplacement", 1)]),
  quote("D-2026-030", "sci-tilleuls", "Rénovation du hall", "accepted", "2026-08-28", "2026-09-27",
    [line("1", "faux-plafond", 64), line("2", "lissage", 64), line("3", "bandes", 128), line("4", "echafaudage", 4)], { converted_invoice_number: "F-2026-0141" }),
  quote("D-2026-029", "clos", "Ravalement intérieur de la cage d'escalier", "accepted", "2026-08-20", "2026-09-19",
    [line("1", "main-oeuvre", 64), line("2", "bandes", 64), line("3", "echafaudage", 2)], { converted_invoice_number: "F-2026-0135" }),
  quote("D-2026-028", "habitat-loire", "Extension maison individuelle · lot cloisons", "accepted", "2026-08-12", "2026-09-11",
    [line("1", "cloison", 54), line("2", "bandes", 54), line("3", "deplacement", 1)], { converted_invoice_number: "F-2026-0143" }),
  quote("D-2026-027", "arvel", "Lot cloisons et doublages", "accepted", "2026-07-28", "2026-08-27",
    [line("1", "cloison", 28), line("2", "doublage", 22), line("3", "bandes", 50)], { converted_invoice_number: "F-2026-0139" }),
  quote("D-2026-026", "fontaine", "Isolation des combles", "accepted", "2026-07-15", "2026-08-14",
    [line("1", "depose", 45), line("2", "combles", 45)], { converted_invoice_number: "F-2026-0138" }),
  quote("D-2026-025", "pichon", "Reprise de plafond après dégât des eaux", "rejected", "2026-07-02", "2026-08-01",
    [line("1", "faux-plafond", 30), line("2", "lissage", 30), line("3", "deplacement", 1)]),
  quote(SUB_QUOTE_NUMBER, "arvel", "Résidence Le Clos Fleuri · lot plâtrerie (sous-traitance)", "accepted", SUB_QUOTE_DATE, "2026-07-30", SUB_QUOTE_LINES),
]

export function demoQuote(id: string): DemoQuote | undefined {
  return DEMO_QUOTES.find((q) => q.id === id || q.quote_number === id)
}

/* ------------------------------------------------------------------ */
/* Bons de commande                                                    */
/* ------------------------------------------------------------------ */

export type DemoPOStatus = "draft" | "sent" | "confirmed" | "cancelled"

export interface DemoPurchaseOrder {
  id: string
  po_number: string
  client_id: string
  client: DemoClient
  subject: string
  status: DemoPOStatus
  issue_date: string
  delivery_date: string | null
  /** Référence de commande du client. */
  reference: string | null
  lines: DemoLine[]
  subtotal_ht: number
  total_vat: number
  total_ttc: number
  quote_number?: string
}

function po(
  n: string, clientId: string, subject: string, status: DemoPOStatus, issue: string,
  delivery: string | null, reference: string | null, lines: DemoLine[], extra: Partial<DemoPurchaseOrder> = {},
): DemoPurchaseOrder {
  return {
    id: n.toLowerCase(), po_number: n, client_id: clientId, client: demoClient(clientId), subject, status,
    issue_date: issue, delivery_date: delivery, reference, lines, ...totals(lines), ...extra,
  }
}

export const DEMO_PURCHASE_ORDERS: DemoPurchaseOrder[] = [
  po("BC-2026-006", "bati-ouest", "Doublage cage d'ascenseur", "confirmed", "2026-10-01", "2026-10-12", "CMD-4471",
    [line("1", "doublage", 140), line("2", "bandes", 140), line("3", "echafaudage", 4)], { quote_number: "D-2026-033" }),
  po("BC-2026-005", "habitat-loire", "Extension · lot cloisons, phase 2", "sent", "2026-09-30", "2026-10-20", "HLC-2026-118",
    [line("1", "cloison", 180), line("2", "bandes", 360), line("3", "benne", 1)], { quote_number: "D-2026-036" }),
  po("BC-2026-004", "mercier", "Cage d'escalier C · plafonds", "draft", "2026-09-29", "2026-10-26", null,
    [line("1", "faux-plafond", 92), line("2", "lissage", 92), line("3", "echafaudage", 6)], { quote_number: "D-2026-034" }),
  po("BC-2026-003", "sci-tilleuls", "Rénovation du hall", "confirmed", "2026-08-28", "2026-09-01", "SCI-0916",
    [line("1", "faux-plafond", 64), line("2", "lissage", 64), line("3", "bandes", 128), line("4", "echafaudage", 4)], { quote_number: "D-2026-030" }),
  po("BC-2026-002", "verdier", "Cloisons amovibles, bureaux", "cancelled", "2026-09-22", "2026-10-05", "CVA-0922",
    [line("1", "cloison", 48), line("2", "bandes", 48)], { quote_number: "D-2026-032" }),
]

export function demoPurchaseOrder(id: string): DemoPurchaseOrder | undefined {
  return DEMO_PURCHASE_ORDERS.find((p) => p.id === id || p.po_number === id)
}

/* ------------------------------------------------------------------ */
/* Avoirs                                                              */
/* ------------------------------------------------------------------ */

export interface DemoCreditNote {
  id: string
  credit_note_number: string
  client: DemoClient
  original_invoice_number: string
  reason: string
  issue_date: string
  /** Lignes reprises de la facture d'origine, comme le fait l'application (avoir total ou partiel). */
  lines: DemoLine[]
  subtotal_ht: number
  total_vat: number
  /** Montant de l'avoir (positif ; affiché en négatif). */
  total_ttc: number
}

/** Avoir partiel : reprend les lignes choisies de la facture d'origine. */
function creditNote(n: string, invoiceNumber: string, lineIds: string[], reason: string, issue: string): DemoCreditNote {
  const inv = DEMO_INVOICES.find((i) => i.invoice_number === invoiceNumber)
  if (!inv) throw new Error(`Facture de démo inconnue : ${invoiceNumber}`)
  const lines = inv.lines.filter((l) => lineIds.includes(l.id))
  return {
    id: n.toLowerCase(), credit_note_number: n, client: inv.client, original_invoice_number: invoiceNumber,
    reason, issue_date: issue, lines, ...totals(lines),
  }
}

export const DEMO_CREDIT_NOTES: DemoCreditNote[] = [
  creditNote("AV-2026-003", "F-2026-0138", ["1"], "Dépose de l'ancienne isolation non réalisée", "2026-09-03"),
  creditNote("AV-2026-002", "F-2026-0118", ["3"], "Échafaudage facturé en trop", "2026-08-12"),
  creditNote("AV-2026-001", "F-2026-0099", ["3"], "Benne non utilisée", "2026-07-09"),
]

/* ------------------------------------------------------------------ */
/* Agrégats (tableau de bord, fiches client)                           */
/* ------------------------------------------------------------------ */

const OPEN_STATUSES: InvoiceStatus[] = ["sent", "pending", "received", "accepted", "overdue"]

/** Factures émises non réglées. */
export const demoOpenInvoices = () => DEMO_INVOICES.filter((i) => OPEN_STATUSES.includes(i.status))
/** En retard : émises, non réglées et échues (statut « En retard » posé ou non). */
export const demoOverdueInvoices = () => DEMO_INVOICES.filter((i) => OPEN_STATUSES.includes(i.status) && i.due_date < DEMO_TODAY)
export const demoSum = (list: { total_ttc: number }[]) => round2(list.reduce((s, x) => s + x.total_ttc, 0))

/** Encaissements par mois (factures payées, date de paiement), d'avril à septembre 2026. */
export const DEMO_MONTHLY_PAID: { month: string; label: string; value: number }[] = [
  { month: "2026-04", label: "Avr.", value: 9800 },
  { month: "2026-05", label: "Mai", value: 12450 },
  { month: "2026-06", label: "Juin", value: 11200 },
  { month: "2026-07", label: "Juil.", value: 15900 },
  { month: "2026-08", label: "Août", value: 8600 },
  { month: "2026-09", label: "Sept.", value: 14280 },
]

/* ------------------------------------------------------------------ */
/* Relances (Paramètres › Relances)                                    */
/* ------------------------------------------------------------------ */

/** Réglages d'exemple : rappel 3 jours avant l'échéance, relances à J+7, J+30 et J+45, devis relancés une fois après 7 jours. */
export const DEMO_REMINDER_SETTINGS: ReminderSettings = {
  invoiceRemindersEnabled: true,
  beforeDueDays: 3,
  afterDueDays: [7, 30, 45],
  quoteFollowupEnabled: true,
  quoteFollowupDays: 7,
  quoteFollowupMax: 1,
}
