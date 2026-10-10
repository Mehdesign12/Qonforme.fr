/**
 * Consignes envoyées au modèle de rédaction (plan, rédaction, correction,
 * image de couverture).
 *
 * Elles sont construites à partir de :
 * - Paramètres › Contexte de marque (nom, audience, offre, bénéfices,
 *   positionnement, ton, preuves) et Paramètres › Stratégie (niche, description) ;
 * - des faits de référence vérifiés (mêmes constantes que les outils gratuits et
 *   que lib/ai/gemini.ts, lib/ai/reference-facts.ts : une mise à jour des barèmes
 *   met à jour les articles à venir) ;
 * - des Préférences d'écriture (longueur, FAQ, sources officielles, angles).
 *
 * JAMAIS Paramètres › Ciblage › Concurrents (règle de CLAUDE.md) : le module
 * n'importe pas `targeting` ici, et chaque appel passe par
 * assertNoCompetitorInPrompt (lib/seo/articles/generate.ts).
 *
 * Module pur : testé dans __tests__/seo-articles-prompt.test.ts.
 */
import { referenceFacts } from "@/lib/ai/reference-facts"
import type { ArticleType } from "@/lib/seo/types"
import type { ArticleSettings, BrandSettings, StrategySettings } from "@/lib/seo/settings"

/* ------------------------------------------------------------------ */
/* Faits de référence                                                  */
/* ------------------------------------------------------------------ */

/** Faits juridiques vérifiés donnés au générateur : même texte que l'ancien générateur (lib/ai/reference-facts.ts). */
export const REFERENCE_FACTS = referenceFacts("vous")

/* ------------------------------------------------------------------ */
/* Angles éditoriaux                                                   */
/* ------------------------------------------------------------------ */

export interface EditorialAngle {
  key: string
  label: string
  instruction: string
}

/** Les 8 angles du générateur historique (lib/ai/gemini.ts), adaptés au Markdown du blog. */
export const EDITORIAL_ANGLES: EditorialAngle[] = [
  {
    key: "guide-pratique",
    label: "Guide pratique",
    instruction: "Guide pratique étape par étape, avec des actions concrètes numérotées que le lecteur peut appliquer tout de suite.",
  },
  {
    key: "checklist",
    label: "Liste de contrôle",
    instruction: "Structurez l'article autour d'une liste de contrôle complète : chaque section est un point à vérifier ou une action à faire (listes à puces, sans cases à cocher).",
  },
  {
    key: "erreurs-a-eviter",
    label: "Erreurs à éviter",
    instruction: "Présentez le sujet à travers les erreurs les plus fréquentes des artisans, avec pour chacune la bonne pratique.",
  },
  {
    key: "cas-concret",
    label: "Cas concret",
    instruction: "Illustrez le sujet par un exemple fictif annoncé comme tel (un artisan, son métier, sa situation) qui sert de fil rouge ; jamais présenté comme un témoignage ou un client réel.",
  },
  {
    key: "avant-apres",
    label: "Avant / après",
    instruction: "Comparez la situation avant et après la bonne pratique, en montrant le gain concret (temps, trésorerie, tranquillité) sans chiffre inventé.",
  },
  {
    key: "faq-etendue",
    label: "Questions-réponses",
    instruction: "Structurez tout l'article en questions et réponses, des plus simples aux plus pointues, comme les vraies questions des artisans.",
  },
  {
    key: "chronologie",
    label: "Chronologie",
    instruction: "Rédigez de façon chronologique (étape par étape dans le temps, ou par échéance) pour aider le lecteur à planifier ses actions.",
  },
  {
    key: "comparaison-metiers",
    label: "Selon le métier",
    instruction: "Montrez les différences selon les métiers du bâtiment (plombier, électricien, peintre, maçon…) en adaptant chaque conseil.",
  },
]

export function findAngle(key: string | null | undefined): EditorialAngle | null {
  return EDITORIAL_ANGLES.find((a) => a.key === key) ?? null
}

/** Angle suivant de la rotation : le premier angle absent des derniers utilisés. */
export function nextAngle(recent: (string | null | undefined)[]): EditorialAngle {
  const used = recent.filter(Boolean) as string[]
  const fresh = EDITORIAL_ANGLES.find((a) => !used.includes(a.key))
  if (fresh) return fresh
  // Tous utilisés : le plus ancien de la liste (la plus récente est en tête)
  for (let i = used.length - 1; i >= 0; i--) {
    const angle = findAngle(used[i])
    if (angle) return angle
  }
  return EDITORIAL_ANGLES[0]
}

/* ------------------------------------------------------------------ */
/* Types d'article                                                     */
/* ------------------------------------------------------------------ */

const TYPE_GUIDANCE: Record<ArticleType, string> = {
  howto: "How-to : un mode d'emploi qui répond à « comment faire », avec des étapes numérotées et un résultat concret.",
  guide: "Guide : un panorama complet et structuré du sujet, de la règle à sa mise en pratique.",
  news: "Actualité : ce qui change, à partir de quand, pour qui et quoi faire maintenant ; uniquement des dates et des règles sûres.",
  faq: "FAQ : l'article entier en questions et réponses courtes et précises.",
}

/* ------------------------------------------------------------------ */
/* Sources officielles                                                 */
/* ------------------------------------------------------------------ */

/** Domaines officiels autorisés en lien : tout .gouv.fr (Légifrance, BOFiP, impots.gouv, service-public.gouv…) et service-public.fr. */
export function isOfficialHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^www\./, "")
  return h.endsWith(".gouv.fr") || h === "service-public.fr" || h.endsWith(".service-public.fr")
}

export function isOfficialUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === "https:" && isOfficialHost(u.hostname)
  } catch {
    return false
  }
}

/* ------------------------------------------------------------------ */
/* Contexte commun                                                     */
/* ------------------------------------------------------------------ */

export interface PromptContext {
  brand: BrandSettings
  strategy: StrategySettings
  prefs: ArticleSettings
}

/**
 * Consigne système commune aux passes : marque, faits, règles de contenu.
 * `reviewer` : même contexte pour le relecteur du contrôle factuel.
 */
export function buildSystemPrompt({ brand, strategy, prefs }: PromptContext, role: "writer" | "reviewer" = "writer"): string {
  const name = brand.name || "Qonforme"
  const lines: string[] = []
  lines.push(
    role === "writer"
      ? `Vous rédigez, en français, des articles pour le blog de ${name} (qonforme.fr). Lecteurs : ${brand.audience || "artisans du bâtiment"}.`
      : `Vous relisez, avant publication, les articles du blog de ${name} (qonforme.fr), écrits en français pour : ${brand.audience || "artisans du bâtiment"}. Vous vérifiez que chaque article respecte les faits et les règles ci-dessous.`,
    "",
    `CE QUE FAIT ${name.toUpperCase()} (seules fonctions que vous pouvez citer) :`,
    brand.offer || "—",
  )
  if (brand.benefits.length > 0) {
    lines.push("Bénéfices :", ...brand.benefits.map((b) => `- ${b}`))
  }
  if (brand.positioning) lines.push(`Positionnement : ${brand.positioning}`)
  if (strategy.niche) lines.push(`Niche : ${strategy.niche}`)
  if (strategy.description && strategy.description !== brand.offer) lines.push(`Activité : ${strategy.description}`)
  if (brand.tone) lines.push(`Ton : ${brand.tone}`)
  if (brand.proofs.length > 0) {
    lines.push(
      "",
      "PREUVES VÉRIFIÉES (à reprendre telles quelles si le sujet s'y prête, avec leur source) :",
      ...brand.proofs.map((p) => `- ${p.claim} (${p.source}${p.url ? `, ${p.url}` : ""})`),
    )
  }
  lines.push("", REFERENCE_FACTS, "", "RÈGLES IMPÉRATIVES :")
  lines.push(
    "- Vouvoyez toujours le lecteur.",
    "- N'inventez aucun chiffre, aucune statistique, aucun avis, aucune note, aucun témoignage, aucun client : seulement des faits vérifiables (textes de loi, sources officielles, faits de référence ci-dessus).",
    "- Ne citez jamais un autre logiciel, éditeur ou marque de devis, de facturation ou de comptabilité : ni nom, ni comparaison, ni « alternative à ». Pour comparer des approches, décrivez des critères sans nommer personne.",
    `- N'écrivez jamais que ${name} est certifié, homologué ou agréé, ni qu'il est une plateforme agréée, ni qu'il transmet les factures électroniques.`,
    `- Ne présentez comme fonction de ${name} que ce qui figure dans l'offre et les bénéfices ci-dessus.`,
    "- Ne promettez aucun contact humain : ni appel, ni rendez-vous, ni visio, ni réponse personnalisée, ni support téléphonique.",
    "- Dites « plateforme agréée », jamais « PDP ».",
    "- Si vous n'êtes pas sûr d'une règle, d'un chiffre ou d'un article de loi, ne le citez pas.",
  )
  if (prefs.officialSources) {
    lines.push(
      "- Chaque règle légale renvoie à sa source officielle. Liens autorisés : uniquement des adresses https en .gouv.fr (legifrance.gouv.fr, bofip.impots.gouv.fr, impots.gouv.fr, entreprendre.service-public.gouv.fr…) ou service-public.fr. N'inventez aucune adresse : en cas de doute, citez le texte (« article L441-10 du Code de commerce ») sans lien.",
    )
  } else {
    lines.push("- Aucun lien externe, sauf vers une adresse https officielle en .gouv.fr dont vous êtes certain.")
  }
  lines.push(
    "",
    "FORMAT DU BLOG (Markdown simple) : pas de titre de niveau 1 (« # ») — le titre est affiché par la page ; sections « ## » et sous-sections « ### » ; listes « - » ou « 1. » ; gras « **…** » ; liens « [texte](https://…) ». Pas de tableau, pas de HTML, pas d'image, pas de case à cocher, pas de bloc de code.",
  )
  return lines.join("\n")
}

/* ------------------------------------------------------------------ */
/* Passe 1 : plan                                                      */
/* ------------------------------------------------------------------ */

export interface ArticleBrief {
  title: string
  keyword: string | null
  articleType: ArticleType
  /** Clé d'angle (EDITORIAL_ANGLES) ; null : angle libre. */
  angle: string | null
  notes: string | null
  lengthMin: number
  lengthMax: number
  /** null : pas de FAQ. */
  faq: { min: number; max: number } | null
}

export interface ArticlePlan {
  title: string
  slug: string
  metaDescription: string
  outline: { h2: string; h3: string[] }[]
  faq: string[]
  keywords: string[]
  sources: { title: string; url: string }[]
}

/** Schéma JSON du plan (sortie structurée de Claude ; Gemini reçoit le mode JSON). */
export const PLAN_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    title: { type: "string", description: "Titre de l'article, 70 caractères au plus" },
    slug: { type: "string", description: "Adresse courte en minuscules, mots séparés par des tirets" },
    metaDescription: { type: "string", description: "Description pour Google, de 120 à 155 caractères" },
    outline: {
      type: "array",
      items: {
        type: "object",
        properties: { h2: { type: "string" }, h3: { type: "array", items: { type: "string" } } },
        required: ["h2", "h3"],
        additionalProperties: false,
      },
    },
    faq: { type: "array", items: { type: "string" } },
    keywords: { type: "array", items: { type: "string" } },
    sources: {
      type: "array",
      items: {
        type: "object",
        properties: { title: { type: "string" }, url: { type: "string" } },
        required: ["title", "url"],
        additionalProperties: false,
      },
    },
  },
  required: ["title", "slug", "metaDescription", "outline", "faq", "keywords", "sources"],
  additionalProperties: false,
}

export function buildPlanPrompt(brief: ArticleBrief, opts: { existingTitles: string[]; previousError?: string | null }): string {
  const angle = findAngle(brief.angle)
  const lines: string[] = [
    "PASSE 1 : PLAN. Préparez le plan d'un article du blog.",
    "",
    `Sujet : ${brief.title}`,
    `Mot-clé cible : ${brief.keyword || "à déduire du sujet"}`,
    `Type : ${TYPE_GUIDANCE[brief.articleType]}`,
    `Angle : ${angle ? angle.instruction : "libre, le plus utile pour le lecteur"}`,
    `Longueur visée de l'article : ${brief.lengthMin} à ${brief.lengthMax} mots.`,
    brief.faq
      ? `FAQ : ${brief.faq.min} à ${brief.faq.max} questions de lecteurs, en fin d'article.`
      : "FAQ : aucune (laissez la liste vide).",
  ]
  if (brief.notes) lines.push(`Notes de l'équipe : ${brief.notes}`)
  if (opts.existingTitles.length > 0) {
    lines.push("", "ARTICLES DÉJÀ PUBLIÉS OU EN PRÉPARATION (ne reprenez ni leur titre ni leur angle) :", ...opts.existingTitles.map((t) => `- ${t}`))
  }
  if (opts.previousError) lines.push("", `ESSAI PRÉCÉDENT REFUSÉ : ${opts.previousError}. Corrigez ce point.`)
  lines.push(
    "",
    "Répondez uniquement en JSON avec ces champs :",
    "- title : titre de 70 caractères au plus, avec le mot-clé cible si c'est naturel, sans nom d'autre logiciel ;",
    "- slug : adresse courte en minuscules sans accents, mots séparés par des tirets ;",
    "- metaDescription : description pour Google de 120 à 155 caractères, qui donne envie de lire, sans promesse invérifiable ;",
    "- outline : 4 à 8 sections { h2, h3: [sous-sections] }, sans section FAQ ni conclusion (elles sont ajoutées à la rédaction) ;",
    "- faq : les questions de la FAQ, chacune terminée par « ? » ;",
    "- keywords : 3 à 6 mots-clés secondaires ;",
    "- sources : textes officiels à citer { title, url } (adresses https en .gouv.fr ou service-public.fr que vous êtes certain d'exister ; liste vide si aucune).",
  )
  return lines.join("\n")
}

/* ------------------------------------------------------------------ */
/* Passe 2 : rédaction                                                 */
/* ------------------------------------------------------------------ */

export function buildWritePrompt(brief: ArticleBrief, plan: ArticlePlan, brandName: string): string {
  const angle = findAngle(brief.angle)
  const outline = plan.outline.flatMap((s) => [`## ${s.h2}`, ...s.h3.map((h) => `### ${h}`)])
  const lines: string[] = [
    "PASSE 2 : RÉDACTION. Rédigez l'article complet en suivant ce plan.",
    "",
    `Titre (affiché par la page : ne le répétez pas en tête d'article) : ${plan.title}`,
    `Mot-clé cible : ${brief.keyword || plan.keywords[0] || plan.title} — dans l'introduction et dans au moins un titre de section, sans répétition forcée.`,
    `Mots-clés secondaires : ${plan.keywords.join(", ") || "—"}`,
    `Type : ${TYPE_GUIDANCE[brief.articleType]}`,
    `Angle : ${angle ? angle.instruction : "libre"}`,
    `Longueur : entre ${brief.lengthMin} et ${brief.lengthMax} mots.`,
    "",
    "Plan :",
    ...outline,
  ]
  if (brief.faq && plan.faq.length > 0) {
    lines.push(
      "",
      `FAQ : ajoutez une section « ## Questions fréquentes » avec ${brief.faq.min} à ${brief.faq.max} questions, chacune en « ### Question ? » suivie d'une réponse de 2 à 4 phrases :`,
      ...plan.faq.map((q) => `- ${q}`),
    )
  }
  if (plan.sources.length > 0) {
    lines.push("", "Sources officielles à citer en lien, à l'endroit où la règle est énoncée :", ...plan.sources.map((s) => `- ${s.title} : ${s.url}`))
  }
  lines.push(
    "",
    `Conclusion : une dernière section « ## » qui résume l'essentiel et invite à essayer ${brandName} pour ce besoin, sans promesse invérifiable, sans chiffre et sans contact humain.`,
    "",
    "Commencez directement par l'introduction. Répondez uniquement avec le Markdown de l'article.",
  )
  return lines.join("\n")
}

/* ------------------------------------------------------------------ */
/* Passe 3 : contrôle factuel (modèle de relecture)                    */
/* ------------------------------------------------------------------ */

export const REVIEW_CATEGORIES = ["stale_value", "forbidden_claim", "unverifiable_claim", "factual_error", "instruction"] as const
export type ReviewCategory = (typeof REVIEW_CATEGORIES)[number]

export const REVIEW_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    problems: {
      type: "array",
      items: {
        type: "object",
        properties: {
          category: { type: "string", enum: Array.from(REVIEW_CATEGORIES) },
          excerpt: { type: "string", description: "Citation exacte du passage, copiée du texte (5 à 30 mots)" },
          explanation: { type: "string" },
          fix: { type: "string" },
        },
        required: ["category", "excerpt", "explanation", "fix"],
        additionalProperties: false,
      },
    },
  },
  required: ["problems"],
  additionalProperties: false,
}

export function buildReviewPrompt(input: { title: string; content: string; lengthMin: number; lengthMax: number; faq: { min: number; max: number } | null }): string {
  return [
    "PASSE 3 : CONTRÔLE FACTUEL. Relisez l'article ci-dessous contre les faits de référence et les règles impératives de la consigne système, puis listez précisément chaque problème.",
    "",
    "Catégories :",
    "- stale_value : chiffre, seuil, taux, date ou article de loi différent des faits de référence (valeur périmée) ;",
    "- forbidden_claim : affirmation interdite (logiciel certifié, homologué ou agréé, plateforme agréée, transmission des factures électroniques, contact humain promis, autre logiciel nommé, avis, note, témoignage ou statistique inventés, fonction absente de l'offre) ;",
    "- unverifiable_claim : chiffre ou règle avancés sans source sûre ;",
    "- factual_error : règle juridique ou fiscale inexacte ;",
    "- instruction : consigne non respectée (tutoiement, titre de niveau 1, tableau, lien vers un site non officiel).",
    "",
    "Pour chaque problème : category ; excerpt = citation EXACTE du passage, copiée mot pour mot (5 à 30 mots) ; explanation = ce qui ne va pas, en une phrase ; fix = ce qu'il faut écrire à la place.",
    "Ne signalez que des problèmes réels et certains ; liste vide si l'article est correct. Le style et la longueur ne sont pas à juger.",
    `Repères : titre « ${input.title} » ; longueur visée ${input.lengthMin} à ${input.lengthMax} mots ; ${input.faq ? `FAQ de ${input.faq.min} à ${input.faq.max} questions` : "pas de FAQ"}.`,
    "",
    "ARTICLE :",
    input.content,
    "",
    "Répondez uniquement en JSON : { \"problems\": [ { \"category\", \"excerpt\", \"explanation\", \"fix\" } ] }.",
  ].join("\n")
}

/* ------------------------------------------------------------------ */
/* Passe 4 : correction                                                */
/* ------------------------------------------------------------------ */

export interface FixInstruction {
  /** Ce qui ne va pas, en une ligne. */
  problem: string
  /** Passage concerné (extrait). */
  excerpt?: string
  /** Ce qu'il faut écrire à la place. */
  fix: string
}

export function buildFixPrompt(content: string, instructions: FixInstruction[]): string {
  return [
    "PASSE 4 : CORRECTION. Le contrôle automatique a repéré les problèmes ci-dessous dans l'article. Corrigez uniquement ces points ; gardez tout le reste (plan, liens officiels, FAQ, conclusion) à l'identique.",
    "",
    "PROBLÈMES :",
    ...instructions.map((i, n) => `${n + 1}. ${i.problem}${i.excerpt ? `\n   Passage : « ${i.excerpt} »` : ""}\n   À faire : ${i.fix}`),
    "",
    "ARTICLE :",
    content,
    "",
    "Répondez uniquement avec le Markdown complet de l'article corrigé.",
  ].join("\n")
}

/* ------------------------------------------------------------------ */
/* Passe 5 : image de couverture                                       */
/* ------------------------------------------------------------------ */

const TRADES: { key: RegExp; scene: string }[] = [
  { key: /plomb|sanitaire|chauffe|chaudi|chauffag/i, scene: "a plumber fitting copper pipes under a sink in a renovated French kitchen" },
  { key: /[ée]lectri|irve|borne/i, scene: "an electrician wiring a modern electrical panel on a renovation site" },
  { key: /ma[çc]on|gros [œo]euvre|b[ée]ton/i, scene: "a mason laying bricks on a house construction site" },
  { key: /peint|ravalement|fa[çc]ade/i, scene: "a painter rolling fresh paint on a wall in a bright apartment under renovation" },
  { key: /carrel|fa[iï]ence|sol/i, scene: "a tiler setting large floor tiles with a spirit level in a new bathroom" },
  { key: /menuis|bois|charpent/i, scene: "a carpenter measuring a wooden window frame in his workshop" },
  { key: /couv|toit|zinguer/i, scene: "a roofer replacing roof tiles on a sunny day, safety harness on" },
  { key: /pl[aâ]tr|plaquiste|cloison/i, scene: "a drywall installer fixing plasterboard on metal studs in a bright room" },
]

const DEFAULT_SCENES = [
  "a building contractor checking plans on a tablet on a renovation site",
  "two craftspeople working on a home renovation, tools on a workbench",
  "a tradesperson carrying materials into a house under renovation",
  "a craftsperson in work clothes taking measurements in an empty room being renovated",
]

/** Consigne d'image : photo réaliste d'artisan du bâtiment au travail, sans texte ni logo, 16:9. */
export function buildCoverPrompt(input: { keyword: string | null; title: string; seed: number }): string {
  const text = `${input.keyword ?? ""} ${input.title}`
  const trade = TRADES.find((t) => t.key.test(text))
  const scene = trade ? trade.scene : DEFAULT_SCENES[Math.abs(input.seed) % DEFAULT_SCENES.length]
  return `A realistic, natural-light editorial photograph for a blog cover, 16:9 widescreen: ${scene}. French building trades context, real working conditions, authentic people, natural colors, shallow depth of field, full-bleed composition filling the whole frame.

STRICT RULES:
- No text, letters, numbers, labels, signs, watermarks or logos anywhere in the image.
- No brand names on clothes, tools, vehicles or packaging.
- Any screen or document must be blurred and unreadable.`
}
