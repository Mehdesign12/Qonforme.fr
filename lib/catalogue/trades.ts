/**
 * Prestations courantes par métier du bâtiment, proposées à l'import dans le
 * catalogue (« Importer les prestations courantes de votre métier »).
 *
 * Aucun prix : chaque artisan a les siens. Une prestation importée sans prix
 * est enregistrée à 0 € et signalée « Prix à compléter » ; sur un devis, sa
 * ligne reste à chiffrer.
 *
 * Taux de TVA proposé selon la nature des travaux et le chantier (sources
 * vérifiées le 03/10/2026) :
 * - 10 % : travaux d'amélioration, de transformation, d'aménagement et
 *   d'entretien de locaux à usage d'habitation achevés depuis plus de deux ans
 *   (CGI, art. 279-0 bis, 1) ;
 * - 5,5 % : travaux d'amélioration de la qualité énergétique de ces mêmes
 *   locaux, quand le matériau ou l'équipement atteint les critères de
 *   performance fixés par arrêté (CGI, art. 278-0 bis A, I et II) ;
 * - 20 % : construction neuve, travaux qui concourent à la production d'un
 *   immeuble neuf ou augmentent la surface de plancher de plus de 10 %
 *   (art. 279-0 bis, 2), locaux professionnels, et, même dans un logement de
 *   plus de deux ans : travaux de nettoyage, aménagement et entretien des
 *   espaces verts, fourniture ou installation d'une chaudière susceptible
 *   d'utiliser des combustibles fossiles (art. 279-0 bis, 2 bis et 278-0 bis A,
 *   III, depuis le 01/03/2025, loi n° 2025-127, art. 32), gros équipements
 *   dont la climatisation (CGI, ann. IV, art. 30-00 A), fourniture sans pose.
 * - Le client certifie sur le devis ou la facture que les conditions du taux
 *   réduit sont remplies (art. 279-0 bis, 3 et 278-0 bis A, IV, depuis la loi
 *   n° 2025-127 du 14/02/2025, art. 41, qui a supprimé les attestations).
 *   https://www.legifrance.gouv.fr/codes/id/LEGISCTA000006191654
 *   https://bofip.impots.gouv.fr/bofip/1666-PGP.html/identifiant=BOI-TVA-LIQ-30-20-90-20-20251022
 *   https://bofip.impots.gouv.fr/bofip/14835-PGP.html/ACTU-2025-00165
 */
import type { TradeId } from "@/lib/legal/profile"

/** Unités : celles que propose déjà la fiche prestation du catalogue. */
export type CatalogueUnit = "m²" | "ml" | "m³" | "unité" | "heure" | "forfait"

/**
 * Nature des travaux au regard de la TVA :
 * - `travaux` : 10 % dans un logement de plus de deux ans, 20 % sinon ;
 * - `energie` : 5,5 % dans un logement de plus de deux ans si les critères de
 *   performance sont atteints, 20 % sinon ;
 * - `normal` : 20 % dans tous les cas (exclu des taux réduits).
 */
export type VatNature = "travaux" | "energie" | "normal"

export interface TradeItem {
  /** Identifiant stable, unique dans le métier. */
  id: string
  name: string
  unit: CatalogueUnit
  vat: VatNature
  /** Précision sur le taux (critère, exclusion). */
  note?: string
}

/** Chantier type choisi à l'import, qui fixe le taux de TVA proposé. */
export type VatContext = "renovation" | "standard" | "franchise"

export const VAT_CONTEXTS: { id: VatContext; label: string; hint: string }[] = [
  {
    id: "renovation",
    label: "Logements de plus de 2 ans",
    hint: "Amélioration, entretien ou rénovation de logements achevés depuis plus de deux ans : 10 %, ou 5,5 % pour la rénovation énergétique.",
  },
  {
    id: "standard",
    label: "Neuf ou locaux professionnels",
    hint: "Construction neuve, extension de plus de 10 % de la surface, locaux professionnels : taux normal de 20 %.",
  },
  {
    id: "franchise",
    label: "Franchise en base",
    hint: "Vous ne facturez pas la TVA (art. 293 B du CGI) : prestations à 0 %.",
  },
]

export const VAT_NATURE_NOTES: Record<VatNature, string> = {
  travaux: "10 % dans un logement achevé depuis plus de 2 ans (CGI, art. 279-0 bis), 20 % sinon.",
  energie: "5,5 % dans un logement achevé depuis plus de 2 ans si le matériau ou l'équipement atteint les critères de performance fixés par arrêté (CGI, art. 278-0 bis A), 20 % sinon.",
  normal: "20 % : exclu des taux réduits, même dans un logement de plus de 2 ans.",
}

/** Taux de TVA proposé pour une prestation selon le chantier type. */
export function proposedVatRate(nature: VatNature, context: VatContext): 0 | 5.5 | 10 | 20 {
  if (context === "franchise") return 0
  if (context === "standard") return 20
  return nature === "energie" ? 5.5 : nature === "travaux" ? 10 : 20
}

const ESPACES_VERTS = "20 % : aménagement et entretien des espaces verts exclus des taux réduits (CGI, art. 279-0 bis, 2 bis)."

/** Prestations communes en fin de liste de chaque métier. */
const COMMON: TradeItem[] = [
  { id: "main-oeuvre", name: "Main-d'œuvre", unit: "heure", vat: "travaux" },
  { id: "deplacement", name: "Frais de déplacement", unit: "forfait", vat: "travaux", note: "Accessoire des travaux : même taux qu'eux." },
]

export const TRADE_CATALOGUES: Record<TradeId, TradeItem[]> = {
  plaquiste: [
    { id: "cloison-ba13", name: "Cloison sur ossature métallique, plaques de plâtre BA13", unit: "m²", vat: "travaux" },
    { id: "faux-plafond", name: "Faux plafond en plaques de plâtre sur ossature", unit: "m²", vat: "travaux" },
    { id: "doublage-colle", name: "Doublage de mur en plaques de plâtre collées", unit: "m²", vat: "travaux" },
    { id: "isolation-murs-interieur", name: "Isolation des murs par l'intérieur, doublage isolant", unit: "m²", vat: "energie", note: "5,5 % si la résistance thermique de l'isolant atteint le seuil fixé par arrêté." },
    { id: "isolation-combles", name: "Isolation des combles perdus", unit: "m²", vat: "energie", note: "5,5 % si la résistance thermique de l'isolant atteint le seuil fixé par arrêté." },
    { id: "bandes-joints", name: "Bandes et enduit de finition des joints", unit: "m²", vat: "travaux" },
    { id: "trappe-visite", name: "Trappe de visite", unit: "unité", vat: "travaux" },
    { id: "depose-cloison", name: "Dépose de cloison existante", unit: "m²", vat: "travaux" },
    ...COMMON,
  ],
  peintre: [
    { id: "protection", name: "Protection des sols et du mobilier", unit: "forfait", vat: "travaux" },
    { id: "preparation", name: "Préparation des supports : lessivage, rebouchage, ponçage", unit: "m²", vat: "travaux" },
    { id: "murs", name: "Peinture des murs, deux couches", unit: "m²", vat: "travaux" },
    { id: "plafonds", name: "Peinture des plafonds, deux couches", unit: "m²", vat: "travaux" },
    { id: "porte", name: "Peinture d'une porte, deux faces", unit: "unité", vat: "travaux" },
    { id: "plinthes", name: "Peinture des plinthes", unit: "ml", vat: "travaux" },
    { id: "papier-peint", name: "Pose de papier peint", unit: "m²", vat: "travaux" },
    { id: "toile-verre", name: "Pose de toile de verre à peindre", unit: "m²", vat: "travaux" },
    ...COMMON,
  ],
  plombier: [
    { id: "mitigeur", name: "Remplacement d'un mitigeur", unit: "unité", vat: "travaux" },
    { id: "wc-suspendu", name: "Pose d'un WC suspendu, bâti-support compris", unit: "unité", vat: "travaux" },
    { id: "receveur-douche", name: "Pose d'un receveur de douche et de sa paroi", unit: "unité", vat: "travaux" },
    { id: "chauffe-eau-electrique", name: "Remplacement d'un chauffe-eau électrique", unit: "unité", vat: "travaux" },
    { id: "chauffe-eau-thermo", name: "Pose d'un chauffe-eau thermodynamique", unit: "unité", vat: "energie", note: "5,5 % si l'équipement atteint les critères de performance fixés par arrêté." },
    { id: "alimentation", name: "Création d'une alimentation en eau (cuivre ou PER)", unit: "ml", vat: "travaux" },
    { id: "evacuation", name: "Création d'une évacuation en PVC", unit: "ml", vat: "travaux" },
    { id: "recherche-fuite", name: "Recherche de fuite", unit: "forfait", vat: "travaux" },
    { id: "debouchage", name: "Débouchage de canalisation", unit: "forfait", vat: "travaux" },
    ...COMMON,
  ],
  chauffagiste: [
    { id: "pac-air-eau", name: "Pose d'une pompe à chaleur air/eau", unit: "unité", vat: "energie", note: "5,5 % si l'équipement atteint les critères de performance fixés par arrêté." },
    { id: "chaudiere-granules", name: "Pose d'une chaudière à granulés de bois", unit: "unité", vat: "energie", note: "5,5 % si l'équipement atteint les critères de performance fixés par arrêté." },
    { id: "chaudiere-gaz", name: "Remplacement d'une chaudière gaz", unit: "unité", vat: "normal", note: "20 % : chaudière à combustible fossile exclue des taux réduits depuis le 1er mars 2025 (CGI, art. 279-0 bis, 2 bis)." },
    { id: "robinets-thermostatiques", name: "Pose de robinets thermostatiques", unit: "unité", vat: "energie", note: "5,5 % : équipement de régulation du chauffage, si les critères fixés par arrêté sont atteints." },
    { id: "radiateur-eau", name: "Pose d'un radiateur à eau chaude", unit: "unité", vat: "travaux" },
    { id: "entretien-chaudiere", name: "Entretien annuel de chaudière", unit: "forfait", vat: "travaux", note: "Entretien sans fourniture ni installation de chaudière : 10 % dans un logement de plus de 2 ans." },
    { id: "desembouage", name: "Désembouage d'un circuit de chauffage", unit: "forfait", vat: "travaux" },
    ...COMMON,
  ],
  electricien: [
    { id: "mise-securite", name: "Mise en sécurité de l'installation électrique", unit: "forfait", vat: "travaux" },
    { id: "tableau", name: "Remplacement du tableau électrique", unit: "unité", vat: "travaux" },
    { id: "prise", name: "Pose d'une prise de courant", unit: "unité", vat: "travaux" },
    { id: "point-lumineux", name: "Pose d'un point lumineux, interrupteur compris", unit: "unité", vat: "travaux" },
    { id: "cable", name: "Tirage de câble sous gaine", unit: "ml", vat: "travaux" },
    { id: "radiateur-electrique", name: "Pose d'un radiateur électrique", unit: "unité", vat: "travaux" },
    { id: "visiophone", name: "Pose d'un interphone ou d'un visiophone", unit: "unité", vat: "travaux" },
    ...COMMON,
  ],
  carreleur: [
    { id: "depose-revetement", name: "Dépose de l'ancien revêtement", unit: "m²", vat: "travaux" },
    { id: "ragreage", name: "Ragréage du sol", unit: "m²", vat: "travaux" },
    { id: "carrelage-sol", name: "Pose de carrelage au sol, collé", unit: "m²", vat: "travaux" },
    { id: "faience", name: "Pose de faïence murale", unit: "m²", vat: "travaux" },
    { id: "etancheite", name: "Étanchéité sous carrelage (pièce humide)", unit: "m²", vat: "travaux" },
    { id: "plinthes", name: "Pose de plinthes carrelées", unit: "ml", vat: "travaux" },
    ...COMMON,
  ],
  macon: [
    { id: "ouverture-mur", name: "Ouverture dans un mur porteur, linteau compris", unit: "forfait", vat: "travaux" },
    { id: "demolition-cloison", name: "Démolition de cloison maçonnée", unit: "m²", vat: "travaux" },
    { id: "mur-parpaings", name: "Montage de mur en parpaings", unit: "m²", vat: "travaux", note: "Extension qui augmente la surface de plus de 10 % : 20 %." },
    { id: "dalle-beton", name: "Coulage d'une dalle en béton", unit: "m²", vat: "travaux", note: "Extension qui augmente la surface de plus de 10 % : 20 %." },
    { id: "enduit-facade", name: "Enduit de façade", unit: "m²", vat: "travaux" },
    { id: "fissures", name: "Reprise de fissures", unit: "ml", vat: "travaux" },
    { id: "gravats", name: "Évacuation des gravats", unit: "forfait", vat: "travaux" },
    ...COMMON,
  ],
  menuisier: [
    { id: "fenetre", name: "Remplacement de fenêtre, double vitrage", unit: "unité", vat: "energie", note: "5,5 % si la menuiserie atteint les critères de performance thermique fixés par arrêté." },
    { id: "porte-entree", name: "Pose d'une porte d'entrée", unit: "unité", vat: "energie", note: "5,5 % si la porte atteint les critères de performance thermique fixés par arrêté, 10 % sinon." },
    { id: "porte-interieure", name: "Pose d'une porte intérieure", unit: "unité", vat: "travaux" },
    { id: "volet-roulant", name: "Pose d'un volet roulant", unit: "unité", vat: "travaux" },
    { id: "parquet", name: "Pose de parquet flottant", unit: "m²", vat: "travaux" },
    { id: "plinthes", name: "Pose de plinthes", unit: "ml", vat: "travaux" },
    ...COMMON,
  ],
  couvreur: [
    { id: "refection-couverture", name: "Réfection de couverture en tuiles", unit: "m²", vat: "travaux" },
    { id: "tuiles", name: "Remplacement de tuiles cassées", unit: "unité", vat: "travaux" },
    { id: "gouttiere", name: "Pose de gouttière en zinc", unit: "ml", vat: "travaux" },
    { id: "fuite-toiture", name: "Réparation de fuite en toiture", unit: "forfait", vat: "travaux" },
    { id: "isolation-toiture", name: "Isolation de la toiture par l'extérieur", unit: "m²", vat: "energie", note: "5,5 % si la résistance thermique de l'isolant atteint le seuil fixé par arrêté." },
    { id: "fenetre-toit", name: "Pose d'une fenêtre de toit", unit: "unité", vat: "energie", note: "5,5 % si la fenêtre atteint les critères de performance thermique fixés par arrêté, 10 % sinon." },
    { id: "echafaudage", name: "Échafaudage, montage et démontage", unit: "forfait", vat: "travaux", note: "Accessoire des travaux : même taux qu'eux." },
    ...COMMON,
  ],
  serrurier: [
    { id: "ouverture-porte", name: "Ouverture de porte claquée", unit: "forfait", vat: "travaux" },
    { id: "cylindre", name: "Remplacement de cylindre", unit: "unité", vat: "travaux" },
    { id: "serrure-multipoints", name: "Pose d'une serrure multipoints", unit: "unité", vat: "travaux" },
    { id: "blindage", name: "Blindage de porte", unit: "unité", vat: "travaux" },
    { id: "porte-blindee", name: "Pose d'une porte blindée", unit: "unité", vat: "travaux" },
    { id: "cle", name: "Reproduction de clé", unit: "unité", vat: "normal", note: "20 % : fourniture sans travaux sur le logement." },
    ...COMMON,
  ],
  paysagiste: [
    { id: "tonte", name: "Tonte de pelouse", unit: "m²", vat: "normal", note: ESPACES_VERTS },
    { id: "taille-haie", name: "Taille de haie", unit: "ml", vat: "normal", note: ESPACES_VERTS },
    { id: "elagage", name: "Élagage d'arbre", unit: "unité", vat: "normal", note: ESPACES_VERTS },
    { id: "massif", name: "Création de massif planté", unit: "m²", vat: "normal", note: ESPACES_VERTS },
    { id: "engazonnement", name: "Engazonnement", unit: "m²", vat: "normal", note: ESPACES_VERTS },
    { id: "dechets-verts", name: "Évacuation des déchets verts", unit: "forfait", vat: "normal", note: ESPACES_VERTS },
    { id: "main-oeuvre", name: "Main-d'œuvre", unit: "heure", vat: "normal", note: ESPACES_VERTS },
    { id: "deplacement", name: "Frais de déplacement", unit: "forfait", vat: "normal", note: ESPACES_VERTS },
  ],
  autre: [
    { id: "fournitures", name: "Fournitures et petit matériel", unit: "forfait", vat: "travaux", note: "Fournies et posées dans le cadre des travaux : même taux qu'eux." },
    ...COMMON,
  ],
}

export function tradeItems(trade: TradeId | null | undefined): TradeItem[] {
  return trade ? TRADE_CATALOGUES[trade] ?? [] : []
}

/** Normalisation d'un nom pour repérer une prestation déjà au catalogue. */
export function normalizeProductName(name: string): string {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’']/g, "'").replace(/\s+/g, " ").trim().toLowerCase()
}

export interface ImportRow {
  name: string
  unit: CatalogueUnit
  vat_rate: 0 | 5.5 | 10 | 20
  unit_price_ht: number
}

/**
 * Lignes à créer dans le catalogue : prestations choisies du métier, au taux
 * du chantier type, au prix saisi ou à 0 € (« Prix à compléter »). Les
 * identifiants inconnus et les prestations déjà au catalogue sont ignorés.
 */
export function buildImportRows(params: {
  trade: TradeId
  context: VatContext
  items: { id: string; unit_price_ht?: number | null }[]
  existingNames?: string[]
}): { rows: ImportRow[]; skipped: string[] } {
  const catalogue = new Map(tradeItems(params.trade).map((i) => [i.id, i]))
  const existing = new Set((params.existingNames ?? []).map(normalizeProductName))
  const rows: ImportRow[] = []
  const skipped: string[] = []
  const seen = new Set<string>()
  for (const choice of params.items) {
    const item = catalogue.get(choice.id)
    if (!item || seen.has(item.id)) continue
    seen.add(item.id)
    const key = normalizeProductName(item.name)
    if (existing.has(key)) { skipped.push(item.name); continue }
    existing.add(key)
    const price = typeof choice.unit_price_ht === "number" && Number.isFinite(choice.unit_price_ht) && choice.unit_price_ht >= 0
      ? Math.round(choice.unit_price_ht * 100) / 100
      : 0
    rows.push({ name: item.name, unit: item.unit, vat_rate: proposedVatRate(item.vat, params.context), unit_price_ht: price })
  }
  return { rows, skipped }
}
