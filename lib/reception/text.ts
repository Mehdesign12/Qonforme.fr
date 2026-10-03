/** Comparaison sans accents ni casse (doublons, recherche). */
export function normalizeText(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
}
