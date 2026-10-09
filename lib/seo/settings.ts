/**
 * Réglages de l'onglet SEO (table seo_settings, une ligne par section).
 *
 * Chaque section a un schéma zod et des valeurs par défaut : une section jamais
 * enregistrée rend ses valeurs par défaut (« saved: false »), ce n'est pas une
 * erreur. Une lecture en échec lève SeoDbError (jamais les valeurs par défaut à
 * la place : un réglage illisible ne doit pas passer pour « pas de réglage »).
 *
 * Valeurs par défaut : textes déjà saisis dans PushRank (contexte de marque du
 * 5 oct. 2026) et décisions du fondateur (PLAN-SEO-INTERNE-2026-10.md § 6).
 *
 * Règle de CLAUDE.md : les concurrents (`targeting.competitors`) servent au
 * suivi interne seulement ; ils ne sont jamais transmis au générateur d'articles
 * (lib/seo/competitors.ts) ni affichés dans un contenu public.
 */
import { z } from "zod"
import { must, type SeoDb } from "@/lib/seo/db"

/* ------------------------------------------------------------------ */
/* Schémas                                                             */
/* ------------------------------------------------------------------ */

const text = (max: number) => z.string().trim().max(max)
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Heure attendue au format HH:MM")
/** 1 = lundi … 7 = dimanche. */
const weekday = z.number().int().min(1).max(7)
const domain = z
  .string()
  .trim()
  .toLowerCase()
  .transform((s) => s.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, ""))
  .pipe(z.string().regex(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/, "Domaine attendu, par exemple exemple.fr"))

export const MAX_PROOFS = 5
export const MAX_COUNTRIES = 20
export const MAX_COMPETITORS = 10

export const brandSchema = z.object({
  name: text(80).min(1, "Le nom de la marque est obligatoire"),
  audience: text(600),
  offer: text(1000),
  /** Une phrase par bénéfice. */
  benefits: z.array(text(300)).max(10),
  positioning: text(1000),
  tone: text(600),
  proofs: z
    .array(
      z.object({
        claim: text(300).min(1, "L'affirmation est obligatoire"),
        source: text(200).min(1, "La source est obligatoire"),
        url: z.union([z.literal(""), z.string().trim().url("Adresse de la source invalide").max(500)]),
      }),
    )
    .max(MAX_PROOFS, `${MAX_PROOFS} preuves au maximum`),
})

export const STRATEGY_GOALS = {
  traffic: "Augmenter le trafic organique",
  positions: "Améliorer les positions",
  content: "Accélérer la production de contenu",
  technical: "Améliorer le SEO technique",
  competitors: "Analyser les concurrents",
  conversions: "Augmenter les inscriptions",
} as const
export type StrategyGoal = keyof typeof STRATEGY_GOALS
const goal = z.enum(Object.keys(STRATEGY_GOALS) as [StrategyGoal, ...StrategyGoal[]])

export const strategySchema = z.object({
  niche: text(300),
  mainGoal: goal,
  goals: z.array(goal).max(6),
  description: text(1500),
})

export const targetingSchema = z.object({
  scope: z.enum(["france", "local", "international"]),
  audience: z.enum(["b2b", "b2c", "both"]),
  /** Codes ISO 3166-1 alpha-2 (« FR »). */
  countries: z.array(z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/)).min(1).max(MAX_COUNTRIES),
  localZone: text(120),
  /** Une ligne par terme : requêtes de marque et repérage dans les réponses des IA. */
  brandTerms: z.array(text(80).min(1)).max(20),
  /** Usage interne seulement (voir l'en-tête du fichier). */
  competitors: z.array(domain).max(MAX_COMPETITORS),
  includeBrandQueries: z.boolean(),
})

export const articlesSchema = z.object({
  publishMode: z.enum(["draft", "after_check", "direct"]),
  /** Rythme de publication proposé par le calendrier. */
  perWeek: z.number().int().min(0).max(7),
  weekday,
  time,
  lengthMin: z.number().int().min(600).max(4000),
  lengthMax: z.number().int().min(800).max(5000),
  faq: z.boolean(),
  faqMin: z.number().int().min(1).max(10),
  faqMax: z.number().int().min(1).max(12),
  officialSources: z.boolean(),
  alternateAngles: z.boolean(),
  /** Identifiant du modèle de rédaction (lib/seo/articles/models.ts). */
  textModel: text(80).min(1),
  coverImage: z.boolean(),
  /** Identifiant du modèle d'image (lib/seo/articles/models.ts). */
  imageModel: text(80).min(1),
  autoLinks: z.boolean(),
})

export const geoSchema = z.object({
  /** Moteurs suivis (une clé absente = éteint). */
  engines: z.object({
    gemini: z.boolean(),
    chatgpt: z.boolean(),
    perplexity: z.boolean(),
    claude: z.boolean(),
    google_ai_overview: z.boolean(),
  }),
  frequency: z.enum(["monthly"]),
  /** Jour du mois du relevé automatique. */
  dayOfMonth: z.number().int().min(1).max(28),
  repetitions: z.union([z.literal(1), z.literal(3), z.literal(5)]),
  market: text(60),
  language: text(60),
})

export const reportsSchema = z.object({
  weeklyDigest: z.boolean(),
  weekday,
  time,
  sections: z.object({
    kpis: z.boolean(),
    pages: z.boolean(),
    articles: z.boolean(),
    geo: z.boolean(),
  }),
})

export const pagespeedSchema = z.object({
  /** Pages suivies par PageSpeed (chemins du site). */
  pages: z
    .array(z.object({ path: z.string().trim().regex(/^\/[^\s?#]*$/, "Chemin attendu, par exemple /modele"), label: text(60).min(1) }))
    .max(20),
  /** Mesure automatique hebdomadaire des pages suivies. */
  weekly: z.boolean(),
})

export const SETTINGS_SCHEMAS = {
  brand: brandSchema,
  strategy: strategySchema,
  targeting: targetingSchema,
  articles: articlesSchema,
  geo: geoSchema,
  reports: reportsSchema,
  pagespeed: pagespeedSchema,
} as const

export type SettingsKey = keyof typeof SETTINGS_SCHEMAS
export type SettingsValue<K extends SettingsKey> = z.infer<(typeof SETTINGS_SCHEMAS)[K]>

export type BrandSettings = SettingsValue<"brand">
export type StrategySettings = SettingsValue<"strategy">
export type TargetingSettings = SettingsValue<"targeting">
export type ArticleSettings = SettingsValue<"articles">
export type GeoSettings = SettingsValue<"geo">
export type ReportSettings = SettingsValue<"reports">
export type PageSpeedSettings = SettingsValue<"pagespeed">

export function isSettingsKey(key: string): key is SettingsKey {
  return Object.prototype.hasOwnProperty.call(SETTINGS_SCHEMAS, key)
}

/* ------------------------------------------------------------------ */
/* Valeurs par défaut                                                  */
/* ------------------------------------------------------------------ */

const OFFER =
  "Le logiciel de devis et de facturation des artisans du bâtiment : devis gratuits et illimités, factures aux mentions obligatoires, relances automatiques."

export const SETTINGS_DEFAULTS: { [K in SettingsKey]: SettingsValue<K> } = {
  brand: {
    name: "Qonforme",
    audience:
      "Artisans du bâtiment, tous métiers, du travailleur seul à une dizaine de salariés, qui choisissent leur premier logiciel de facturation.",
    offer: OFFER,
    benefits: [
      "Devis gratuits et illimités, sans carte bancaire.",
      "Devis et factures aux mentions obligatoires, avec l'assurance professionnelle de l'artisan.",
      "TVA ligne par ligne (20 %, 10 %, 5,5 %), ventilée par taux sur la facture.",
      "Du devis signé à la facture sans ressaisie, avec une numérotation continue.",
    ],
    positioning:
      "Le logiciel de devis et de facturation des artisans du bâtiment : le premier et le dernier logiciel de l'artisan, du premier devis gratuit à la facture électronique, sans changer d'outil quand l'entreprise grandit.",
    tone:
      "Vouvoiement, phrases courtes et concrètes, vocabulaire du chantier, sans jargon ni marketing de la peur ; chaque règle légale citée avec sa source officielle.",
    proofs: [
      {
        claim: "Franchise de TVA : 37 500 € (services) et 85 000 € (vente), seuils majorés 41 250 € et 93 500 €",
        source: "Légifrance, CGI art. 293 B",
        url: "",
      },
      {
        claim: "Pénalités de retard : taux de refinancement de la BCE + 10 points",
        source: "Code de commerce, art. L441-10",
        url: "",
      },
      {
        claim: "Devis obligatoire dès le premier euro pour un dépannage, une réparation ou un entretien chez un particulier",
        source: "Arrêté du 24 janvier 2017 ; service-public.gouv.fr, fiche F31144",
        url: "https://entreprendre.service-public.gouv.fr/vosdroits/F31144",
      },
      {
        claim: "Réception des factures électroniques obligatoire pour toutes les entreprises depuis le 1er septembre 2026",
        source: "impots.gouv.fr",
        url: "https://www.impots.gouv.fr/facturation-electronique-et-plateformes-agreees",
      },
      {
        claim: "Plafonds micro-entreprise 2026 : 203 100 € (vente) et 83 600 € (services)",
        source: "service-public.gouv.fr",
        url: "https://entreprendre.service-public.gouv.fr/vosdroits/F32353",
      },
    ],
  },
  strategy: {
    niche:
      "SaaS de facturation électronique (devis, factures, relances et suivi des paiements) pour TPE/PME du secteur du bâtiment",
    mainGoal: "traffic",
    goals: ["traffic", "positions", "content", "technical", "competitors"],
    description: OFFER,
  },
  targeting: {
    scope: "france",
    audience: "both",
    countries: ["FR"],
    localZone: "France",
    brandTerms: ["Qonforme", "qonforme.fr"],
    competitors: ["tolteck.com", "constructor.co", "btp.inprocess.ai", "mediabat.com"],
    includeBrandQueries: false,
  },
  articles: {
    publishMode: "draft",
    perWeek: 1,
    weekday: 1,
    time: "08:00",
    lengthMin: 1500,
    lengthMax: 2500,
    faq: true,
    faqMin: 3,
    faqMax: 5,
    officialSources: true,
    alternateAngles: true,
    textModel: "gemini-2.5-flash",
    coverImage: true,
    imageModel: "gemini-3.1-flash-image-preview",
    autoLinks: true,
  },
  geo: {
    engines: { gemini: true, chatgpt: true, perplexity: false, claude: false, google_ai_overview: false },
    frequency: "monthly",
    dayOfMonth: 1,
    repetitions: 3,
    market: "France",
    language: "français",
  },
  reports: {
    weeklyDigest: false,
    weekday: 1,
    time: "08:00",
    sections: { kpis: true, pages: true, articles: true, geo: true },
  },
  pagespeed: {
    pages: [
      { path: "/", label: "Accueil" },
      { path: "/facturation", label: "Pages métier" },
      { path: "/modele", label: "Modèles" },
      { path: "/guide/mentions-obligatoires-facture", label: "Guides" },
      { path: "/demo", label: "Démo" },
    ],
    weekly: true,
  },
}

/* ------------------------------------------------------------------ */
/* Lecture et écriture                                                 */
/* ------------------------------------------------------------------ */

export interface StoredSettings<K extends SettingsKey> {
  value: SettingsValue<K>
  /** Faux : valeurs par défaut, jamais enregistrées. */
  saved: boolean
  updatedAt: string | null
}

/**
 * Valeur enregistrée complétée par les valeurs par défaut (un champ ajouté au
 * schéma après l'enregistrement prend sa valeur par défaut). Une valeur
 * enregistrée devenue invalide retombe sur les valeurs par défaut, champ par champ.
 */
export function mergeWithDefaults<K extends SettingsKey>(key: K, stored: unknown): SettingsValue<K> {
  const defaults = SETTINGS_DEFAULTS[key]
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return defaults
  const schema = SETTINGS_SCHEMAS[key] as unknown as z.ZodObject<z.ZodRawShape>
  const merged: Record<string, unknown> = { ...(defaults as Record<string, unknown>) }
  for (const [field, fieldSchema] of Object.entries(schema.shape)) {
    const raw = (stored as Record<string, unknown>)[field]
    if (raw === undefined) continue
    const parsed = (fieldSchema as z.ZodType).safeParse(raw)
    if (parsed.success) merged[field] = parsed.data
  }
  return merged as SettingsValue<K>
}

export async function getSettings<K extends SettingsKey>(db: SeoDb, key: K): Promise<StoredSettings<K>> {
  const row = must(
    await db.from("seo_settings").select("value, updated_at").eq("key", key).maybeSingle(),
    `les réglages « ${key} »`,
  ) as { value: unknown; updated_at: string } | null
  if (!row) return { value: SETTINGS_DEFAULTS[key], saved: false, updatedAt: null }
  return { value: mergeWithDefaults(key, row.value), saved: true, updatedAt: row.updated_at }
}

/** Plusieurs sections en une lecture. */
export async function getAllSettings(db: SeoDb): Promise<{ [K in SettingsKey]: StoredSettings<K> }> {
  const rows = must(await db.from("seo_settings").select("key, value, updated_at"), "les réglages SEO") as {
    key: string
    value: unknown
    updated_at: string
  }[]
  const byKey = new Map(rows.map((r) => [r.key, r]))
  const out = {} as { [K in SettingsKey]: StoredSettings<K> }
  for (const key of Object.keys(SETTINGS_SCHEMAS) as SettingsKey[]) {
    const row = byKey.get(key)
    ;(out as Record<string, unknown>)[key] = row
      ? { value: mergeWithDefaults(key, row.value), saved: true, updatedAt: row.updated_at }
      : { value: SETTINGS_DEFAULTS[key], saved: false, updatedAt: null }
  }
  return out
}

export type ParsedSettings<K extends SettingsKey> =
  | { ok: true; value: SettingsValue<K> }
  | { ok: false; error: string; fieldErrors: Record<string, string> }

/** Valide une section reçue du navigateur (messages en français, champ par champ). */
export function parseSettings<K extends SettingsKey>(key: K, input: unknown): ParsedSettings<K> {
  const parsed = SETTINGS_SCHEMAS[key].safeParse(input)
  if (parsed.success) {
    const value = parsed.data as SettingsValue<K>
    const crossError = crossCheck(key, value)
    if (crossError) return { ok: false, error: crossError.message, fieldErrors: { [crossError.field]: crossError.message } }
    return { ok: true, value }
  }
  const fieldErrors: Record<string, string> = {}
  for (const issue of parsed.error.issues) {
    const path = issue.path.join(".") || "_"
    if (!fieldErrors[path]) fieldErrors[path] = issue.message
  }
  return { ok: false, error: Object.values(fieldErrors)[0] ?? "Réglages invalides", fieldErrors }
}

function crossCheck<K extends SettingsKey>(key: K, value: SettingsValue<K>): { field: string; message: string } | null {
  if (key === "articles") {
    const v = value as ArticleSettings
    if (v.lengthMin > v.lengthMax) return { field: "lengthMax", message: "La longueur maximale doit dépasser la longueur minimale" }
    if (v.faqMin > v.faqMax) return { field: "faqMax", message: "Le nombre maximal de questions doit dépasser le minimum" }
  }
  if (key === "strategy") {
    const v = value as StrategySettings
    if (!v.goals.includes(v.mainGoal)) return { field: "goals", message: "L'objectif principal doit faire partie des objectifs cochés" }
  }
  return null
}

export async function saveSettings<K extends SettingsKey>(db: SeoDb, key: K, value: SettingsValue<K>): Promise<string> {
  const updatedAt = new Date().toISOString()
  must(
    await db.from("seo_settings").upsert({ key, value, updated_at: updatedAt }, { onConflict: "key" }),
    `l'enregistrement des réglages « ${key} »`,
  )
  return updatedAt
}
