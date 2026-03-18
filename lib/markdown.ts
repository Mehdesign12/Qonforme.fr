/**
 * Minimal Markdown → HTML converter for blog posts.
 * Supports: headings (with IDs for TOC), bold, italic, links, unordered/ordered lists,
 * code blocks, inline code, blockquotes, paragraphs, horizontal rules.
 *
 * Content is authored by admins only — no untrusted user input.
 */
export function markdownToHtml(md: string): string {
  let html = md

  // Fenced code blocks (```...```)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, _lang, code) => {
    return `<pre><code>${escapeHtml(code.trimEnd())}</code></pre>`
  })

  // Headings — with generated IDs for table of contents
  html = html.replace(/^#### (.+)$/gm, (_m, text) => `<h4>${text}</h4>`)
  html = html.replace(/^### (.+)$/gm, (_m, text) => `<h3 id="${slugify(text)}">${text}</h3>`)
  html = html.replace(/^## (.+)$/gm, (_m, text) => `<h2 id="${slugify(text)}">${text}</h2>`)
  html = html.replace(/^# (.+)$/gm, (_m, text) => `<h1>${text}</h1>`)

  // Horizontal rule
  html = html.replace(/^---$/gm, '<hr />')

  // Blockquotes (> text)
  html = html.replace(/((?:^> .+\n?)+)/gm, (block) => {
    const inner = block.trim().split('\n').map(line =>
      line.replace(/^> ?/, '')
    ).join('<br />')
    return `<blockquote><p>${inner}</p></blockquote>\n`
  })

  // Bold & italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>')

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')

  // Unordered lists
  html = html.replace(/((?:^- .+\n?)+)/gm, (block) => {
    const items = block.trim().split('\n').map(line =>
      `<li>${line.replace(/^- /, '')}</li>`
    ).join('\n')
    return `<ul>\n${items}\n</ul>\n`
  })

  // Ordered lists
  html = html.replace(/((?:^\d+\. .+\n?)+)/gm, (block) => {
    const items = block.trim().split('\n').map(line =>
      `<li>${line.replace(/^\d+\. /, '')}</li>`
    ).join('\n')
    return `<ol>\n${items}\n</ol>\n`
  })

  // Paragraphs: wrap remaining lines not already in tags
  html = html
    .split('\n\n')
    .map(block => {
      const trimmed = block.trim()
      if (!trimmed) return ''
      if (/^<(h[1-4]|ul|ol|pre|hr|blockquote)/.test(trimmed)) return trimmed
      return `<p>${trimmed.replace(/\n/g, '<br />')}</p>`
    })
    .join('\n\n')

  return html
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
