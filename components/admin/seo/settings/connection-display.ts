/**
 * État affiché d'une connexion dans Paramètres › Connexions (planche
 * Parametres-connexions) : module pur, sans JSX (testé à part).
 *
 * Une clé présente n'est « Connectée » qu'après un test réussi : jamais
 * testée, ou testée sans réponse authentifiée (« unverified »), elle reste
 * « Clé présente » ; en erreur si son dernier test a échoué.
 */
import { CONNECTION_STATE, KEY_PRESENT, type ConnectionState } from "@/lib/seo/types"

export { KEY_PRESENT }

export interface ConnectionTestView {
  /** « unverified » : clé présente, le service n'a pas permis de la vérifier. */
  state: ConnectionState | "unverified"
  message: string
  checkedAt: string
}

/** État affiché : « present » = clé présente que rien n'a vérifiée (jamais testée, ou test non concluant). */
export type DisplayState = ConnectionState | "present"


/**
 * État affiché : la présence d'abord. Une clé présente n'est « Connectée »
 * qu'après un test réussi ; jamais testée ou non vérifiée, elle reste « Clé
 * présente » ; en erreur si son dernier test a échoué.
 */
export function displayState(row: { state: ConnectionState }, test: ConnectionTestView | undefined): DisplayState {
  if (row.state !== "connected") return row.state
  if (test?.state === "error") return "error"
  return test?.state === "connected" ? "connected" : "present"
}

export function pillOf(state: DisplayState) {
  return state === "present" ? KEY_PRESENT : CONNECTION_STATE[state]
}

export function summaryOf(counts: Record<DisplayState, number>): string {
  const parts: string[] = []
  if (counts.connected) parts.push(`${counts.connected} ${counts.connected > 1 ? "connectées" : "connectée"}`)
  if (counts.present) parts.push(`${counts.present} ${counts.present > 1 ? "clés présentes" : "clé présente"}`)
  if (counts.error) parts.push(`${counts.error} en erreur`)
  if (counts.missing) parts.push(`${counts.missing} ${counts.missing > 1 ? "clés manquantes" : "clé manquante"}`)
  if (counts.not_configured) parts.push(`${counts.not_configured} ${counts.not_configured > 1 ? "non configurées" : "non configurée"}`)
  return parts.join(" · ")
}
