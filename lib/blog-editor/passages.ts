/**
 * Retrouver un passage dans le Markdown d'un article et le remplacer : « Aller
 * au passage » et « Corriger avec l'IA » (passages refusés par le contrôle),
 * intégration d'un mot-clé par l'IA (mots-clés secondaires, sous-titre,
 * introduction).
 *
 * Le contrôle ne donne qu'un extrait (« excerpt », 300 caractères au plus,
 * tiré du Markdown : liens, gras et guillemets compris). On le compare au
 * texte sans syntaxe ni guillemets (`comparable`, lib/seo/articles/check.ts),
 * comme le contrôle lui-même.
 *
 * Unité d'un passage : le paragraphe, le titre (sans ses « # »), ou la puce
 * d'une liste (sans son tiret). Citations, tableaux, HTML et blocs de code se
 * retrouvent (pour montrer l'endroit) mais ne se remplacent pas : l'IA ne
 * réécrit que du texte courant.
 *
 * Module pur : navigateur, serveur et tests.
 */
import { comparable } from "@/lib/seo/articles/check"
import { parseBlocks } from "@/lib/seo/articles/images"

export type PassageKind = "paragraph" | "heading" | "list-item" | "other"

export interface PassageUnit {
  kind: PassageKind
  /** Position du texte remplaçable dans le Markdown (hors « # » et hors marqueur de liste). */
  start: number
  end: number
  /** Markdown du passage (ce que l'on envoie au modèle). */
  text: string
  /** Niveau d'un titre (1 à 6). */
  level?: number
}

const LIST_ITEM = /^(\s*(?:[-*+]|\d+[.)])\s+)/

/** Unités de texte du Markdown, dans l'ordre. */
export function passageUnits(markdown: string): PassageUnit[] {
  const out: PassageUnit[] = []
  for (const block of parseBlocks(markdown)) {
    if (block.kind === "paragraph") {
      out.push({ kind: "paragraph", start: block.start, end: block.end, text: markdown.slice(block.start, block.end) })
    } else if (block.kind === "heading") {
      const raw = markdown.slice(block.start, block.end)
      const lead = raw.match(/^\s*(#{1,6})\s+/)
      const hashes = lead?.[0].length ?? 0
      out.push({ kind: "heading", start: block.start + hashes, end: block.end, text: raw.slice(hashes), level: lead?.[1].length })
    } else if (block.kind === "list") {
      const raw = markdown.slice(block.start, block.end)
      let offset = 0
      let item: PassageUnit | null = null
      for (const line of raw.split("\n")) {
        const marker = line.match(LIST_ITEM)?.[1].length
        const lineStart = block.start + offset
        const lineEnd = lineStart + line.length
        if (marker !== undefined) {
          if (item) out.push(item)
          item = { kind: "list-item", start: lineStart + marker, end: lineEnd, text: line.slice(marker) }
        } else if (item) {
          item.end = lineEnd
          item.text = markdown.slice(item.start, item.end)
        }
        offset += line.length + 1
      }
      if (item) out.push(item)
    } else if (block.kind !== "image" && block.kind !== "code") {
      out.push({ kind: "other", start: block.start, end: block.end, text: markdown.slice(block.start, block.end) })
    }
  }
  return out
}

/** Extrait et ses versions raccourcies (un extrait coupé ne retrouve pas toujours son passage en entier). */
function probes(excerpt: string): string[] {
  // Les extraits du contrôle d'audit sont entourés de « … » quand ils sont coupés
  const full = comparable(excerpt.replace(/^[\s….]+|[\s….]+$/g, ""))
  if (!full) return []
  const list = [full]
  for (const max of [120, 60]) {
    if (full.length > max + 10) list.push(full.slice(0, max).replace(/\s+\S*$/, ""))
  }
  return Array.from(new Set(list.filter((p, i) => i === 0 || p.length >= 12)))
}

/**
 * Le texte contient l'extrait en entier (sans syntaxe, guillemets ni casse), même s'il s'étend sur plusieurs
 * passages : « le passage refusé est-il encore là ? ». Un extrait dont on ne retrouve que le début est corrigé.
 */
export function excerptInText(text: string, excerpt: string): boolean {
  const needle = probes(excerpt)[0]
  return Boolean(needle) && comparable(text).includes(needle)
}

/** Le texte (sans syntaxe) contient l'extrait, entier d'abord, puis son début (retrouver un passage coupé ou modifié plus loin). */
export function textHasExcerpt(text: string, excerpt: string): boolean {
  const hay = comparable(text)
  return probes(excerpt).some((p) => hay.includes(p))
}

/** Passage du Markdown qui contient l'extrait (null : introuvable, ou texte déjà modifié). */
export function locateInMarkdown(markdown: string, excerpt: string): PassageUnit | null {
  const units = passageUnits(markdown)
  for (const probe of probes(excerpt)) {
    const found = units.find((u) => comparable(u.text).includes(probe))
    if (found) return found
  }
  return null
}

/** Réécriture rangée sur une seule ligne (titre, puce) ou sans ligne vide (paragraphe). */
export function fitPassageText(kind: PassageKind, replacement: string): string {
  const text = replacement.replace(/\r\n?/g, "\n").trim()
  if (kind === "heading") return text.replace(/^#{1,6}\s+/, "").replace(/\s*\n\s*/g, " ")
  if (kind === "list-item") return text.replace(/^(?:[-*+]|\d+[.)])\s+/, "").replace(/\s*\n\s*/g, " ")
  return text.replace(/\n{2,}/g, "\n")
}

export interface PassageEdit {
  /** Extrait qui retrouve le passage (premier texte du passage, ou extrait du contrôle). */
  excerpt: string
  /** Nouveau texte du passage, en Markdown en ligne. */
  text: string
}

export interface AppliedEdits {
  markdown: string
  applied: number
  /** Extraits dont le passage n'a pas été retrouvé (texte modifié entre-temps) ou n'est pas remplaçable. */
  missed: string[]
}

/**
 * Remplace les passages d'un coup (positions lues dans le Markdown d'origine,
 * remplacement de la fin vers le début). Deux modifications du même passage :
 * la première seule est faite.
 */
export function applyPassageEdits(markdown: string, edits: PassageEdit[]): AppliedEdits {
  const found: { unit: PassageUnit; text: string; excerpt: string }[] = []
  const missed: string[] = []
  for (const edit of edits) {
    const unit = locateInMarkdown(markdown, edit.excerpt)
    if (!unit || unit.kind === "other" || found.some((f) => f.unit.start === unit.start)) {
      missed.push(edit.excerpt)
      continue
    }
    found.push({ unit, text: fitPassageText(unit.kind, edit.text), excerpt: edit.excerpt })
  }
  let out = markdown
  for (const f of found.sort((a, b) => b.unit.start - a.unit.start)) out = out.slice(0, f.unit.start) + f.text + out.slice(f.unit.end)
  return { markdown: out, applied: found.length, missed }
}

/** Contexte de lecture autour d'un passage : texte brut avant et après (500 caractères au plus de chaque côté). */
export function contextAround(markdown: string, unit: PassageUnit): { before: string; after: string } {
  const squash = (s: string) => s.replace(/\s+/g, " ").trim()
  return {
    before: squash(markdown.slice(Math.max(0, unit.start - 700), unit.start)).slice(-500),
    after: squash(markdown.slice(unit.end, unit.end + 700)).slice(0, 500),
  }
}
