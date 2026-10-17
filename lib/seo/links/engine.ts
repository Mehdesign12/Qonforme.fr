/**
 * Maillage interne d'un article en Markdown : où poser des liens vers les
 * autres pages de qonforme.fr, combien, et comment les écrire.
 *
 * Règles (recommandations courantes du référencement, appliquées par le code) :
 * - une ancre descriptive qui fait partie de la phrase (jamais « cliquez ici »),
 *   posée sur du texte qui existe déjà : le moteur ne réécrit rien ;
 * - chaque page liée une seule fois, jamais la page elle-même, jamais une page
 *   qui vise le même mot-clé que l'article (cannibalisation), jamais le mot-clé
 *   principal de l'article lui-même comme ancre ;
 * - jamais dans un titre, un tableau, un bloc de code, une citation, une image
 *   ni dans un lien existant ; au plus deux liens par paragraphe, à 100
 *   caractères l'un de l'autre, et deux par section (trois si le compte n'est
 *   pas atteint), répartis dans tout l'article ;
 * - le nombre cherché suit la longueur : 3 pour 800 mots, 5 pour 1 200, 7 pour
 *   1 800, 8 pour 2 500 (`linkGoal`), liens déjà posés compris ;
 * - une page est choisie d'abord pour sa proximité avec le sujet de l'article
 *   (`relevanceOf`), puis pour son poids (guides et modèles avant le glossaire).
 *
 * Module pur : serveur, navigateur et tests. Le catalogue des pages vient de
 * lib/seo/links/catalog.ts.
 */
import { foldPlain, foldWithMap, topicTokens, wordCount } from "@/lib/seo/links/text"

export type LinkKind = "article" | "guide" | "modele" | "metier" | "outil" | "installation" | "glossaire" | "page"

/** Expression qui désigne une page : chaîne (sans accents ni casse, pluriel admis) ou expression régulière (texte tel quel). */
export type Phrase = string | RegExp

export interface LinkCandidate {
  /** Chemin du site : « /guide/tva-travaux ». */
  path: string
  title: string
  kind: LinkKind
  phrases: Phrase[]
  /** Mots du sujet de la page (formes de `topicTokens`). */
  topics: string[]
  /** Poids de base : guides et modèles avant le glossaire. */
  weight: number
  /** Mot-clé principal de la page (articles) : une page qui vise celui de l'article n'est jamais liée. */
  keyword?: string | null
}

export interface LinkProposal {
  path: string
  title: string
  kind: LinkKind
  /** Texte de l'article qui devient le lien (tel qu'il est écrit). */
  anchor: string
  /** Ligne du Markdown (à partir de 0) et position du texte dans cette ligne. */
  line: number
  start: number
  end: number
  /** Jusqu'à 40 caractères de texte brut qui précèdent l'ancre (retrouver l'endroit dans l'éditeur visuel). */
  before: string
  /** Numéro de la section « ## » de l'ancre (0 : introduction). */
  section: number
}

/* ------------------------------------------------------------------ */
/* Combien de liens                                                    */
/* ------------------------------------------------------------------ */

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

export interface LinkGoal {
  /** En dessous : le lien manque (un bloc « Pour aller plus loin » complète). */
  min: number
  /** Nombre cherché par le complément automatique. */
  goal: number
  /** Au-delà : trop de liens pour la longueur. */
  max: number
}

/** Nombre de liens internes conseillé pour un texte de `words` mots. */
export function linkGoal(words: number): LinkGoal {
  return {
    min: clamp(Math.round(words / 450), 2, 5),
    goal: clamp(Math.round(words / 260), 3, 8),
    max: clamp(Math.round(words / 190), 4, 10),
  }
}

/* ------------------------------------------------------------------ */
/* Lecture du Markdown                                                 */
/* ------------------------------------------------------------------ */

type LineKind = "blank" | "heading" | "code" | "table" | "image" | "rule" | "quote" | "list" | "para"

interface ParsedLine {
  index: number
  raw: string
  kind: LineKind
  /** Début du texte (après la puce ou le numéro d'une liste). */
  contentStart: number
  /** Section « ## » (0 : avant le premier). */
  section: number
}

function parseLines(markdown: string): ParsedLine[] {
  const out: ParsedLine[] = []
  let fence = false
  let section = 0
  markdown.split("\n").forEach((raw, index) => {
    const trimmed = raw.trim()
    let kind: LineKind = "para"
    let contentStart = 0
    if (/^```/.test(trimmed)) {
      fence = !fence
      kind = "code"
    } else if (fence) kind = "code"
    else if (!trimmed) kind = "blank"
    else if (/^#{1,6}\s/.test(trimmed)) {
      kind = "heading"
      if (/^##\s/.test(trimmed)) section++
    } else if (trimmed.startsWith("|")) kind = "table"
    else if (/^!\[/.test(trimmed)) kind = "image"
    else if (/^([-*_])(\s*\1){2,}$/.test(trimmed)) kind = "rule"
    else if (trimmed.startsWith(">")) kind = "quote"
    else {
      const list = raw.match(/^\s*(?:[-*+]|\d+\.)\s+/)
      if (list) {
        kind = "list"
        contentStart = list[0].length
      }
    }
    out.push({ index, raw, kind, contentStart, section })
  })
  return out
}

/** Construction à ne jamais traverser : code en ligne, image, lien existant, balise. */
const PROTECTED = /(`[^`\n]*`|!\[[^\]\n]*\]\([^)\n]*\)|\[[^\]\n]*\]\([^)\n]*\)|<[^>\n]+>)/g
/** Lettres et chiffres (latin, accents compris) : la cible du projet n'admet pas les classes Unicode. */
const WORD = "A-Za-z0-9À-ÖØ-öø-ÿŒœ"
/** Caractères qui ne peuvent pas figurer dans une ancre (ils casseraient la syntaxe du lien). */
const ANCHOR_FORBIDDEN = /[[\]()*_`<>|\\]/

function plainSegments(line: string, from: number): { start: number; text: string }[] {
  const out: { start: number; text: string }[] = []
  const body = line.slice(from)
  let last = 0
  for (const m of Array.from(body.matchAll(PROTECTED))) {
    const at = m.index ?? 0
    if (at > last) out.push({ start: from + last, text: body.slice(last, at) })
    last = at + m[0].length
  }
  if (last < body.length) out.push({ start: from + last, text: body.slice(last) })
  return out
}

/* ------------------------------------------------------------------ */
/* Liens déjà posés                                                    */
/* ------------------------------------------------------------------ */

const MD_LINK = /(!?)\[([^\]\n]*)\]\(\s*<?([^\s)>]+)>?(?:\s+"[^"]*")?\s*\)/g
const SITE_ORIGIN = /^https:\/\/(?:www\.)?qonforme\.fr(?=\/|$)/i

/** Chemin d'une adresse interne (« /guide/x#y » → « /guide/x »), null pour une adresse externe ou une ancre. */
export function internalPathOf(href: string): string | null {
  const trimmed = href.trim()
  const url = trimmed.replace(SITE_ORIGIN, "")
  // Adresse du site sans chemin : l'accueil
  if (url === "" && SITE_ORIGIN.test(trimmed)) return "/"
  if (!url.startsWith("/") || url.startsWith("//")) return null
  const path = url.split(/[?#]/)[0].replace(/\/+$/, "")
  return path === "" ? "/" : path
}

export interface FoundLink {
  text: string
  path: string
  line: number
}

/** Liens internes du texte (hors images). */
export function internalLinksOf(markdown: string): FoundLink[] {
  const out: FoundLink[] = []
  markdown.split("\n").forEach((raw, line) => {
    for (const m of Array.from(raw.matchAll(MD_LINK))) {
      if (m[1]) continue
      const path = internalPathOf(m[3])
      if (path) out.push({ text: m[2], path, line })
    }
  })
  return out
}

export interface LinkStats {
  internal: number
  external: number
  words: number
}

export function linkStats(markdown: string): LinkStats {
  let external = 0
  for (const m of Array.from(markdown.matchAll(MD_LINK))) if (!m[1] && !internalPathOf(m[3]) && /^https?:/i.test(m[3])) external++
  return { internal: internalLinksOf(markdown).length, external, words: wordCount(markdown) }
}

/**
 * Retire les liens internes qui ne mènent à aucune page connue (adresse
 * inventée par le modèle) et ramène les adresses complètes de qonforme.fr à
 * leur chemin ; le texte du lien reste. Les liens dans un titre perdent aussi
 * leur lien.
 */
export function cleanInternalLinks(markdown: string, validPaths: ReadonlySet<string>): { markdown: string; removed: string[]; fixed: number } {
  const removed: string[] = []
  let fixed = 0
  const lines = markdown.split("\n")
  let fence = false
  const out = lines.map((raw) => {
    if (/^\s*```/.test(raw)) {
      fence = !fence
      return raw
    }
    if (fence) return raw
    const heading = /^#{1,6}\s/.test(raw.trim())
    return raw.replace(MD_LINK, (all: string, bang: string, text: string, href: string) => {
      if (bang) return all
      const path = internalPathOf(href)
      if (!path) return heading ? text : all
      if (heading) {
        removed.push(path)
        return text
      }
      if (!validPaths.has(path)) {
        removed.push(path)
        return text
      }
      if (SITE_ORIGIN.test(href.trim())) {
        fixed++
        return `[${text}](${href.trim().replace(SITE_ORIGIN, "") || "/"})`
      }
      return all
    })
  })
  return { markdown: out.join("\n"), removed, fixed }
}

/* ------------------------------------------------------------------ */
/* Proximité d'une page avec le sujet                                  */
/* ------------------------------------------------------------------ */

/** Poids de chaque mot du catalogue : un mot présent dans presque toutes les pages (« facture ») compte peu. */
function idfOf(candidates: LinkCandidate[]): Map<string, number> {
  const df = new Map<string, number>()
  for (const c of candidates) for (const t of Array.from(new Set(c.topics))) df.set(t, (df.get(t) ?? 0) + 1)
  const n = Math.max(1, candidates.length)
  const out = new Map<string, number>()
  df.forEach((count, token) => out.set(token, Math.log(1 + n / count)))
  return out
}

/** Proximité d'une page avec un sujet (0 : aucun mot significatif en commun). */
export function relevanceOf(topic: Set<string>, candidate: LinkCandidate, idf: Map<string, number>): number {
  let shared = 0
  let total = 0
  for (const t of Array.from(new Set(candidate.topics))) {
    const w = idf.get(t) ?? 1
    total += w
    if (topic.has(t)) shared += w
  }
  return total === 0 ? 0 : shared / Math.sqrt(total)
}

/** Pages les plus proches du sujet, de types variés : sert la liste donnée au rédacteur et le bloc « Pour aller plus loin ». */
export function rankRelated(
  topicText: string,
  candidates: LinkCandidate[],
  opts: { limit: number; exclude?: Iterable<string>; keyword?: string | null; perKind?: Partial<Record<LinkKind, number>>; allowUnrelated?: boolean },
): LinkCandidate[] {
  const topic = new Set(topicTokens(topicText))
  const idf = idfOf(candidates)
  const excluded = new Set(opts.exclude ?? [])
  const keyword = opts.keyword ? foldPlain(opts.keyword) : null
  const perKind: Record<LinkKind, number> = { article: 4, guide: 6, modele: 4, outil: 3, metier: 2, installation: 2, glossaire: 3, page: 1, ...opts.perKind }
  const used = new Map<LinkKind, number>()
  const scored = candidates
    .filter((c) => !excluded.has(c.path) && !(keyword && c.keyword && foldPlain(c.keyword) === keyword))
    .map((c) => {
      const relevance = relevanceOf(topic, c, idf)
      return { c, relevance, score: relevance * 4 + c.weight * 0.3 }
    })
    .filter((x) => x.relevance > 0 || opts.allowUnrelated)
    .sort((a, b) => b.score - a.score || a.c.path.localeCompare(b.c.path))
  const out: LinkCandidate[] = []
  for (const { c } of scored) {
    if (out.length >= opts.limit) break
    const n = used.get(c.kind) ?? 0
    if (n >= perKind[c.kind]) continue
    used.set(c.kind, n + 1)
    out.push(c)
  }
  return out
}

/* ------------------------------------------------------------------ */
/* Propositions                                                        */
/* ------------------------------------------------------------------ */

const regexCache = new Map<string, RegExp>()

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/** Expression de recherche d'une chaîne pliée : mots entiers, pluriel admis, espaces libres. */
function literalRegex(phrase: string): RegExp {
  const cached = regexCache.get(phrase)
  if (cached) return cached
  const words = foldPlain(phrase).split(" ").filter(Boolean)
  const parts = words.map((w) => (w.length < 3 || /[sx]$/.test(w) ? escapeRegExp(w) : `${escapeRegExp(w)}(?:s|x)?`))
  const re = new RegExp(`(?<![a-z0-9])${parts.join("\\s+")}(?![a-z0-9])`, "g")
  regexCache.set(phrase, re)
  return re
}

interface Occurrence {
  candidate: LinkCandidate
  line: ParsedLine
  start: number
  end: number
  anchor: string
  /** Longueur de l'ancre : plus elle est précise, mieux elle décrit la page. */
  length: number
  curated: boolean
}

/** Ancre trop courte ou générique pour décrire une page. */
function weakAnchor(anchor: string): boolean {
  const words = anchor.trim().split(/\s+/)
  return words.length === 1 && anchor.trim().length < 7
}

interface Compiled {
  candidate: LinkCandidate
  phrases: { curated: boolean; re: RegExp }[]
}

function compile(candidates: LinkCandidate[]): Compiled[] {
  return candidates.map((candidate) => ({
    candidate,
    phrases: candidate.phrases.map((phrase) =>
      typeof phrase === "string"
        ? { curated: false, re: literalRegex(phrase) }
        : { curated: true, re: new RegExp(phrase.source, phrase.flags.includes("g") ? phrase.flags : `${phrase.flags}g`) },
    ),
  }))
}

function occurrencesIn(line: ParsedLine, compiled: Compiled[], keyword: string | null): Occurrence[] {
  const out: Occurrence[] = []
  for (const seg of plainSegments(line.raw, line.contentStart)) {
    const folded = foldWithMap(seg.text)
    for (const { candidate, phrases } of compiled) {
      for (const { curated, re } of phrases) {
        const subject = curated ? seg.text : folded.text
        re.lastIndex = 0
        for (const m of Array.from(subject.matchAll(re))) {
          const a = m.index ?? 0
          const b = a + m[0].length
          if (b <= a) continue
          const start = seg.start + (curated ? a : folded.map[a])
          const end = seg.start + (curated ? b : folded.map[b])
          const anchor = line.raw.slice(start, end)
          if (ANCHOR_FORBIDDEN.test(anchor) || !new RegExp(`^[${WORD}]`).test(anchor) || !new RegExp(`[${WORD}]$`).test(anchor) || weakAnchor(anchor)) continue
          // Jamais le mot-clé principal de l'article comme ancre d'une autre page
          if (keyword && foldPlain(anchor).includes(keyword)) continue
          out.push({ candidate, line, start, end, anchor, length: anchor.length, curated })
        }
      }
    }
  }
  return out
}

export interface ProposeOptions {
  /** Chemin de l'article lui-même (jamais lié). */
  selfPath?: string | null
  /** Mot-clé principal de l'article. */
  keyword?: string | null
  /** Nombre de liens internes à atteindre en tout, liens déjà posés compris. */
  target: number
  /** Sujet de l'article (titre, mot-clé, titres de sections) : sert à choisir parmi les pages possibles. */
  topic?: string
  /** Chemins à ne pas lier. */
  exclude?: Iterable<string>
  /** Liens au plus par section « ## » (2 ; un troisième seulement si le compte n'est pas atteint). */
  perSection?: number
}

/**
 * Liens à poser pour atteindre `target` liens internes. Rien n'est écrit ici :
 * `applyProposals` pose les liens.
 */
export function proposeLinks(markdown: string, candidates: LinkCandidate[], opts: ProposeOptions): LinkProposal[] {
  const existing = internalLinksOf(markdown)
  const need = opts.target - existing.length
  if (need <= 0) return []

  const linked = new Set<string>(existing.map((l) => l.path))
  if (opts.selfPath) linked.add(opts.selfPath.replace(/\/+$/, "") || "/")
  Array.from(opts.exclude ?? []).forEach((p) => linked.add(p))
  const keyword = opts.keyword ? foldPlain(opts.keyword) : null
  const eligible = candidates.filter((c) => !linked.has(c.path) && !(keyword && c.keyword && foldPlain(c.keyword) === keyword))
  if (eligible.length === 0) return []

  const lines = parseLines(markdown).filter((l) => l.kind === "para" || l.kind === "list")
  const idf = idfOf(candidates)
  const topic = new Set(topicTokens(opts.topic ?? markdown.slice(0, 2000)))
  const priority = new Map(eligible.map((c) => [c.path, relevanceOf(topic, c, idf) * 5 + c.weight * 2]))

  // Toutes les occurrences, par page
  const compiled = compile(eligible)
  const byPath = new Map<string, Occurrence[]>()
  for (const line of lines) {
    for (const o of occurrencesIn(line, compiled, keyword)) {
      const list = byPath.get(o.candidate.path) ?? []
      list.push(o)
      byPath.set(o.candidate.path, list)
    }
  }

  // Ordre : proximité et poids de la page, puis précision de sa meilleure ancre (la plus longue décrit le mieux)
  const rank = (path: string) => (priority.get(path) ?? 0) + 0.35 * Math.max(0, ...(byPath.get(path) ?? []).map((o) => o.length))
  const order = Array.from(byPath.keys()).sort((a, b) => rank(b) - rank(a) || a.localeCompare(b))
  const picked: Occurrence[] = []
  const perLine = new Map<number, { start: number; end: number }[]>()
  const perSection = new Map<number, number>()
  /** Deux liens au plus dans un paragraphe, à 100 caractères l'un de l'autre. */
  const roomOnLine = (o: Occurrence) => {
    const used = perLine.get(o.line.index) ?? []
    return used.length < 2 && used.every((r) => o.start >= r.end + 100 || o.end <= r.start - 100)
  }

  const run = (cap: number) => {
    for (const path of order) {
      if (picked.length >= need) return
      if (picked.some((p) => p.candidate.path === path)) continue
      const options = (byPath.get(path) ?? []).filter((o) => roomOnLine(o) && (perSection.get(o.line.section) ?? 0) < cap)
      if (options.length === 0) continue
      // L'ancre la plus précise, dans la section la moins chargée, la plus haute du texte
      options.sort((a, b) => {
        const score = (o: Occurrence) => o.length + (o.curated ? 4 : 0) - (perSection.get(o.line.section) ?? 0) * 14
        return score(b) - score(a) || a.line.index - b.line.index || a.start - b.start
      })
      const best = options[0]
      picked.push(best)
      perLine.set(best.line.index, [...(perLine.get(best.line.index) ?? []), { start: best.start, end: best.end }])
      perSection.set(best.line.section, (perSection.get(best.line.section) ?? 0) + 1)
    }
  }
  const cap = opts.perSection ?? 2
  run(cap)
  if (picked.length < need) run(cap + 1)

  return picked
    .sort((a, b) => a.line.index - b.line.index || a.start - b.start)
    .map((o): LinkProposal => {
      const prefixStart = Math.max(o.line.contentStart, o.start - 40)
      return {
        path: o.candidate.path,
        title: o.candidate.title,
        kind: o.candidate.kind,
        anchor: o.anchor,
        line: o.line.index,
        start: o.start,
        end: o.end,
        before: stripMarks(o.line.raw.slice(prefixStart, o.start)),
        section: o.line.section,
      }
    })
}

/** Texte brut d'un morceau de ligne (marques de gras, d'italique et de code retirées). */
function stripMarks(text: string): string {
  return text.replace(/[*_`]/g, "")
}

/** Pose les liens : `[ancre](chemin)` à la place du texte. Le reste du Markdown ne change pas d'un caractère. */
export function applyProposals(markdown: string, proposals: LinkProposal[]): string {
  const lines = markdown.split("\n")
  const byLine = new Map<number, LinkProposal[]>()
  for (const p of proposals) byLine.set(p.line, [...(byLine.get(p.line) ?? []), p])
  byLine.forEach((list, index) => {
    let text = lines[index]
    for (const p of list.slice().sort((a, b) => b.start - a.start)) {
      if (text.slice(p.start, p.end) !== p.anchor) continue
      text = `${text.slice(0, p.start)}[${p.anchor}](${p.path})${text.slice(p.end)}`
    }
    lines[index] = text
  })
  return lines.join("\n")
}

/* ------------------------------------------------------------------ */
/* Bloc « Pour aller plus loin »                                       */
/* ------------------------------------------------------------------ */

export const RELATED_HEADING = "Pour aller plus loin"

/**
 * Bloc de liens en fin d'article, quand le texte n'a pas pu en recevoir assez :
 * les pages les plus proches du sujet, une ligne chacune. Null s'il n'y a rien
 * à ajouter ou si le bloc existe déjà.
 */
export function relatedBlock(markdown: string, candidates: LinkCandidate[], opts: { count: number; topic: string; selfPath?: string | null; keyword?: string | null }): string | null {
  if (opts.count <= 0) return null
  if (new RegExp(`^##\\s+${RELATED_HEADING}\\s*$`, "im").test(markdown)) return null
  const linked = new Set(internalLinksOf(markdown).map((l) => l.path))
  if (opts.selfPath) linked.add(opts.selfPath)
  const picks = rankRelated(opts.topic, candidates, { limit: opts.count, exclude: linked, keyword: opts.keyword, perKind: { article: 2, glossaire: 0, page: 0, metier: 1, installation: 1 }, allowUnrelated: true })
  if (picks.length === 0) return null
  return [`## ${RELATED_HEADING}`, "", ...picks.map((c) => `- [${c.title}](${c.path})`)].join("\n")
}

/* ------------------------------------------------------------------ */
/* Tout en un                                                          */
/* ------------------------------------------------------------------ */

export interface TopUpOptions {
  selfPath?: string | null
  keyword?: string | null
  /** Sujet : titre, mot-clé, titres de sections. */
  topic: string
  /** Ajoute le bloc « Pour aller plus loin » si le texte reste sous le minimum (génération ; pas à l'affichage). */
  allowRelatedBlock?: boolean
  exclude?: Iterable<string>
}

export interface TopUpResult {
  markdown: string
  added: LinkProposal[]
  /** Liens du bloc « Pour aller plus loin » ajouté, s'il y en a un. */
  relatedAdded: number
  before: number
  after: number
  goal: LinkGoal
}

/** Complète les liens internes d'un article jusqu'à l'objectif de sa longueur. */
export function topUpLinks(markdown: string, candidates: LinkCandidate[], opts: TopUpOptions): TopUpResult {
  const words = wordCount(markdown)
  const goal = linkGoal(words)
  const before = internalLinksOf(markdown).length
  const proposals = proposeLinks(markdown, candidates, { selfPath: opts.selfPath, keyword: opts.keyword, topic: opts.topic, target: goal.goal, exclude: opts.exclude })
  let next = applyProposals(markdown, proposals)
  let relatedAdded = 0
  const after = before + proposals.length
  if (opts.allowRelatedBlock && after < goal.min) {
    const block = relatedBlock(next, candidates, { count: Math.min(3, goal.min - after + 1), topic: opts.topic, selfPath: opts.selfPath, keyword: opts.keyword })
    if (block) {
      next = `${next.replace(/\s+$/, "")}\n\n${block}\n`
      relatedAdded = (block.match(/^- \[/gm) ?? []).length
    }
  }
  return { markdown: next, added: proposals, relatedAdded, before, after: after + relatedAdded, goal }
}
