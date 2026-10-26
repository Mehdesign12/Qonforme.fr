import { describe, expect, it } from 'vitest'
import { parseActivationParam, sendAfterPaymentOutcome, wantsSendAfterPayment, withActivationParam } from '@/lib/stripe/activation'
import { buildSubscriptionActivatedEmail } from '@/lib/email/templates/subscription-activated'

describe('paramètre d’activation', () => {
  it('ajoute abonnement=1 par défaut', () => {
    expect(withActivationParam('/dashboard')).toBe('/dashboard?abonnement=1')
  })
  it('remplace send=1 par abonnement=envoi', () => {
    const out = withActivationParam('/invoices/abc?send=1')
    expect(out).toContain('abonnement=envoi')
    expect(out).not.toContain('send=1')
  })
  it('lit seulement les valeurs connues', () => {
    expect(parseActivationParam('1')).toBe('standard')
    expect(parseActivationParam('envoi')).toBe('envoi')
    expect(parseActivationParam('x')).toBeNull()
    expect(parseActivationParam(null)).toBeNull()
  })
})

describe('envoi de la facture après le paiement', () => {
  it('ne réagit qu’à send=1', () => {
    expect(wantsSendAfterPayment('1')).toBe(true)
    expect(wantsSendAfterPayment('0')).toBe(false)
    expect(wantsSendAfterPayment('true')).toBe(false)
    expect(wantsSendAfterPayment(null)).toBe(false)
    expect(wantsSendAfterPayment(undefined)).toBe(false)
  })
  it('ouvre l’envoi pour un brouillon dont le client a un email', () => {
    expect(sendAfterPaymentOutcome({ status: 'draft', client: { email: 'a@b.fr' } })).toBe('open')
  })
  it('refuse clairement une facture déjà émise', () => {
    for (const status of ['sent', 'paid', 'overdue', 'credited']) {
      expect(sendAfterPaymentOutcome({ status, client: { email: 'a@b.fr' } })).toBe('not-draft')
    }
  })
  it('signale un client sans email, vide ou absent', () => {
    expect(sendAfterPaymentOutcome({ status: 'draft', client: { email: null } })).toBe('no-email')
    expect(sendAfterPaymentOutcome({ status: 'draft', client: { email: '   ' } })).toBe('no-email')
    expect(sendAfterPaymentOutcome({ status: 'draft', client: null })).toBe('no-email')
    expect(sendAfterPaymentOutcome({ status: 'draft' })).toBe('no-email')
  })
})

describe('email d’abonnement activé', () => {
  it('nomme la formule, le montant et la garantie', () => {
    const { subject, html } = buildSubscriptionActivatedEmail({
      plan: 'starter', period: 'monthly', nextPaymentAt: new Date('2026-11-20T10:00:00Z'),
    })
    expect(subject).toContain('Essentiel')
    expect(html).toContain('24,00')
    expect(html).toContain('30 jours')
    expect(html).toContain('Ouvrir Qonforme')
    expect(html).not.toMatch(/\bHT\b|\bTTC\b/)
  })
})
