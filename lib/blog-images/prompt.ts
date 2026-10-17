/**
 * Consigne des images générées par Gemini dans le studio d'images de
 * l'éditeur du blog (couverture et images du texte).
 *
 * - L'admin décrit la scène en français (`defaultImageDescription` propose une
 *   première scène d'après le métier repéré dans le titre ou le mot-clé) ;
 * - les puces de style ajoutent ou retirent une phrase toute faite ;
 * - `buildImagePrompt` encadre la description : photographie de reportage au
 *   format demandé, écrite comme une consigne de photographe (optique, lumière
 *   disponible, prise sur le vif, outils usés, grain léger) pour éviter l'allure
 *   « image d'IA » ; puis des règles strictes EN FIN de consigne (elles
 *   l'emportent sur la description) : aucun texte, chiffre, logo ni marque,
 *   écrans et documents illisibles, mains et outils plausibles, contexte des
 *   artisans du bâtiment en France. Aucune donnée d'appareil n'est écrite dans
 *   le fichier (lib/blog-images/metadata.ts) : la consigne décrit un rendu, elle
 *   ne fabrique pas de faux EXIF.
 *
 * Les couvertures des articles ne passent plus par ici : elles sont dessinées
 * par le code (lib/blog-images/cover/). Ce module sert aux photos de l'éditeur.
 *
 * Les concurrents ne passent jamais par ici : la route vérifie la consigne
 * entière (assertNoCompetitorInPrompt) avant tout appel.
 *
 * Module pur : navigateur (préremplissage, puces), serveur et tests.
 */
import type { ImageAspect } from "@/lib/blog-images/policy"
import { detectTrade, foldText, type TradeId } from "@/lib/blog-images/trades"

export type ImagePurpose = "cover" | "inline"

/** Longueur maximale de la description (champ du studio et contrôle de la route). */
export const MAX_IMAGE_DESCRIPTION = 1200
/** Texte alternatif : 5 à 180 caractères (lecteurs d'écran et Google Images). */
export const ALT_MIN = 5
export const ALT_MAX = 180
/** Légende d'une image du texte. */
export const CAPTION_MAX = 200

/* ------------------------------------------------------------------ */
/* Puces de style                                                      */
/* ------------------------------------------------------------------ */

export interface ImageStyleChip {
  id: string
  label: string
  /** Phrase ajoutée à la description (retirée quand la puce est désactivée). */
  text: string
}

export const IMAGE_STYLE_CHIPS: ImageStyleChip[] = [
  { id: "chantier", label: "Photo de chantier", text: "Sur un vrai chantier de rénovation, matériaux et outils en place." },
  { id: "interieur", label: "Intérieur rénové", text: "Dans un intérieur rénové, lumineux et soigné." },
  { id: "outils", label: "Outils en gros plan", text: "Gros plan sur les outils et les mains, arrière-plan flou." },
  { id: "artisan", label: "Artisan au travail", text: "Un artisan concentré sur son geste, photographié sur le vif." },
  { id: "bureau", label: "Bureau et documents", text: "Un bureau d'artisan avec des documents et un ordinateur portable, écrans et papiers illisibles." },
  { id: "soir", label: "Lumière du soir", text: "Lumière chaude et rasante de fin de journée." },
  { id: "vif", label: "Sur le vif", text: "Photographié sur le vif, sans pose : la personne est absorbée par son geste et ne regarde pas l'appareil." },
  { id: "fenetre", label: "Lumière d'une fenêtre", text: "Éclairé seulement par la lumière naturelle d'une fenêtre, sans éclairage de studio." },
]

/** Vrai si la phrase de la puce figure dans la description. */
export function hasStyleChip(description: string, chip: ImageStyleChip): boolean {
  return description.includes(chip.text)
}

/**
 * Ajoute la phrase de la puce à la fin de la description, ou la retire si
 * elle y est déjà. Une description qui ne finit pas par une ponctuation reçoit
 * un point avant l'ajout. Rien n'est ajouté au-delà de MAX_IMAGE_DESCRIPTION.
 */
export function toggleStyleChip(description: string, chip: ImageStyleChip): string {
  if (hasStyleChip(description, chip)) {
    return description
      .split(chip.text)
      .join("")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/ +\n/g, "\n")
      .trim()
  }
  const base = description.trimEnd()
  const joined = base ? `${/[.!?…]$/.test(base) ? base : `${base}.`} ${chip.text}` : chip.text
  return joined.length > MAX_IMAGE_DESCRIPTION ? description : joined
}

/* ------------------------------------------------------------------ */
/* Description proposée                                                */
/* ------------------------------------------------------------------ */

const fold = foldText

/**
 * Scène de chaque métier (reconnaissance : lib/blog-images/trades.ts) : un geste
 * précis, des outils et des matériaux vrais, jamais un sourire de pose.
 */
const TRADE_SCENE: Record<TradeId, string> = {
  chauffagiste: "Un chauffagiste accroupi règle le groupe extérieur d'une pompe à chaleur fixé au mur d'une maison, tablette de réglage et manomètres posés à côté.",
  plombier: "Un plombier, de profil, soude un raccord en cuivre sous l'évier d'une cuisine en rénovation ; tuyaux en cuivre, chiffon et clé à molette sur le plan de travail.",
  electricien: "Un électricien raccorde les fils d'un tableau électrique ouvert sur un chantier de rénovation, tournevis isolé en main, gaines et domino de connexion visibles.",
  macon: "Un maçon monte un mur de parpaings sur le chantier d'une maison individuelle, truelle dans une main, niveau à bulle et seau de mortier à ses pieds.",
  peintre: "Un peintre passe un rouleau chargé de peinture claire sur un mur d'un appartement en rénovation, bâches au sol, pot et pinceau sur un escabeau.",
  carreleur: "Un carreleur pose un grand carreau au sol d'une salle de bains neuve, croisillons en place, niveau à bulle et spatule crantée près de lui.",
  menuisier: "Un menuisier mesure au mètre ruban le cadre d'une fenêtre en bois dans son atelier, copeaux sur l'établi, crayon de charpentier derrière l'oreille.",
  couvreur: "Un couvreur remplace des tuiles sur un toit de maison par une journée claire, harnais attaché, tuiles empilées à côté de lui.",
  plaquiste: "Un plaquiste visse une plaque de plâtre sur une ossature métallique dans une pièce lumineuse, visseuse en main, poussière blanche sur ses vêtements.",
  serrurier: "Un serrurier remplace le cylindre d'une serrure sur une porte d'entrée en bois, outils étalés sur une mallette ouverte.",
  paysagiste: "Un paysagiste pose des dalles de terrasse sur un lit de sable dans un jardin, maillet en caoutchouc et cordeau tendu.",
}

const PAPERWORK = /devis|factur|relance|paiement|impaye|tva|acompte|avoir|comptab|tresorerie|mention/

/** Métier reconnu dans le titre ou le mot-clé (scène correspondante), sinon null. */
export function detectTradeScene(text: string): string | null {
  const trade = detectTrade(text)
  return trade ? TRADE_SCENE[trade] : null
}

/**
 * Première description proposée dans le studio : la scène du métier repéré
 * dans le mot-clé ou le titre ; à défaut, un artisan qui relit un devis (sujet
 * de gestion) ou un chantier de rénovation. Le cadrage suit l'usage.
 */
export function defaultImageDescription(input: { title: string; keyword: string | null; purpose: ImagePurpose }): string {
  const text = `${input.keyword ?? ""} ${input.title ?? ""}`
  const trade = detectTradeScene(text)
  const scene =
    trade ??
    (PAPERWORK.test(fold(text))
      ? "Un artisan du bâtiment relit un devis sur sa tablette dans sa camionnette, portière ouverte, entre deux chantiers, casque et outils sur le siège passager."
      : "Un chantier de rénovation intérieure en cours : outils usés et matériaux posés sur un établi, poussière dans la lumière d'une fenêtre, personne ne regarde l'appareil.")
  const framing = input.purpose === "cover" ? "Cadrage large et aéré, sujet bien visible." : "Cadrage resserré sur le geste."
  return `${scene} ${framing}`
}

/**
 * Texte alternatif proposé pour une image générée : première phrase de la
 * description, sans les phrases des puces de style ni le point final, coupée
 * à ALT_MAX caractères sur une fin de mot. Vide si trop court.
 */
export function altFromDescription(description: string): string {
  let text = description
  for (const chip of IMAGE_STYLE_CHIPS) text = text.split(chip.text).join(" ")
  text = text.replace(/[<>]/g, " ").replace(/\s+/g, " ").trim()
  const end = /[.!?…](\s|$)/.exec(text)
  let sentence = (end ? text.slice(0, end.index) : text).trim()
  if (sentence.length > ALT_MAX) {
    const cut = sentence.slice(0, ALT_MAX + 1)
    const space = cut.lastIndexOf(" ")
    sentence = (space > ALT_MIN ? cut.slice(0, space) : cut.slice(0, ALT_MAX)).replace(/[\s,;:–-]+$/, "")
  }
  return sentence.length >= ALT_MIN ? sentence : ""
}

/* ------------------------------------------------------------------ */
/* Consigne                                                            */
/* ------------------------------------------------------------------ */

const ASPECT_WORDS: Record<ImageAspect, string> = {
  "16:9": "16:9 widescreen landscape",
  "4:3": "4:3 landscape",
  "1:1": "1:1 square",
}

/** Description nettoyée : chevrons et caractères de contrôle retirés, espaces réduits, 1 200 caractères au plus. */
export function cleanImageDescription(description: string): string {
  return description
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/[<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_IMAGE_DESCRIPTION)
    .trim()
}

/**
 * Consigne envoyée au modèle d'image : cadre photo réaliste éditoriale au
 * format demandé, description de l'admin, puis les règles strictes en dernier.
 */
export function buildImagePrompt(input: { description: string; aspect: ImageAspect; purpose: ImagePurpose }): string {
  const scene = cleanImageDescription(input.description)
  const format = ASPECT_WORDS[input.aspect] ?? ASPECT_WORDS["16:9"]
  const frame =
    input.purpose === "cover"
      ? `A realistic documentary photograph for the cover of a blog article, ${format} format, full-bleed composition filling the whole frame.`
      : `A realistic documentary photograph illustrating a passage of a blog article, ${format} format.`
  return `${frame}

PHOTOGRAPHIC LOOK: reportage photograph taken on a full-frame camera with a 35 mm lens at f/2.8, available natural light only, true-to-life colors, a hint of film grain, natural skin texture, slightly imperfect candid framing, shallow depth of field with the subject in sharp focus. Candid and unposed: people are absorbed in what they are doing and do not look at the camera.
REAL WORK DETAILS: worn and scuffed tools, work clothes with real creases and dust, materials in use, a little everyday mess, believable French building site conditions.

SCENE (described in French):
${scene}

STRICT RULES (they override anything in the scene description):
- No text, letters, numbers, labels, signs, watermarks or logos anywhere in the image.
- No brand names on clothes, tools, vehicles or packaging.
- Any screen or document must be blurred and unreadable.
- Hands, fingers and tools must be anatomically correct and physically plausible: five fingers per hand, tools held the way they are really used.
- Not an illustration, not a 3D render, not a glossy stock photo: no posed smiles, no studio lighting, no over-processed HDR look.
- Context: French building trades (artisans du bâtiment en France), French homes, materials and job sites.`
}
