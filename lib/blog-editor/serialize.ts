/**
 * Éditeur visuel des articles : document Tiptap (JSON) → Markdown du blog.
 *
 * Le Markdown reste le format enregistré (contrôle, liens automatiques,
 * vérification du blog et rendu public inchangés). Ce sérialiseur n'écrit que
 * ce que le moteur du blog (lib/markdown.ts) sait afficher, et l'écrit de
 * façon que le moteur le rende exactement comme l'éditeur le montre.
 *
 * Le moteur n'est pas CommonMark : pas d'échappement par barre oblique,
 * remplacements globaux par expressions régulières (gras, italique, code et
 * liens jusque dans le code), HTML brut laissé tel quel. D'où les choix
 * suivants :
 *
 * - Caractères qui déclencheraient une mise en forme dans du texte : écrits
 *   en entités HTML, que le moteur laisse passer et que le navigateur affiche
 *   comme le caractère (« * » → « &#42; », « ` » → « &#96; », « [ » et « ] »,
 *   « < » devant une lettre → « &lt; », « & » devant une entité → « &amp; »).
 *   C'est la solution la plus sûre : rien de visible ne change, et l'éditeur
 *   relit le caractère d'origine. Les espaces invisibles (fine insécable…)
 *   changeraient le texte lu par Google et copié par les lecteurs.
 * - Début de ligne d'un paragraphe qui serait lu comme un titre, une liste,
 *   une citation ou un tableau (« # », « - », « 1. », « > », « | », « :--- ») :
 *   premier caractère en entité (« &#35; », « &#45; », « 1&#46; », « &gt; »,
 *   « &#124; », « &#58; »).
 * - Image : `![alt](adresse#w=…&h=… "légende")` seule sur sa ligne, crochets
 *   du texte alternatif et guillemets de la légende précédés d'une barre
 *   oblique inverse (le moteur les retire).
 * - Gras, italique, code : délimiteurs Markdown (« ** », « * », « ` »), sauf
 *   quand le moteur les lirait autrement (italique collé à du gras…) : la
 *   ligne est alors écrite en balises <strong>, <em>, <code>, que le moteur
 *   laisse passer. Chaque ligne est vérifiée en la passant par le moteur.
 * - Saut de ligne : retour à la ligne dans un paragraphe et une citation,
 *   « <br /> » dans un élément de liste, espace dans un titre et une cellule.
 * - Listes : un seul niveau (le moteur n'affiche pas les listes imbriquées) ;
 *   une sous-liste est aplatie à la suite de l'élément qui la contient.
 * - Image, tableau ou séparateur placé dans une liste, une citation ou une
 *   cellule (HTML collé…) : le moteur ne sait l'afficher qu'au premier niveau.
 *   Il est sorti juste après le bloc qui le contient, jamais perdu.
 * - Bloc de code : une ligne vide y devient une espace (une ligne vide
 *   couperait le bloc en paragraphes) ; le moteur reste incapable d'afficher
 *   tel quel un « ## » ou un « * » de début de ligne dans du code.
 *
 * Module pur (navigateur et tests).
 */
import type { JSONContent } from "@tiptap/core"
import { isSafeHref, markdownToHtml } from "@/lib/markdown"
import { withImageSize } from "@/lib/blog-images/policy"

/* ------------------------------------------------------------------ */
/* Texte                                                               */
/* ------------------------------------------------------------------ */

/** Échappe un texte pour le moteur du blog (entités HTML, voir l'en-tête). */
export function escapeMarkdownText(text: string): string {
  return text
    .replace(/[\t\r\n]+/g, " ")
    // Caractère nul : marqueur interne du moteur du blog
    .replace(/\u0000/g, "")
    .replace(/&(?=#?[a-z0-9]+;)/gi, "&amp;")
    .replace(/<(?=[a-z/!?])/gi, "&lt;")
    .replace(/\*/g, "&#42;")
    .replace(/`/g, "&#96;")
    .replace(/\[/g, "&#91;")
    .replace(/\]/g, "&#93;")
}

/** Premier caractère d'une ligne de paragraphe qui serait lu comme un bloc. */
export function escapeLineStart(line: string): string {
  if (line.startsWith("#")) return `&#35;${line.slice(1)}`
  if (line.startsWith("-")) return `&#45;${line.slice(1)}`
  if (line.startsWith(">")) return `&gt;${line.slice(1)}`
  if (line.startsWith("|")) return `&#124;${line.slice(1)}`
  const ordered = line.match(/^(\d+)\.(?=\s)/)
  if (ordered) return `${ordered[1]}&#46;${line.slice(ordered[0].length)}`
  // Ligne qui passerait pour la ligne de séparation d'un tableau (« :--- | ---: »)
  if (line.startsWith(":") && /^[|:\-\s]+$/.test(line) && line.includes("-")) return `&#58;${line.slice(1)}`
  return line
}

const HREF_ESCAPES: Record<string, string> = {
  " ": "%20",
  "(": "%28",
  ")": "%29",
  "*": "%2A",
  '"': "%22",
  "<": "%3C",
  ">": "%3E",
  "`": "%60",
  "[": "%5B",
  "]": "%5D",
  "|": "%7C",
}

/** Adresse d'un lien ou d'une image : sans ce que le moteur lirait comme de la syntaxe ; null si refusée par le moteur. */
export function markdownHref(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null
  const href = raw.trim().replace(/[\t\r\n]/g, "").replace(/[ ()*"<>`[\]|]/g, (c) => HREF_ESCAPES[c] ?? c)
  // Même règle que le moteur : ni « // », ni « /\ », ni barre oblique inverse ou caractère de contrôle
  if (!href || !isSafeHref(href)) return null
  return href
}

/* ------------------------------------------------------------------ */
/* Contenu en ligne                                                    */
/* ------------------------------------------------------------------ */

type MarkKey = "link" | "bold" | "italic" | "code"

/** Ordre d'imbrication, de l'extérieur vers l'intérieur. */
const MARK_ORDER: MarkKey[] = ["link", "bold", "italic", "code"]

interface Segment {
  text: string
  bold: boolean
  italic: boolean
  code: boolean
  link: string | null
}

type InlineItem = Segment | { br: true }

function isBreak(item: InlineItem): item is { br: true } {
  return "br" in item
}

/** Contenu en ligne d'un bloc : morceaux de texte avec leurs marques, et sauts de ligne. */
function inlineItems(content: JSONContent[] | undefined): InlineItem[] {
  const out: InlineItem[] = []
  for (const node of content ?? []) {
    if (node.type === "hardBreak") {
      out.push({ br: true })
      continue
    }
    if (node.type === "text" && typeof node.text === "string" && node.text) {
      const marks = node.marks ?? []
      const link = marks.find((m) => m.type === "link")
      out.push({
        text: node.text,
        bold: marks.some((m) => m.type === "bold"),
        italic: marks.some((m) => m.type === "italic"),
        code: marks.some((m) => m.type === "code"),
        link: link ? markdownHref(String(link.attrs?.href ?? "")) : null,
      })
      continue
    }
    // Nœud en ligne inconnu : son texte seulement
    if (node.content) out.push(...inlineItems(node.content).filter((i) => !isBreak(i)))
    else if (typeof node.text === "string" && node.text) out.push({ text: node.text, bold: false, italic: false, code: false, link: null })
  }
  return out
}

/** Découpe en lignes aux sauts de ligne. */
function splitLines(items: InlineItem[]): Segment[][] {
  const lines: Segment[][] = [[]]
  for (const item of items) {
    if (isBreak(item)) lines.push([])
    else lines[lines.length - 1].push(item)
  }
  return lines
}

function sameMarks(a: Segment, b: Segment): boolean {
  return a.bold === b.bold && a.italic === b.italic && a.code === b.code && a.link === b.link
}

function has(seg: Segment, key: MarkKey): boolean {
  return key === "link" ? seg.link !== null : seg[key]
}

interface Syntax {
  open: (key: MarkKey, seg: Segment) => string
  close: (key: MarkKey, href: string | null) => string
}

const DELIMITERS: Syntax = {
  open: (key) => (key === "link" ? "[" : key === "bold" ? "**" : key === "italic" ? "*" : "`"),
  close: (key, href) => (key === "link" ? `](${href})` : key === "bold" ? "**" : key === "italic" ? "*" : "`"),
}

const TAGS: Syntax = {
  open: (key) => (key === "link" ? "[" : key === "bold" ? "<strong>" : key === "italic" ? "<em>" : "<code>"),
  close: (key, href) => (key === "link" ? `](${href})` : key === "bold" ? "</strong>" : key === "italic" ? "</em>" : "</code>"),
}

/**
 * Écrit une ligne de contenu en ligne avec une syntaxe de marques. Les marques
 * déjà ouvertes restent ouvertes tant qu'elles continuent ; les espaces de bord
 * sortent des marques (« **mot** suivant » plutôt que « **mot **suivant »),
 * sauf pour le code, où l'espace compte.
 */
function writeLine(segments: Segment[], syntax: Syntax): string {
  // Morceaux voisins aux mêmes marques réunis
  const segs: Segment[] = []
  for (const s of segments) {
    const last = segs[segs.length - 1]
    if (last && sameMarks(last, s)) last.text += s.text
    else segs.push({ ...s })
  }

  let out = ""
  const stack: { key: MarkKey; href: string | null }[] = []
  let pendingTrail = ""

  const closeTo = (depth: number) => {
    while (stack.length > depth) {
      const top = stack.pop()!
      out += syntax.close(top.key, top.href)
    }
  }

  for (const seg of segs) {
    const text = seg.text.replace(/[\t\r\n]+/g, " ")
    const blank = text.trim() === ""
    // Espaces seuls : jamais de marque ouverte pour eux (« **** » serait mal lu)
    const wanted = (key: MarkKey): boolean => {
      if (!has(seg, key)) return false
      if (!blank) return true
      return stack.some((m) => m.key === key && (key !== "link" || m.href === seg.link))
    }

    // Fermeture : du sommet jusqu'à la plus profonde marque qui s'arrête
    let keep = 0
    while (keep < stack.length) {
      const m = stack[keep]
      if (!wanted(m.key) || (m.key === "link" && m.href !== seg.link)) break
      keep++
    }
    const closing = stack.length > keep
    if (closing) closeTo(keep)
    out += pendingTrail
    pendingTrail = ""

    const toOpen = MARK_ORDER.filter((key) => wanted(key) && !stack.some((m) => m.key === key))
    const isCode = seg.code && !blank
    let lead = ""
    let core = text
    let trail = ""
    if (!isCode && !blank) {
      const m = text.match(/^(\s*)([\s\S]*?)(\s*)$/)!
      lead = m[1]
      core = m[2]
      trail = m[3]
    }
    if (toOpen.length > 0) {
      out += lead
      lead = ""
    }
    for (const key of toOpen) {
      out += syntax.open(key, seg)
      stack.push({ key, href: key === "link" ? seg.link : null })
    }
    out += lead + escapeMarkdownText(core)
    // L'espace de fin reste dans la marque si elle continue au morceau suivant (réglé à l'itération suivante)
    pendingTrail = trail
  }
  closeTo(0)
  out += pendingTrail
  return out
}

function hasFormatting(segments: Segment[]): boolean {
  return segments.some((s) => s.bold || s.italic || s.code)
}

/**
 * Verdicts déjà rendus par le moteur (« délimiteurs sûrs ? ») : le document
 * est réécrit à chaque frappe, et ses lignes inchangées ne repassent pas par
 * le moteur. Taille bornée.
 */
const engineVerdicts = new Map<string, boolean>()
const MAX_VERDICTS = 2000

function delimitersRenderLikeTags(delimited: string, tagged: string): boolean {
  const key = `${delimited}\u0001${tagged}`
  const known = engineVerdicts.get(key)
  if (known !== undefined) return known
  const same = markdownToHtml(delimited) === markdownToHtml(tagged)
  if (engineVerdicts.size >= MAX_VERDICTS) engineVerdicts.clear()
  engineVerdicts.set(key, same)
  return same
}

/**
 * Ligne de contenu en ligne, prête pour le moteur : délimiteurs Markdown si le
 * moteur les rend comme prévu, balises HTML sinon.
 */
function inlineMarkdown(segments: Segment[]): string {
  const delimited = writeLine(segments, DELIMITERS)
  if (!hasFormatting(segments)) return delimited
  const tagged = writeLine(segments, TAGS)
  if (delimited === tagged) return delimited
  return delimitersRenderLikeTags(delimited, tagged) ? delimited : tagged
}

/** Lignes d'un bloc de texte (sauts de ligne gardés), espaces de bord retirés, lignes vides fusionnées. */
function blockLines(content: JSONContent[] | undefined): string[] {
  const lines = splitLines(inlineItems(content)).map((segs) => inlineMarkdown(segs).replace(/^[ \t]+|[ \t]+$/g, ""))
  // Sauts de ligne en tête et en fin : sans effet à l'affichage
  while (lines.length > 0 && lines[0] === "") lines.shift()
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop()
  // Ligne vide au milieu : un retour à la ligne de plus, sans couper le paragraphe
  const out: string[] = []
  for (const line of lines) {
    if (line === "" && out.length > 0) out[out.length - 1] += "<br />"
    else out.push(line)
  }
  return out
}

/** Contenu en ligne sur une seule ligne (titre, cellule) : sauts de ligne en espaces. */
function singleLine(content: JSONContent[] | undefined): string {
  const segs = inlineItems(content).map((i) => (isBreak(i) ? { text: " ", bold: false, italic: false, code: false, link: null } : i))
  return inlineMarkdown(segs).replace(/\s+$/g, "").replace(/^\s+/g, "")
}

/* ------------------------------------------------------------------ */
/* Blocs                                                               */
/* ------------------------------------------------------------------ */

/**
 * Blocs sortis d'une liste, d'une citation ou d'une cellule (images,
 * tableaux, séparateurs), écrits juste après le bloc de premier niveau qui
 * les contenait.
 */
type Hoisted = string[]

/** Bloc que le moteur n'affiche qu'au premier niveau : sorti de son conteneur. */
function hoist(node: JSONContent, hoisted: Hoisted): boolean {
  switch (node.type) {
    case "image": {
      const md = image(node)
      if (md) hoisted.push(md)
      return true
    }
    case "table": {
      const md = table(node, hoisted)
      if (md) hoisted.push(md)
      return true
    }
    case "horizontalRule":
      hoisted.push("---")
      return true
    default:
      return false
  }
}

function textOf(node: JSONContent): string {
  if (typeof node.text === "string") return node.text
  return (node.content ?? []).map(textOf).join("")
}

function paragraph(node: JSONContent): string {
  return blockLines(node.content).map(escapeLineStart).join("\n")
}

function heading(node: JSONContent): string {
  const text = singleLine(node.content)
  if (!text) return ""
  const raw = Number(node.attrs?.level ?? 2)
  const level = Math.min(4, Math.max(1, Number.isFinite(raw) ? Math.round(raw) : 2))
  return literalHeading(`${"#".repeat(level)} ${text}`)
}

/** Entités écrites par escapeMarkdownText, et le caractère qu'elles remplacent. */
const HEADING_ENTITIES: [RegExp, string][] = [
  [/&#91;/g, "["],
  [/&#93;/g, "]"],
  [/&#42;/g, "*"],
  [/&#96;/g, "`"],
]

/**
 * Titre 2 ou 3 : le moteur tire son identifiant (ancre « #… ») du texte brut,
 * entités comprises (« &#91; » donnerait « -91- »). Une entité inutile
 * casserait donc les liens vers ce titre (« [la section](#…) », liens déjà
 * partagés). Les caractères que le moteur ne lirait pas comme une mise en
 * forme (« [ » sans « ]( », « * » seul…) restent écrits tels quels : le
 * moteur décide, en comparant les deux rendus (identifiant mis à part).
 */
function literalHeading(line: string): string {
  if (!/^#{2,3} /.test(line) || !/&#(?:91|93|42|96);/.test(line)) return line
  const decode = (text: string) => HEADING_ENTITIES.reduce((acc, [entity, char]) => acc.replace(entity, char), text)
  // Rendu tel que le lecteur le voit (entités décodées), identifiant mis à part
  const shown = (md: string) => decode(markdownToHtml(md).replace(/^<h([23]) id="[^"]*">/, "<h$1>"))
  const expected = shown(line)
  // Tout en clair, sinon crochets seuls, puis astérisques seuls, puis accents graves seuls
  const candidates = [decode(line), line.replace(/&#91;/g, "[").replace(/&#93;/g, "]"), line.replace(/&#42;/g, "*"), line.replace(/&#96;/g, "`")]
  for (const candidate of candidates) {
    if (candidate !== line && shown(candidate) === expected) return candidate
  }
  return line
}

/** Texte d'un élément de liste : ses blocs en ligne, séparés par « <br /> ». */
function listItemParts(item: JSONContent, hoisted: Hoisted): { text: string; nested: string[] } {
  const parts: string[] = []
  const nested: string[] = []
  for (const child of item.content ?? []) {
    if (hoist(child, hoisted)) continue
    switch (child.type) {
      case "paragraph":
      case "heading": {
        const lines = blockLines(child.content)
        if (lines.length > 0) parts.push(lines.join("<br />"))
        break
      }
      case "bulletList":
      case "orderedList":
        nested.push(...listItems(child, hoisted))
        break
      case "blockquote":
        for (const line of quoteLines(child, hoisted)) parts.push(line)
        break
      case "codeBlock": {
        const code = textOf(child).trim()
        if (code) parts.push(escapeMarkdownText(code))
        break
      }
      default:
        break
    }
  }
  return { text: parts.join("<br />"), nested }
}

/** Éléments d'une liste, sous-listes aplaties à la suite. */
function listItems(list: JSONContent, hoisted: Hoisted): string[] {
  const items: string[] = []
  for (const item of list.content ?? []) {
    const { text, nested } = listItemParts(item, hoisted)
    if (text) items.push(text)
    items.push(...nested)
  }
  return items
}

function list(node: JSONContent, hoisted: Hoisted): string {
  const items = listItems(node, hoisted)
  if (items.length === 0) return ""
  return items.map((text, i) => (node.type === "orderedList" ? `${i + 1}. ${text}` : `- ${text}`)).join("\n")
}

/** Lignes d'une citation (sans le « > »). */
function quoteLines(node: JSONContent, hoisted: Hoisted): string[] {
  const lines: string[] = []
  for (const child of node.content ?? []) {
    if (hoist(child, hoisted)) continue
    switch (child.type) {
      case "paragraph":
        lines.push(...blockLines(child.content))
        break
      case "heading": {
        const text = singleLine(child.content)
        if (text) lines.push(text)
        break
      }
      case "bulletList":
      case "orderedList":
        listItems(child, hoisted).forEach((text, i) => lines.push(child.type === "orderedList" ? `${i + 1}. ${text}` : `- ${text}`))
        break
      case "blockquote":
        lines.push(...quoteLines(child, hoisted))
        break
      case "codeBlock":
        lines.push(
          ...textOf(child)
            .split("\n")
            .map((l) => escapeMarkdownText(l).trim())
            .filter(Boolean),
        )
        break
      default:
        break
    }
  }
  return lines.filter((l) => l.trim() !== "")
}

function blockquote(node: JSONContent, hoisted: Hoisted): string {
  return quoteLines(node, hoisted)
    .map((l) => `> ${l}`)
    .join("\n")
}

function codeBlock(node: JSONContent): string {
  const body = textOf(node).replace(/\r\n?/g, "\n").replace(/\n+$/, "")
  if (!body.trim()) return ""
  const lang = String(node.attrs?.language ?? "").replace(/\W/g, "")
  const lines = body
    .replace(/```/g, "``​`")
    .split("\n")
    .map((l) => (l === "" ? " " : l))
  return `\`\`\`${lang}\n${lines.join("\n")}\n\`\`\``
}

/**
 * Texte d'image (alt, légende) : une ligne ; barre oblique inverse devant ce
 * qui fermerait la syntaxe (le moteur la retire à l'affichage).
 */
function imageText(value: unknown, special: RegExp): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(special, (c) => `\\${c}`)
}

function image(node: JSONContent): string {
  const src = markdownHref(String(node.attrs?.src ?? "").split("#")[0])
  if (!src || !/^https?:\/\//i.test(src)) return ""
  const width = Number(node.attrs?.width)
  const height = Number(node.attrs?.height)
  const url = width > 0 && height > 0 ? withImageSize(src, width, height) : src
  const alt = imageText(node.attrs?.alt, /[\\[\]]/g)
  const caption = imageText(node.attrs?.title, /[\\"]/g)
  return caption ? `![${alt}](${url} "${caption}")` : `![${alt}](${url})`
}

type Align = "left" | "center" | "right" | null

function cellAlign(cell: JSONContent): Align {
  const a = cell.attrs?.align
  return a === "left" || a === "center" || a === "right" ? a : null
}

function cellText(cell: JSONContent, hoisted: Hoisted): string {
  const parts: string[] = []
  for (const child of cell.content ?? []) {
    if (hoist(child, hoisted)) continue
    if (child.type === "paragraph" || child.type === "heading") {
      const text = singleLine(child.content)
      if (text) parts.push(text)
    } else if (child.type === "bulletList" || child.type === "orderedList") {
      parts.push(...listItems(child, hoisted).map((t) => t.replace(/<br \/>/g, " ")))
    } else if (child.type === "blockquote") {
      parts.push(...quoteLines(child, hoisted).map((t) => t.replace(/<br \/>/g, " ")))
    } else if (child.type === "codeBlock") {
      const code = textOf(child).replace(/\s+/g, " ").trim()
      if (code) parts.push(escapeMarkdownText(code))
    }
  }
  return parts.join(" ").replace(/\|/g, "\\|")
}

function table(node: JSONContent, hoisted: Hoisted): string {
  const rows = (node.content ?? [])
    .filter((r) => r.type === "tableRow")
    .map((r) => (r.content ?? []).filter((c) => c.type === "tableCell" || c.type === "tableHeader"))
    .filter((cells) => cells.length > 0)
  if (rows.length === 0) return ""
  const cols = Math.max(...rows.map((r) => r.length))
  const aligns: Align[] = Array.from({ length: cols }, (_, i) => {
    for (const r of rows) {
      const a = r[i] ? cellAlign(r[i]) : null
      if (a) return a
    }
    return null
  })
  const line = (cells: JSONContent[]) => `| ${Array.from({ length: cols }, (_, i) => (cells[i] ? cellText(cells[i], hoisted) : "")).join(" | ")} |`
  const delimiter = `| ${aligns.map((a) => (a === "center" ? ":---:" : a === "right" ? "---:" : a === "left" ? ":---" : "---")).join(" | ")} |`
  return [line(rows[0]), delimiter, ...rows.slice(1).map(line)].join("\n")
}

/** Un bloc de premier niveau, suivi des blocs sortis de lui. */
function withHoisted(md: string, hoisted: Hoisted): string {
  return [md, ...hoisted].filter((b) => b.trim() !== "").join("\n\n")
}

function block(node: JSONContent): string {
  const hoisted: Hoisted = []
  switch (node.type) {
    case "paragraph":
      return paragraph(node)
    case "heading":
      return heading(node)
    case "bulletList":
    case "orderedList":
      return withHoisted(list(node, hoisted), hoisted)
    case "listItem":
      return withHoisted(list({ type: "bulletList", content: [node] }, hoisted), hoisted)
    case "blockquote":
      return withHoisted(blockquote(node, hoisted), hoisted)
    case "codeBlock":
      return codeBlock(node)
    case "horizontalRule":
      return "---"
    case "image":
      return image(node)
    case "table":
      return withHoisted(table(node, hoisted), hoisted)
    case "text":
      return paragraph({ type: "paragraph", content: [node] })
    default:
      // Nœud inconnu : ses blocs
      return (node.content ?? []).map(block).filter(Boolean).join("\n\n")
  }
}

/**
 * Markdown du blog d'un document Tiptap : blocs séparés par une ligne vide,
 * sans espace ni saut de ligne final. Document vide → « ».
 */
export function docToMarkdown(doc: JSONContent): string {
  const nodes = doc.type === "doc" ? doc.content ?? [] : [doc]
  return nodes
    .map(block)
    .filter((b) => b.trim() !== "")
    .join("\n\n")
    .replace(/\s+$/, "")
}
