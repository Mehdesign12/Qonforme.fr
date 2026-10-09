/**
 * Conversion du HTML d'un article PushRank vers le Markdown du blog.
 *
 * Le moteur Markdown du blog (lib/markdown.ts) laisse passer le HTML brut : il
 * a été écrit pour des textes saisis par l'admin. Le contenu reçu de PushRank
 * vient d'un tiers : il est reconstruit ici à partir d'une liste blanche de
 * balises (titres, paragraphes, listes, liens http(s), gras, italique, code,
 * citations, tableaux). Tout le reste est réduit à son texte, et le texte est
 * échappé (`<`, `>`, `&` et les marqueurs Markdown), si bien qu'aucune balise ni
 * aucun attribut venu de PushRank n'arrive tel quel dans la page.
 *
 * Les images insérées dans le corps de l'article sont retirées : seule l'image
 * de couverture est re-hébergée (règle de PushRank : ne pas lier ses URL).
 */

import { decodeEntities } from "@/lib/html-entities"

export { decodeEntities }

type El = { type: "el"; tag: string; attrs: Record<string, string>; children: Node[] }
type Node = { type: "text"; text: string } | El

/** Éléments supprimés avec tout leur contenu. */
const DROPPED = new Set([
  "script", "style", "iframe", "object", "embed", "noscript", "template", "svg", "math",
  "form", "select", "textarea", "button", "head", "title", "video", "audio", "canvas", "map",
])
/** Éléments sans contenu. */
const VOID = new Set(["br", "hr", "img", "input", "meta", "link", "source", "wbr", "col", "area", "base", "track", "param"])
/** Éléments qui forment un bloc (le reste est du texte en ligne). */
const BLOCK = new Set([
  "p", "div", "section", "article", "main", "header", "footer", "aside", "nav", "figure", "figcaption",
  "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "blockquote", "pre", "hr", "table",
  "dl", "dt", "dd", "address", "details", "summary",
])

/** Texte sûr pour le moteur Markdown du blog : ni balise, ni marqueur Markdown involontaire. */
function escapeText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*/g, "&#42;")
    .replace(/`/g, "&#96;")
    .replace(/\[/g, "&#91;")
    .replace(/]/g, "&#93;")
}

/** Un début de ligne ne doit jamais être lu comme un titre, une liste, une citation ou un filet. */
function escapeLineStart(line: string): string {
  return line
    .replace(/^#/, "&#35;")
    .replace(/^-(\s|-)/, "&#45;$1")
    .replace(/^(\d+)\.(\s)/, "$1&#46;$2")
}

/** Lien autorisé : http(s), chemin du site ou ancre. Renvoie l'adresse encodée pour le Markdown, ou null. */
export function safeHref(raw: string | undefined): string | null {
  if (!raw) return null
  const href = decodeEntities(raw).trim()
  if (!/^(https?:\/\/|\/(?!\/)|#)/i.test(href)) return null
  return href.replace(/[\s"'<>()]/g, (c) => encodeURIComponent(c).replace(/'/g, "%27").replace(/\(/g, "%28").replace(/\)/g, "%29"))
}

function parseAttrs(s: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g
  let m: RegExpExecArray | null
  while ((m = re.exec(s))) attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? ""
  return attrs
}

/** Arbre tolérant : balises non fermées acceptées, fermetures orphelines ignorées. */
export function parseHtml(html: string): Node[] {
  const root: El = { type: "el", tag: "#root", attrs: {}, children: [] }
  const stack: El[] = [root]
  const src = html.replace(/<!--[\s\S]*?-->/g, "").replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "").replace(/<![^>]*>/g, "")
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>|([^<]+)|(<)/g
  let m: RegExpExecArray | null
  let skip: string | null = null
  while ((m = re.exec(src))) {
    const [, closing, rawTag, rawAttrs, text, lt] = m
    if (skip) {
      if (closing && rawTag?.toLowerCase() === skip) skip = null
      continue
    }
    const current = stack[stack.length - 1]
    if (text !== undefined || lt !== undefined) {
      current.children.push({ type: "text", text: decodeEntities(text ?? "<") })
      continue
    }
    const tag = rawTag.toLowerCase()
    if (closing) {
      const i = stack.map((e) => e.tag).lastIndexOf(tag)
      if (i > 0) stack.length = i
      continue
    }
    if (DROPPED.has(tag)) {
      if (!VOID.has(tag) && !/\/\s*$/.test(rawAttrs)) skip = tag
      continue
    }
    const el: El = { type: "el", tag, attrs: parseAttrs(rawAttrs), children: [] }
    // Un nouveau paragraphe ou élément de liste ferme le précédent resté ouvert
    if (tag === "p" || tag === "li") {
      const i = stack.map((e) => e.tag).lastIndexOf(tag)
      const barrier = Math.max(stack.map((e) => e.tag).lastIndexOf("ul"), stack.map((e) => e.tag).lastIndexOf("ol"))
      if (i > 0 && (tag === "p" || i > barrier)) stack.length = i
    }
    stack[stack.length - 1].children.push(el)
    if (!VOID.has(tag) && !/\/\s*$/.test(rawAttrs)) stack.push(el)
  }
  return root.children
}

interface InlineCtx {
  singleLine: boolean
  bold?: boolean
  italic?: boolean
}

function wrap(inner: string, marker: string): string {
  const m = inner.match(/^(\s*)([\s\S]*?)(\s*)$/)!
  return m[2] ? `${m[1]}${marker}${m[2]}${marker}${m[3]}` : inner
}

function textOf(nodes: Node[]): string {
  return nodes.map((n) => (n.type === "text" ? n.text : n.tag === "br" ? "\n" : textOf(n.children))).join("")
}

function inline(nodes: Node[], ctx: InlineCtx): string {
  let out = ""
  for (const n of nodes) {
    if (n.type === "text") {
      out += escapeText(n.text.replace(/\s+/g, " "))
      continue
    }
    switch (n.tag) {
      case "br":
        out += ctx.singleLine ? " " : "\n"
        break
      case "img":
        break
      case "strong":
      case "b":
        out += ctx.bold ? inline(n.children, ctx) : wrap(inline(n.children, { ...ctx, bold: true }), "**")
        break
      case "em":
      case "i":
        out += ctx.italic || ctx.bold ? inline(n.children, ctx) : wrap(inline(n.children, { ...ctx, italic: true }), "*")
        break
      case "code":
      case "kbd":
      case "samp": {
        const code = escapeText(textOf(n.children).replace(/\s+/g, " ")).trim()
        out += code ? `\`${code}\`` : ""
        break
      }
      case "a": {
        const label = inline(n.children, { ...ctx, singleLine: true }).trim()
        const href = safeHref(n.attrs.href)
        out += href && label ? `[${label}](${href})` : label
        break
      }
      default:
        out += BLOCK.has(n.tag) ? ` ${inline(n.children, ctx)} ` : inline(n.children, ctx)
    }
  }
  return out
}

/** Nettoie un texte de bloc : espaces fusionnés, lignes vides retirées, débuts de ligne neutralisés. */
function cleanBlock(s: string): string {
  return s
    .split("\n")
    .map((l) => escapeLineStart(l.replace(/[ \t]+/g, " ").trim()))
    .filter(Boolean)
    .join("\n")
}

function listItems(list: El, ordered: boolean): string[] {
  const lines: string[] = []
  let n = 0
  for (const child of list.children) {
    if (child.type !== "el") continue
    if (child.tag === "ul" || child.tag === "ol") {
      lines.push(...listItems(child, child.tag === "ol"))
      continue
    }
    if (child.tag !== "li") continue
    const own = child.children.filter((c) => !(c.type === "el" && (c.tag === "ul" || c.tag === "ol")))
    const text = cleanBlock(inline(own, { singleLine: true })).replace(/\n/g, " ")
    if (text) lines.push(`${ordered ? `${++n}.` : "-"} ${text}`)
    for (const nested of child.children) {
      if (nested.type === "el" && (nested.tag === "ul" || nested.tag === "ol")) lines.push(...listItems(nested, nested.tag === "ol"))
    }
  }
  return lines
}

function table(el: El): string | null {
  const rows: El[] = []
  const collect = (nodes: Node[]) => {
    for (const c of nodes) {
      if (c.type !== "el") continue
      if (c.tag === "tr") rows.push(c)
      else if (["thead", "tbody", "tfoot"].includes(c.tag)) collect(c.children)
    }
  }
  collect(el.children)
  const html = rows
    .map((tr) => {
      const cells = tr.children.filter((c): c is El => c.type === "el" && (c.tag === "th" || c.tag === "td"))
      if (cells.length === 0) return ""
      return `<tr>${cells.map((c) => `<${c.tag}>${cleanBlock(inline(c.children, { singleLine: true })).replace(/\n/g, " ")}</${c.tag}>`).join("")}</tr>`
    })
    .filter(Boolean)
    .join("")
  // Une seule ligne de HTML reconstruit (balises sûres, texte déjà échappé) : le moteur la laisse passer telle quelle
  return html ? `<table><tbody>${html}</tbody></table>` : null
}

function blocks(nodes: Node[]): string[] {
  const out: string[] = []
  let run: Node[] = []
  const flush = () => {
    const text = cleanBlock(inline(run, { singleLine: false }))
    if (text) out.push(text)
    run = []
  }
  for (const n of nodes) {
    if (n.type === "text" || !BLOCK.has(n.tag)) {
      run.push(n)
      continue
    }
    flush()
    const hasBlockChild = n.children.some((c) => c.type === "el" && BLOCK.has(c.tag))
    switch (n.tag) {
      case "h1":
      case "h2":
      case "h3":
      case "h4":
      case "h5":
      case "h6": {
        const level = n.tag === "h1" || n.tag === "h2" ? "##" : n.tag === "h3" ? "###" : "####"
        const text = cleanBlock(inline(n.children, { singleLine: true })).replace(/\n/g, " ")
        if (text) out.push(`${level} ${text}`)
        break
      }
      case "ul":
      case "ol": {
        const lines = listItems(n, n.tag === "ol")
        if (lines.length) out.push(lines.join("\n"))
        break
      }
      case "blockquote": {
        const text = blocks(n.children).join(" ").replace(/\n/g, " ").trim()
        if (text) out.push(`> ${text}`)
        break
      }
      case "pre": {
        const code = textOf(n.children).replace(/```/g, "` ` `").replace(/\s+$/, "")
        if (code.trim()) out.push("```\n" + code + "\n```")
        break
      }
      case "hr":
        out.push("---")
        break
      case "table": {
        const t = table(n)
        if (t) out.push(t)
        break
      }
      case "li": {
        const text = cleanBlock(inline(n.children, { singleLine: true })).replace(/\n/g, " ")
        if (text) out.push(`- ${text}`)
        break
      }
      default:
        if (hasBlockChild) out.push(...blocks(n.children))
        else {
          const text = cleanBlock(inline(n.children, { singleLine: false }))
          if (text) out.push(text)
        }
    }
  }
  flush()
  return out
}

/** HTML d'un article PushRank → Markdown du blog, sans HTML ni attribut d'origine. */
export function htmlToMarkdown(html: string): string {
  return blocks(parseHtml(html)).join("\n\n").replace(/\n{3,}/g, "\n\n").trim()
}

const comparable = (s: string) =>
  decodeEntities(s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()

/**
 * Retire un premier titre identique au titre de l'article : la page l'affiche
 * déjà en h1, et PushRank le répète en tête du contenu (constaté le 07/10/2026).
 */
export function stripLeadingTitle(markdown: string, title: string): string {
  const m = /^(#{1,6})[ \t]+([^\n]*)(?:\n+|$)/.exec(markdown)
  if (!m || !title.trim()) return markdown
  if (comparable(m[2]) !== comparable(title)) return markdown
  return markdown.slice(m[0].length).trimStart()
}

/** Texte simple (titre, extrait, description) : sans balise, espaces fusionnés. */
export function plainText(s: string | undefined | null, max = 500): string {
  if (!s) return ""
  return decodeEntities(s.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim().slice(0, max)
}
