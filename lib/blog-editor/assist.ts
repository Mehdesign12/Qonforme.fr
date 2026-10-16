/**
 * Assistant de rédaction de l'éditeur d'articles (menu de sélection ›
 * « Assistant ») : consignes envoyées au modèle, nettoyage de sa réponse et
 * points à vérifier avant de l'utiliser.
 *
 * Règles (les mêmes que la rédaction des articles, lib/seo/articles/prompt.ts) :
 * garder les faits, n'ajouter aucun chiffre, date, taux, montant ni référence
 * légale absents du passage, vouvoiement, accents, Markdown en ligne
 * seulement, aucun concurrent. La réponse est contrôlée ici même : liens
 * ajoutés retirés, images retirées, HTML neutralisé, nombres nouveaux,
 * valeurs périmées et concurrents signalés.
 *
 * Module pur (route et composants) : testé dans __tests__/blog-editor-assist.test.ts.
 */
import { z } from "zod"
import { auditArticle } from "@/lib/blog-audit"
import { findCompetitorMentions } from "@/lib/seo/competitors"
import type { AssistAction, AssistRequest } from "@/lib/seo/articles/editor-types"

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

export const ASSIST_ACTIONS: AssistAction[] = ["rephrase", "shorten", "expand", "simplify", "fix", "keyword"]

/** Libellés du menu (le mot-clé est ajouté par le menu pour « keyword »). */
export const ASSIST_LABELS: Record<AssistAction, string> = {
  rephrase: "Reformuler",
  shorten: "Raccourcir",
  expand: "Développer",
  simplify: "Simplifier",
  fix: "Corriger l'orthographe",
  keyword: "Intégrer le mot-clé",
}

const INSTRUCTIONS: Record<AssistAction, (keyword: string | null) => string> = {
  rephrase: () => "Reformulez ce passage : même sens, mêmes faits, longueur comparable, formulation plus claire et plus naturelle.",
  shorten: () => "Raccourcissez ce passage d'environ un tiers, sans perdre d'information utile au lecteur.",
  expand: () =>
    "Développez ce passage (deux fois plus long au plus) : expliquez, précisez, illustrez par une situation de chantier qui découle du passage. N'ajoutez aucun fait nouveau.",
  simplify: () => "Simplifiez ce passage pour un artisan qui lit vite : phrases courtes, mots courants, une idée par phrase.",
  fix: () =>
    "Corrigez seulement l'orthographe, la grammaire, la ponctuation et les accents (y compris sur les majuscules : « À », « É ») ; typographie française (guillemets « », espace insécable avant « : ; ? ! »). Ne changez rien d'autre.",
  keyword: (keyword) =>
    `Intégrez le mot-clé « ${keyword ?? ""} » une fois, à l'endroit où il se lit le plus naturellement (accents et accords corrects) ; le reste du passage ne change pas, ou presque.`,
}

const RULES = [
  "Gardez tous les faits du passage, sans en changer le sens.",
  "N'ajoutez aucun chiffre, aucune date, aucun taux, aucun montant, aucune référence légale (article, loi, décret) qui ne figure pas dans le passage.",
  "Vouvoyez le lecteur. Français correct, avec tous les accents.",
  "Markdown en ligne seulement : gras « **…** », italique « *…* », liens « [texte](adresse) ». Gardez les liens du passage tels quels (même adresse) et n'en ajoutez aucun.",
  "Gardez la structure du passage : une liste reste une liste, un paragraphe reste un paragraphe. Pas de titre, sauf si le passage en contient un.",
  "Aucune image, aucun tableau, aucun HTML, aucun bloc de code.",
  "Répondez par le seul passage réécrit : sans guillemets autour, sans introduction, sans commentaire.",
].map((r) => `- ${r}`)

/** Schéma de la requête (AssistRequest). */
export const assistSchema = z.object({
  action: z.enum(["rephrase", "shorten", "expand", "simplify", "fix", "keyword"], { message: "Action inconnue" }),
  text: z.string().trim().min(1, "Sélectionnez un passage").max(4000, "Passage de 4 000 caractères au plus : sélectionnez moins de texte."),
  keyword: z.string().trim().max(120, "Mot-clé de 120 caractères au plus").nullable().optional(),
  title: z.string().trim().max(200, "Titre de 200 caractères au plus").optional(),
  before: z.string().max(2000, "Contexte trop long").optional(),
  after: z.string().max(2000, "Contexte trop long").optional(),
})

/* ------------------------------------------------------------------ */
/* Consigne                                                            */
/* ------------------------------------------------------------------ */

/**
 * Markdown du passage lisible par le modèle : les entités que l'éditeur
 * écrit pour le moteur du blog (« &#42; », « &#35; »…) redeviennent des
 * caractères.
 */
export function decodeForModel(text: string): string {
  return text
    .replace(/&#(\d{1,6});/g, (m, code: string) => {
      const n = Number(code)
      return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m
    })
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
}

function contextOf(text: string | undefined, side: "before" | "after"): string {
  const t = decodeForModel(text ?? "").replace(/\s+/g, " ").trim()
  if (!t) return ""
  return side === "before" ? t.slice(-500) : t.slice(0, 500)
}

/** Consigne de l'action, sans la consigne système (buildSystemPrompt). */
export function buildAssistPrompt(req: Pick<AssistRequest, "action" | "text" | "keyword" | "title" | "before" | "after">): string {
  const keyword = req.keyword?.trim() || null
  const lines: string[] = []
  if (req.title?.trim()) lines.push(`TITRE DE L'ARTICLE : ${req.title.trim()}`)
  if (keyword) lines.push(`MOT-CLÉ PRINCIPAL : ${keyword}`)
  const before = contextOf(req.before, "before")
  const after = contextOf(req.after, "after")
  if (before) lines.push("", "CONTEXTE AVANT LE PASSAGE (à ne pas réécrire) :", `"""${before}"""`)
  lines.push("", "PASSAGE À RÉÉCRIRE :", `"""${decodeForModel(req.text).trim()}"""`)
  if (after) lines.push("", "CONTEXTE APRÈS LE PASSAGE (à ne pas réécrire) :", `"""${after}"""`)
  lines.push("", `CONSIGNE : ${INSTRUCTIONS[req.action](keyword)}`, "", "RÈGLES :", ...RULES)
  return lines.join("\n")
}

/** Rôle de l'assistant, ajouté à la consigne système commune. */
export const ASSIST_SYSTEM_SUFFIX =
  "\n\nVOTRE RÔLE ICI : vous réécrivez un passage d'un article existant, à la demande de son auteur. Vous ne rédigez pas d'article : vous rendez seulement le passage réécrit."

/* ------------------------------------------------------------------ */
/* Nettoyage de la réponse                                             */
/* ------------------------------------------------------------------ */

/**
 * Lien ou image, lus avec la grammaire du moteur du blog (lib/markdown.ts :
 * tout ce qui est entre les parenthèses, espaces, tabulations et titre
 * compris). Une grammaire plus stricte laisserait passer
 * « [texte](https://exemple.fr ) », que le moteur affiche bien en lien.
 */
const MD_LINK = /(!?)\[([^\]]*)\]\(([^)]*)\)/g

/** Adresse comparable, telle que le moteur l'écrit (espaces de bord retirés ; « %28 » et « ( » sont la même adresse). */
function normalizeUrl(url: string): string {
  const u = url.trim()
  try {
    return decodeURI(u)
  } catch {
    return u
  }
}

function linkUrls(markdown: string): Set<string> {
  const urls = new Set<string>()
  for (const m of Array.from(markdown.matchAll(MD_LINK))) if (!m[1]) urls.add(normalizeUrl(m[3]))
  return urls
}

/** Balises que l'éditeur écrit lui-même (lib/blog-editor/serialize.ts) : gardées. */
const KEPT_TAGS = /^<(?:br \/|\/?strong|\/?em|\/?code)>/

export interface CleanedAssist {
  text: string
  /** Liens ajoutés par le modèle, retirés (le texte reste). */
  removedLinks: number
}

/**
 * Nettoie la réponse du modèle : bloc de code ou guillemets englobants,
 * phrase d'introduction, images, liens absents du passage d'origine, titres
 * (si le passage n'en avait pas), HTML (« < » neutralisé, sauf les balises
 * que l'éditeur écrit lui-même).
 */
export function cleanAssistOutput(raw: string, original: string): CleanedAssist {
  let text = raw.replace(/\r\n?/g, "\n").trim()
  const fence = text.match(/^```[\w-]*\n([\s\S]*?)\n?```$/)
  if (fence) text = fence[1].trim()
  // Phrase d'introduction (« Voici le passage réécrit : »)
  text = text.replace(/^(?:voici|proposition|passage réécrit)[^\n]{0,80}:\s*\n+/i, "")
  // Guillemets englobants absents de l'original
  const decodedOriginal = decodeForModel(original).trim()
  const quotes: [string, string][] = [
    ['"""', '"""'],
    ["«", "»"],
    ['"', '"'],
    ["“", "”"],
  ]
  for (const [open, close] of quotes) {
    if (text.startsWith(open) && text.endsWith(close) && text.length > open.length + close.length && !decodedOriginal.startsWith(open)) {
      text = text.slice(open.length, text.length - close.length).trim()
      break
    }
  }

  // Images retirées ; liens absents de l'original remplacés par leur texte. Jusqu'à ce que plus
  // rien ne change : un texte de lien gardé (« [[x](a)](https://…) ») pourrait reformer un lien
  const allowed = linkUrls(decodedOriginal)
  let removedLinks = 0
  for (let previous = ""; previous !== text; ) {
    previous = text
    text = text.replace(MD_LINK, (whole, bang: string, label: string, url: string) => {
      if (bang) return ""
      if (allowed.has(normalizeUrl(url))) return whole
      removedLinks++
      return label
    })
  }

  // Titres : seulement si le passage en avait ; jamais de niveau 1
  const hadHeading = /^#{1,6}\s/m.test(decodedOriginal)
  text = text.replace(/^(#{1,6})\s+(.*)$/gm, (_m, hashes: string, body: string) => (hadHeading ? `${hashes.length === 1 ? "##" : hashes} ${body}` : body))

  // HTML neutralisé (le moteur du blog l'afficherait tel quel)
  text = text.replace(/</g, (lt, offset: number, all: string) => (KEPT_TAGS.test(all.slice(offset)) ? lt : "&lt;"))

  text = text.replace(/[ \t]+$/gm, "").replace(/\n{3,}/g, "\n\n").trim()
  return { text, removedLinks }
}

/* ------------------------------------------------------------------ */
/* Points à vérifier                                                   */
/* ------------------------------------------------------------------ */

/**
 * Nombres d'un texte (sans adresses de liens, numéros de liste ni entités),
 * sous forme comparable et telle qu'écrite. Séparateurs de milliers admis :
 * espace, espace insécable, espace fine insécable, point (« 10 000 » écrit
 * de trois façons reste le même nombre).
 */
export function numbersIn(markdown: string): { key: string; raw: string }[] {
  const text = decodeForModel(markdown)
    .replace(/\]\([^)]*\)/g, "]")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/^\s*\d+\.\s/gm, " ")
  const out: { key: string; raw: string }[] = []
  for (const m of Array.from(text.matchAll(/\d+(?:[ \u00A0\u202F.]\d{3})*(?:,\d+)?/g))) {
    const raw = m[0]
    out.push({ key: raw.replace(/[ \u00A0\u202F.]/g, ""), raw })
  }
  return out
}

/**
 * Ce que la réécriture doit faire vérifier : liens retirés, valeurs périmées
 * ou affirmations interdites (lib/blog-audit.ts), concurrent cité, nombres
 * absents du passage d'origine.
 */
export function assistWarnings(input: { original: string; result: string; competitors: string[]; removedLinks?: number }): string[] {
  const warnings: string[] = []
  if (input.removedLinks && input.removedLinks > 0) {
    warnings.push(
      input.removedLinks > 1
        ? `${input.removedLinks} liens ajoutés par l'assistant ont été retirés : seuls les liens du passage sont gardés.`
        : "Un lien ajouté par l'assistant a été retiré : seuls les liens du passage sont gardés.",
    )
  }
  const seen = new Set<string>()
  for (const finding of auditArticle(input.result)) {
    if (seen.has(finding.rule.id)) continue
    seen.add(finding.rule.id)
    warnings.push(`${finding.rule.label} : ${finding.rule.correction}`)
  }
  for (const domain of findCompetitorMentions(input.result, input.competitors)) {
    warnings.push(`Le texte proposé cite un concurrent (${domain}) : retirez-le avant de l'utiliser.`)
  }
  const known = new Set(numbersIn(input.original).map((n) => n.key))
  const added: string[] = []
  for (const n of numbersIn(input.result)) {
    if (known.has(n.key) || added.includes(n.raw)) continue
    added.push(n.raw)
  }
  for (const raw of added.slice(0, 4)) warnings.push(`Vérifiez : « ${raw} » n'était pas dans le passage.`)
  if (added.length > 4) warnings.push(`Vérifiez aussi ${added.length - 4} autre${added.length - 4 > 1 ? "s" : ""} nombre${added.length - 4 > 1 ? "s" : ""} absent${added.length - 4 > 1 ? "s" : ""} du passage.`)
  return warnings
}
