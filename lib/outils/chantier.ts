/**
 * Calculs de chantier des outils gratuits : pente (pourcentage, degrés, rapport,
 * dénivelé) et béton (volume, marge de perte, composition indicative).
 *
 * Fonctions pures, sans dépendance. Les résultats sont des nombres bruts : les
 * outils les arrondissent à l'affichage (`arrondir`). Le seul arrondi interne
 * est celui du nombre de sacs, calculé sur une valeur nettoyée du bruit des
 * flottants pour qu'un compte exact ne passe pas au sac suivant.
 */

const RADIAN = Math.PI / 180

/** Arrondi à d décimales (le demi s'arrondit vers le haut), sans bruit de flottant. */
export function arrondir(n: number, d: number): number {
  const f = 10 ** d
  return Math.round((n + Number.EPSILON * Math.sign(n)) * f) / f
}

/* ─────────────────────────────────────────────────────────
   Pente
   pente (%) = dénivelé ÷ distance horizontale × 100
   angle     = arctan(dénivelé ÷ distance horizontale)
───────────────────────────────────────────────────────── */

export interface Pente {
  /** Pourcentage : 1 m de dénivelé sur 10 m à plat = 10 %. */
  pourcent: number
  /** Angle avec l'horizontale, en degrés. */
  degres: number
  /** « 1 pour n » : n mètres à plat pour 1 mètre de dénivelé ; null si la pente est nulle. */
  rapport: number | null
  /** Centimètres de dénivelé par mètre à plat (égal au pourcentage). */
  cmParMetre: number
}

/** Pente depuis le rapport dénivelé ÷ distance horizontale. */
function penteDepuisRatio(ratio: number): Pente {
  return {
    pourcent: ratio * 100,
    degres: Math.atan(ratio) / RADIAN,
    rapport: ratio > 0 ? 1 / ratio : null,
    cmParMetre: ratio * 100,
  }
}

/** Pente d'un dénivelé sur une distance horizontale (même unité) ; la distance doit être > 0. */
export function penteDepuisDimensions(denivele: number, distanceHorizontale: number): Pente & { longueurInclinee: number } {
  if (!(distanceHorizontale > 0)) throw new RangeError("La distance horizontale doit être supérieure à zéro")
  if (!(denivele >= 0)) throw new RangeError("Le dénivelé ne peut pas être négatif")
  return { ...penteDepuisRatio(denivele / distanceHorizontale), longueurInclinee: Math.hypot(denivele, distanceHorizontale) }
}

export function penteDepuisPourcent(pourcent: number): Pente {
  if (!(pourcent >= 0)) throw new RangeError("La pente ne peut pas être négative")
  return penteDepuisRatio(pourcent / 100)
}

/** Angle de 0 (inclus) à 90 (exclu) degrés : à 90°, la pente est verticale et le pourcentage infini. */
export function penteDepuisDegres(degres: number): Pente {
  if (!(degres >= 0 && degres < 90)) throw new RangeError("L'angle doit être compris entre 0 et 90 degrés (90 exclu)")
  return penteDepuisRatio(Math.tan(degres * RADIAN))
}

/** Dénivelé d'une pente connue sur une distance horizontale, dans l'unité de la distance. */
export function denivele(distanceHorizontale: number, pourcent: number): { denivele: number; longueurInclinee: number } {
  if (!(distanceHorizontale > 0)) throw new RangeError("La distance horizontale doit être supérieure à zéro")
  if (!(pourcent >= 0)) throw new RangeError("La pente ne peut pas être négative")
  const d = (distanceHorizontale * pourcent) / 100
  return { denivele: d, longueurInclinee: Math.hypot(d, distanceHorizontale) }
}

/* ─────────────────────────────────────────────────────────
   Béton
───────────────────────────────────────────────────────── */

/** Masse volumique du béton courant, en tonnes par m³ : un ordre de grandeur (2,3 à 2,5 selon les granulats). */
export const MASSE_VOLUMIQUE_BETON = 2.4

/** Volume d'une dalle, d'une semelle ou d'un massif rectangulaire : longueur et largeur en m, épaisseur en cm. Résultat en m³. */
export function volumeRectangulaire(longueurM: number, largeurM: number, epaisseurCm: number): number {
  for (const v of [longueurM, largeurM, epaisseurCm]) if (!(v > 0)) throw new RangeError("Les dimensions doivent être supérieures à zéro")
  return longueurM * largeurM * (epaisseurCm / 100)
}

/** Volume de `nombre` poteaux ou plots cylindriques : diamètre en cm, hauteur en m. Résultat en m³. */
export function volumeCylindres(diametreCm: number, hauteurM: number, nombre: number): number {
  for (const v of [diametreCm, hauteurM]) if (!(v > 0)) throw new RangeError("Les dimensions doivent être supérieures à zéro")
  if (!Number.isInteger(nombre) || nombre < 1) throw new RangeError("Le nombre de pièces doit être un entier d'au moins 1")
  const rayonM = diametreCm / 200
  return Math.PI * rayonM * rayonM * hauteurM * nombre
}

/** Volume majoré d'une marge de perte (en %) : irrégularités du fond, pertes, débordements. */
export function avecMarge(volumeM3: number, margePourcent: number): number {
  if (!(margePourcent >= 0)) throw new RangeError("La marge ne peut pas être négative")
  return volumeM3 * (1 + margePourcent / 100)
}

/** Dosages courants, en kilogrammes de ciment par m³ de béton. */
export const DOSAGES = [250, 300, 350] as const
export type Dosage = (typeof DOSAGES)[number]

/** Poids d'un sac de ciment courant, en kg. */
export const SAC_CIMENT_KG = 35

/**
 * Pour 1 m³ de béton fabriqué sur place : 0,4 m³ de sable 0/4 et 0,8 m³ de
 * gravillons 4/20 (mesurés en vrac : ils se tassent dans le béton), et une eau
 * égale à la moitié de la masse de ciment (rapport E/C ≈ 0,5). Proportions de
 * référence des guides de bricolage, à valider avec la fiche du fabricant.
 */
export const SABLE_M3_PAR_M3 = 0.4
export const GRAVILLONS_M3_PAR_M3 = 0.8
export const RAPPORT_EAU_CIMENT = 0.5

export interface Composition {
  cimentKg: number
  /** Sacs de ciment entiers à acheter (SAC_CIMENT_KG chacun). */
  sacs: number
  sableM3: number
  gravillonsM3: number
  eauLitres: number
}

export function composition(volumeM3: number, dosageKgM3: number): Composition {
  if (!(volumeM3 > 0)) throw new RangeError("Le volume doit être supérieur à zéro")
  if (!(dosageKgM3 > 0)) throw new RangeError("Le dosage doit être supérieur à zéro")
  const cimentKg = volumeM3 * dosageKgM3
  return {
    cimentKg,
    // 980 kg de ciment font exactement 28 sacs de 35 kg : le bruit des flottants ne doit pas en ajouter un
    sacs: Math.ceil(arrondir(cimentKg / SAC_CIMENT_KG, 6)),
    sableM3: volumeM3 * SABLE_M3_PAR_M3,
    gravillonsM3: volumeM3 * GRAVILLONS_M3_PAR_M3,
    eauLitres: cimentKg * RAPPORT_EAU_CIMENT,
  }
}

/** Masse approximative du béton, en tonnes. */
export function masseTonnes(volumeM3: number): number {
  return volumeM3 * MASSE_VOLUMIQUE_BETON
}
