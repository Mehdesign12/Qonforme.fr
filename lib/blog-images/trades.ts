/**
 * Les 11 métiers du bâtiment des pages métier, reconnus dans un titre ou un
 * mot-clé : la scène de la photo (lib/blog-images/prompt.ts) et l'icône de la
 * couverture (lib/blog-images/cover/) en dépendent.
 *
 * Ordre de reconnaissance : le chauffagiste avant le plombier (« pompe à
 * chaleur »). Motifs sur un texte sans accents ni majuscules (`foldText`).
 *
 * Module pur : navigateur, serveur et tests.
 */

export type TradeId =
  | "chauffagiste"
  | "plombier"
  | "electricien"
  | "macon"
  | "peintre"
  | "carreleur"
  | "menuisier"
  | "couvreur"
  | "plaquiste"
  | "serrurier"
  | "paysagiste"

export const TRADE_KEYS: { id: TradeId; key: RegExp }[] = [
  { id: "chauffagiste", key: /chauffag|pompe a chaleur|chaudiere|\bpac\b/ },
  { id: "plombier", key: /plomb|sanitaire|chauffe-eau|robinet/ },
  { id: "electricien", key: /electri|irve|borne de recharge|tableau electrique/ },
  { id: "macon", key: /macon|gros oeuvre|gros œuvre|beton|parpaing/ },
  { id: "peintre", key: /peint|ravalement/ },
  { id: "carreleur", key: /carrel|faience/ },
  { id: "menuisier", key: /menuis|charpent|fenetre|ebenist/ },
  { id: "couvreur", key: /couvreur|toiture|\btoits?\b|zingu|tuile/ },
  { id: "plaquiste", key: /plaquiste|platr|placo|cloison|faux plafond/ },
  { id: "serrurier", key: /serrur/ },
  { id: "paysagiste", key: /paysag|jardin|espaces? verts?|terrasse/ },
]

/** Minuscules sans accents (« Électricité » → « electricite »). */
export function foldText(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
}

/** Métier reconnu dans le texte (titre, mot-clé), sinon null. */
export function detectTrade(text: string): TradeId | null {
  const t = foldText(text)
  return TRADE_KEYS.find((k) => k.key.test(t))?.id ?? null
}
