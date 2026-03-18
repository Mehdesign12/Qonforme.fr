/**
 * Blog utility functions: reading time, category derivation, category colors.
 */

import { SEO_TOPICS } from "@/lib/ai/seo-topics"
import type { TopicCategory } from "@/lib/ai/seo-topics"

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

export interface CategoryConfig {
  label: string
  color: string       // text color
  bg: string          // background color
  border: string      // border color
}

export const CATEGORY_CONFIG: Record<TopicCategory, CategoryConfig> = {
  "réglementation": { label: "Réglementation", color: "text-red-700", bg: "bg-red-50", border: "border-red-200" },
  "tutoriel":       { label: "Tutoriel",       color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200" },
  "guide":          { label: "Guide",          color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
  "actualité":      { label: "Actualité",      color: "text-orange-700", bg: "bg-orange-50", border: "border-orange-200" },
  "comparatif":     { label: "Comparatif",     color: "text-purple-700", bg: "bg-purple-50", border: "border-purple-200" },
  "pratique":       { label: "Pratique",        color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200" },
  "gestion":        { label: "Gestion",        color: "text-teal-700", bg: "bg-teal-50", border: "border-teal-200" },
  "comptabilité":   { label: "Comptabilité",   color: "text-indigo-700", bg: "bg-indigo-50", border: "border-indigo-200" },
  "digital":        { label: "Digital",        color: "text-cyan-700", bg: "bg-cyan-50", border: "border-cyan-200" },
  "cas-usage":      { label: "Cas d'usage",    color: "text-pink-700", bg: "bg-pink-50", border: "border-pink-200" },
}

export const ALL_CATEGORIES = Object.keys(CATEGORY_CONFIG) as TopicCategory[]

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

    const question = headingMatch[1].trim()

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
      .slice(0, 500)

    if (answer.length > 20) {
      items.push({ question, answer })
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
    headings.push({ id, text, level })
  }

  return headings
}
