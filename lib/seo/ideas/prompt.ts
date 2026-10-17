/**
 * Consigne de la « Proposition IA » : la méthode des mots-clés compacts
 * (skill expert-seo, MOTS-CLES-COMPACTS-2026-10.md § 0 et § 9), écrite pour un
 * modèle qui doit penser comme l'artisan qui tape sa recherche, pas comme un
 * rédacteur.
 *
 * Le modèle ne connaît ni les volumes ni l'existence réelle d'une phrase : il
 * propose, le serveur vérifie (saisie semi-automatique de Google, DataForSEO,
 * articles et pages déjà en place). Rien de ce qu'il rend n'est montré sans ce
 * contrôle (lib/seo/ideas/run.ts).
 *
 * Module pur : serveur et tests. Aucun concurrent n'entre dans une consigne.
 */
import { FREE_RULE } from "@/lib/seo/articles/search-language"
import { TRADE_LABELS, type TradeId } from "@/lib/blog-images/trades"
import type { BrandSettings, StrategySettings } from "@/lib/seo/settings"
import type { ArticleType } from "@/lib/seo/types"
import { IDEA_DEFAULT_COUNT, IDEA_MAX_COUNT, type IdeaRequest } from "@/lib/seo/ideas/types"

/** Phrases proposées par le modèle : le double de ce qui est montré, pour que le contrôle en laisse assez. */
export function requestedCandidates(count: number): number {
  return Math.min(30, Math.max(6, count * 2))
}

export function clampCount(count: number | undefined): number {
  const n = Math.round(count ?? IDEA_DEFAULT_COUNT)
  return Math.min(IDEA_MAX_COUNT, Math.max(3, Number.isFinite(n) ? n : IDEA_DEFAULT_COUNT))
}

/** Les cinq situations d'un artisan qui cherche : de quoi varier les idées sans inventer de personnage. */
export const SEARCHER_SITUATIONS = [
  "Je me lance : entreprise tout juste créée (micro-entreprise ou entreprise individuelle), premier devis, première facture, ne connaît ni les mentions obligatoires ni la TVA des travaux.",
  "Je gagne du temps : artisan installé qui fait ses devis le soir ou dans la camionnette, cherche un modèle, un exemple ou un outil pour ne plus tout refaire à la main.",
  "Je me fais payer : facture impayée, relance, délai de paiement, pénalités de retard, acompte, retenue de garantie.",
  "Je veux être en règle : taux de TVA (20 %, 10 %, 5,5 %), mentions obligatoires, assurance décennale, facture électronique et plateforme agréée.",
  "Je chiffre un chantier précis : exemple de devis pour un ouvrage (remplacement de tableau électrique, salle de bains, dalle, ravalement…).",
]

/** Ce que Qonforme ne fait pas encore : aucun sujet ne doit le promettre. */
const NOT_AVAILABLE = [
  "la transmission des factures par une plateforme agréée (raccordement en préparation : on peut expliquer la réforme, pas promettre l'envoi)",
  "une application à télécharger dans les stores (le site s'installe sur l'écran d'accueil)",
  "tout contact humain : appel, rendez-vous, visio, réponse personnalisée",
  "le nom d'un autre logiciel, éditeur ou marque (aucun comparatif nommé)",
]

export interface IdeasSystemContext {
  brand: BrandSettings
  strategy: StrategySettings
}

export function buildIdeasSystemPrompt({ brand, strategy }: IdeasSystemContext): string {
  const name = brand.name || "Qonforme"
  return [
    `Vous êtes un expert SEO français. Vous cherchez, pour le blog de ${name} (qonforme.fr), les phrases EXACTES que tape dans Google la personne qui a besoin de ce que ${name} apporte. Vous pensez comme cette personne, pas comme un rédacteur.`,
    "",
    `QUI TAPE : ${brand.audience || "des artisans du bâtiment"}. Souvent seul, souvent sur son téléphone, entre deux chantiers, avec les mots du chantier : « comment », « exemple », « modèle », « pdf », « à imprimer », « gratuit », « tarif », « calcul », « obligatoire ».`,
    "",
    "SITUATIONS (variez les idées entre elles) :",
    ...SEARCHER_SITUATIONS.map((s) => `- ${s}`),
    "",
    `CE QUE FAIT ${name.toUpperCase()} (seules fonctions que vous pouvez promettre) :`,
    brand.offer || "—",
    ...(strategy.niche ? [`Niche : ${strategy.niche}`] : []),
    "",
    "MÉTHODE :",
    "- Une idée = une requête exacte (2 à 8 mots, minuscules, orthographe française avec tous ses accents) que quelqu'un tape vraiment. Pas une phrase de marketing, pas un titre.",
    "- L'ouvrage avant le métier (« exemple devis maçonnerie »), le chantier précis (« exemple devis remplacement tableau électrique »), le fichier voulu (« pdf », « vierge », « à imprimer », « excel »), « auto-entrepreneur » quand c'est le statut de la personne.",
    "- Une requête qui commence par « comment » est un how-to : le titre de l'article reprend cette phrase. Une question (« peut-on… », « quel taux… ») est une FAQ. Un sujet de règle large est un guide. Un changement de règle daté est une actualité.",
    "- Le moment : « learn » (comprendre une règle), « do » (faire un devis, une facture, une relance), « buy » (choisir un logiciel). Les requêtes « do » et « buy » valent plus que « learn » : l'artisan est en train d'agir.",
    "- Pour chaque idée, le titre de l'article qui répond (20 à 80 caractères) parle comme la recherche, sans mot-clé générique suivi de deux-points.",
    "- Une phrase « why » dit ce que la personne veut au moment où elle tape.",
    "",
    "À NE PAS FAIRE :",
    `- Ne proposez rien qui promette : ${NOT_AVAILABLE.join(" ; ")}.`,
    `- ${FREE_RULE}`,
    "- Aucun nom de marque, de concurrent ni de logiciel dans une requête ou un titre.",
    "- N'inventez aucun chiffre, aucune date, aucun taux dans un titre.",
    "- Dites « plateforme agréée », jamais « PDP » dans un titre.",
    "- Ne reprenez aucune idée de la liste « déjà couvert » : cherchez ce qui manque.",
  ].join("\n")
}

export interface IdeasContext {
  /** Mots-clés déjà suivis (forme canonique). */
  keywords: string[]
  /** Titres des sujets en attente ou planifiés. */
  topics: string[]
  /** Articles du blog : titre et mot-clé. */
  posts: { title: string; keyword: string | null }[]
  /** Requêtes réelles de Search Console (les plus vues), avec leurs impressions. */
  queries: { query: string; impressions: number; position: number | null }[]
}

const TYPE_LABEL: Record<ArticleType, string> = { howto: "howto", guide: "guide", news: "news", faq: "faq" }

/** Retire les chevrons (délimiteurs) et réduit les espaces d'un texte venu de l'éditeur. */
function clean(text: string, max: number): string {
  return text.replace(/[<>]/g, " ").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, max)
}

function list(items: string[], max: number): string[] {
  return items.slice(0, max).map((i) => `- ${clean(i, 140)}`)
}

export function buildIdeasPrompt(req: IdeaRequest, ctx: IdeasContext): string {
  const count = clampCount(req.count)
  const lines: string[] = []

  if (req.mode === "article" && req.article) {
    lines.push(
      "MISSION : trouvez les requêtes exactes que taperait la personne pour laquelle CET ARTICLE est la bonne réponse.",
      `Proposez ${Math.min(requestedCandidates(count), 12)} requêtes différentes, de la plus fidèle à l'article à la plus large.`,
      "",
      `Titre de l'article : ${clean(req.article.title, 200)}`,
    )
    if (req.article.keyword?.trim()) lines.push(`Mot-clé actuel (peut être mal choisi) : « ${clean(req.article.keyword, 120)} »`)
    if (req.article.articleType) lines.push(`Type de l'article : ${TYPE_LABEL[req.article.articleType]}`)
    lines.push(
      "Si l'article est un « comment faire », une FAQ ou une actualité, ne proposez pas de requête d'achat de logiciel : la personne qui cherche cet article tape autre chose.",
      "",
      "ARTICLE (extrait) :",
      "<<<",
      clean(req.article.content, 4_000) || "(texte pas encore écrit : appuyez-vous sur le titre)",
      ">>>",
    )
  } else {
    lines.push(
      `MISSION : proposez ${requestedCandidates(count)} idées de sujets d'articles, chacune avec la requête exacte qu'elle vise.`,
      `Il en restera ${count} après la vérification de chaque requête dans Google : variez les situations, les métiers et les moments (learn / do / buy).`,
    )
    if (req.focus?.trim()) lines.push("", `ANGLE DEMANDÉ : ${clean(req.focus, 300)}`)
    const trade = req.trade && req.trade in TRADE_LABELS ? TRADE_LABELS[req.trade as TradeId] : null
    if (trade) lines.push(`MÉTIER : ${trade} (les requêtes parlent de ses ouvrages et de son quotidien).`)
  }

  if (ctx.queries.length > 0) {
    lines.push(
      "",
      "REQUÊTES RÉELLES de Search Console (28 derniers jours : le site s'affiche déjà dessus ; exploitez-les, ne les dupliquez pas) :",
      ...ctx.queries.slice(0, 40).map((q) => `- ${clean(q.query, 100)} (${q.impressions} affichages${q.position ? `, position ${Math.round(q.position)}` : ""})`),
    )
  }
  const covered = [
    ...ctx.posts.map((p) => (p.keyword ? `${p.title} [${p.keyword}]` : p.title)),
    ...ctx.topics,
    ...ctx.keywords,
  ]
  if (covered.length > 0 && req.mode !== "article") {
    lines.push("", "DÉJÀ COUVERT (articles, sujets et mots-clés suivis : ne les reprenez pas) :", ...list(covered, 160))
  }

  lines.push(
    "",
    'Répondez uniquement en JSON : {"ideas": [{"keyword": "…", "title": "…", "articleType": "howto|guide|news|faq", "stage": "learn|do|buy", "why": "…"}]}',
  )
  return lines.join("\n")
}

export const IDEAS_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    ideas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          keyword: { type: "string", description: "La requête exacte tapée dans Google, minuscules, avec accents" },
          title: { type: "string", description: "Titre de l'article qui y répond, 20 à 80 caractères" },
          articleType: { type: "string", enum: ["howto", "guide", "news", "faq"] },
          stage: { type: "string", enum: ["learn", "do", "buy"] },
          why: { type: "string", description: "Ce que la personne veut, en une phrase" },
        },
        required: ["keyword", "title", "articleType", "stage", "why"],
        additionalProperties: false,
      },
    },
  },
  required: ["ideas"],
  additionalProperties: false,
}

export interface RawIdea {
  keyword: string
  title: string
  articleType: string
  stage: string
  why: string
}

/** Idées d'une réponse du modèle : JSON `{ ideas: [...] }` (bloc de code toléré) ; liste vide si illisible. */
export function parseIdeasOutput(text: string): RawIdea[] {
  const raw = text.trim().replace(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i, "$1").trim()
  const start = raw.indexOf("{")
  const end = raw.lastIndexOf("}")
  if (start < 0 || end <= start) return []
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1)) as { ideas?: unknown }
    if (!Array.isArray(parsed.ideas)) return []
    return parsed.ideas
      .filter((i): i is Record<string, unknown> => !!i && typeof i === "object")
      .map((i) => ({
        keyword: typeof i.keyword === "string" ? i.keyword : "",
        title: typeof i.title === "string" ? i.title : "",
        articleType: typeof i.articleType === "string" ? i.articleType : "",
        stage: typeof i.stage === "string" ? i.stage : "",
        why: typeof i.why === "string" ? i.why : "",
      }))
  } catch {
    return []
  }
}
