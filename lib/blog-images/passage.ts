/**
 * Ce que montre une photo d'article : le modèle lit le passage choisi (texte
 * sélectionné, paragraphe du curseur, section d'un article en rédaction) et
 * décrit la photographie qui l'illustre : sujet repéré, scène, style, texte
 * alternatif. Le studio d'images de l'éditeur préremplit ainsi « Ce que montre
 * l'image » et les puces de style ; la rédaction automatique des articles
 * l'emploie pour chaque photo du texte (lib/seo/articles/images.ts).
 *
 * Sans modèle (clé absente, panne, quota), `heuristicPassage` propose une scène
 * d'après le métier ou le sujet repérés dans le passage : la fenêtre s'ouvre
 * toujours avec une proposition.
 *
 * Module pur : navigateur (repli, extraits), serveur et tests. Les concurrents
 * ne passent jamais par ici : la route masque ceux que le passage nomme avant
 * l'appel (lib/seo/articles/check.ts, redactCompetitors).
 */
import {
  ALT_MAX,
  ALT_MIN,
  IMAGE_STYLE_CHIPS,
  altFromDescription,
  cleanImageDescription,
  defaultImageDescription,
  toggleStyleChip,
} from "@/lib/blog-images/prompt"
import { detectTrade, foldText } from "@/lib/blog-images/trades"

/** Passage à illustrer, tel que l'éditeur le relève. */
export interface PassageContext {
  /** Texte sélectionné ; sans sélection, le paragraphe (ou le titre) du curseur. */
  text: string
  /** Titre de section le plus proche au-dessus du passage (ou le passage lui-même s'il s'agit d'un titre). */
  heading: string | null
  /** Texte qui précède, puis qui suit (quelques phrases : le sens autour). */
  before: string
  after: string
  /** Vrai si le texte a été sélectionné (sinon c'est le paragraphe du curseur). */
  selected: boolean
}

export const PASSAGE_TEXT_MAX = 1_500
export const PASSAGE_CONTEXT_MAX = 800
export const PASSAGE_SUBJECT_MAX = 80

export interface PassageSuggestion {
  /** Sujet repéré, en quelques mots : « Pose de carrelage au sol ». */
  subject: string
  /** Scène à photographier (champ « Ce que montre l'image »), sans les phrases des puces. */
  scene: string
  /** Identifiants des puces de style retenues (IMAGE_STYLE_CHIPS), deux au plus. */
  styles: string[]
  /** Texte alternatif proposé. */
  alt: string
}

const STYLE_IDS = IMAGE_STYLE_CHIPS.map((c) => c.id)

/* ------------------------------------------------------------------ */
/* Consigne                                                            */
/* ------------------------------------------------------------------ */

export const PASSAGE_SYSTEM = [
  "Vous êtes iconographe pour le blog d'un logiciel de devis et de facturation destiné aux artisans du bâtiment, en France.",
  "Vous choisissez la photographie qui illustre le mieux un passage d'article : du reportage réaliste, pris sur le vif, jamais une photo de banque d'images ni une illustration.",
].join(" ")

export const PASSAGE_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    subject: { type: "string", description: "Sujet repéré dans le passage, 3 à 8 mots" },
    scene: { type: "string", description: "La photographie en une ou deux phrases en français, 200 à 400 caractères" },
    styles: { type: "array", items: { type: "string", enum: STYLE_IDS }, description: "Un ou deux styles" },
    alt: { type: "string", description: "Texte alternatif de 60 à 140 caractères" },
  },
  required: ["subject", "scene", "styles", "alt"],
  additionalProperties: false,
}

/** Retire les chevrons (délimiteurs) et réduit les espaces d'un texte venu de l'éditeur. */
function clean(text: string, max: number): string {
  return text.replace(/[<>]/g, " ").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, max)
}

export function buildPassagePrompt(input: { passage: PassageContext; title: string; keyword: string | null }): string {
  const { passage } = input
  const lines: string[] = [
    passage.selected ? "PASSAGE SÉLECTIONNÉ À ILLUSTRER :" : "PARAGRAPHE À ILLUSTRER (rien n'est sélectionné : prenez celui où se trouve le curseur) :",
    "<<<",
    clean(passage.text, PASSAGE_TEXT_MAX) || "(vide : appuyez-vous sur le titre de la section)",
    ">>>",
  ]
  if (passage.heading) lines.push(`Titre de la section : ${clean(passage.heading, 200)}`)
  if (input.title.trim()) lines.push(`Titre de l'article : ${clean(input.title, 200)}`)
  if (input.keyword?.trim()) lines.push(`Mot-clé de l'article : ${clean(input.keyword, 120)}`)
  if (passage.before.trim()) lines.push("", "Texte qui précède (contexte seulement) :", "<<<", clean(passage.before, PASSAGE_CONTEXT_MAX), ">>>")
  if (passage.after.trim()) lines.push("", "Texte qui suit (contexte seulement) :", "<<<", clean(passage.after, PASSAGE_CONTEXT_MAX), ">>>")
  lines.push(
    "",
    "Décidez ce que la photographie montre, puis répondez uniquement en JSON :",
    '- subject : le sujet repéré dans le passage, en 3 à 8 mots (« Pose de carrelage au sol »).',
    "- scene : la photographie, en une ou deux phrases en français (200 à 400 caractères) : QUI (un métier du bâtiment), QUOI (le geste précis), OÙ (type de chantier, de pièce ou de lieu), avec deux ou trois objets vrais (outils usés, matériaux). Rien d'abstrait, aucune pose souriante vers l'appareil.",
    `- styles : un ou deux identifiants, parmi : ${IMAGE_STYLE_CHIPS.map((c) => `${c.id} (${c.label.toLowerCase()})`).join(", ")}.`,
    `- alt : texte alternatif factuel de 60 à 140 caractères qui décrit ce qu'on voit (« Un carreleur pose un grand carreau au sol d'une salle de bains »), sans « image de » ni « photo de », sans répéter un mot-clé.`,
    "",
    "RÈGLES :",
    "- Passage sur des papiers (devis, facture, relance, TVA, loi, délais) : montrez l'artisan avec ses papiers ou sa tablette dans un lieu réel (camionnette, bureau à la maison, chantier), documents et écrans flous et illisibles.",
    "- Passage sur un geste, un ouvrage ou un matériau : montrez ce geste ou cet ouvrage, en gros plan sur les mains et les outils.",
    "- Passage sur une règle abstraite : un moment concret où l'artisan y est confronté, jamais un symbole (balance, tampon, cadenas).",
    "- Aucun texte, chiffre, logo, marque, nom d'entreprise ni plaque lisible dans l'image ; aucune personne reconnaissable, aucun enfant.",
    "- Jamais deux idées dans la scène : une seule photo, un seul moment.",
  )
  return lines.join("\n")
}

/* ------------------------------------------------------------------ */
/* Réponse                                                             */
/* ------------------------------------------------------------------ */

function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim()
  if (t.length <= max) return t
  const cut = t.slice(0, max + 1)
  const space = cut.lastIndexOf(" ")
  return (space > max * 0.6 ? cut.slice(0, space) : cut.slice(0, max)).replace(/[\s,;:–-]+$/, "")
}

/** Sujet affiché : première lettre en capitale, 80 caractères au plus, sans point final. */
function subjectOf(text: string): string {
  const t = clip(text.replace(/[<>«»"]/g, " "), PASSAGE_SUBJECT_MAX).replace(/[.!?…]+$/, "")
  return t ? t.charAt(0).toLocaleUpperCase("fr-FR") + t.slice(1) : ""
}

/**
 * Suggestion lue dans la réponse du modèle (JSON, bloc de code toléré) ; null
 * si elle est illisible ou si la scène est trop courte pour guider une image.
 * Les styles inconnus sont ignorés, le texte alternatif trop court ou trop
 * long est refait d'après la scène.
 */
export function parsePassageOutput(text: string): PassageSuggestion | null {
  const raw = text.trim().replace(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i, "$1").trim()
  const start = raw.indexOf("{")
  const end = raw.lastIndexOf("}")
  if (start < 0 || end <= start) return null
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>
  } catch {
    return null
  }
  const scene = cleanImageDescription(typeof parsed.scene === "string" ? parsed.scene : "")
  if (scene.length < 30) return null
  const styles = (Array.isArray(parsed.styles) ? parsed.styles : [])
    .filter((s): s is string => typeof s === "string" && STYLE_IDS.includes(s))
    .filter((s, i, all) => all.indexOf(s) === i)
    .slice(0, 2)
  const altRaw = typeof parsed.alt === "string" ? clip(parsed.alt.replace(/[<>]/g, " "), ALT_MAX) : ""
  const alt = altRaw.length >= ALT_MIN ? altRaw : altFromDescription(scene)
  const subject = subjectOf(typeof parsed.subject === "string" ? parsed.subject : "") || subjectOf(scene)
  return { subject, scene, styles, alt }
}

/* ------------------------------------------------------------------ */
/* Repli sans modèle                                                   */
/* ------------------------------------------------------------------ */

const PAPERWORK = /devis|factur|relance|paiement|impaye|tva|acompte|avoir|comptab|tresorerie|mention|delai|penalit|mise en demeure/
const TOOLS = /outil|materiel|perceuse|niveau|truelle|visseuse|equipement/
const INTERIOR = /renov|salle de bain|cuisine|interieur|piece|sol|mur|carrelage|peinture/

/** Premiers mots d'un texte, comme sujet quand rien d'autre n'est connu. */
function firstWords(text: string, count: number): string {
  return text.replace(/[#*_`>[\]()]/g, " ").replace(/\s+/g, " ").trim().split(" ").slice(0, count).join(" ")
}

/**
 * Proposition sans modèle : la scène du métier reconnu dans le passage (sinon
 * celle des papiers ou d'un chantier), les puces de style qui vont avec.
 */
export function heuristicPassage(input: { passage: PassageContext; title: string; keyword: string | null }): PassageSuggestion {
  const { passage } = input
  const own = `${passage.text} ${passage.heading ?? ""}`
  const folded = foldText(own)
  // Le métier du passage d'abord, puis celui du titre et du mot-clé
  const scene = defaultImageDescription({ title: own, keyword: detectTrade(own) ? null : input.keyword ?? input.title, purpose: "inline" })
  const styles: string[] = []
  if (PAPERWORK.test(folded) && !detectTrade(own)) styles.push("bureau")
  else if (detectTrade(own) || detectTrade(`${input.keyword ?? ""} ${input.title}`)) styles.push("artisan")
  if (TOOLS.test(folded)) styles.push("outils")
  else if (INTERIOR.test(folded)) styles.push("interieur")
  if (styles.length === 0) styles.push("chantier")
  const subject = subjectOf(passage.heading || firstWords(passage.text, 8)) || "Passage de l'article"
  return { subject, scene, styles: styles.slice(0, 2), alt: altFromDescription(scene) }
}

/* ------------------------------------------------------------------ */
/* Pour la fenêtre                                                     */
/* ------------------------------------------------------------------ */

/** Texte du champ « Ce que montre l'image » : la scène, puis la phrase de chaque puce retenue (puces actives dans la fenêtre). */
export function descriptionFromSuggestion(suggestion: PassageSuggestion): string {
  let description = suggestion.scene
  for (const id of suggestion.styles) {
    const chip = IMAGE_STYLE_CHIPS.find((c) => c.id === id)
    if (chip) description = toggleStyleChip(description, chip)
  }
  return description
}

/** Extrait du passage pour l'afficher (« d'après : … »), sur une ligne. */
export function passageExcerpt(text: string, max = 110): string {
  return clip(text.replace(/[#*_`>]/g, " "), max)
}
