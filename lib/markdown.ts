/**
 * Minimal Markdown → HTML converter for blog posts.
 * Supports: headings (with IDs for TOC), bold, italic, links, unordered/ordered lists,
 * code blocks, inline code, blockquotes, paragraphs, horizontal rules,
 * images alone on their line (figure + légende) and GFM tables.
 *
 * Content is authored by admins only — no untrusted user input.
 *
 * Images (éditeur du blog, octobre 2026) :
 * - `![alt](adresse "légende")` seule sur sa ligne devient
 *   <figure><img …><figcaption>…</figcaption></figure>, avec largeur et hauteur
 *   lues dans le fragment de l'adresse (#w=…&h=…, retiré de src) pour réserver
 *   la place de l'image ;
 * - seulement pour une image du compartiment du blog (isBlogImageUrl,
 *   lib/blog-images/policy.ts) : une image hébergée ailleurs n'est pas
 *   affichée du tout (vie privée des lecteurs, images qui disparaissent) ;
 * - une image au milieu d'une phrase n'est jamais affichée : l'éditeur place
 *   toujours ses images sur une ligne à part (une puce ou une citation qui ne
 *   contenait qu'une image disparaît, une image cliquable part avec son lien) ;
 *   la syntaxe d'une image dans du code en ligne (« `![alt](url)` ») reste
 *   affichée telle quelle ;
 * - texte alternatif et légende sont du texte brut, échappé (& < > ") et mis
 *   à l'abri des remplacements suivants (gras, italique, liens).
 *
 * Tableaux GFM (`| a | b |` puis `|---|:---:|`) : une seule ligne de HTML
 * (<table><thead>…</thead><tbody>…</tbody></table>), donc un seul bloc pour
 * le découpage en paragraphes ; alignements des colonnes par text-align ;
 * `\|` dans une cellule = barre verticale littérale. Le gras, l'italique et le
 * code sont appliqués cellule par cellule (jamais à cheval sur deux cellules),
 * les liens par les remplacements globaux appliqués ensuite. Le contenu des
 * blocs de code (même sur une seule ligne) n'est jamais lu comme un tableau
 * ni comme une image.
 */
import { isBlogImageUrl, isGeneratedBlogImage, readImageSize } from "@/lib/blog-images/policy"

export interface MarkdownOptions {
  /** Adresse du projet Supabase dont les images sont admises ; par défaut NEXT_PUBLIC_SUPABASE_URL. */
  supabaseUrl?: string
  /**
   * Page publique du blog : « Illustration générée par IA » dans la légende
   * d'une image générée (editor/ia/, isGeneratedBlogImage ; AI Act, art. 50).
   * Jamais dans l'éditeur, qui relit la légende comme du texte de l'article.
   */
  aiImageMention?: boolean
  /**
   * Page publique du blog : un lien vers une page du site (« /guide/… », « #… »)
   * s'ouvre dans le même onglet, avec son référent (l'analyse des parcours le
   * lit) ; les liens externes gardent leur nouvel onglet. L'éditeur, qui relit
   * le texte à l'identique, garde le comportement d'origine.
   */
  sameTabInternalLinks?: boolean
}

/** Mention ajoutée sous une image générée par IA (option aiImageMention). */
export const AI_IMAGE_MENTION = "Illustration générée par IA"

/**
 * Ligne vide autour de chaque bloc (titre, liste, citation, séparateur, code) :
 * le texte collé juste au-dessus ou au-dessous reste un paragraphe à part. Sans
 * elle, « **Tableau** » suivi directement de « - une puce » donnait un <ul>
 * dans un <p>, avec des <br /> entre les <li> : trous dans la liste de l'éditeur
 * et espaces en trop sur la page publique.
 */
const BLOCK_BREAK = '\n\n'

export function markdownToHtml(md: string, options: MarkdownOptions = {}): string {
  let html = md

  // Fragments déjà rendus (images), remis en place juste avant les paragraphes
  const shelf: string[] = []
  const shelve = (fragment: string) => `\u0000${shelf.push(fragment) - 1}\u0000`

  // Fenced code blocks (```...```)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, _lang, code) => {
    return `${BLOCK_BREAK}<pre><code>${escapeHtml(code.trimEnd())}</code></pre>${BLOCK_BREAK}`
  })

  // Tableaux et images seules sur leur ligne (avant les titres, les liens et les paragraphes)
  html = blockMedia(html, options.supabaseUrl === undefined ? process.env.NEXT_PUBLIC_SUPABASE_URL : options.supabaseUrl, shelve, options.aiImageMention === true)

  // Headings — with generated IDs for table of contents
  html = html.replace(/^#### (.+)$/gm, (_m, text) => `${BLOCK_BREAK}<h4>${text}</h4>${BLOCK_BREAK}`)
  html = html.replace(/^### (.+)$/gm, (_m, text) => `${BLOCK_BREAK}<h3 id="${slugify(text)}">${text}</h3>${BLOCK_BREAK}`)
  html = html.replace(/^## (.+)$/gm, (_m, text) => `${BLOCK_BREAK}<h2 id="${slugify(text)}">${text}</h2>${BLOCK_BREAK}`)
  html = html.replace(/^# (.+)$/gm, (_m, text) => `${BLOCK_BREAK}<h1>${text}</h1>${BLOCK_BREAK}`)

  // Horizontal rule
  html = html.replace(/^---$/gm, `${BLOCK_BREAK}<hr />${BLOCK_BREAK}`)

  // Blockquotes (> text)
  html = html.replace(/((?:^> .+\n?)+)/gm, (block) => {
    const inner = block.trim().split('\n').map(line =>
      line.replace(/^> ?/, '')
    ).join('<br />')
    return `${BLOCK_BREAK}<blockquote><p>${inner}</p></blockquote>${BLOCK_BREAK}`
  })

  // Bold & italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>')

  // Links — http(s), chemins du site et ancres seulement (jamais javascript:, data:…)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, text: string, href: string) => {
    const url = safeHref(href)
    if (url && options.sameTabInternalLinks && /^(\/(?![/\\])|#)/.test(url)) return `<a href="${url}">${text}</a>`
    return url ? `<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>` : text
  })

  // Unordered lists
  html = html.replace(/((?:^- .+\n?)+)/gm, (block) => {
    const items = block.trim().split('\n').map(line =>
      `<li>${line.replace(/^- /, '')}</li>`
    ).join('\n')
    return `${BLOCK_BREAK}<ul>\n${items}\n</ul>${BLOCK_BREAK}`
  })

  // Ordered lists
  html = html.replace(/((?:^\d+\. .+\n?)+)/gm, (block) => {
    const items = block.trim().split('\n').map(line =>
      `<li>${line.replace(/^\d+\. /, '')}</li>`
    ).join('\n')
    return `${BLOCK_BREAK}<ol>\n${items}\n</ol>${BLOCK_BREAK}`
  })

  // Images remises en place, chacune dans son propre bloc
  html = html.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => shelf[Number(i)] ?? '')

  // Paragraphs: wrap remaining lines not already in tags
  html = html
    .split('\n\n')
    .map(block => {
      const trimmed = block.trim()
      if (!trimmed) return ''
      if (/^<(h[1-4]|ul|ol|pre|hr|blockquote|table|figure|div)/.test(trimmed)) return trimmed
      return `<p>${trimmed.replace(/\n/g, '<br />')}</p>`
    })
    .filter(block => block !== '')
    .join('\n\n')

  return html
}

/* ------------------------------------------------------------------ */
/* Images et tableaux                                                  */
/* ------------------------------------------------------------------ */

/**
 * Texte entre crochets d'une image : `\` échappe un caractère, et des crochets
 * équilibrés sur un niveau sont admis (« [lien](…) » recopié dans un alt).
 */
const ALT_TEXT = String.raw`(?:[^\[\]\\\n]|\\.|\[(?:[^\[\]\\\n]|\\.)*\])*`
/** `![alt](adresse "légende")` seule sur sa ligne. */
const BLOCK_IMAGE = new RegExp(String.raw`^[ \t]*!\[(${ALT_TEXT})\]\(\s*<?([^\s<>()]+)>?(?:\s+"((?:[^"\\\n]|\\.)*)")?\s*\)[ \t\r]*$`)
/** Image dans une phrase : retirée (seules les images seules sur leur ligne sont affichées). */
const INLINE_IMAGE = new RegExp(String.raw`!\[${ALT_TEXT}\]\([^)\n]*\)`, "g")
/** Image cliquable `[![alt](image)](lien)` : retirée avec son lien (sinon il resterait « [](lien) »). */
const LINKED_IMAGE = new RegExp(String.raw`\[\s*!\[${ALT_TEXT}\]\([^)\n]*\)\s*\]\([^)\n]*\)`, "g")
/** Ligne réduite à une puce, un numéro ou un chevron de citation une fois l'image retirée. */
const BARE_MARKER = /^[ \t]*(?:[-*+]|\d+\.|>)?[ \t\r]*$/

/**
 * Retire les images d'une ligne qui n'est pas une image seule ; null si la
 * ligne ne contenait qu'une image (dans une puce ou une citation, par
 * exemple) : elle disparaît au lieu de laisser une puce vide ou un « > ».
 */
function stripInlineImages(line: string): string | null {
  if (!line.includes('![')) return line
  const stripped = withoutImages(line, INLINE_CODE)
  if (stripped === line) return line
  return BARE_MARKER.test(stripped) ? null : stripped
}

/** Code en ligne : `…` dans le Markdown, <code>…</code> dans le HTML d'un tableau. */
const INLINE_CODE = /(`[^`]+`)/
const CODE_TAG = /(<code>[\s\S]*?<\/code>)/

/**
 * Images retirées hors du code en ligne : « `![alt](url)` » reste un exemple
 * de syntaxe affiché tel quel (les morceaux de rang impair sont le code).
 */
function withoutImages(text: string, code: RegExp): string {
  return text
    .split(code)
    .map((part, i) => (i % 2 === 1 ? part : part.replace(LINKED_IMAGE, '').replace(INLINE_IMAGE, '')))
    .join('')
}

const unescapeMd = (s: string) => s.replace(/\\(.)/g, '$1')

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, '&quot;')
}

/** <figure> d'une image du compartiment du blog ; null pour une autre adresse. */
function imageFigure(rawAlt: string, url: string, rawCaption: string | undefined, supabaseUrl: string | undefined, aiMention: boolean): string | null {
  if (!isBlogImageUrl(url, supabaseUrl)) return null
  const { src, width, height } = readImageSize(url)
  const alt = escapeAttr(unescapeMd(rawAlt).replace(/\s+/g, ' ').trim())
  const typed = rawCaption ? escapeAttr(unescapeMd(rawCaption).replace(/\s+/g, ' ').trim()) : ''
  // Image générée par IA : la mention suit la légende (ou la remplace si elle est vide)
  const caption = aiMention && isGeneratedBlogImage(url, supabaseUrl) ? (typed ? `${typed} · ${AI_IMAGE_MENTION}` : AI_IMAGE_MENTION) : typed
  const size = width && height ? ` width="${width}" height="${height}"` : ''
  const img = `<img src="${src.replace(/&/g, '&amp;')}" alt="${alt}"${size} loading="lazy" decoding="async" />`
  return `<figure>${img}${caption ? `<figcaption>${caption}</figcaption>` : ''}</figure>`
}

/** Vrai si la ligne contient une barre verticale non échappée. */
const hasPipe = (line: string) => /(^|[^\\])\|/.test(line)

/** Cellules d'une ligne de tableau (barres de bord facultatives, `\|` littéral). */
function splitRow(line: string): string[] {
  let s = line.trim()
  if (s.startsWith('|')) s = s.slice(1)
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1)
  const cells: string[] = []
  let cell = ''
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === '\\' && s[i + 1] === '|') {
      cell += '|'
      i++
    } else if (c === '|') {
      cells.push(cell.trim())
      cell = ''
    } else {
      cell += c
    }
  }
  cells.push(cell.trim())
  return cells
}

/**
 * Mise en forme d'une cellule (mêmes remplacements, dans le même ordre, que
 * le texte courant), puis astérisques et accents graves restés seuls rendus
 * en entités : les remplacements globaux appliqués ensuite ne peuvent plus
 * apparier l'astérisque d'une cellule avec celui d'une autre (« 5 * 3 » et
 * « 2 * 4 » donneraient un <em> à cheval sur deux cellules).
 */
function cellInline(text: string): string {
  return text
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*/g, '&#42;')
    .replace(/`/g, '&#96;')
}

type Align = 'left' | 'center' | 'right' | null

/** Alignements lus sur la ligne de séparation ; null si ce n'en est pas une. */
function delimiterRow(line: string, columns: number): Align[] | null {
  if (!hasPipe(line) || !line.includes('-')) return null
  const cells = splitRow(line)
  if (cells.length !== columns || !cells.every((c) => /^:?-+:?$/.test(c))) return null
  return cells.map((c) => {
    const left = c.startsWith(':')
    const right = c.endsWith(':')
    return left && right ? 'center' : right ? 'right' : left ? 'left' : null
  })
}

/** Tableau GFM commençant à la ligne `start` : HTML sur une ligne et dernière ligne lue. */
function readTable(lines: string[], start: number): { html: string; end: number } | null {
  const header = lines[start]
  if (!hasPipe(header) || start + 1 >= lines.length) return null
  const head = splitRow(header)
  const aligns = delimiterRow(lines[start + 1], head.length)
  if (!aligns) return null

  const cell = (tag: 'th' | 'td', text: string, i: number) => {
    const align = aligns[i]
    return `<${tag}${align ? ` style="text-align:${align}"` : ''}>${cellInline(text)}</${tag}>`
  }
  const row = (tag: 'th' | 'td', cells: string[]) =>
    `<tr>${aligns.map((_a, i) => cell(tag, cells[i] ?? '', i)).join('')}</tr>`

  const body: string[] = []
  let end = start + 1
  for (let j = start + 2; j < lines.length; j++) {
    const line = lines[j]
    if (!line.trim() || !hasPipe(line)) break
    body.push(row('td', splitRow(line)))
    end = j
  }
  const html = `<table><thead>${row('th', head)}</thead>${body.length ? `<tbody>${body.join('')}</tbody>` : ''}</table>`
  return { html, end }
}

/**
 * Passe ligne à ligne : tableaux GFM, images seules sur leur ligne (rangées
 * à l'abri par `shelve`) et images dans une phrase (retirées). Les lignes des
 * blocs de code (<pre>) sont laissées telles quelles.
 */
function blockMedia(html: string, supabaseUrl: string | undefined, shelve: (fragment: string) => string, aiMention: boolean): string {
  const lines = html.split('\n')
  const out: string[] = []
  let inPre = false
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (inPre) {
      out.push(line)
      if (line.includes('</pre>')) inPre = false
      continue
    }
    // Ligne d'un bloc de code (sur une seule ligne, ou première d'un bloc) : jamais lue
    if (line.includes('<pre>')) {
      if (!line.includes('</pre>')) inPre = true
      out.push(line)
      continue
    }
    const table = readTable(lines, i)
    if (table) {
      // Lignes vides autour : le tableau forme toujours son propre bloc
      out.push('', withoutImages(table.html, CODE_TAG), '')
      i = table.end
      continue
    }
    const image = BLOCK_IMAGE.exec(line)
    if (image) {
      const figure = imageFigure(image[1], image[2], image[3], supabaseUrl, aiMention)
      // Image refusée : la ligne disparaît (le paragraphe qui l'entoure reste d'un seul tenant)
      if (figure) out.push('', shelve(figure), '')
      continue
    }
    const kept = stripInlineImages(line)
    if (kept !== null) out.push(kept)
  }
  return out.join('\n')
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/** http(s), chemin du site ou ancre ; jamais « // » ni « /\ » (un navigateur lit « /\hôte » comme « //hôte »). */
const SAFE_HREF_START = /^(https?:\/\/|\/(?![/\\])|#)/i
/**
 * Barre oblique inverse et caractères de contrôle : un navigateur lit « \ »
 * comme « / » et retire tabulations et retours à la ligne d'une adresse
 * (« /<tab>/hôte » mène à « //hôte », un autre site).
 */
const UNSAFE_HREF_CHAR = /[\\\u0000-\u001f\u007f]/

/**
 * Vrai pour une adresse de lien sûre : http(s), chemin du site (pas « // » ni
 * « /\ ») ou ancre, sans barre oblique inverse ni caractère de contrôle.
 * Même règle pour le moteur (safeHref), l'éditeur (liens Tiptap, Markdown
 * écrit, bouton « Ouvrir ») et le score (lien interne).
 */
export function isSafeHref(raw: string): boolean {
  const href = raw.trim()
  return SAFE_HREF_START.test(href) && !UNSAFE_HREF_CHAR.test(href)
}

/** Adresse de lien sûre (isSafeHref), prête pour l'attribut href ; null sinon. */
export function safeHref(raw: string): string | null {
  if (!isSafeHref(raw)) return null
  return raw.trim().replace(/"/g, "%22").replace(/</g, "%3C").replace(/>/g, "%3E")
}
