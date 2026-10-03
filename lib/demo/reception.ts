/**
 * Factures fournisseurs fictives de la démo (/demo/received-invoices) :
 * négoce de matériaux, location d'engins, carburant, panneaux bois, dans les
 * différents statuts du cycle de vie.
 *
 * Les données de chaque facture structurée viennent d'un vrai XML CII produit
 * par le générateur Factur-X de Qonforme (lib/facturx/xml.ts) puis relu par le
 * lecteur de réception (lib/reception/cii.ts) : montants, TVA et totaux sont
 * donc cohérents, et la démo passe par le même code que l'application.
 *
 * Aucune donnée réelle : fournisseurs inventés, SIREN qui ne passent
 * volontairement pas la clé de contrôle (comme lib/demo/data.ts), adresses en
 * @example.com.
 */
import { buildFacturX, type FxDocument, type FxLine, type FxSeller } from "@/lib/facturx/xml"
import { parseCii } from "@/lib/reception/cii"
import { parseXml } from "@/lib/reception/xml"
import { sirenToVAT } from "@/lib/utils/invoice"
import { DEMO_COMPANY } from "@/lib/demo/data"
import type { ReceivedStatus } from "@/lib/reception/lifecycle"
import type { ParsedInvoice, ReceivedFormat, ReceptionCheck } from "@/lib/reception/types"
import type { ReceivedDetail, ReceivedEvent, ReceivedListItem } from "@/lib/reception/view"

/* ------------------------------------------------------------------ */
/* Fournisseurs                                                         */
/* ------------------------------------------------------------------ */

const supplier = (name: string, siren: string, address: string, zip: string, city: string, iban: string, email: string): FxSeller => ({
  name, siren, siret: `${siren}00018`, vat_number: sirenToVAT(siren), address, zip_code: zip, city, iban, email,
  legal_notice: "SAS au capital de 50 000 €.",
})

const COMPTOIR = supplier("Comptoir des Isolants Ligériens", "398765431", "ZA des Rives", "49070", "Beaucouzé", "FR7600000000000000000000101", "factures@comptoir-isolants.example.com")
const LIGERIA = supplier("Ligéria Location Matériel", "812345671", "3 rue de l'Industrie", "49124", "Saint-Barthélemy-d'Anjou", "FR7600000000000000000000202", "compta@ligeria-location.example.com")
const LAYON = supplier("Bois & Panneaux du Layon", "523981044", "Route de Chalonnes", "49750", "Beaulieu-sur-Layon", "FR7600000000000000000000303", "factures@bois-layon.example.com")

const ME = {
  name: DEMO_COMPANY.name,
  siren: DEMO_COMPANY.siren,
  vat_number: DEMO_COMPANY.vat_number,
  address: DEMO_COMPANY.address,
  zip_code: DEMO_COMPANY.zip_code,
  city: DEMO_COMPANY.city,
}

const line = (description: string, quantity: number, unit: string, unit_price_ht: number, vat_rate = 20): FxLine => ({
  description, quantity, unit, unit_price_ht, vat_rate, total_ht: Math.round(quantity * unit_price_ht * 100) / 100,
})

/** Facture lue comme l'application la lirait : XML CII produit, puis relu. */
function read(doc: Omit<FxDocument, "buyer" | "kind"> & { kind?: FxDocument["kind"] }): ParsedInvoice {
  const xml = buildFacturX({ kind: "invoice", buyer: ME, payment_terms: "Paiement à 30 jours par virement.", ...doc }).xml
  return parseCii(parseXml(xml))
}

/* ------------------------------------------------------------------ */
/* Factures                                                             */
/* ------------------------------------------------------------------ */

const OK_CHECKS = (format: ReceivedFormat): ReceptionCheck[] => [
  { id: "format", level: "ok", title: format === "facturx" ? "Factur-X lu" : "XML CII lu", detail: "profil EN 16931 · CII" },
  { id: "buyer_siren", level: "ok", title: "Adressée à votre entreprise", detail: `SIREN ${DEMO_COMPANY.siren}` },
  { id: "duplicate", level: "ok", title: "Pas de doublon", detail: "Aucune facture de ce fournisseur avec ce numéro cette année." },
  { id: "totals", level: "ok", title: "Totaux cohérents", detail: "Lignes, HT, TVA et TTC concordent." },
  { id: "vat", level: "ok", title: "TVA cohérente", detail: "20 %" },
]

let seq = 0
const ev = (status: ReceivedStatus, at: string, actor: ReceivedEvent["actor"], extra: Partial<ReceivedEvent> = {}): ReceivedEvent => ({
  id: `ev-${++seq}`, status, code: actor === "import" ? null : codeOf(status), reason_code: null, reason: null, actor, transmitted_at: null, created_at: at, ...extra,
})
const CODES: Partial<Record<ReceivedStatus, string>> = {
  received: "202", in_hand: "204", approved: "205", partially_approved: "206", disputed: "207", suspended: "208", refused: "210", payment_sent: "211",
}
const codeOf = (s: ReceivedStatus) => CODES[s] ?? null

interface DemoSpec {
  id: string
  format: ReceivedFormat
  status: ReceivedStatus
  reason_code?: string | null
  reason?: string | null
  data: ParsedInvoice | null
  /** Saisie manuelle (PDF simple). */
  manual?: { supplier_name: string; supplier_siren: string | null; number: string; issue_date: string; due_date: string | null; ht: number; tva: number; ttc: number }
  file_name: string
  file_size: number
  received_at: string
  events: ReceivedEvent[]
}

function detail(s: DemoSpec): ReceivedDetail {
  const d = s.data
  const m = s.manual
  const last = s.events[s.events.length - 1]
  const ttc = d ? d.totals.grand_total ?? 0 : m!.ttc
  return {
    id: s.id,
    supplier_name: d ? d.seller.name ?? "—" : m!.supplier_name,
    supplier_siren: d ? d.seller.siren : m!.supplier_siren,
    invoice_number: d ? d.number ?? "—" : m!.number,
    document_type: d ? d.type_code : "380",
    issue_date: d ? d.issue_date ?? "" : m!.issue_date,
    due_date: d ? d.due_date : m!.due_date,
    total_ttc: ttc,
    amount_due: d ? d.totals.due_payable ?? ttc : m!.ttc,
    currency: "EUR",
    status: s.status,
    format: s.format,
    source: "import",
    created_at: s.received_at,
    total_ht: d ? d.totals.tax_basis ?? 0 : m!.ht,
    total_vat: d ? d.totals.tax_total ?? 0 : m!.tva,
    supplier_vat_number: d ? d.seller.vat_number : null,
    buyer_name: d ? d.buyer.name : null,
    buyer_siren: d ? d.buyer.siren : null,
    data: d,
    checks: d ? OK_CHECKS(s.format) : [
      { id: "format", level: "ok", title: "PDF simple classé à la main", detail: "Pas de données structurées : vérifiez la saisie avec le PDF." },
      { id: "buyer_siren", level: "warning", title: "Destinataire à vérifier", detail: "Vérifiez sur le PDF que la facture est bien adressée à votre entreprise." },
      { id: "duplicate", level: "ok", title: "Pas de doublon", detail: "Aucune facture de ce fournisseur avec ce numéro cette année." },
    ],
    status_reason_code: s.reason_code ?? null,
    status_reason: s.reason ?? null,
    status_changed_at: last?.created_at ?? s.received_at,
    file_name: s.file_name,
    file_mime: s.format === "cii" ? "application/xml" : "application/pdf",
    file_size: s.file_size,
    has_pdf: s.format === "facturx" || s.format === "pdf",
    received_at: s.received_at,
    events: s.events,
  }
}

const SPECS: DemoSpec[] = [
  {
    id: "cil-26-04512",
    format: "facturx",
    status: "approved",
    data: read({
      number: "CIL-26-04512", issue_date: "2026-09-22", due_date: "2026-10-31", seller: COMPTOIR,
      lines: [
        line("Plaque de plâtre BA13 2,50 x 1,20 m", 60, "u", 8.4),
        line("Laine de verre 100 mm, rouleau", 24, "u", 31.5),
        line("Montant M48 3 m", 80, "u", 4.15),
        line("Bande à joint et enduit, lot", 6, "u", 18.9),
        line("Livraison sur chantier", 1, "forfait", 45),
      ],
    }),
    file_name: "CIL-26-04512.pdf", file_size: 48_213, received_at: "2026-09-23T07:42:00",
    events: [ev("received", "2026-09-23T07:42:00", "import"), ev("approved", "2026-09-24T18:10:00", "user")],
  },
  {
    id: "llm-2026-0917",
    format: "cii",
    status: "disputed",
    reason_code: "QTE_ERR",
    reason: "Nacelle rendue le 24 septembre : 2 jours de location, pas 3.",
    data: read({
      number: "LLM-2026-0917", issue_date: "2026-09-28", due_date: "2026-10-28", seller: LIGERIA,
      notes: "Location du 23 au 25 septembre 2026, chantier rue des Lices.",
      lines: [
        line("Location nacelle articulée 12 m", 3, "jour", 145),
        line("Transport aller-retour", 1, "forfait", 90),
        line("Garantie casse", 3, "jour", 12),
      ],
    }),
    file_name: "LLM-2026-0917.xml", file_size: 9_874, received_at: "2026-09-29T08:15:00",
    events: [
      ev("received", "2026-09-29T08:15:00", "import"),
      ev("disputed", "2026-09-29T08:31:00", "user", { reason_code: "QTE_ERR", reason: "Nacelle rendue le 24 septembre : 2 jours de location, pas 3." }),
    ],
  },
  {
    id: "fac-77120",
    format: "facturx",
    status: "received",
    data: read({
      number: "FAC-77120", issue_date: "2026-09-30", due_date: "2026-10-30", seller: LAYON,
      lines: [
        line("Panneau OSB 3 18 mm 2,50 x 1,25 m", 14, "u", 21.9),
        line("Tasseau sapin 27 x 40 mm 2,40 m", 30, "u", 2.65),
      ],
    }),
    file_name: "Facture_FAC-77120.pdf", file_size: 61_402, received_at: "2026-10-01T09:05:00",
    events: [ev("received", "2026-10-01T09:05:00", "import")],
  },
  {
    id: "cil-av-26-0088",
    format: "facturx",
    status: "received",
    data: read({
      kind: "credit_note",
      number: "CIL-AV-26-0088", issue_date: "2026-09-29", seller: COMPTOIR,
      preceding_invoice: { number: "CIL-26-04512", issue_date: "2026-09-22" },
      lines: [line("Laine de verre 100 mm, rouleau (retour)", 4, "u", 31.5)],
    }),
    file_name: "CIL-AV-26-0088.pdf", file_size: 39_877, received_at: "2026-09-30T07:58:00",
    events: [ev("received", "2026-09-30T07:58:00", "import")],
  },
  {
    id: "llm-2026-0874",
    format: "facturx",
    status: "approved",
    data: read({
      number: "LLM-2026-0874", issue_date: "2026-08-28", due_date: "2026-09-27", seller: LIGERIA,
      lines: [
        line("Location mini-pelle 2,5 t", 2, "jour", 165),
        line("Transport aller-retour", 1, "forfait", 90),
      ],
    }),
    file_name: "LLM-2026-0874.pdf", file_size: 44_120, received_at: "2026-08-29T10:20:00",
    events: [ev("received", "2026-08-29T10:20:00", "import"), ev("approved", "2026-09-02T17:45:00", "user")],
  },
  {
    id: "rcp-0926-118",
    format: "pdf",
    status: "payment_sent",
    data: null,
    manual: { supplier_name: "Relais Carburant des Ponts", supplier_siren: null, number: "RCP-0926-118", issue_date: "2026-09-30", due_date: "2026-10-10", ht: 520.83, tva: 104.17, ttc: 625 },
    file_name: "releve-carburant-septembre.pdf", file_size: 112_530, received_at: "2026-09-30T19:02:00",
    events: [ev("received", "2026-09-30T19:02:00", "import"), ev("payment_sent", "2026-09-30T19:04:00", "user")],
  },
  {
    id: "llm-2026-0921",
    format: "facturx",
    status: "refused",
    reason_code: "DOUBLON",
    reason: "Même location que la facture LLM-2026-0917, renvoyée sous un autre numéro.",
    data: read({
      number: "LLM-2026-0921", issue_date: "2026-09-29", due_date: "2026-10-29", seller: LIGERIA,
      lines: [
        line("Location nacelle articulée 12 m", 3, "jour", 145),
        line("Transport aller-retour", 1, "forfait", 90),
      ],
    }),
    file_name: "LLM-2026-0921.pdf", file_size: 45_310, received_at: "2026-09-30T08:40:00",
    events: [
      ev("received", "2026-09-30T08:40:00", "import"),
      ev("refused", "2026-09-30T08:52:00", "user", { reason_code: "DOUBLON", reason: "Même location que la facture LLM-2026-0917, renvoyée sous un autre numéro." }),
    ],
  },
]

export const DEMO_RECEIVED: ReceivedDetail[] = SPECS.map(detail)

export const DEMO_RECEIVED_LIST: ReceivedListItem[] = DEMO_RECEIVED.map((d) => ({
  id: d.id, supplier_name: d.supplier_name, supplier_siren: d.supplier_siren, invoice_number: d.invoice_number,
  document_type: d.document_type, issue_date: d.issue_date, due_date: d.due_date, total_ttc: d.total_ttc,
  amount_due: d.amount_due, currency: d.currency, status: d.status, format: d.format, source: d.source, created_at: d.created_at,
}))

export function demoReceived(id: string): ReceivedDetail | undefined {
  return DEMO_RECEIVED.find((d) => d.id === id)
}

/* ------------------------------------------------------------------ */
/* Fichiers d'exemple pour l'import de démonstration                     */
/* ------------------------------------------------------------------ */

/** Nouvelle facture du négoce, en XML CII (lue dans le navigateur par le même code que l'application). */
export function demoSampleXml(): string {
  return buildFacturX({
    kind: "invoice", number: "CIL-26-04655", issue_date: "2026-10-01", due_date: "2026-10-31",
    seller: COMPTOIR, buyer: ME, payment_terms: "Paiement à 30 jours par virement.",
    lines: [
      line("Plaque de plâtre hydro BA13 2,50 x 1,20 m", 30, "u", 11.2),
      line("Rail R48 3 m", 40, "u", 3.2),
      line("Vis TTPC 25 mm, boîte de 1 000", 5, "u", 9.9),
    ],
  }).xml
}

/** La facture LLM-2026-0917 déjà enregistrée, envoyée une seconde fois : l'import la bloque. */
export function demoDuplicateXml(): string {
  return buildFacturX({
    kind: "invoice", number: "LLM-2026-0917", issue_date: "2026-09-28", due_date: "2026-10-28",
    seller: LIGERIA, buyer: ME, payment_terms: "Paiement à 30 jours par virement.",
    lines: [
      line("Location nacelle articulée 12 m", 3, "jour", 145),
      line("Transport aller-retour", 1, "forfait", 90),
      line("Garantie casse", 3, "jour", 12),
    ],
  }).xml
}
