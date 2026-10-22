/**
 * Enregistrement des sessions (PostHog Session replay), 22/10/2026.
 *
 * L'enregistrement ne part qu'après l'accord du visiteur (lib/consent.ts), jamais
 * sur les pages exclues (NO_TRACKING_PATHS). Il est **minimal par défaut** :
 *  - tous les champs de saisie sont masqués (SIREN, IBAN, noms, montants saisis) ;
 *  - dans l'application, le texte est masqué lui aussi (noms de clients, montants,
 *    numéros de documents) : on voit les clics, le parcours et les blocages, pas
 *    les données de l'artisan ni de ses clients ;
 *  - le texte n'est lisible que sur les pages publiques de la liste blanche
 *    ci-dessous (contenu identique pour tous, démo à données fictives). Une
 *    nouvelle route est donc masquée tant qu'on ne l'a pas ajoutée ici.
 */

/** Pages publiques dont le texte peut être enregistré en clair. */
export const REPLAY_CLEAR_TEXT_PATHS =
  /^\/$|^\/(blog|guide|modele|outils|pricing|facturation|devenir-a-son-compte|glossaire|plan-du-site|demo|login|signup|forgot-password)(\/|$)/

/**
 * Dans l'application, seuls ces libellés d'interface restent lisibles (en-têtes de
 * tableau, étiquettes de champ, onglets, boutons d'action courts sans chiffre). Un
 * bouton qui ouvre une liste (sélecteur de client, menu du compte) affiche une
 * donnée : il reste masqué.
 */
const INTERFACE_LABEL = "th, label, [role='tab'], button"
const DATA_BUTTON = "[aria-haspopup], [role='combobox']"
const MAX_LABEL_LENGTH = 30

type MaskElement = {
  closest?: (selector: string) => MaskElement | null
  matches?: (selector: string) => boolean
  tagName?: string
}

/** Remplace chaque caractère visible par « * », en gardant les espaces (la mise en page reste lisible). */
function mask(text: string): string {
  return text.replace(/\S/g, "*")
}

export function maskReplayText(
  text: string,
  element?: MaskElement | null,
  pathname: string = typeof window === "undefined" ? "" : window.location.pathname,
): string {
  if (REPLAY_CLEAR_TEXT_PATHS.test(pathname)) return text
  const label = element?.closest?.(INTERFACE_LABEL)
  if (!label) return mask(text)
  if (label.matches?.(DATA_BUTTON)) return mask(text)
  if (text.length > MAX_LABEL_LENGTH || /\d/.test(text)) return mask(text)
  return text
}

/** Réglages passés à `posthog.init`. */
export const SESSION_RECORDING_CONFIG = {
  maskAllInputs: true,
  maskTextFn: maskReplayText,
} as const
