/**
 * Événements de parcours : où un nouvel inscrit s'arrête (inscription, fenêtre « Bienvenue »,
 * premier devis, première facture). Ils alimentent le funnel de PostHog.
 *
 * Règles (CLAUDE.md, « Traceurs ») :
 *  - envoyés par `captureEvent`, donc seulement après l'accord du visiteur, jamais sur les
 *    pages sans traceur ;
 *  - **jamais de donnée personnelle ni de contenu** : ni SIREN, ni nom, ni adresse, ni texte
 *    recherché, ni montant, ni numéro de document. Seulement un nom d'étape, un type de
 *    document ou un motif d'échec parmi une liste fermée ;
 *  - un nom d'événement ne s'écrit qu'ici (liste fermée : une faute de frappe ne passe pas la compilation).
 */
import { captureEvent } from "@/components/shared/PostHogProvider"

export type JourneyEvents = {
  /** Compte créé par email et mot de passe (Google : voir `signup_completed` de la route de retour, non suivi côté navigateur). */
  signup_completed: { method: "email" }
  /** Création de compte refusée : compte déjà existant, ou autre erreur du serveur. */
  signup_failed: { reason: "already_exists" | "other" }
  /** Une étape de la fenêtre « Bienvenue » s'affiche. */
  onboarding_step_viewed: { step: string }
  /** L'étape est validée (`manual` : entreprise saisie à la main, sans choisir dans le répertoire). */
  onboarding_step_completed: { step: string; manual?: boolean }
  /** L'enregistrement de l'étape a échoué (réseau, session) : la fenêtre revient sur l'étape. */
  onboarding_step_failed: { step: string }
  /** La fenêtre se ferme ; `finished` : l'écran final était affiché, sinon c'est un abandon à `step`. */
  onboarding_closed: { step: string; finished: boolean }
  /** La recherche d'entreprise n'a rien donné (`not_found`) ou le répertoire n'a pas répondu (`unavailable`). */
  onboarding_company_search_failed: { result: "not_found" | "unavailable"; kind: "number" | "name" }
  /** Le formulaire du devis ou de la facture est refusé : champs à corriger. */
  document_form_invalid: { document: "quote" | "invoice" }
  /** Document enregistré (`action` : enregistrement automatique, brouillon seul, ou création puis envoi). */
  quote_created: { action: "autosave" | "draft" | "send" }
  invoice_created: { action: "autosave" | "draft" | "send" }
  /** Document envoyé par email au client. */
  quote_sent: Record<never, never>
  invoice_sent: Record<never, never>
  /** PDF d'un devis téléchargé depuis sa fiche (`status` : statut du devis à ce moment, liste fermée). Mesure qui repart avec le PDF au lieu d'envoyer par Qonforme. */
  quote_pdf_downloaded: { status: "draft" | "sent" | "accepted" | "other" }
  /** Envoi refusé : l'identité de l'entreprise (SIREN, adresse) n'est pas complète. */
  send_blocked: { reason: "company_required" }
}

export type JourneyEventName = keyof JourneyEvents

export function trackJourney<N extends JourneyEventName>(
  name: N,
  ...props: keyof JourneyEvents[N] extends never ? [] : [JourneyEvents[N]]
): void {
  captureEvent(name, (props[0] ?? undefined) as Record<string, string | number | boolean> | undefined)
}

/** Une recherche d'entreprise : un numéro (SIREN, SIRET) ou un nom. Sert à classer l'échec, sans garder le texte. */
export function searchKind(query: string): "number" | "name" {
  const compact = query.replace(/[\s.]/g, "")
  return /^\d{9,14}$/.test(compact) ? "number" : "name"
}
