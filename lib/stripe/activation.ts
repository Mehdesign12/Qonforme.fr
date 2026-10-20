/**
 * Retour après paiement : la fenêtre « Abonnement activé » s'ouvre sur la page
 * où l'artisan retombe (sa facture, ou le tableau de bord) grâce au paramètre
 * `abonnement` ajouté à l'adresse de destination.
 *
 *   abonnement=1      → remerciement (ouverture de la formule, premiers pas)
 *   abonnement=envoi  → retour sur une facture qui attendait : même remerciement,
 *                       avec « Envoyer la facture » (remplace l'ancien ?send=1,
 *                       que la fiche facture ouvrait sans rien dire).
 *
 * Jamais de donnée dans l'adresse : la fenêtre relit l'abonnement côté serveur
 * (/api/subscription/status). Un paramètre inconnu ne fait rien.
 */
export const ACTIVATION_PARAM = 'abonnement'

export type ActivationKind = 'standard' | 'envoi'

/** Ajoute le paramètre à un chemin interne (déjà filtré par safeNextPath). */
export function withActivationParam(path: string): string {
  let url: URL
  try {
    url = new URL(path, 'http://qonforme.local')
  } catch {
    return path
  }
  const wantsSend = url.searchParams.get('send') === '1'
  url.searchParams.delete('send')
  url.searchParams.set(ACTIVATION_PARAM, wantsSend ? 'envoi' : '1')
  return `${url.pathname}${url.search}${url.hash}`
}

/** Valeur du paramètre → variante de la fenêtre, ou null si rien à afficher. */
export function parseActivationParam(value: string | null | undefined): ActivationKind | null {
  if (value === '1') return 'standard'
  if (value === 'envoi') return 'envoi'
  return null
}
