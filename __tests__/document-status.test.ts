/**
 * Tests pour lib/utils/document-status.ts.
 *
 * Documente la faille corrigée le 2026-10-01 : un PATCH { status: "draft" } remettait
 * une facture émise en brouillon, ce qui la rendait de nouveau modifiable puis
 * supprimable. Une facture émise ne se modifie ni ne se supprime : elle se corrige
 * par un avoir (numérotation continue, CGI art. 242 nonies A).
 */
import { describe, it, expect } from 'vitest'
import {
  canTransition,
  isContentLocked,
  statusAfterSend,
  canRemindInvoice,
  canConvertQuote,
  transitionError,
} from '@/lib/utils/document-status'

const ISSUED_INVOICE_STATUSES = ['sent', 'pending', 'received', 'accepted', 'rejected', 'paid', 'overdue', 'credited', 'cancelled']

describe('factures : jamais de retour au brouillon', () => {
  it.each(ISSUED_INVOICE_STATUSES)('refuse %s → draft (cœur de la faille)', (from) => {
    expect(canTransition('invoice', from, 'draft')).toBe(false)
  })

  it('refuse de poser « credited » ou « cancelled » à la main : seuls un avoir ou rien ne le font', () => {
    expect(canTransition('invoice', 'sent', 'credited')).toBe(false)
    expect(canTransition('invoice', 'paid', 'credited')).toBe(false)
    expect(canTransition('invoice', 'sent', 'cancelled')).toBe(false)
    expect(canTransition('invoice', 'draft', 'cancelled')).toBe(false)
  })

  it('fige une facture créditée ou annulée', () => {
    for (const to of ['sent', 'paid', 'overdue', 'accepted']) {
      expect(canTransition('invoice', 'credited', to)).toBe(false)
      expect(canTransition('invoice', 'cancelled', to)).toBe(false)
    }
  })

  it('accepte les actions proposées par la fiche facture (InvoiceDetail NEXT_ACTIONS)', () => {
    expect(canTransition('invoice', 'draft', 'sent')).toBe(true)
    expect(canTransition('invoice', 'sent', 'paid')).toBe(true)
    expect(canTransition('invoice', 'sent', 'overdue')).toBe(true)
    expect(canTransition('invoice', 'pending', 'paid')).toBe(true)
    expect(canTransition('invoice', 'received', 'accepted')).toBe(true)
    expect(canTransition('invoice', 'received', 'rejected')).toBe(true)
    expect(canTransition('invoice', 'accepted', 'paid')).toBe(true)
    expect(canTransition('invoice', 'overdue', 'paid')).toBe(true)
  })

  it('permet de corriger un paiement saisi par erreur, sans toucher au contenu', () => {
    expect(canTransition('invoice', 'paid', 'sent')).toBe(true)
    expect(canTransition('invoice', 'paid', 'overdue')).toBe(true)
  })

  it('accepte une requête rejouée avec le même statut', () => {
    expect(canTransition('invoice', 'paid', 'paid')).toBe(true)
    expect(canTransition('invoice', 'draft', 'draft')).toBe(true)
  })

  it('refuse un statut inconnu', () => {
    expect(canTransition('invoice', 'sent', 'deleted')).toBe(false)
    expect(canTransition('invoice', 'unknown', 'sent')).toBe(false)
  })
})

describe('devis et bons de commande', () => {
  it('refusent le retour au brouillon une fois envoyés', () => {
    for (const from of ['sent', 'accepted', 'rejected']) expect(canTransition('quote', from, 'draft')).toBe(false)
    for (const from of ['sent', 'confirmed', 'cancelled']) expect(canTransition('purchase_order', from, 'draft')).toBe(false)
  })

  it('figent un devis accepté : un changement passe par un avenant', () => {
    expect(canTransition('quote', 'accepted', 'sent')).toBe(false)
    expect(canTransition('quote', 'accepted', 'rejected')).toBe(false)
  })

  it('accepte les actions proposées par les fiches devis et bon de commande', () => {
    expect(canTransition('quote', 'draft', 'sent')).toBe(true)
    expect(canTransition('quote', 'sent', 'accepted')).toBe(true)
    expect(canTransition('quote', 'sent', 'rejected')).toBe(true)
    expect(canTransition('purchase_order', 'draft', 'sent')).toBe(true)
    expect(canTransition('purchase_order', 'sent', 'confirmed')).toBe(true)
    expect(canTransition('purchase_order', 'sent', 'cancelled')).toBe(true)
    expect(canTransition('purchase_order', 'confirmed', 'cancelled')).toBe(true)
  })
})

describe('contenu, envoi, relance, conversion', () => {
  it('ne laisse modifier le contenu que d\'un brouillon', () => {
    expect(isContentLocked('draft')).toBe(false)
    for (const s of ['sent', 'accepted', 'paid', 'credited', 'confirmed']) expect(isContentLocked(s)).toBe(true)
  })

  it('n\'écrase pas un statut final quand on renvoie une copie par email', () => {
    expect(statusAfterSend('invoice', 'draft')).toBe('sent')
    expect(statusAfterSend('invoice', 'rejected')).toBe('sent')
    expect(statusAfterSend('invoice', 'paid')).toBe('paid')
    expect(statusAfterSend('invoice', 'credited')).toBe('credited')
    expect(statusAfterSend('quote', 'accepted')).toBe('accepted')
    expect(statusAfterSend('quote', 'rejected')).toBe('rejected')
    expect(statusAfterSend('purchase_order', 'confirmed')).toBe('confirmed')
  })

  it('ne relance qu\'une facture émise et non réglée', () => {
    for (const s of ['sent', 'pending', 'received', 'accepted', 'overdue']) expect(canRemindInvoice(s)).toBe(true)
    for (const s of ['draft', 'paid', 'credited', 'cancelled', 'rejected']) expect(canRemindInvoice(s)).toBe(false)
  })

  it('ne convertit en facture qu\'un devis envoyé ou accepté', () => {
    expect(canConvertQuote('sent')).toBe(true)
    expect(canConvertQuote('accepted')).toBe(true)
    expect(canConvertQuote('draft')).toBe(false)
    expect(canConvertQuote('rejected')).toBe(false)
  })

  it('explique comment corriger une facture émise', () => {
    expect(transitionError('invoice', 'paid', 'draft')).toMatch(/avoir/)
  })
})
