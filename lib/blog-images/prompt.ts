/**
 * Consigne des images générées par Gemini dans le studio d'images de
 * l'éditeur du blog (couverture et images du texte).
 *
 * - L'admin décrit la scène en français (`defaultImageDescription` propose une
 *   première scène d'après le métier repéré dans le titre ou le mot-clé) ;
 * - les puces de style ajoutent ou retirent une phrase toute faite ;
 * - `buildImagePrompt` encadre la description : photo réaliste éditoriale au
 *   format demandé, puis des règles strictes EN FIN de consigne (elles
 *   l'emportent sur la description) : aucun texte, chiffre, logo ni marque,
 *   écrans et documents illisibles, contexte des artisans du bâtiment en
 *   France. Même esprit que la couverture des articles générés
 *   (buildCoverPrompt, lib/seo/articles/prompt.ts).
 *
 * Les concurrents ne passent jamais par ici : la route vérifie la consigne
 * entière (assertNoCompetitorInPrompt) avant tout appel.
 *
 * Module pur : navigateur (préremplissage, puces), serveur et tests.
 */
import type { ImageAspect } from "@/lib/blog-images/policy"

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

const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()

/**
 * Métiers du bâtiment (les 11 des pages métier) et leur scène, dans l'ordre de
 * reconnaissance : le chauffagiste avant le plombier (« pompe à chaleur »),
 * motifs sur un texte sans accents.
 */
const TRADE_SCENES: { key: RegExp; scene: string }[] = [
  {
    key: /chauffag|pompe a chaleur|chaudiere|\bpac\b/,
    scene: "Un chauffagiste règle une pompe à chaleur installée contre le mur extérieur d'une maison.",
  },
  {
    key: /plomb|sanitaire|chauffe-eau|robinet/,
    scene: "Un plombier installe des tuyaux en cuivre sous l'évier d'une cuisine rénovée.",
  },
  {
    key: /electri|irve|borne de recharge|tableau electrique/,
    scene: "Un électricien raccorde un tableau électrique moderne sur un chantier de rénovation.",
  },
  {
    key: /macon|gros oeuvre|gros œuvre|beton|parpaing/,
    scene: "Un maçon monte un mur de parpaings sur le chantier d'une maison individuelle.",
  },
  {
    key: /peint|ravalement/,
    scene: "Un peintre passe le rouleau sur un mur clair dans un appartement en rénovation.",
  },
  {
    key: /carrel|faience/,
    scene: "Un carreleur pose de grands carreaux au sol, niveau à bulle en main, dans une salle de bains neuve.",
  },
  {
    key: /menuis|charpent|fenetre|ebenist/,
    scene: "Un menuisier mesure un cadre de fenêtre en bois dans son atelier.",
  },
  {
    key: /couvreur|toiture|\btoits?\b|zingu|tuile/,
    scene: "Un couvreur remplace des tuiles sur un toit par une journée claire, harnais de sécurité attaché.",
  },
  {
    key: /plaquiste|platr|placo|cloison|faux plafond/,
    scene: "Un plaquiste fixe des plaques de plâtre sur une ossature métallique dans une pièce lumineuse.",
  },
  {
    key: /serrur/,
    scene: "Un serrurier remplace le cylindre d'une serrure sur une porte d'entrée en bois.",
  },
  {
    key: /paysag|jardin|espaces? verts?|terrasse/,
    scene: "Un paysagiste pose des dalles de terrasse dans un jardin bien entretenu.",
  },
]

const PAPERWORK = /devis|factur|relance|paiement|impaye|tva|acompte|avoir|comptab|tresorerie|mention/

/** Métier reconnu dans le titre ou le mot-clé (scène correspondante), sinon null. */
export function detectTradeScene(text: string): string | null {
  const t = fold(text)
  return TRADE_SCENES.find((s) => s.key.test(t))?.scene ?? null
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
      ? "Un artisan du bâtiment relit un devis sur sa tablette dans sa camionnette, entre deux chantiers."
      : "Un chantier de rénovation intérieure en cours : outils et matériaux posés sur un établi, lumière naturelle.")
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
      ? `A realistic, natural-light editorial photograph for the cover of a blog article, ${format} format, full-bleed composition filling the whole frame.`
      : `A realistic, natural-light editorial photograph illustrating a passage of a blog article, ${format} format.`
  return `${frame} Authentic people, real working conditions, natural colors, shallow depth of field.

SCENE (described in French):
${scene}

STRICT RULES (they override anything in the scene description):
- No text, letters, numbers, labels, signs, watermarks or logos anywhere in the image.
- No brand names on clothes, tools, vehicles or packaging.
- Any screen or document must be blurred and unreadable.
- Context: French building trades (artisans du bâtiment en France), French homes, materials and job sites.`
}
