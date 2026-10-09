/**
 * Blog utility functions: reading time, category derivation, category labels.
 */

import { SEO_TOPICS } from "@/lib/ai/seo-topics"
import type { TopicCategory } from "@/lib/ai/seo-topics"
import { decodeEntities } from "@/lib/html-entities"

// ── Reading time ────────────────────────────────────────────────────────────

/** Average reading speed in French (words per minute). */
const WPM = 230

export function getReadingTime(content: string): number {
  const words = content.trim().split(/\s+/).length
  return Math.max(1, Math.round(words / WPM))
}

// ── Category derivation ─────────────────────────────────────────────────────

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

/**
 * Derives the topic category from the ai_prompt field stored in blog_posts.
 * Falls back to "guide" if no match is found.
 */
export function getCategoryFromPrompt(aiPrompt: string | null): TopicCategory {
  if (!aiPrompt) return "guide"
  const normalizedPrompt = normalize(aiPrompt)

  for (const topic of SEO_TOPICS) {
    const normalizedTopic = normalize(topic.topic)
    if (normalizedPrompt.includes(normalizedTopic)) {
      return topic.category
    }
  }

  return "guide"
}

// ── Category display config ─────────────────────────────────────────────────

/**
 * Libellé affiché de chaque catégorie. Une seule couleur pour toutes les
 * pastilles (accent du canevas, voir components/blog/CategoryBadge.tsx).
 */
export const CATEGORY_CONFIG: Record<TopicCategory, { label: string }> = {
  "réglementation": { label: "Réglementation" },
  "tutoriel":       { label: "Tutoriel" },
  "guide":          { label: "Guide" },
  "actualité":      { label: "Actualité" },
  "comparatif":     { label: "Comparatif" },
  "pratique":       { label: "Pratique" },
  "gestion":        { label: "Gestion" },
  "comptabilité":   { label: "Comptabilité" },
  "digital":        { label: "Digital" },
  "cas-usage":      { label: "Cas d'usage" },
}

// ── FAQ extraction for JSON-LD ──────────────────────────────────────────────

export interface FaqItem {
  question: string
  answer: string
}

/**
 * Extracts FAQ pairs from markdown content.
 * A FAQ item is any H2/H3 heading ending with "?" followed by paragraph text.
 */
export function extractFaqItems(content: string): FaqItem[] {
  const items: FaqItem[] = []
  const lines = content.split("\n")

  for (let i = 0; i < lines.length; i++) {
    const headingMatch = lines[i].match(/^#{2,3}\s+(.+\?)\s*$/)
    if (!headingMatch) continue

    const question = decodeEntities(headingMatch[1].trim())

    // Collect answer lines until next heading, code block, or end
    const answerLines: string[] = []
    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j]
      if (/^#{1,3}\s/.test(line)) break
      if (line.startsWith("```")) break
      const trimmed = line.trim()
      if (trimmed) answerLines.push(trimmed)
    }

    const answer = answerLines
      .join(" ")
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/\*(.+?)\*/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/<[^>]+>/g, " ")
    const answerText = decodeEntities(answer).replace(/\s+/g, " ").trim().slice(0, 500)

    if (answerText.length > 20) {
      items.push({ question, answer: answerText })
    }
  }

  return items.slice(0, 10)
}

/**
 * Extracts H2 headings from markdown content for table of contents.
 */
export function extractHeadings(content: string): { id: string; text: string; level: number }[] {
  const headings: { id: string; text: string; level: number }[] = []
  const regex = /^(#{2,3})\s+(.+)$/gm
  let match

  while ((match = regex.exec(content)) !== null) {
    const level = match[1].length
    const text = match[2].trim()
    const id = text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
    // L'id suit le texte brut (comme lib/markdown.ts) ; l'affichage, le texte décodé
    headings.push({ id, text: decodeEntities(text), level })
  }

  return headings
}

const comparableTitle = (s: string) =>
  decodeEntities(s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()

/**
 * Retire un premier titre identique au titre de l'article : la page l'affiche
 * déjà en h1. Appliqué à l'affichage, pour tous les articles (l'article reçu de
 * PushRank le 07/10/2026 commençait par son titre en h2).
 */
export function stripLeadingTitle(markdown: string, title: string): string {
  const m = /^\s*(#{1,6})[ \t]+([^\n]*)(?:\n+|$)/.exec(markdown)
  if (!m || !title.trim() || comparableTitle(m[2]) !== comparableTitle(title)) return markdown
  return markdown.slice(m[0].length).trimStart()
}
