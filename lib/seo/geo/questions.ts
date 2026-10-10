/**
 * Questions suivies (seo_geo_questions) : validation des saisies de « Gérer le suivi ».
 * Module pur.
 */
import { z } from "zod"
import { findCompetitorMentions } from "@/lib/seo/competitors"

export const MAX_GEO_QUESTIONS = 20
export const QUESTION_MIN = 10
export const QUESTION_MAX = 300

const questionText = z
  .string({ error: "La question est obligatoire" })
  .transform((s) => s.replace(/\s+/g, " ").trim())
  .pipe(
    z
      .string()
      .min(QUESTION_MIN, `La question doit faire au moins ${QUESTION_MIN} caractères`)
      .max(QUESTION_MAX, `La question doit faire au plus ${QUESTION_MAX} caractères`),
  )

export const createQuestionSchema = z.object({ question: questionText }, { error: "Corps attendu : { question }" })

export const updateQuestionSchema = z
  .object(
    {
      question: questionText.optional(),
      active: z.boolean({ error: "« active » doit valoir vrai ou faux" }).optional(),
    },
    { error: "Corps attendu : { question } ou { active }" },
  )
  .refine((v) => v.question !== undefined || v.active !== undefined, { message: "Rien à modifier" })

export type ParsedInput<T> = { ok: true; value: T } | { ok: false; error: string }

/** Première erreur de validation, en français. */
export function parseInput<T>(schema: z.ZodType<T>, input: unknown): ParsedInput<T> {
  const parsed = schema.safeParse(input)
  if (parsed.success) return { ok: true, value: parsed.data }
  const issue = parsed.error.issues[0]
  // Message par défaut de zod (en anglais) : jamais renvoyé tel quel
  const message = issue?.message && !/^Invalid\b|^Expected\b|^Unrecognized\b/i.test(issue.message) ? issue.message : "Saisie invalide"
  return { ok: false, error: message }
}

/** Vrai si la chaîne a la forme d'un identifiant uuid (évite une requête vouée à l'échec). */
export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

export const MAX_BRAND_TERMS = 20
export const BRAND_TERM_MAX = 80

/** Termes de marque saisis (une ligne par terme) : nettoyés, sans doublon. */
export function parseBrandTerms(text: string): { terms: string[]; error: string | null } {
  const seen = new Set<string>()
  const terms: string[] = []
  text.split(/\r?\n/).forEach((line) => {
    const t = line.trim()
    const key = t.toLocaleLowerCase("fr-FR")
    if (!t || seen.has(key)) return
    seen.add(key)
    terms.push(t)
  })
  if (terms.some((t) => t.length > BRAND_TERM_MAX)) return { terms, error: `Un terme fait au plus ${BRAND_TERM_MAX} caractères.` }
  if (terms.length > MAX_BRAND_TERMS) return { terms, error: `${MAX_BRAND_TERMS} termes au plus.` }
  return { terms, error: null }
}

/**
 * Message de refus si la question nomme un concurrent suivi (usage interne : il ne part
 * ni chez les moteurs IA, ni dans un sujet d'article) ; null sinon.
 */
export function competitorInQuestion(question: string, competitors: string[]): string | null {
  const found = findCompetitorMentions(question, competitors)
  if (found.length === 0) return null
  return "Cette question nomme un concurrent suivi : les concurrents restent dans l'admin (usage interne). Reformulez-la sans nom de concurrent."
}
