/**
 * « Proposer un title et une description » (détail d'un constat) : Gemini
 * rédige une proposition, contrôlée avant d'être enregistrée « à relire ».
 *
 * La consigne contient le chemin, le title et la description actuels, les
 * requêtes de la page (Search Console) et le contexte de marque. JAMAIS les
 * concurrents (règle de CLAUDE.md) : une requête qui en cite un est écartée,
 * et la consigne est bloquée si un concurrent y figure malgré tout.
 *
 * Contrôles du résultat : title de 70 caractères au plus, description de 120 à
 * 155, vouvoiement, aucune valeur périmée ni affirmation interdite
 * (lib/blog-audit.ts), aucun concurrent cité.
 */
import { auditArticle } from "@/lib/blog-audit"
import { assertNoCompetitorInPrompt, findCompetitorMentions } from "@/lib/seo/competitors"
import type { BrandSettings } from "@/lib/seo/settings-schema"
import { DESCRIPTION_MAX, DESCRIPTION_MIN, TITLE_MAX } from "@/lib/seo/audit/checks"
import { textLength } from "@/lib/seo/audit/html"
import type { FindingRule, QueryStat } from "@/lib/seo/actions/rules"

export const SUGGEST_MODEL = "gemini-2.5-flash"
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${SUGGEST_MODEL}:generateContent`
const TIMEOUT_MS = 25_000

/** Règles pour lesquelles une proposition de title et de description a un sens. */
export const SUGGESTIBLE_RULES: FindingRule[] = [
  "gsc-no-click",
  "gsc-second-page",
  "gsc-beyond-second-page",
  "gsc-declining",
  "crawl-title",
  "crawl-description",
]

export function isSuggestible(rule: string): boolean {
  return (SUGGESTIBLE_RULES as string[]).includes(rule)
}

export interface Suggestion {
  title: string
  description: string
  model: string
  generatedAt: string
}

/** Lecture de la colonne `suggestion` (JSON) ; null si vide ou illisible. */
export function parseStoredSuggestion(value: string | null | undefined): Suggestion | null {
  if (!value) return null
  try {
    const s = JSON.parse(value) as Partial<Suggestion>
    if (typeof s.title === "string" && typeof s.description === "string") {
      return { title: s.title, description: s.description, model: s.model ?? SUGGEST_MODEL, generatedAt: s.generatedAt ?? "" }
    }
  } catch {
    /* texte libre */
  }
  return null
}

const SYSTEM = [
  "Tu rédiges la balise title et la meta description d'une page du site qonforme.fr, en français.",
  "Qonforme est un logiciel de devis et de facturation pour les artisans du bâtiment.",
  `Le title fait ${TITLE_MAX} caractères au plus, espaces comprises ; la requête principale de la page vient au début.`,
  `La description fait entre ${DESCRIPTION_MIN} et ${DESCRIPTION_MAX} caractères, espaces comprises : une ou deux phrases concrètes qui donnent envie d'ouvrir la page.`,
  "Vouvoiement obligatoire. Aucune affirmation invérifiable : pas de chiffre inventé, pas d'avis, pas de « certifié », « homologué », « agréé » ni « n° 1 », pas de promesse de contact humain.",
  "Ne cite aucun autre logiciel ni aucune autre entreprise.",
  "Réponds uniquement en JSON : {\"title\": \"…\", \"description\": \"…\"}.",
].join("\n")

/** Consigne envoyée à Gemini (sans concurrent : vérifié par l'appelant avec assertNoCompetitorInPrompt). */
export function buildSuggestionPrompt(input: {
  path: string
  title: string | null
  description: string | null
  queries: QueryStat[]
  brand: Pick<BrandSettings, "name" | "audience" | "offer" | "benefits" | "tone" | "proofs">
  problem: string
  feedback?: string[]
}): string {
  const lines = [
    `Page : https://qonforme.fr${input.path === "/" ? "/" : input.path}`,
    `Problème constaté : ${input.problem}`,
    `Title actuel : ${input.title ?? "(aucun)"}`,
    `Description actuelle : ${input.description ?? "(aucune)"}`,
  ]
  if (input.queries.length > 0) {
    lines.push("Requêtes Google qui affichent la page (28 derniers jours) :")
    input.queries.slice(0, 10).forEach((q) => lines.push(`- « ${q.query} » : ${q.impressions} impressions, ${q.clicks} clics`))
  }
  lines.push(
    "",
    "Contexte de marque :",
    `- Nom : ${input.brand.name}`,
    `- Audience : ${input.brand.audience}`,
    `- Offre : ${input.brand.offer}`,
  )
  if (input.brand.benefits.length > 0) lines.push(`- Bénéfices : ${input.brand.benefits.join(" ; ")}`)
  if (input.brand.tone) lines.push(`- Ton : ${input.brand.tone}`)
  if (input.brand.proofs.length > 0) lines.push(`- Faits vérifiés utilisables : ${input.brand.proofs.map((p) => `${p.claim} (${p.source})`).join(" ; ")}`)
  if (input.feedback && input.feedback.length > 0) {
    lines.push("", "Ta proposition précédente a été refusée :", ...input.feedback.map((f) => `- ${f}`), "Corrige ces points.")
  }
  return lines.join("\n")
}

/** Tutoiement repéré (« tu », « ton », « tes », « t'… »). */
const TUTOIEMENT = /(^|[^a-zà-ÿ])(tu|toi|ton|tes|ta|tien|tienne)(?=[^a-zà-ÿ]|$)|(^|[\s«"(])t['’][a-zà-ÿ]/i

/** Problèmes d'une proposition (vide : acceptée). */
export function checkSuggestion(s: { title: string; description: string }, competitors: string[]): string[] {
  const problems: string[] = []
  const tl = textLength(s.title)
  const dl = textLength(s.description)
  if (tl === 0) problems.push("Le title est vide.")
  else if (tl > TITLE_MAX) problems.push(`Le title fait ${tl} caractères (${TITLE_MAX} au plus).`)
  if (dl < DESCRIPTION_MIN || dl > DESCRIPTION_MAX) problems.push(`La description fait ${dl} caractères (${DESCRIPTION_MIN} à ${DESCRIPTION_MAX}).`)
  const text = `${s.title}\n${s.description}`
  if (TUTOIEMENT.test(text)) problems.push("Le texte tutoie le lecteur : le vouvoiement est obligatoire.")
  auditArticle(text).forEach((f) => problems.push(`${f.rule.label} : « ${f.excerpt} ».`))
  const found = findCompetitorMentions(text, competitors)
  if (found.length > 0) problems.push("Le texte cite un autre logiciel ou une autre entreprise.")
  return problems
}

export class SuggestionError extends Error {
  constructor(
    message: string,
    readonly kind: "not_configured" | "upstream" | "rejected",
    readonly problems: string[] = [],
  ) {
    super(message)
    this.name = "SuggestionError"
  }
}

type FetchLike = (url: string, init: RequestInit) => Promise<Response>

/** Un appel à Gemini ; rend le title et la description proposés. */
export async function requestGemini(prompt: string, opts: { apiKey: string; fetchImpl?: FetchLike }): Promise<{ title: string; description: string }> {
  const doFetch: FetchLike = opts.fetchImpl ?? ((u, init) => fetch(u, init))
  let res: Response
  try {
    res = await doFetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": opts.apiKey },
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.6,
          maxOutputTokens: 1024,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: { title: { type: "STRING" }, description: { type: "STRING" } },
            required: ["title", "description"],
          },
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    })
  } catch {
    throw new SuggestionError("Gemini ne répond pas pour le moment. Réessayez dans un instant.", "upstream")
  }
  if (!res.ok) {
    console.error("[seo-actions] Gemini a répondu", res.status)
    throw new SuggestionError("Gemini a refusé la demande. Réessayez dans un instant.", "upstream")
  }
  const data = (await res.json().catch(() => null)) as { candidates?: { content?: { parts?: { text?: string }[] } }[] } | null
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? ""
  try {
    const parsed = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, "")) as { title?: unknown; description?: unknown }
    if (typeof parsed.title === "string" && typeof parsed.description === "string") {
      return { title: parsed.title.replace(/\s+/g, " ").trim(), description: parsed.description.replace(/\s+/g, " ").trim() }
    }
  } catch {
    /* réponse illisible */
  }
  throw new SuggestionError("Réponse de Gemini illisible. Réessayez dans un instant.", "upstream")
}

/**
 * Propose un title et une description contrôlés (deux essais : le second
 * reçoit les raisons du refus). Lève SuggestionError.
 */
export async function proposeTitleAndDescription(input: {
  path: string
  title: string | null
  description: string | null
  queries: QueryStat[]
  brand: BrandSettings
  problem: string
  competitors: string[]
  apiKey: string | undefined
  now?: Date
  fetchImpl?: FetchLike
}): Promise<Suggestion> {
  if (!input.apiKey) throw new SuggestionError("Clé Gemini absente : ajoutez GEMINI_API_KEY dans les variables d'environnement.", "not_configured")
  // Requêtes qui citent un concurrent : jamais transmises.
  const queries = input.queries.filter((q) => findCompetitorMentions(q.query, input.competitors).length === 0)

  let feedback: string[] = []
  for (let attempt = 0; attempt < 2; attempt++) {
    const prompt = buildSuggestionPrompt({ ...input, queries, feedback })
    assertNoCompetitorInPrompt(prompt, input.competitors)
    const proposal = await requestGemini(prompt, { apiKey: input.apiKey, fetchImpl: input.fetchImpl })
    const problems = checkSuggestion(proposal, input.competitors)
    if (problems.length === 0) {
      return { ...proposal, model: SUGGEST_MODEL, generatedAt: (input.now ?? new Date()).toISOString() }
    }
    feedback = problems
  }
  throw new SuggestionError("La proposition ne respectait pas les règles (longueurs, vouvoiement, affirmations). Réessayez.", "rejected", feedback)
}
