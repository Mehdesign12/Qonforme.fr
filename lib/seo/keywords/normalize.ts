/**
 * Forme canonique d'un mot-clé suivi (colonne `keyword` de seo_keywords,
 * unique) : c'est elle qui sert à rapprocher une requête de Search Console d'un
 * mot-clé, à refuser un doublon et à interroger DataForSEO.
 *
 * - minuscules (règles du français), Unicode composé (NFC) ;
 * - apostrophes typographiques (’ ‘ ʼ ´ `) remplacées par l'apostrophe droite ;
 * - caractères invisibles retirés, puis espaces de toute sorte (insécables
 *   compris) réduits à un seul, bords retirés : la forme est stable
 *   (canonicalKeyword(canonicalKeyword(x)) === canonicalKeyword(x)) ;
 * - 2 à 120 caractères ;
 * - une adresse web (« https://… », « www.… », « site.fr/page ») est refusée :
 *   c'est une page, pas une requête. Un nom de domaine seul (« qonforme.fr »)
 *   reste accepté, des internautes le tapent tel quel.
 *
 * Module pur : serveur, navigateur et tests.
 */

export const KEYWORD_MIN_LENGTH = 2
export const KEYWORD_MAX_LENGTH = 120

export type NormalizedKeyword = { ok: true; keyword: string } | { ok: false; error: string }

/** Apostrophes typographiques redressées en « ' » (’ ‘ ‛ ʼ ʻ ′ ´ `). */
export const TYPO_APOSTROPHE_CHARS = [0x2019, 0x2018, 0x201b, 0x02bc, 0x02bb, 0x2032, 0x00b4, 0x0060].map((c) => String.fromCharCode(c))
const TYPO_APOSTROPHES = /[\u2018\u2019\u201B\u02BC\u02BB\u2032\u00B4\u0060]/g
// Caractères de contrôle et espaces sans chasse (copiés-collés d'un traitement de texte).
// eslint-disable-next-line no-control-regex
const INVISIBLES = /[\u0000-\u0008\u000E-\u001F\u007F\u200B-\u200D\u2060]/g
const SPACES = /[\s\u00A0\u202F\u2007]+/g

const URL_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i
const DOMAIN_WITH_PATH = /^[^\s/]+\.[a-z]{2,}\/\S*/i

/** Vrai si la saisie ressemble à une adresse web plutôt qu'à une requête. */
export function looksLikeUrl(value: string): boolean {
  const v = value.trim()
  return URL_SCHEME.test(v) || /^www\./i.test(v) || DOMAIN_WITH_PATH.test(v)
}

/** Forme canonique, sans contrôle de longueur (rapprochement des requêtes de Search Console). */
export function canonicalKeyword(raw: string): string {
  // Invisibles retirés AVANT de réduire les espaces : sinon « a \u200B b » garde
  // deux espaces et la forme n'est plus stable quand on la réapplique.
  return raw
    .normalize("NFC")
    .replace(INVISIBLES, "")
    .replace(SPACES, " ")
    .replace(TYPO_APOSTROPHES, "'")
    .trim()
    .toLocaleLowerCase("fr-FR")
}

/** Valide et normalise une saisie ; message d'erreur en français sinon. */
export function normalizeKeyword(raw: unknown): NormalizedKeyword {
  if (typeof raw !== "string") return { ok: false, error: "Saisissez un mot-clé." }
  const keyword = canonicalKeyword(raw)
  if (!keyword) return { ok: false, error: "Saisissez un mot-clé." }
  if (looksLikeUrl(keyword)) {
    return { ok: false, error: "Saisissez une requête, pas une adresse web : la page se choisit dans « Page cible »." }
  }
  if (keyword.length < KEYWORD_MIN_LENGTH) return { ok: false, error: `Un mot-clé compte au moins ${KEYWORD_MIN_LENGTH} caractères.` }
  if (keyword.length > KEYWORD_MAX_LENGTH) return { ok: false, error: `Un mot-clé compte au plus ${KEYWORD_MAX_LENGTH} caractères.` }
  return { ok: true, keyword }
}

/** Sans accents ni casse (« Qönforme » → « qonforme ») : comparaison des termes de marque. */
export function foldAccents(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr-FR")
}
