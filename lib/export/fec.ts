/**
 * Générateur FEC — Fichier des Écritures Comptables
 *
 * Format officiel DGFiP (Arrêté du 29 juillet 2013 — CGI art. 47 A I).
 * Requis lors de toute vérification de comptabilité informatisée.
 *
 * Spécifications appliquées :
 *   - Séparateur de champs : tabulation (\t)
 *   - Fin de ligne         : \r\n (CRLF — obligatoire DGFiP)
 *   - Encodage             : UTF-8 avec BOM \uFEFF (compatibilité Excel, Sage, Cegid, EBP)
 *   - Séparateur décimal   : virgule (ex : 1 200,00)
 *   - Format de date       : YYYYMMDD
 *   - Nom de fichier       : {SIREN}FEC{YYYYMMDD}.txt
 *
 * Journaux générés :
 *   VT — Journal des ventes (factures)
 *   AV — Journal des avoirs (credit notes)
 *
 * Comptes PCG utilisés :
 *   411xxxxx — Clients (créance TTC)
 *   706xxxxx — Prestations de services (produit HT)
 *   445710xx — TVA collectée (par taux)
 */

import type { InvoiceLine } from '@/types'

// ── 18 colonnes FEC dans l'ordre strict DGFiP ────────────────────────────────
const FEC_HEADER = [
  'JournalCode', 'JournalLib', 'EcritureNum', 'EcritureDate',
  'CompteNum', 'CompteLib', 'CompAuxNum', 'CompAuxLib',
  'PieceRef', 'PieceDate', 'EcritureLib',
  'Debit', 'Credit',
  'EcritureLet', 'DateLet', 'ValidDate',
  'Montantdevise', 'Idevise',
].join('\t')

// ── Comptes PCG ───────────────────────────────────────────────────────────────
const COMPTE_CLIENT = { num: '41100000', lib: 'Clients' }
const COMPTE_VENTES = { num: '70600000', lib: 'Prestations de services' }

const TVA_COMPTES: Record<number, { num: string; lib: string }> = {
  20:  { num: '44571000', lib: 'TVA collectée 20 %'  },
  10:  { num: '44572000', lib: 'TVA collectée 10 %'  },
  5.5: { num: '44573000', lib: 'TVA collectée 5,5 %' },
  2.1: { num: '44574000', lib: 'TVA collectée 2,1 %' },
}

// ── Statuts de facture inclus dans le FEC ────────────────────────────────────
// Exclu : 'draft' (non validée) et 'cancelled' (annulée avant envoi)
const STATUTS_INCLUS = new Set([
  'sent', 'pending', 'received', 'accepted',
  'rejected', 'paid', 'overdue', 'credited',
])

// ── Helpers ───────────────────────────────────────────────────────────────────

/** YYYY-MM-DD → YYYYMMDD */
function fmtDate(iso: string): string {
  return iso.slice(0, 10).replace(/-/g, '')
}

/** Montant absolut en format français (virgule décimale, 2 décimales) */
function fmtMontant(n: number): string {
  return Math.abs(n).toFixed(2).replace('.', ',')
}

/**
 * Numéro de compte auxiliaire client :
 *   - SIREN sans espaces (9 chiffres) si disponible
 *   - Sinon : 9 premiers caractères alphanumériques du nom en majuscules
 */
function buildCompAuxNum(client: { siren?: string | null; name: string }): string {
  if (client.siren) {
    const cleaned = client.siren.replace(/\s/g, '')
    if (cleaned.length >= 9) return cleaned.slice(0, 17)
  }
  const fallback = client.name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 9)
  return fallback || 'INCONNU'
}

/** Raison sociale tronquée à 100 caractères (limite DGFiP) */
function buildCompAuxLib(name: string): string {
  return name.slice(0, 100)
}

/** Libellé d'écriture tronqué à 150 caractères */
function buildEcritureLib(s: string): string {
  return s.slice(0, 150)
}

/**
 * Regroupe les lignes d'une facture/avoir par taux TVA.
 * Retourne une Map<taux, { totalHt, totalVat }>.
 */
function groupByVatRate(
  lines: InvoiceLine[],
): Map<number, { totalHt: number; totalVat: number }> {
  const groups = new Map<number, { totalHt: number; totalVat: number }>()
  for (const line of lines) {
    const rate    = line.vat_rate
    const current = groups.get(rate) ?? { totalHt: 0, totalVat: 0 }
    groups.set(rate, {
      totalHt:  current.totalHt  + (line.total_ht  ?? 0),
      totalVat: current.totalVat + (line.total_vat ?? 0),
    })
  }
  return groups
}

/**
 * Construit une ligne FEC (18 colonnes, séparées par \t).
 * EcritureLet, DateLet, Montantdevise, Idevise sont toujours vides.
 * ValidDate = EcritureDate (simplification légale courante).
 */
interface FecRowParams {
  journalCode:  string
  journalLib:   string
  ecritureNum:  string
  ecritureDate: string
  compteNum:    string
  compteLib:    string
  compAuxNum:   string
  compAuxLib:   string
  pieceRef:     string
  pieceDate:    string
  ecritureLib:  string
  debit:        string
  credit:       string
}

function buildFecRow(p: FecRowParams): string {
  return [
    p.journalCode, p.journalLib, p.ecritureNum,  p.ecritureDate,
    p.compteNum,   p.compteLib,  p.compAuxNum,   p.compAuxLib,
    p.pieceRef,    p.pieceDate,  p.ecritureLib,
    p.debit,       p.credit,
    '',            '',           p.ecritureDate, // EcritureLet, DateLet, ValidDate
    '',            '',                           // Montantdevise, Idevise
  ].join('\t')
}

// ── Types publics ─────────────────────────────────────────────────────────────

export interface FecClient {
  id:    string
  name:  string
  siren?: string | null
}

export interface FecInvoice {
  invoice_number: string
  issue_date:     string
  lines:          InvoiceLine[]
  subtotal_ht:    number
  total_vat:      number
  total_ttc:      number
  status:         string
  client:         FecClient | null
}

export interface FecCreditNote {
  credit_note_number: string
  issue_date:         string
  lines:              InvoiceLine[]
  subtotal_ht:        number
  total_vat:          number
  total_ttc:          number
  client:             FecClient | null
}

export interface GenerateFecParams {
  invoices:    FecInvoice[]
  creditNotes: FecCreditNote[]
}

// ── Générateur principal ──────────────────────────────────────────────────────

/**
 * Génère le contenu complet d'un fichier FEC.
 *
 * Retourne une string prête à être téléchargée :
 *   BOM UTF-8 + en-tête 18 colonnes + une ligne par écriture, CRLF.
 *
 * Pour chaque facture (journal VT) :
 *   1 ligne Débit 411 (TTC)
 *   1 ligne Crédit 706 par groupe de taux TVA (HT)
 *   1 ligne Crédit 445xxx par groupe de taux > 0 (TVA)
 *
 * Pour chaque avoir (journal AV) : écritures inverses.
 */
export function generateFec({ invoices, creditNotes }: GenerateFecParams): string {
  const rows: string[] = []
  let vtSeq = 0
  let avSeq = 0

  // ── Factures — Journal VT ──────────────────────────────────────────────────
  for (const inv of invoices) {
    if (!STATUTS_INCLUS.has(inv.status)) continue
    if (!inv.client) continue

    vtSeq++
    const seq    = String(vtSeq).padStart(6, '0')
    const num    = `VT${seq}`
    const date   = fmtDate(inv.issue_date)
    const auxNum = buildCompAuxNum(inv.client)
    const auxLib = buildCompAuxLib(inv.client.name)
    const lib    = buildEcritureLib(`Facture ${inv.invoice_number}`)

    const commonVT = {
      journalCode: 'VT', journalLib: 'Journal des ventes',
      ecritureNum: num,  ecritureDate: date,
      pieceRef: inv.invoice_number, pieceDate: date,
    }

    // Ligne 1 — Débit 411 : créance client (= total TTC)
    rows.push(buildFecRow({
      ...commonVT,
      compteNum: COMPTE_CLIENT.num, compteLib: COMPTE_CLIENT.lib,
      compAuxNum: auxNum, compAuxLib: auxLib,
      ecritureLib: lib,
      debit: fmtMontant(inv.total_ttc), credit: '0,00',
    }))

    // Lignes suivantes — Crédit 706 + 445xxx par groupe TVA
    const vatGroups = groupByVatRate(inv.lines)
    for (const [rate, { totalHt, totalVat }] of vatGroups) {

      // Crédit 706 — produit HT
      rows.push(buildFecRow({
        ...commonVT,
        compteNum: COMPTE_VENTES.num, compteLib: COMPTE_VENTES.lib,
        compAuxNum: '', compAuxLib: '',
        ecritureLib: lib,
        debit: '0,00', credit: fmtMontant(totalHt),
      }))

      // Crédit 445xxx — TVA collectée (uniquement si taux > 0 et montant significatif)
      if (rate > 0 && totalVat > 0.005) {
        const tva = TVA_COMPTES[rate] ?? { num: '44571000', lib: `TVA collectée ${rate} %` }
        rows.push(buildFecRow({
          ...commonVT,
          compteNum: tva.num, compteLib: tva.lib,
          compAuxNum: '', compAuxLib: '',
          ecritureLib: buildEcritureLib(`TVA ${rate}% — ${inv.invoice_number}`),
          debit: '0,00', credit: fmtMontant(totalVat),
        }))
      }
    }
  }

  // ── Avoirs — Journal AV ────────────────────────────────────────────────────
  for (const cn of creditNotes) {
    if (!cn.client) continue

    avSeq++
    const seq    = String(avSeq).padStart(6, '0')
    const num    = `AV${seq}`
    const date   = fmtDate(cn.issue_date)
    const auxNum = buildCompAuxNum(cn.client)
    const auxLib = buildCompAuxLib(cn.client.name)
    const lib    = buildEcritureLib(`Avoir ${cn.credit_note_number}`)

    const commonAV = {
      journalCode: 'AV', journalLib: 'Journal des avoirs',
      ecritureNum: num,  ecritureDate: date,
      pieceRef: cn.credit_note_number, pieceDate: date,
    }

    // Ligne 1 — Crédit 411 : annulation créance (= total TTC, sens inversé)
    rows.push(buildFecRow({
      ...commonAV,
      compteNum: COMPTE_CLIENT.num, compteLib: COMPTE_CLIENT.lib,
      compAuxNum: auxNum, compAuxLib: auxLib,
      ecritureLib: lib,
      debit: '0,00', credit: fmtMontant(cn.total_ttc),
    }))

    // Lignes suivantes — Débit 706 + 445xxx (sens inversé)
    const vatGroups = groupByVatRate(cn.lines)
    for (const [rate, { totalHt, totalVat }] of vatGroups) {

      // Débit 706 — annulation produit HT
      rows.push(buildFecRow({
        ...commonAV,
        compteNum: COMPTE_VENTES.num, compteLib: COMPTE_VENTES.lib,
        compAuxNum: '', compAuxLib: '',
        ecritureLib: lib,
        debit: fmtMontant(totalHt), credit: '0,00',
      }))

      // Débit 445xxx — annulation TVA collectée
      if (rate > 0 && totalVat > 0.005) {
        const tva = TVA_COMPTES[rate] ?? { num: '44571000', lib: `TVA collectée ${rate} %` }
        rows.push(buildFecRow({
          ...commonAV,
          compteNum: tva.num, compteLib: tva.lib,
          compAuxNum: '', compAuxLib: '',
          ecritureLib: buildEcritureLib(`TVA ${rate}% — ${cn.credit_note_number}`),
          debit: fmtMontant(totalVat), credit: '0,00',
        }))
      }
    }
  }

  // ── Assemblage final ──────────────────────────────────────────────────────
  // BOM UTF-8 (\uFEFF) + en-tête + lignes séparées par CRLF
  return '\uFEFF' + [FEC_HEADER, ...rows].join('\r\n')
}
