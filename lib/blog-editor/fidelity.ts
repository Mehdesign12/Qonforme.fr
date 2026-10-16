/**
 * Fidélité de l'éditeur visuel : le Markdown réécrit par l'éditeur
 * (docToMarkdown) s'affiche-t-il sur le blog exactement comme l'original ?
 *
 * On compare des « signatures de rendu » : le HTML produit par le moteur du
 * blog (lib/markdown.ts), lu par un DOMParser, réduit à ce qu'un lecteur voit
 * — texte (espaces normalisés), structure (titres, paragraphes, listes,
 * citations, code, tableaux, séparateurs), mise en forme (gras, italique,
 * code), liens (adresse) et images (adresse, texte alternatif, légende).
 * Les attributs sans effet visible (target, rel, dimensions) et les
 * enveloppes sans effet (thead, tbody, paragraphe seul dans un élément de
 * liste) sont ignorés. Les identifiants des titres comptent : ce sont les
 * ancres des liens (« #… » dans l'article, liens déjà partagés).
 *
 * Deux défauts d'espacement du moteur ne comptent pas comme une différence
 * (l'éditeur les corrige, sans rien changer au texte ni à la mise en forme) :
 * - un retour à la ligne en début ou en fin de bloc (« Texte » suivi d'une
 *   liste sans ligne vide : <p>Texte<br></p><ul><br><li>…) ;
 * - du texte nu au premier niveau (« ## Titre » suivi d'une ligne sans ligne
 *   vide : le moteur ne l'enveloppe pas de <p>) : lu comme un paragraphe.
 *
 * Si les signatures diffèrent, `compareRendering` dit pourquoi, en français :
 * l'éditeur s'ouvre alors en mode Markdown pour ne rien perdre.
 *
 * Module pur : le DOMParser est fourni (navigateur : window.DOMParser ;
 * tests : happy-dom).
 */
import { markdownToHtml } from "@/lib/markdown"

/** Lecture d'un HTML en document (DOMParser du navigateur ou de happy-dom). */
export type ParseHtml = (html: string) => Document

export function browserParseHtml(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html")
}

/* ------------------------------------------------------------------ */
/* Signature                                                           */
/* ------------------------------------------------------------------ */

export interface RenderingSignature {
  /** Suite des jetons (structure, mise en forme, texte). */
  tokens: string[]
  /** Balises ou attributs sans équivalent dans l'éditeur (« div », « span », « style »…). */
  raw: string[]
  nestedLists: number
  links: string[]
  images: string[]
  tables: string[]
  headings: string[]
  /** Identifiants des titres (ancres), dans l'ordre. */
  anchors: string[]
  code: string[]
}

/** Contenu en ligne : enveloppé d'un paragraphe quand il est nu au premier niveau. */
const INLINE_TAGS = new Set(["a", "abbr", "b", "br", "code", "del", "em", "i", "ins", "kbd", "mark", "s", "small", "span", "strong", "sub", "sup", "u"])

const BLOCK_TAGS = new Set(["p", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "blockquote", "hr", "table", "tr", "th", "td", "figure", "figcaption"])
const INLINE_MARKS: Record<string, string> = { strong: "strong", b: "strong", em: "em", i: "em", code: "code" }
/** Enveloppes sans effet visible. */
const TRANSPARENT = new Set(["thead", "tbody", "tfoot", "html", "body"])
/** Ignorées entièrement. */
const SKIPPED = new Set(["colgroup", "col", "script", "style", "template", "head", "title", "meta", "link"])
/** Conteneurs où un paragraphe seul ne change rien : ses paragraphes deviennent des retours à la ligne. */
const INLINE_CONTAINERS = new Set(["li", "blockquote", "td", "th", "figcaption"])

function normalizeHref(href: string): string {
  const h = href.trim()
  try {
    return decodeURI(h)
  } catch {
    return h
  }
}

function alignOf(el: Element): string {
  const style = (el.getAttribute("style") ?? "").match(/text-align\s*:\s*(left|center|right)/i)
  const attr = (el.getAttribute("align") ?? "").toLowerCase()
  const a = style ? style[1].toLowerCase() : attr
  return a === "left" || a === "center" || a === "right" ? a : ""
}

/** Le style ne porte qu'un alignement de cellule (rendu par l'éditeur). */
function styleIsAlignmentOnly(el: Element): boolean {
  const style = (el.getAttribute("style") ?? "").trim()
  if (!style) return true
  if (el.tagName.toLowerCase() !== "th" && el.tagName.toLowerCase() !== "td") return false
  return style
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .every((s) => /^text-align\s*:/i.test(s))
}

class Walker {
  tokens: string[] = []
  raw = new Set<string>()
  nestedLists = 0
  links: string[] = []
  images: string[] = []
  tables: string[] = []
  headings: string[] = []
  anchors: string[] = []
  code: string[] = []

  walk(node: Node, ctx: { listDepth: number }): void {
    if (node.nodeType === 3) {
      this.tokens.push(`t:${node.textContent ?? ""}`)
      return
    }
    if (node.nodeType !== 1) return
    const el = node as Element
    const tag = el.tagName.toLowerCase()
    if (SKIPPED.has(tag)) return
    if (!styleIsAlignmentOnly(el)) this.raw.add("style")

    if (TRANSPARENT.has(tag)) {
      this.children(el, ctx)
      return
    }
    if (tag === "br") {
      this.tokens.push("br")
      return
    }
    if (tag === "hr") {
      this.tokens.push("<hr>")
      return
    }
    if (tag === "img") {
      const src = (el.getAttribute("src") ?? "").split("#")[0]
      const alt = (el.getAttribute("alt") ?? "").replace(/\s+/g, " ").trim()
      this.tokens.push(`img:${src}|${alt}`)
      this.images.push(`${src}|${alt}`)
      return
    }
    if (tag === "pre") {
      const text = (el.textContent ?? "")
        .replace(/\r\n?/g, "\n")
        .split("\n")
        .map((l) => (l.trim() === "" ? "" : l.replace(/\s+$/, "")))
        .join("\n")
        .replace(/^\n+|\n+$/g, "")
      this.tokens.push(`<pre>${text}</pre>`)
      this.code.push(text)
      return
    }
    if (tag === "a") {
      const href = normalizeHref(el.getAttribute("href") ?? "")
      this.tokens.push(`<a ${href}>`)
      this.children(el, ctx)
      this.tokens.push("</a>")
      this.links.push(`${href}|${(el.textContent ?? "").replace(/\s+/g, " ").trim()}`)
      return
    }
    if (INLINE_MARKS[tag]) {
      const mark = INLINE_MARKS[tag]
      this.tokens.push(`<${mark}>`)
      this.children(el, ctx)
      this.tokens.push(`</${mark}>`)
      return
    }
    if (BLOCK_TAGS.has(tag)) {
      let open = tag
      if (tag === "th" || tag === "td") {
        const align = alignOf(el)
        if (align) open = `${tag} ${align}`
      }
      if (tag === "ul" || tag === "ol") {
        if (ctx.listDepth > 0) this.nestedLists++
      }
      if (/^h[1-6]$/.test(tag)) {
        this.headings.push(`${tag}:${(el.textContent ?? "").replace(/\s+/g, " ").trim()}`)
        const id = el.getAttribute("id")
        if (id) this.anchors.push(id)
      }
      this.tokens.push(`<${open}>`)
      const next = { listDepth: tag === "ul" || tag === "ol" ? ctx.listDepth + 1 : ctx.listDepth }
      if (INLINE_CONTAINERS.has(tag)) this.inlineChildren(el, next)
      else this.children(el, next)
      this.tokens.push(`</${tag}>`)
      if (tag === "table") this.tables.push(tableKey(el))
      return
    }
    // Balise sans équivalent (div, span, u, sup, mark, iframe…) : son contenu compte quand même
    this.raw.add(tag)
    this.children(el, ctx)
  }

  children(el: Element, ctx: { listDepth: number }): void {
    for (const child of Array.from(el.childNodes)) this.walk(child, ctx)
  }

  /** Paragraphes d'un conteneur en ligne : retour à la ligne entre deux, sans balise <p>. */
  inlineChildren(el: Element, ctx: { listDepth: number }): void {
    let previousParagraph = false
    for (const child of Array.from(el.childNodes)) {
      if (child.nodeType === 1 && (child as Element).tagName.toLowerCase() === "p") {
        if (previousParagraph) this.tokens.push("br")
        this.children(child as Element, ctx)
        previousParagraph = true
        continue
      }
      if (child.nodeType === 3 && !(child.textContent ?? "").trim()) {
        this.walk(child, ctx)
        continue
      }
      if (previousParagraph) this.tokens.push("br")
      previousParagraph = false
      this.walk(child, ctx)
    }
  }
}

function tableKey(el: Element): string {
  return Array.from(el.querySelectorAll("tr"))
    .map((tr) =>
      Array.from(tr.children)
        .map((c) => `${c.tagName.toLowerCase()}${alignOf(c) ? `:${alignOf(c)}` : ""}${c.getAttribute("colspan") ? `*${c.getAttribute("colspan")}` : ""}${c.getAttribute("rowspan") ? `^${c.getAttribute("rowspan")}` : ""}=${(c.textContent ?? "").replace(/\s+/g, " ").trim()}`)
        .join("|"),
    )
    .join("\n")
}

const OPEN_INLINE = /^<(strong|em|code|a .*|a)>$/
const isOpenInline = (t: string) => OPEN_INLINE.test(t) && !t.startsWith("</")
const isCloseInline = (t: string) => /^<\/(strong|em|code|a)>$/.test(t)
const isBlockBoundary = (t: string) => t === "br" || (/^<\/?[a-z0-9]+[ >]/.test(t) && !isOpenInline(t) && !isCloseInline(t)) || t.startsWith("<pre>") || t.startsWith("img:")

/**
 * Normalise la suite de jetons : textes voisins réunis, espaces repliés (sauf
 * insécables), espaces de bord sortis des marques, espaces de début et de fin
 * de bloc retirés, marques vides retirées.
 */
function normalizeTokens(input: string[]): string[] {
  // Textes voisins réunis, espaces repliés
  let tokens: string[] = []
  for (const t of input) {
    if (t.startsWith("t:")) {
      const text = t.slice(2).replace(/[ \t\n\r\f]+/g, " ")
      const last = tokens[tokens.length - 1]
      if (last?.startsWith("t:")) tokens[tokens.length - 1] = last + text
      else tokens.push(`t:${text}`)
    } else tokens.push(t)
  }

  let changed = true
  while (changed) {
    changed = false
    const out: string[] = []
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i]
      const next = tokens[i + 1]
      // Marque vide
      if (isOpenInline(t) && next && isCloseInline(next) && next.slice(2) === (t.startsWith("<a ") ? "a>" : t.slice(1))) {
        i++
        changed = true
        continue
      }
      // Marque fermée puis rouverte à l'identique
      if (isCloseInline(t) && next && isOpenInline(next) && !next.startsWith("<a") && t.slice(2) === next.slice(1)) {
        i++
        changed = true
        continue
      }
      // Espace de début d'une marque : sort devant la marque
      if (isOpenInline(t) && next?.startsWith("t: ")) {
        out.push("t: ", t)
        tokens[i + 1] = `t:${next.slice(3)}`
        changed = true
        continue
      }
      // Espace de fin d'une marque : sort derrière la marque
      if (isCloseInline(t)) {
        const prev = out[out.length - 1]
        if (prev?.startsWith("t:") && prev.length > 2 && prev.endsWith(" ")) {
          out[out.length - 1] = prev.slice(0, -1)
          out.push(t, "t: ")
          changed = true
          continue
        }
      }
      out.push(t)
    }
    // Textes voisins réunis à nouveau, textes vides retirés, doubles espaces repliés
    const merged: string[] = []
    for (const t of out) {
      if (t === "t:") continue
      const last = merged[merged.length - 1]
      if (t.startsWith("t:") && last?.startsWith("t:")) merged[merged.length - 1] = (last + t.slice(2)).replace(/ {2,}/g, " ")
      else merged.push(t)
    }
    tokens = merged
  }

  // Espaces en bord de bloc (et autour d'un retour à la ligne) retirés
  const out: string[] = []
  for (let i = 0; i < tokens.length; i++) {
    let t = tokens[i]
    if (!t.startsWith("t:")) {
      out.push(t)
      continue
    }
    let text = t.slice(2)
    // Bord gauche : précédé (en sautant les marques ouvrantes) d'une limite de bloc
    let j = out.length - 1
    while (j >= 0 && isOpenInline(out[j])) j--
    if (j < 0 || isBlockBoundary(out[j])) text = text.replace(/^ +/, "")
    // Bord droit : suivi (en sautant les marques fermantes) d'une limite de bloc
    let k = i + 1
    while (k < tokens.length && isCloseInline(tokens[k])) k++
    if (k >= tokens.length || isBlockBoundary(tokens[k])) text = text.replace(/ +$/, "")
    t = `t:${text}`
    if (text) out.push(t)
  }

  // Retours à la ligne en bord de bloc (début, fin, entre deux éléments de liste) : sans effet sur le texte
  const edgeless = stripEdgeBreaks(out)

  // Blocs vides retirés (paragraphe sans contenu)
  const cleaned: string[] = []
  for (const t of edgeless) {
    const last = cleaned[cleaned.length - 1]
    if (t === "</p>" && last === "<p>") {
      cleaned.pop()
      continue
    }
    cleaned.push(t)
  }
  return cleaned
}

/** Limite de bloc autre qu'un retour à la ligne. */
const isStructural = (t: string) => t !== "br" && isBlockBoundary(t)

/**
 * Retire les retours à la ligne collés à une limite de bloc (en sautant les
 * marques ouvrantes ou fermantes) : <p>Texte<br></p>, <ul><br><li>…
 */
function stripEdgeBreaks(tokens: string[]): string[] {
  let current = tokens
  for (;;) {
    const next = current.filter((t, i) => {
      if (t !== "br") return true
      let j = i - 1
      while (j >= 0 && isOpenInline(current[j])) j--
      if (j < 0 || isStructural(current[j])) return false
      let k = i + 1
      while (k < current.length && isCloseInline(current[k])) k++
      return !(k >= current.length || isStructural(current[k]))
    })
    if (next.length === current.length) return next
    current = next
  }
}

/**
 * Texte et balises en ligne nus au premier niveau (le moteur ne les
 * enveloppe pas toujours de <p>) : enveloppés d'un paragraphe, comme
 * l'éditeur le fait en les lisant.
 */
function wrapBareInline(body: HTMLElement): void {
  const doc = body.ownerDocument
  let run: ChildNode[] = []
  const flush = () => {
    if (run.some((n) => n.nodeType !== 3 || (n.textContent ?? "").trim() !== "")) {
      const p = doc.createElement("p")
      body.insertBefore(p, run[0])
      for (const n of run) p.appendChild(n)
    }
    run = []
  }
  for (const node of Array.from(body.childNodes)) {
    const inline = node.nodeType === 3 || (node.nodeType === 1 && INLINE_TAGS.has((node as Element).tagName.toLowerCase()))
    if (inline) run.push(node)
    else flush()
  }
  flush()
}

export function renderingSignature(html: string, parse: ParseHtml): RenderingSignature {
  const doc = parse(`<!doctype html><html><body>${html}</body></html>`)
  wrapBareInline(doc.body)
  const walker = new Walker()
  walker.children(doc.body, { listDepth: 0 })
  return {
    tokens: normalizeTokens(walker.tokens),
    raw: Array.from(walker.raw),
    nestedLists: walker.nestedLists,
    links: walker.links,
    images: walker.images,
    tables: walker.tables,
    headings: walker.headings,
    anchors: walker.anchors,
    code: walker.code,
  }
}

/* ------------------------------------------------------------------ */
/* Comparaison                                                         */
/* ------------------------------------------------------------------ */

export interface RenderingComparison {
  same: boolean
  /** Ce que l'éditeur visuel ne reproduirait pas, en français (vide si `same`). */
  reasons: string[]
}

function sameList(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const sa = [...a].sort()
  const sb = [...b].sort()
  return sa.every((v, i) => v === sb[i])
}

const RAW_LABELS: Record<string, string> = { style: "styles", span: "<span>", div: "<div>" }

function rawLabel(tag: string): string {
  return RAW_LABELS[tag] ?? `<${tag}>`
}

/** Texte lisible autour de la première différence. */
function excerptAt(tokens: string[], index: number): string {
  const around = tokens.slice(Math.max(0, index - 2), index + 3)
  const text = around
    .filter((t) => t.startsWith("t:"))
    .map((t) => t.slice(2))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
  if (!text) return ""
  return text.length > 60 ? `${text.slice(0, 57).trimEnd()}…` : text
}

/**
 * Compare le rendu du Markdown d'origine et celui du Markdown réécrit par
 * l'éditeur. Raisons possibles : HTML brut sans équivalent, liste imbriquée
 * aplatie, lien modifié, tableau reformaté, image retirée, titre modifié,
 * bloc de code modifié, mise en forme différente.
 */
export function compareRendering(originalMd: string, roundTripMd: string, parse: ParseHtml): RenderingComparison {
  if (originalMd === roundTripMd) return { same: true, reasons: [] }
  const a = renderingSignature(markdownToHtml(originalMd), parse)
  const b = renderingSignature(markdownToHtml(roundTripMd), parse)
  // Balise sans équivalent (<u>, <span class>, style…) : son effet serait perdu même si le texte est le même
  const raw = a.raw.filter((r) => !b.raw.includes(r))
  // Ancre d'un titre changée : les liens vers ce titre ne mèneraient plus nulle part
  const sameAnchors = a.anchors.length === b.anchors.length && a.anchors.every((id, i) => id === b.anchors[i])
  if (raw.length === 0 && sameAnchors && a.tokens.length === b.tokens.length && a.tokens.every((t, i) => t === b.tokens[i])) return { same: true, reasons: [] }

  const reasons: string[] = []
  if (raw.length > 0) {
    reasons.push(`HTML brut sans équivalent (${raw.slice(0, 4).map(rawLabel).join(", ")}${raw.length > 4 ? "…" : ""})`)
  }
  if (a.nestedLists > b.nestedLists) reasons.push("liste imbriquée aplatie")
  if (!sameList(a.links, b.links)) reasons.push("lien modifié")
  if (!sameList(a.tables, b.tables)) reasons.push("tableau reformaté")
  if (a.images.length > b.images.length) reasons.push(a.images.length - b.images.length > 1 ? "images retirées" : "image retirée")
  else if (!sameList(a.images, b.images)) reasons.push("image modifiée")
  if (!sameList(a.headings, b.headings)) reasons.push("titre modifié")
  else if (!sameAnchors) reasons.push("ancre de titre modifiée")
  if (!sameList(a.code, b.code)) reasons.push("bloc de code modifié")
  if (reasons.length === 0) {
    let i = 0
    while (i < a.tokens.length && i < b.tokens.length && a.tokens[i] === b.tokens[i]) i++
    const excerpt = excerptAt(a.tokens, i)
    reasons.push(excerpt ? `mise en forme différente près de « ${excerpt} »` : "mise en forme différente")
  }
  return { same: false, reasons }
}
