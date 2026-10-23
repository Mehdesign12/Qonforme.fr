/**
 * Placer un mot-clé dans le texte d'un article avec l'IA : mots-clés
 * secondaires (« Absent » dans le panneau), mot-clé du sous-titre et de
 * l'introduction (liste de contrôle du score).
 *
 * Le serveur choisit lui-même les passages qui peuvent le recevoir
 * (`integrationCandidates` : développement seulement, jamais la FAQ ni la
 * conclusion, passages qui nomment un concurrent écartés), les numérote pour
 * le modèle, qui répond par le passage réécrit de chaque numéro choisi ;
 * chaque réécriture est contrôlée (`buildProposals`) avant d'être montrée :
 * le mot-clé doit y figurer tel quel, une seule fois ou deux au plus, rien
 * d'autre ne doit changer de façon notable (longueur, liens, chiffres).
 *
 * Module pur (route et tests) : __tests__/seo-integrate.test.ts.
 */
import { assistWarnings, cleanAssistOutput, decodeForModel } from "@/lib/blog-editor/assist"
import { fitPassageText, passageUnits, type PassageUnit } from "@/lib/blog-editor/passages"
import { comparable } from "@/lib/seo/articles/check"
import { NO_IMAGE_HEADING } from "@/lib/seo/articles/images"
import { countKeyword, markdownPlainText, matchKeyword, needleOf, stemmedTokens } from "@/lib/seo/articles/onpage"
import { findCompetitorMentions } from "@/lib/seo/competitors"
import { foldPlain } from "@/lib/seo/links/text"
import type { IntegrateMode, IntegrateProposal } from "@/lib/seo/articles/editor-types"

/** Passages proposés au modèle, au plus. */
export const MAX_CANDIDATES = 8
/** Un passage plus long n'est pas proposé (la réécriture se lit mal et coûte plus cher). */
const MAX_PASSAGE_CHARS = 1200
/** Mots d'un paragraphe ou d'une puce pour recevoir un mot-clé. */
const MIN_PARAGRAPH_WORDS = 25
const MIN_ITEM_WORDS = 12
/** Un sous-titre reste court. */
const MAX_HEADING_CHARS = 100

export interface IntegrateCandidate {
  /** Rang (à partir de 1) dans la consigne. */
  index: number
  kind: "paragraph" | "heading" | "list-item"
  /** Markdown du passage (un titre sans ses « # », une puce sans son tiret). */
  text: string
  /** Titre de la section qui le porte. */
  section: string
  /** Début du paragraphe qui suit un sous-titre (contexte du sous-titre). */
  context?: string
}

const wordsOf = (text: string) => (text.trim() ? text.trim().split(/\s+/).length : 0)

/** Début d'un passage, comparable : sert à ne pas reproposer un passage déjà vu. */
const stamp = (text: string) => comparable(text).slice(0, 60)

/**
 * Passages qui peuvent recevoir le mot-clé, dans l'ordre du texte, numérotés
 * à partir de 1. Liste vide : rien ne s'y prête (texte vide, mot-clé déjà
 * partout, tout est dans la FAQ ou la conclusion).
 */
export function integrationCandidates(
  markdown: string,
  keyword: string,
  mode: IntegrateMode,
  options: { competitors?: string[]; avoid?: string[] } = {},
): IntegrateCandidate[] {
  const competitors = options.competitors ?? []
  const avoid = new Set((options.avoid ?? []).map(stamp).filter(Boolean))
  const needle = needleOf(keyword)
  if (needle.length === 0) return []

  const units = passageUnits(markdown)
  const pool: { unit: PassageUnit; section: string; context?: string }[] = []
  let section = ""
  let h2Seen = false
  let excluded = false
  let introTaken = false
  units.forEach((unit, i) => {
    if (unit.kind === "heading") {
      const level = unit.level ?? 2
      if (level === 1) return
      section = markdownPlainText(unit.text)
      const matches = NO_IMAGE_HEADING.test(foldPlain(section))
      if (level === 2) {
        h2Seen = true
        excluded = matches
      } else if (matches) {
        excluded = true
      }
      if (mode === "heading" && !excluded && unit.text.length <= MAX_HEADING_CHARS * 2 && matchKeyword(section, keyword) !== "exact") {
        const next = units.slice(i + 1).find((u) => u.kind !== "heading")
        pool.push({ unit, section, context: next ? markdownPlainText(next.text).slice(0, 240) : undefined })
      }
      return
    }
    if (mode === "intro") {
      // Le premier paragraphe du texte, et lui seul
      if (!introTaken && unit.kind === "paragraph") {
        introTaken = true
        pool.push({ unit, section: "Introduction" })
      }
      return
    }
    if (mode !== "secondary") return
    if (unit.kind === "other" || !h2Seen || excluded) return
    const plain = markdownPlainText(unit.text)
    if (wordsOf(plain) < (unit.kind === "paragraph" ? MIN_PARAGRAPH_WORDS : MIN_ITEM_WORDS) || /[:：]\s*$/.test(plain)) return
    if (matchKeyword(plain, keyword) === "exact") return
    pool.push({ unit, section })
  })

  const usable = pool.filter(({ unit }) => {
    if (unit.text.length > MAX_PASSAGE_CHARS) return false
    if (avoid.has(stamp(unit.text))) return false
    return findCompetitorMentions(decodeForModel(unit.text), competitors).length === 0
  })

  let chosen = usable
  if (mode === "secondary" && usable.length > MAX_CANDIDATES) {
    // Les passages dont les mots recoupent ceux du mot-clé (et de leur section) d'abord ; sans recoupement
    // nulle part, des passages répartis sur tout l'article
    const scored = usable.map((entry, position) => {
      const tokens = new Set(stemmedTokens(markdownPlainText(entry.unit.text)))
      const sectionTokens = new Set(stemmedTokens(entry.section))
      let score = 0
      for (const t of needle) {
        if (tokens.has(t)) score += 2
        if (sectionTokens.has(t)) score += 1
      }
      return { entry, position, score }
    })
    const best = Math.max(...scored.map((s) => s.score))
    if (best === 0) {
      const step = usable.length / MAX_CANDIDATES
      chosen = Array.from({ length: MAX_CANDIDATES }, (_, i) => usable[Math.floor(i * step)])
    } else {
      chosen = scored
        .slice()
        .sort((a, b) => b.score - a.score || a.position - b.position)
        .slice(0, MAX_CANDIDATES)
        .sort((a, b) => a.position - b.position)
        .map((s) => s.entry)
    }
  } else if (usable.length > MAX_CANDIDATES) {
    chosen = usable.slice(0, MAX_CANDIDATES)
  }

  return chosen.map(({ unit, section: sec, context }, i) => ({
    index: i + 1,
    kind: unit.kind === "other" ? "paragraph" : unit.kind,
    text: unit.text,
    section: sec,
    ...(context ? { context } : {}),
  }))
}

/* ------------------------------------------------------------------ */
/* Consigne                                                            */
/* ------------------------------------------------------------------ */

export const INTEGRATE_SYSTEM_SUFFIX =
  "\n\nVOTRE RÔLE ICI : vous retouchez quelques passages d'un article existant pour y faire figurer un mot-clé, à la demande de son auteur. Vous ne rédigez pas d'article : vous rendez seulement les passages retouchés."

export const INTEGRATE_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    edits: {
      type: "array",
      description: "Un élément par passage retouché ; liste vide si aucun passage ne s'y prête sans forcer.",
      items: {
        type: "object",
        properties: {
          index: { type: "integer", description: "Numéro du passage, tel qu'il est donné." },
          text: { type: "string", description: "Le passage entier, réécrit, en Markdown en ligne." },
        },
        required: ["index", "text"],
        additionalProperties: false,
      },
    },
  },
  required: ["edits"],
  additionalProperties: false,
}

const RULES = [
  "Le mot-clé figure tel quel dans chaque passage retouché : la suite de mots dans cet ordre, avec ses accents ; une seule fois par passage.",
  "Retouchez au minimum : une phrase ajustée au plus. Les faits, le ton, la structure et les liens du passage restent.",
  "N'ajoutez aucun chiffre, aucune date, aucun taux, aucun montant, aucune référence légale qui ne figure pas dans le passage.",
  "Ne forcez pas : une phrase qui sonne faux ou un mot-clé collé sans lien avec le passage vaut moins que rien. Si aucun passage ne s'y prête, renvoyez une liste vide.",
  "Vouvoyez le lecteur. Français correct, avec tous les accents.",
  "Markdown en ligne seulement : gras « **…** », italique « *…* », liens « [texte](adresse) ». Gardez les liens du passage tels quels (même adresse), n'en ajoutez aucun.",
  "Aucune image, aucun tableau, aucun HTML, aucun titre dans un paragraphe ; une puce reste une puce, un paragraphe reste un paragraphe.",
  'Répondez en JSON : {"edits":[{"index":1,"text":"passage entier réécrit"}]}. Un passage non retouché n\'y figure pas.',
].map((r) => `- ${r}`)

const TASKS: Record<IntegrateMode, (keyword: string, count: number) => string> = {
  secondary: (keyword, count) =>
    `Faites figurer le mot-clé « ${keyword} » dans ${count > 1 ? `${count} passages au plus` : "un seul passage"}, choisi${count > 1 ? "s" : ""} parmi ceux qui suivent : ceux où il se lit le plus naturellement et sert le lecteur.`,
  heading: (keyword) =>
    `Réécrivez UN seul de ces sous-titres pour qu'il reprenne le mot-clé « ${keyword} », sans changer ce dont parle la section (le début de son texte est donné). Sous-titre court (${MAX_HEADING_CHARS - 30} caractères au plus), sans point final. Choisissez celui où le mot-clé se lit le plus naturellement.`,
  intro: (keyword) =>
    `Réécrivez ce paragraphe d'introduction pour que le mot-clé « ${keyword} » figure dans sa première ou sa deuxième phrase, de façon naturelle : le lecteur doit savoir dès les premières lignes de quoi parle l'article.`,
}

export function buildIntegratePrompt(req: { mode: IntegrateMode; keyword: string; title?: string; mainKeyword?: string | null; count?: number; candidates: IntegrateCandidate[] }): string {
  const keyword = req.keyword.trim()
  const count = Math.max(1, Math.min(3, req.count ?? 2))
  const lines: string[] = []
  if (req.title?.trim()) lines.push(`TITRE DE L'ARTICLE : ${req.title.trim()}`)
  if (req.mainKeyword?.trim() && comparable(req.mainKeyword) !== comparable(keyword)) lines.push(`MOT-CLÉ PRINCIPAL DE L'ARTICLE : ${req.mainKeyword.trim()}`)
  lines.push(`MOT-CLÉ À FAIRE FIGURER : ${keyword}`, "", `CONSIGNE : ${TASKS[req.mode](keyword, count)}`, "", "PASSAGES :")
  for (const c of req.candidates) {
    const where = c.kind === "heading" ? "sous-titre" : c.kind === "list-item" ? `puce, section « ${c.section} »` : `paragraphe, section « ${c.section} »`
    lines.push(`[${c.index}] (${where})`, `"""${decodeForModel(c.text).trim()}"""`)
    if (c.context) lines.push(`Début du texte de cette section : « ${c.context} »`)
  }
  lines.push("", "RÈGLES :", ...RULES)
  return lines.join("\n")
}

/* ------------------------------------------------------------------ */
/* Réponse                                                             */
/* ------------------------------------------------------------------ */

export interface RawEdit {
  index: number
  text: string
}

/** Lit la réponse du modèle : JSON { edits: [...] }, tolérant (bloc de code, texte autour, index écrit en chaîne). */
export function parseIntegrateOutput(text: string): RawEdit[] {
  const raw = text.trim().replace(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i, "$1").trim()
  const start = raw.indexOf("{")
  const end = raw.lastIndexOf("}")
  let list: unknown = null
  if (start >= 0 && end > start) {
    try {
      list = (JSON.parse(raw.slice(start, end + 1)) as { edits?: unknown }).edits
    } catch {
      list = null
    }
  }
  if (!Array.isArray(list) && raw.startsWith("[")) {
    try {
      list = JSON.parse(raw) as unknown
    } catch {
      list = null
    }
  }
  if (!Array.isArray(list)) return []
  const out: RawEdit[] = []
  for (const item of list) {
    if (!item || typeof item !== "object") continue
    const { index, text: body } = item as { index?: unknown; text?: unknown }
    const n = typeof index === "number" ? index : typeof index === "string" && /^\d+$/.test(index.trim()) ? Number(index.trim()) : NaN
    if (Number.isInteger(n) && typeof body === "string" && body.trim()) out.push({ index: n, text: body })
  }
  return out
}

export interface BuiltProposals {
  proposals: IntegrateProposal[]
  /** Raisons des réécritures écartées (pour expliquer une réponse vide). */
  rejected: string[]
}

/**
 * Réécritures du modèle qui tiennent : mot-clé présent tel quel, passage
 * rangé comme avant (une ligne pour un titre ou une puce), longueur
 * raisonnable, aucun concurrent. Au plus `limit` (un seul sous-titre ou
 * paragraphe d'introduction).
 */
export function buildProposals(
  candidates: IntegrateCandidate[],
  edits: RawEdit[],
  options: { mode: IntegrateMode; keyword: string; competitors?: string[]; count?: number },
): BuiltProposals {
  const limit = options.mode === "secondary" ? Math.max(1, Math.min(3, options.count ?? 2)) : 1
  const proposals: IntegrateProposal[] = []
  const rejected: string[] = []
  const seen = new Set<number>()
  for (const edit of edits) {
    const cand = candidates.find((c) => c.index === edit.index)
    if (!cand || seen.has(cand.index)) continue
    seen.add(cand.index)
    if (proposals.length >= limit) break
    const where = cand.kind === "heading" ? `Sous-titre « ${markdownPlainText(cand.text)} »` : `Passage de la section « ${cand.section} »`
    const cleaned = cleanAssistOutput(edit.text, cand.text)
    const text = fitPassageText(cand.kind, cleaned.text)
    const plain = markdownPlainText(text)
    if (!text) continue
    if (matchKeyword(plain, options.keyword) !== "exact") {
      rejected.push(`${where} : le mot-clé n'y figurait pas tel quel.`)
      continue
    }
    if (countKeyword(plain, options.keyword) > 2) {
      rejected.push(`${where} : le mot-clé y était répété trop souvent.`)
      continue
    }
    if (comparable(text) === comparable(cand.text)) {
      rejected.push(`${where} : aucun changement.`)
      continue
    }
    const before = cand.text.length
    if (cand.kind === "heading" ? text.length > MAX_HEADING_CHARS : text.length > before * 2 + 150 || text.length < before * 0.5) {
      rejected.push(`${where} : la réécriture changeait trop le passage.`)
      continue
    }
    if (findCompetitorMentions(text, options.competitors ?? []).length > 0) {
      rejected.push(`${where} : la réécriture citait un concurrent.`)
      continue
    }
    proposals.push({
      id: String(cand.index),
      kind: cand.kind,
      section: cand.kind === "heading" ? "Sous-titre" : cand.section,
      before: cand.text,
      after: text,
      warnings: assistWarnings({ original: cand.text, result: text, competitors: options.competitors ?? [], removedLinks: cleaned.removedLinks }),
    })
  }
  return { proposals, rejected }
}
