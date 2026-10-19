/**
 * Tuile « Terminer votre inscription » → fenêtre « Bienvenue » : la tuile
 * demande l'ouverture par un évènement, que DashboardClient écoute. Aucune
 * navigation : avant, un lien vers `/dashboard?inscription=reprendre` faisait
 * refaire tout le tableau de bord côté serveur avant que quoi que ce soit
 * change à l'écran, et le toucher semblait ne rien faire.
 */
export const RESUME_INSCRIPTION_EVENT = "qonforme:resume-inscription"

/**
 * Demande l'ouverture de la fenêtre. Vrai si elle a été prise en charge ; faux
 * s'il n'y a personne pour l'ouvrir (la tuile retombe alors sur son lien).
 */
export function requestResumeInscription(): boolean {
  const event = new CustomEvent(RESUME_INSCRIPTION_EVENT, { cancelable: true })
  window.dispatchEvent(event)
  return event.defaultPrevented
}
