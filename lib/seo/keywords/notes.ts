/**
 * Notes d'un mot-clé enregistrées d'elles-mêmes (panneau de détail) : règles
 * pures, testées dans __tests__/seo-keywords-rules.test.ts.
 *
 * - une saisie revenue à la valeur enregistrée n'a plus rien à envoyer, ni
 *   après le délai, ni à la fermeture du panneau (sinon un texte effacé
 *   pouvait partir) ;
 * - à la fermeture, la saisie affichée part si le serveur ne l'a pas déjà et
 *   qu'elle n'est pas en cours d'envoi ;
 * - une saisie modifiée pendant un envoi est renvoyée ensuite.
 */

export type NotesState = "idle" | "pending" | "saving" | "saved" | "error"

/** Vrai si la saisie diffère de ce que le serveur a : un enregistrement doit être programmé. */
export function notesNeedSave(notes: string, saved: string): boolean {
  return notes !== saved
}

/** État affiché quand la saisie revient à la valeur enregistrée (« en attente » et « erreur » s'effacent). */
export function notesStateWhenBackToSaved(state: NotesState): NotesState {
  return state === "pending" || state === "error" ? "idle" : state
}

/** Saisie à envoyer à la fermeture du panneau, ou null s'il n'y a rien à envoyer. */
export function notesToFlush(latest: string, sending: string | null, saved: string): string | null {
  const lastSent = sending ?? saved
  return latest !== lastSent ? latest : null
}

/** Après un envoi réussi de `sent` : vrai si la saisie a changé entre-temps et doit repartir. */
export function notesNeedResend(latest: string, sent: string): boolean {
  return latest !== sent
}
