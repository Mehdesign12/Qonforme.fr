/**
 * Filtres d'une photo de document, appliqués pixel par pixel (le filtre de
 * canvas n'existe pas sur tous les Safari). Opère sur le tableau RGBA d'un
 * ImageData : pur, testable sans navigateur.
 *
 * - original : aucun changement ;
 * - color : lumière uniformisée (le blanc du papier redevient blanc) et
 *   contraste léger, couleurs conservées ;
 * - bw : niveaux de gris, noir et blanc étirés sur la plage utile de la photo
 *   (le texte ressort, l'ombre du papier s'efface).
 */
export type ScanFilter = "color" | "bw" | "original"

export const SCAN_FILTER_LABELS: Record<ScanFilter, string> = {
  color: "Couleur",
  bw: "Noir et blanc",
  original: "Original",
}

/** Niveaux de luminance (0-255) en dessous desquels `low` et `high` de la population se trouvent. */
export function lumaLevels(data: Uint8ClampedArray, low = 0.02, high = 0.9): { black: number; white: number } {
  const hist = new Uint32Array(256)
  let n = 0
  for (let i = 0; i < data.length; i += 4) {
    hist[Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2])]++
    n++
  }
  if (n === 0) return { black: 0, white: 255 }
  let acc = 0
  let black = 0
  let white = 255
  let foundBlack = false
  for (let v = 0; v < 256; v++) {
    acc += hist[v]
    if (!foundBlack && acc / n >= low) { black = v; foundBlack = true }
    if (acc / n >= high) { white = v; break }
  }
  // Plage trop étroite (photo presque unie) : on ne l'étire pas, on la laisserait en aplat
  if (white - black < 40) return { black: 0, white: 255 }
  return { black, white }
}

const stretch = (v: number, black: number, white: number) => {
  const t = (v - black) / (white - black)
  return t <= 0 ? 0 : t >= 1 ? 255 : t * 255
}

/** Applique le filtre sur place. */
export function applyFilter(data: Uint8ClampedArray, filter: ScanFilter): void {
  if (filter === "original") return
  const { black, white } = lumaLevels(data)
  if (filter === "bw") {
    for (let i = 0; i < data.length; i += 4) {
      const g = stretch(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2], black, white)
      // Courbe en S légère : le gris moyen du papier devient blanc, le texte reste franc
      const s = g < 128 ? 255 * Math.pow(g / 255, 1.25) : 255 - 255 * Math.pow(1 - g / 255, 1.6)
      data[i] = data[i + 1] = data[i + 2] = s
    }
    return
  }
  // color : même étirement sur les trois canaux, pour garder la teinte
  for (let i = 0; i < data.length; i += 4) {
    data[i] = stretch(data[i], black * 0.6, white)
    data[i + 1] = stretch(data[i + 1], black * 0.6, white)
    data[i + 2] = stretch(data[i + 2], black * 0.6, white)
  }
}
