import { describe, expect, it } from 'vitest'
import { parseActivationParam, withActivationParam } from '@/lib/stripe/activation'
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
