/**
 * Événements PostHog envoyés depuis le navigateur.
 *
 * posthog-js n'est initialisé que si NEXT_PUBLIC_POSTHOG_KEY est défini
 * (components/shared/PostHogProvider.tsx) : sans clé, ces fonctions ne font rien.
 * Jamais de donnée personnelle ni de contenu de document dans les propriétés :
 * un type d'outil, un compte de lignes, au plus. L'analytique ne doit jamais
 * casser un parcours, d'où les try/catch.
 */
import posthog from "posthog-js"

const actif = () => typeof window !== "undefined" && Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY)

export function captureEvent(nom: string, proprietes?: Record<string, string | number | boolean>) {
  if (!actif()) return
  try {
    posthog.capture(nom, proprietes)
  } catch {
    // ignoré : l'événement est perdu, le parcours continue
  }
}

/**
 * Relie le visiteur anonyme au compte qu'il vient de créer (PostHog est configuré en
 * `identified_only`). On n'envoie que l'identifiant du compte, jamais l'email ni le nom.
 */
export function identifyUser(userId: string | null | undefined) {
  if (!userId || !actif()) return
  try {
    posthog.identify(userId)
  } catch {
    // ignoré, comme ci-dessus
  }
}
