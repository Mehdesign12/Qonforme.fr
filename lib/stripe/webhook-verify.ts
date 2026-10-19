/**
 * Vérifie la signature d'un message du webhook Stripe et en déduit le mode.
 *
 * Une seule adresse reçoit les messages des deux modes : le bac à sable et la
 * production ont chacun leur webhook, leur clé de signature (`whsec_`) et leur
 * clé secrète. La signature qui correspond donne le mode ; un message dont
 * l'indicateur `livemode` contredit ce mode est refusé.
 */
import type Stripe from 'stripe'
import { getStripe, isStripeConfigured, webhookSecretFor, type StripeMode } from './mode'

export type VerifiedEvent = { event: Stripe.Event; mode: StripeMode }

export class WebhookConfigError extends Error {}
export class WebhookSignatureError extends Error {}

const ORDER: StripeMode[] = ['live', 'test']

export function verifyStripeEvent(body: string, signature: string): VerifiedEvent {
  const candidates = ORDER.filter((mode) => webhookSecretFor(mode) !== '' && isStripeConfigured(mode))
  if (candidates.length === 0) {
    throw new WebhookConfigError('Aucune clé de signature de webhook configurée')
  }

  for (const mode of candidates) {
    let event: Stripe.Event
    try {
      event = getStripe(mode).webhooks.constructEvent(body, signature, webhookSecretFor(mode))
    } catch {
      continue
    }
    if (event.livemode !== (mode === 'live')) {
      throw new WebhookSignatureError(`Mode du message incohérent avec sa signature (${mode})`)
    }
    return { event, mode }
  }

  throw new WebhookSignatureError('Signature invalide')
}
