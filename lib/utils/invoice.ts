import { InvoiceStatus, QuoteStatus } from '@/types'

// ---- Formatage monétaire ----
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(amount)
}

// ---- Formatage date ----
export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date))
}

// ---- Calcul TVA ----
export function calculateLineTotals(
  quantity: number,
  unitPriceHT: number,
  vatRate: 0 | 5.5 | 10 | 20
) {
  const totalHT = Math.round(quantity * unitPriceHT * 100) / 100
  const totalVAT = Math.round(totalHT * (vatRate / 100) * 100) / 100
  const totalTTC = Math.round((totalHT + totalVAT) * 100) / 100
  return { totalHT, totalVAT, totalTTC }
}

export function calculateInvoiceTotals(
  lines: Array<{ total_ht: number; total_vat: number; total_ttc: number }>
) {
  const subtotalHT = lines.reduce((sum, l) => sum + l.total_ht, 0)
  const totalVAT = lines.reduce((sum, l) => sum + l.total_vat, 0)
  const totalTTC = lines.reduce((sum, l) => sum + l.total_ttc, 0)
  return {
    subtotal_ht: Math.round(subtotalHT * 100) / 100,
    total_vat: Math.round(totalVAT * 100) / 100,
    total_ttc: Math.round(totalTTC * 100) / 100,
  }
}

// ---- Numérotation séquentielle ----
export function generateInvoiceNumber(prefix: string, sequence: number): string {
  const year = new Date().getFullYear()
  const seq = String(sequence).padStart(3, '0')
  return `${prefix}-${year}-${seq}`
}

// ---- Statuts factures ----
export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft:     'Brouillon',
  sent:      'Envoyée',
  pending:   'En attente',
  received:  'Reçue',
  accepted:  'Acceptée',
  rejected:  'Rejetée',
  paid:      'Payée',
  overdue:   'En retard',
  cancelled: 'Annulée',
  credited:  'Avoir émis',
}

export const INVOICE_STATUS_STYLES: Record<
  InvoiceStatus,
  { bg: string; text: string }
> = {
  draft:     { bg: '#F1F5F9', text: '#475569' },
  sent:      { bg: '#DBEAFE', text: '#1E40AF' },
  pending:   { bg: '#FEF3C7', text: '#92400E' },
  received:  { bg: '#EDE9FE', text: '#5B21B6' },
  accepted:  { bg: '#D1FAE5', text: '#065F46' },
  rejected:  { bg: '#FEE2E2', text: '#991B1B' },
  paid:      { bg: '#D1FAE5', text: '#065F46' },
  overdue:   { bg: '#FEE2E2', text: '#991B1B' },
  cancelled: { bg: '#F1F5F9', text: '#64748B' },
  credited:  { bg: '#FFF7ED', text: '#C2410C' },
}

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  draft:    'Brouillon',
  sent:     'Envoyé',
  accepted: 'Accepté',
  rejected: 'Refusé',
}

// ---- Taux TVA disponibles ----
export const VAT_RATES = [0, 5.5, 10, 20] as const

// ---- Validation SIREN ----
export function isValidSiren(siren: string): boolean {
  if (!/^\d{9}$/.test(siren)) return false
  // Algorithme de Luhn pour les SIREN
  let sum = 0
  for (let i = 0; i < 9; i++) {
    let n = parseInt(siren[8 - i])
    if (i % 2 === 1) {
      n *= 2
      if (n > 9) n -= 9
    }
    sum += n
  }
  return sum % 10 === 0
}

// ---- Validation TVA intracommunautaire FR ----
export function isValidFrenchVAT(vat: string): boolean {
  return /^FR\d{2}\d{9}$/.test(vat)
}

// ---- Génération numéro TVA depuis SIREN ----
export function sirenToVAT(siren: string): string {
  const key = (12 + 3 * (parseInt(siren) % 97)) % 97
  return `FR${String(key).padStart(2, '0')}${siren}`
}
