/**
 * Résumé hebdomadaire SEO (Paramètres › Rapports) : forme des données lues
 * par buildDigest() et rendues par lib/email/templates/seo-digest.ts.
 *
 * Module pur (types et constantes) : importable par le serveur, le navigateur
 * (aperçu en direct dans Paramètres › Rapports) et les tests.
 *
 * Règle de contenu : aucun chiffre inventé. Une section cochée sans données
 * vaut `null` (« — » ou phrase « aucun… ») ; une section dont la lecture a
 * échoué figure dans `unavailable` (« Données indisponibles »). Les concurrents
 * ne figurent jamais dans le résumé (CLAUDE.md, DECISIONS § 2).
 */
import type { FindingSeverity, GeoEngine } from "@/lib/seo/types"

export type DigestSectionKey = "kpis" | "pages" | "articles" | "geo"

export type DigestSections = Record<DigestSectionKey, boolean>

export const DIGEST_SECTION_KEYS: DigestSectionKey[] = ["kpis", "pages", "articles", "geo"]

/** Libellés des cases « Contenu du résumé » et titres des sections de l'email. */
export const DIGEST_SECTION_LABELS: Record<DigestSectionKey, { label: string; hint: string }> = {
  kpis: { label: "Indicateurs", hint: "Clics, impressions, taux de clic et position moyenne." },
  pages: { label: "Pages à surveiller", hint: "Les pages qui demandent une action en priorité." },
  articles: { label: "Articles publiés", hint: "Les articles parus pendant la semaine." },
  geo: { label: "Visibilité IA", hint: "Mentions et citations d'après le dernier relevé." },
}

export const ALL_DIGEST_SECTIONS: DigestSections = { kpis: true, pages: true, articles: true, geo: true }

export interface DigestTotals {
  clicks: number
  impressions: number
  /** 0 à 1 ; null sans impression. */
  ctr: number | null
  /** null sans impression. */
  position: number | null
}

export interface DigestKpis {
  /** Les 7 derniers jours enregistrés de Search Console (AAAA-MM-JJ), moins si la base est plus courte. */
  range: { from: string; to: string }
  /** Vrai si la base couvre moins de 7 jours : `range` commence au premier jour enregistré. */
  partial?: boolean
  current: DigestTotals
  /** Les 7 jours précédents ; null si la base ne les couvre pas entièrement (pas de comparaison). */
  previous: DigestTotals | null
}

export interface DigestFinding {
  id: string
  title: string
  path: string
  severity: FindingSeverity
  explanation: string | null
}

export interface DigestFindings {
  /** Les 3 constats ouverts les plus graves. */
  top: DigestFinding[]
  openCount: number
}

export interface DigestArticle {
  title: string
  slug: string
  publishedAt: string
}

export interface DigestGeoEngine {
  key: GeoEngine
  label: string
  mentionRate: number | null
  citationRate: number | null
}

export interface DigestGeo {
  /** Date du relevé (fin, sinon création). */
  at: string
  /** Relevé importé de PushRank (taux seulement). */
  imported: boolean
  mentionRate: number | null
  citationRate: number | null
  engines: DigestGeoEngine[]
}

export interface SeoDigest {
  generatedAt: string
  /** Semaine du résumé et fenêtre des articles : les 7 jours de Paris entiers qui précèdent le jour de l'envoi. */
  week: { from: string; to: string }
  /** Sections lues (les autres valent undefined). */
  sections: DigestSections
  /** undefined : section non lue ; null : aucune donnée. */
  kpis?: DigestKpis | null
  findings?: DigestFindings | null
  articles?: DigestArticle[] | null
  geo?: DigestGeo | null
  /** Sections cochées dont la lecture a échoué. */
  unavailable: DigestSectionKey[]
}
