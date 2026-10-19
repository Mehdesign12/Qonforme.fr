/**
 * Étiquette d'une facture d'abonnement Stripe, partagée par la page Abonnement
 * du client et l'activité de l'admin : une facture payée puis remboursée par un
 * avoir (garantie de 30 jours) ne doit plus se lire « Payée ».
 */
export type InvoiceTone = 'ok' | 'info' | 'warn' | 'danger' | 'neutral'

export interface InvoiceBadge {
  label: string
  tone: InvoiceTone
}

/** `amount` et `refunded` dans la même unité (euros ou centimes). */
export function invoiceBadge(status: string, amount: number, refunded = 0): InvoiceBadge {
  if (status === 'paid' && refunded > 0) {
    // Tolérance d'un demi-centime ou d'un centime selon l'unité : un avoir couvre la facture
    return refunded >= amount * 0.999
      ? { label: 'Remboursée', tone: 'info' }
      : { label: 'Remboursée en partie', tone: 'info' }
  }
  switch (status) {
    case 'paid': return { label: 'Payée', tone: 'ok' }
    case 'open': return { label: 'À régler', tone: 'warn' }
    case 'uncollectible': return { label: 'Impayée', tone: 'danger' }
    case 'void': return { label: 'Annulée', tone: 'neutral' }
    case 'draft': return { label: 'Brouillon', tone: 'neutral' }
    default: return { label: status, tone: 'neutral' }
  }
}
