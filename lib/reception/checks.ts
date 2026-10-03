/**
 * Contrôles d'une facture reçue, avant son enregistrement.
 *
 * Trois contrôles bloquent l'enregistrement (niveau « error ») :
 * - données indispensables absentes (numéro, date, fournisseur, montant) ;
 * - facture adressée à un autre SIREN que celui de l'entreprise ;
 * - doublon : même fournisseur, même numéro, même année. C'est la règle
 *   d'unicité de la DGFiP (dossier général v3.2, § 3.6.7, note 109 : « numéro
 *   de facture, identifiant du fournisseur (SIREN) et année ») ; le guide
 *   pratique de démarrage (juillet 2026, question 5) demande de « désigner une
 *   facture de référence » pour éviter « un double paiement, une double
 *   comptabilisation ou une double déduction de TVA ».
 *
 * Les autres (totaux, TVA, mentions) sont des avertissements : la facture est
 * celle du fournisseur, l'artisan peut l'enregistrer puis la refuser avec le
 * motif adapté (lib/reception/lifecycle.ts).
 *
 * Règles de calcul : norme EN 16931 (BR-CO-10 somme des lignes, BR-CO-13 total
 * HT, BR-CO-14 total TVA, BR-CO-15 total TTC, BR-CO-16 net à payer, BR-CO-17
 * TVA d'une ventilation = base × taux), tolérance d'un centime.
 */
import { isValidSiren } from "@/lib/utils/invoice"
import { round2 } from "@/lib/reception/fields"
import {
  isCreditNoteType, isSummaryProfile, profileLabel, FORMAT_LABELS,
  type ManualEntry, type ParsedInvoice, type ReceivedFormat, type ReceptionCheck,
} from "@/lib/reception/types"

export interface CheckContext {
  /** SIREN de l'entreprise de l'utilisateur (destinataire attendu). */
  companySiren: string | null
  /** Facture déjà enregistrée avec le même fournisseur, numéro et année. */
  duplicate: { id: string; created_at: string | null } | null
}

/** Taux de TVA en vigueur en France (métropole, Corse, outre-mer). CGI, art. 278 à 281 nonies, 296 et 297. */
const FRENCH_RATES = [0, 0.9, 1.05, 1.75, 2.1, 5.5, 8.5, 10, 13, 20]

const eur = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n).replace(/ /g, " ")

const close = (a: number, b: number, tolerance = 0.01) => Math.abs(round2(a) - round2(b)) <= tolerance + 1e-9

/** « a ; b ; c. » avec une majuscule, trois éléments au plus. */
function sentence(items: string[]): string {
  const text = items.slice(0, 3).join(" ; ")
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`
}

export const hasBlockingCheck = (checks: ReceptionCheck[]) => checks.some((c) => c.level === "error")

function siren(value: string | null | undefined): string | null {
  const d = (value ?? "").replace(/\s+/g, "")
  return /^\d{9}$/.test(d) ? d : null
}

/** Contrôle du destinataire : SIREN de l'acheteur = SIREN de l'entreprise. */
function buyerCheck(buyerSiren: string | null, ctx: CheckContext): ReceptionCheck {
  const mine = siren(ctx.companySiren)
  if (!mine) {
    return {
      id: "buyer_siren",
      level: "warning",
      title: "Destinataire non vérifié",
      detail: "Renseignez le SIREN de votre entreprise dans Paramètres › Entreprise pour vérifier que les factures vous sont bien adressées.",
    }
  }
  if (!buyerSiren) {
    return {
      id: "buyer_siren",
      level: "warning",
      title: "SIREN du client absent de la facture",
      detail: "Vérifiez qu'elle est bien adressée à votre entreprise.",
    }
  }
  if (buyerSiren !== mine) {
    return {
      id: "buyer_siren",
      level: "error",
      title: "Facture adressée à une autre entreprise",
      detail: `Le client indiqué a le SIREN ${buyerSiren}, le vôtre est ${mine}. Demandez au fournisseur une facture à votre nom.`,
    }
  }
  return { id: "buyer_siren", level: "ok", title: "Adressée à votre entreprise", detail: `SIREN ${mine}` }
}

function duplicateCheck(ctx: CheckContext): ReceptionCheck {
  if (ctx.duplicate) {
    return {
      id: "duplicate",
      level: "error",
      title: "Déjà enregistrée",
      detail: "Une facture de ce fournisseur porte déjà ce numéro cette année. Gardez une seule facture de référence pour éviter un double paiement.",
      duplicate_of: ctx.duplicate,
    }
  }
  return { id: "duplicate", level: "ok", title: "Pas de doublon", detail: "Aucune facture de ce fournisseur avec ce numéro cette année." }
}

/** Contrôles d'une facture structurée (Factur-X, CII, UBL). */
export function checkParsedInvoice(inv: ParsedInvoice, format: ReceivedFormat, ctx: CheckContext): ReceptionCheck[] {
  const checks: ReceptionCheck[] = []
  const profile = profileLabel(inv.profile)

  checks.push({
    id: "format",
    level: "ok",
    title: `${FORMAT_LABELS[format]} lu`,
    detail: [isCreditNoteType(inv.type_code) ? "Avoir" : null, profile ? `profil ${profile}` : null, inv.syntax].filter(Boolean).join(" · "),
  })

  // ── Indispensables ──
  const missing: string[] = []
  if (!inv.number) missing.push("numéro")
  if (!inv.issue_date) missing.push("date")
  if (!inv.seller.name) missing.push("nom du fournisseur")
  if (inv.totals.grand_total === null && inv.totals.due_payable === null) missing.push("montant TTC")
  if (missing.length) {
    checks.push({ id: "required", level: "error", title: "Données indispensables absentes", detail: `Manque : ${missing.join(", ")}.` })
  }

  checks.push(buyerCheck(inv.buyer.siren, ctx))
  checks.push(duplicateCheck(ctx))

  // ── Profil ──
  if (isSummaryProfile(inv.profile)) {
    checks.push({
      id: "profile",
      level: "warning",
      title: "Facture sans lignes de détail",
      detail: `Le profil ${profile} ne porte que les totaux : il ne respecte pas à lui seul la norme EN 16931 exigée par la réforme.`,
    })
  } else if (inv.lines.length === 0) {
    checks.push({ id: "lines", level: "warning", title: "Aucune ligne de détail", detail: "La facture ne détaille pas ce qui est facturé." })
  }

  // ── Totaux ──
  const t = inv.totals
  const issues: string[] = []
  if (inv.lines.length > 0 && t.line_total !== null) {
    const sum = round2(inv.lines.reduce((s, l) => s + l.net_amount, 0))
    if (!close(sum, t.line_total)) issues.push(`la somme des lignes (${eur(sum)}) diffère du total des lignes (${eur(t.line_total)})`)
  }
  if (t.tax_basis !== null && t.line_total !== null) {
    const expected = round2(t.line_total - (t.allowances ?? 0) + (t.charges ?? 0))
    if (!close(expected, t.tax_basis)) issues.push(`le total HT (${eur(t.tax_basis)}) ne correspond pas aux lignes, remises et frais (${eur(expected)})`)
  }
  if (t.grand_total !== null && t.tax_basis !== null && t.tax_total !== null) {
    const expected = round2(t.tax_basis + t.tax_total)
    if (!close(expected, t.grand_total)) issues.push(`le total TTC (${eur(t.grand_total)}) n'est pas égal au HT plus la TVA (${eur(expected)})`)
  }
  if (t.due_payable !== null && t.grand_total !== null) {
    const expected = round2(t.grand_total - (t.prepaid ?? 0) + (t.rounding ?? 0))
    if (!close(expected, t.due_payable)) issues.push(`le net à payer (${eur(t.due_payable)}) ne correspond pas au TTC moins les acomptes (${eur(expected)})`)
  }
  if (inv.vat.length > 0) {
    const bases = round2(inv.vat.reduce((s, v) => s + v.base, 0))
    const taxes = round2(inv.vat.reduce((s, v) => s + v.tax, 0))
    if (t.tax_basis !== null && !close(bases, t.tax_basis)) issues.push(`les bases de TVA (${eur(bases)}) ne font pas le total HT (${eur(t.tax_basis)})`)
    if (t.tax_total !== null && !close(taxes, t.tax_total)) issues.push(`la TVA ventilée (${eur(taxes)}) ne fait pas le total TVA (${eur(t.tax_total)})`)
  }
  checks.push(issues.length
    ? { id: "totals", level: "warning", title: "Totaux incohérents", detail: sentence(issues) }
    : { id: "totals", level: "ok", title: "Totaux cohérents", detail: "Lignes, HT, TVA et TTC concordent." })

  // ── TVA ──
  const vatIssues: string[] = []
  for (const v of inv.vat) {
    if (v.category === "S" && v.rate !== null) {
      const expected = round2(v.base * v.rate / 100)
      if (!close(expected, v.tax)) vatIssues.push(`TVA à ${v.rate} % : ${eur(v.tax)} au lieu de ${eur(expected)}`)
    }
    if (v.rate !== null && !FRENCH_RATES.includes(v.rate) && (inv.seller.address?.country ?? "FR") === "FR") {
      vatIssues.push(`taux de ${v.rate} % inhabituel en France`)
    }
    if (["E", "AE", "K", "G", "O"].includes(v.category) && !v.exemption_reason && !v.exemption_code) {
      vatIssues.push(`exonération (catégorie ${v.category}) sans motif`)
    }
  }
  if (inv.vat.length === 0 && (t.tax_total ?? 0) !== 0) vatIssues.push("TVA facturée sans ventilation par taux")
  checks.push(vatIssues.length
    ? { id: "vat", level: "warning", title: "TVA à vérifier", detail: sentence(vatIssues) }
    : { id: "vat", level: "ok", title: "TVA cohérente", detail: inv.vat.length ? inv.vat.map((v) => (v.category === "S" ? `${v.rate} %` : v.category)).join(", ") : "Aucune TVA" })

  // ── Fournisseur ──
  if (!inv.seller.siren) {
    checks.push({ id: "seller_siren", level: "warning", title: "SIREN du fournisseur absent", detail: "Il permet d'identifier le fournisseur sans ambiguïté." })
  } else if (!isValidSiren(inv.seller.siren) && inv.seller.siren !== "356000000") {
    checks.push({ id: "seller_siren", level: "warning", title: "SIREN du fournisseur invalide", detail: `${inv.seller.siren} : la clé de contrôle ne correspond pas.` })
  }
  const taxed = inv.vat.some((v) => v.category === "S" && v.tax !== 0)
  if (taxed && !inv.seller.vat_number && (inv.seller.address?.country ?? "FR") === "FR") {
    checks.push({ id: "seller_vat", level: "warning", title: "N° de TVA du fournisseur absent", detail: "Mention obligatoire d'une facture avec TVA (CGI, annexe II, art. 242 nonies A)." })
  }

  // ── Divers ──
  if (inv.currency !== "EUR") {
    checks.push({ id: "currency", level: "warning", title: `Facture en ${inv.currency}`, detail: "Les montants ne sont pas en euros." })
  }
  if (inv.issue_date && inv.due_date && inv.due_date < inv.issue_date) {
    checks.push({ id: "due_date", level: "warning", title: "Échéance antérieure à la date de facture" })
  }

  return checks
}

/** Contrôles d'une saisie manuelle (PDF sans données structurées). */
export function checkManualEntry(entry: ManualEntry, ctx: CheckContext): ReceptionCheck[] {
  const checks: ReceptionCheck[] = [
    {
      id: "format",
      level: "ok",
      title: "PDF simple classé à la main",
      detail: "Pas de données structurées : vérifiez la saisie avec le PDF.",
    },
    {
      id: "buyer_siren",
      level: "warning",
      title: "Destinataire à vérifier",
      detail: "Vérifiez sur le PDF que la facture est bien adressée à votre entreprise.",
    },
    duplicateCheck(ctx),
  ]
  if (!close(round2(entry.total_ht + entry.total_vat), entry.total_ttc)) {
    checks.push({
      id: "totals",
      level: "warning",
      title: "Totaux incohérents",
      detail: `HT + TVA = ${eur(round2(entry.total_ht + entry.total_vat))}, pour un TTC de ${eur(entry.total_ttc)}.`,
    })
  }
  if (entry.supplier_siren && !isValidSiren(entry.supplier_siren) && entry.supplier_siren !== "356000000") {
    checks.push({ id: "seller_siren", level: "warning", title: "SIREN du fournisseur invalide", detail: `${entry.supplier_siren} : la clé de contrôle ne correspond pas.` })
  }
  if (entry.due_date && entry.due_date < entry.issue_date) {
    checks.push({ id: "due_date", level: "warning", title: "Échéance antérieure à la date de facture" })
  }
  return checks
}
