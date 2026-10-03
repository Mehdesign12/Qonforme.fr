/**
 * Modèle « devis gratuits, factures payantes » : règles d'accès, garantie,
 * chemin de retour après paiement, grille de prix et mur de paiement serveur.
 */
import { describe, it, expect } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  mapStripeStatus,
  canIssueInvoices,
  guaranteeEndsAt,
  isWithinGuarantee,
  safeNextPath,
  SUBSCRIPTION_REQUIRED,
} from '@/lib/stripe/access'
import { PLANS, withVat, formatEuros, getPlanByPriceId, isPlanId } from '@/lib/stripe/plans'
import { requireIssuingAccess } from '@/lib/stripe/subscription'

describe('mapStripeStatus', () => {
  it('actif et essai → active', () => {
    expect(mapStripeStatus('active')).toBe('active')
    expect(mapStripeStatus('trialing')).toBe('active')
  })
  it('impayé en cours de nouvelles tentatives → past_due', () => {
    expect(mapStripeStatus('past_due')).toBe('past_due')
  })
  it('tentatives épuisées, annulé, expiré → canceled', () => {
    expect(mapStripeStatus('unpaid')).toBe('canceled')
    expect(mapStripeStatus('canceled')).toBe('canceled')
    expect(mapStripeStatus('incomplete_expired')).toBe('canceled')
  })
  it('paiement non abouti ou en pause → incomplete', () => {
    expect(mapStripeStatus('incomplete')).toBe('incomplete')
    expect(mapStripeStatus('paused')).toBe('incomplete')
  })
})

describe('canIssueInvoices', () => {
  it('autorise une formule active ou en délai de grâce', () => {
    expect(canIssueInvoices('active')).toBe(true)
    expect(canIssueInvoices('past_due')).toBe(true)
  })
  it('refuse un compte gratuit, résilié ou au paiement abandonné', () => {
    expect(canIssueInvoices(null)).toBe(false)
    expect(canIssueInvoices(undefined)).toBe(false)
    expect(canIssueInvoices('canceled')).toBe(false)
    expect(canIssueInvoices('incomplete')).toBe(false)
  })
})

describe('garantie 30 jours', () => {
  const firstPaid = new Date('2026-10-02T10:00:00Z')

  it('se termine 30 jours après le premier paiement', () => {
    expect(guaranteeEndsAt(firstPaid).toISOString()).toBe('2026-11-01T10:00:00.000Z')
  })
  it('est ouverte jusqu’à la dernière seconde incluse', () => {
    expect(isWithinGuarantee(firstPaid, new Date('2026-10-02T10:00:00Z'))).toBe(true)
    expect(isWithinGuarantee(firstPaid, new Date('2026-11-01T10:00:00Z'))).toBe(true)
  })
  it('est close passé 30 jours', () => {
    expect(isWithinGuarantee(firstPaid, new Date('2026-11-01T10:00:01Z'))).toBe(false)
  })
  it('n’existe pas sans paiement', () => {
    expect(isWithinGuarantee(null)).toBe(false)
  })
})

describe('safeNextPath — pas de redirection ouverte après paiement', () => {
  it('accepte un chemin interne', () => {
    expect(safeNextPath('/invoices/abc?send=1')).toBe('/invoices/abc?send=1')
    expect(safeNextPath('/settings/billing')).toBe('/settings/billing')
  })
  it('refuse une URL absolue ou relative au protocole', () => {
    expect(safeNextPath('https://evil.example')).toBeNull()
    expect(safeNextPath('//evil.example')).toBeNull()
    expect(safeNextPath('/\\evil.example')).toBeNull()
    expect(safeNextPath('javascript:alert(1)')).toBeNull()
  })
  it('refuse les caractères de contrôle, les antislashs et les valeurs absurdes', () => {
    expect(safeNextPath('/invoices\n/x')).toBeNull()
    expect(safeNextPath('/a\\b')).toBeNull()
    expect(safeNextPath('')).toBeNull()
    expect(safeNextPath('/' + 'a'.repeat(400))).toBeNull()
    expect(safeNextPath(undefined)).toBeNull()
    expect(safeNextPath(['/invoices'])).toBeNull()
  })
})

describe('grille de prix', () => {
  it('Essentiel : 12 € HT par mois, 120 € HT par an', () => {
    expect(PLANS.starter.name).toBe('Essentiel')
    expect(PLANS.starter.monthlyPrice).toBe(12)
    expect(PLANS.starter.yearlyPrice).toBe(120)
    expect(PLANS.starter.yearlyMonthlyEquivalent).toBe(10)
    expect(PLANS.starter.available).toBe(true)
  })
  it('Artisan : 24 € HT, fonctions livrées, en vente seulement avec ses deux prix Stripe', () => {
    expect(PLANS.pro.name).toBe('Artisan')
    expect(PLANS.pro.monthlyPrice).toBe(24)
    expect(PLANS.pro.yearlyPrice).toBe(240)
    // Sans NEXT_PUBLIC_ARTISAN_ON_SALE (next.config.mjs), pas en vente
    expect(PLANS.pro.available).toBe(false)
    expect(PLANS.pro.features).toContain('Situations de travaux et factures d’acompte')
    expect(PLANS.pro.features).toContain('Suivi par chantier')
    expect(PLANS.pro.upcoming).toEqual([])
  })
  it('TVA 20 % arrondie au centime', () => {
    expect(withVat(12)).toBe(14.4)
    expect(withVat(120)).toBe(144)
    expect(withVat(24)).toBe(28.8)
  })
  it('montants affichés à la française', () => {
    expect(formatEuros(12)).toBe('12 €')
    expect(formatEuros(14.4)).toBe('14,40 €')
    expect(formatEuros(144)).toBe('144 €')
  })
  it('un price_id vide ne correspond à aucune formule', () => {
    expect(getPlanByPriceId('')).toBeNull()
    expect(getPlanByPriceId('price_inconnu')).toBeNull()
  })
  it('identifiants internes inchangés (contrainte CHECK de la table subscriptions)', () => {
    expect(isPlanId('starter')).toBe(true)
    expect(isPlanId('pro')).toBe(true)
    expect(isPlanId('essentiel')).toBe(false)
  })
})

describe('requireIssuingAccess — mur de paiement côté serveur', () => {
  function fakeSupabase(result: { data: { status: string } | null; error: { code: string } | null }) {
    const query = {
      select: () => query,
      eq: () => query,
      maybeSingle: async () => result,
    }
    return { from: () => query } as unknown as SupabaseClient
  }

  it('laisse émettre une formule active ou en délai de grâce', async () => {
    expect(await requireIssuingAccess(fakeSupabase({ data: { status: 'active' }, error: null }), 'u1')).toBeNull()
    expect(await requireIssuingAccess(fakeSupabase({ data: { status: 'past_due' }, error: null }), 'u1')).toBeNull()
  })

  it('répond 402 SUBSCRIPTION_REQUIRED sans formule', async () => {
    for (const data of [null, { status: 'canceled' }, { status: 'incomplete' }]) {
      const res = await requireIssuingAccess(fakeSupabase({ data, error: null }), 'u1')
      expect(res?.status).toBe(402)
      expect((await res!.json()).code).toBe(SUBSCRIPTION_REQUIRED)
    }
  })

  it('répond 503 sur une erreur de lecture, jamais un faux « sans formule »', async () => {
    const res = await requireIssuingAccess(fakeSupabase({ data: null, error: { code: '500' } }), 'u1')
    expect(res?.status).toBe(503)
  })
})
