/**
 * Champs de l'éditeur d'articles (admin › Blog) propres au référencement et à
 * la publication : mot-clé principal, texte alternatif de la couverture, date
 * de publication programmée. Lus par POST /api/admin/blog et
 * PATCH /api/admin/blog/<id> ; les mêmes règles servent dans le navigateur
 * (panneau Publication) pour dire tout de suite ce qui n'ira pas.
 *
 * - Date programmée : instant ISO 8601 avec fuseau (« Z » ou « +02:00 ») :
 *   une heure sans fuseau serait lue à l'heure du serveur (UTC), une ou deux
 *   heures plus tôt que l'heure de Paris choisie. Au moins une minute dans le
 *   futur (la tâche planifiée passe toutes les quinze minutes : une date déjà
 *   passée publierait l'article au prochain passage, sans le dire), au plus
 *   un an à l'avance (faute de frappe sur l'année).
 * - Mot-clé : forme canonique de l'onglet Mots-clés (lib/seo/keywords/normalize.ts),
 *   accents conservés, jamais une adresse web.
 * - Texte alternatif : 300 caractères au plus, sans chevrons (il part dans un
 *   attribut alt du blog).
 * - Adresse de l'article et adresse de la couverture : mêmes règles à la
 *   création et à la modification (l'adresse devient l'URL publique, la
 *   couverture part dans un attribut src).
 *
 * Module pur : serveur, navigateur et tests. Messages en français, prêts à
 * afficher.
 */
import { canonicalKeyword, KEYWORD_MAX_LENGTH, KEYWORD_MIN_LENGTH, looksLikeUrl } from "@/lib/seo/keywords/normalize"
import { parisInstant } from "@/lib/seo/articles/schedule"
import { isIsoDay } from "@/lib/utils/paris-date"

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string }

/** Avance minimale d'une publication programmée. */
export const SCHEDULE_MIN_LEAD_MS = 60_000
/** Une publication se programme au plus un an à l'avance. */
export const SCHEDULE_MAX_AHEAD_MS = 365 * 86_400_000
export const COVER_ALT_MAX = 300

/**
 * Instant ISO 8601 complet avec fuseau : « 2026-10-22T06:00:00.000Z », « 2026-10-22T08:00+02:00 ».
 * Heures 00-23, minutes et secondes 00-59 : Date.parse accepterait « 24:00 ».
 */
const ISO_WITH_ZONE = /^(\d{4}-\d{2}-\d{2})T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,9})?)?(?:Z|[+-](?:[01]\d|2[0-3]):?[0-5]\d)$/i

const ok = <T>(value: T): Parsed<T> => ({ ok: true, value })
const fail = <T>(error: string): Parsed<T> => ({ ok: false, error })

/**
 * Date de publication programmée : null (aucune), ou instant ISO normalisé
 * (toISOString). Vide ou null : la programmation est retirée.
 */
export function parseScheduledAt(value: unknown, now: Date = new Date()): Parsed<string | null> {
  if (value === null || value === undefined) return ok(null)
  if (typeof value !== "string") return fail("Date de publication invalide.")
  const raw = value.trim()
  if (!raw) return ok(null)
  const iso = ISO_WITH_ZONE.exec(raw)
  if (!iso) return fail("Date de publication invalide : date et heure complètes attendues, avec leur fuseau.")
  // Date.parse fait glisser un jour qui n'existe pas (« 30 février » → 2 mars) au lieu de le refuser
  const time = Date.parse(raw)
  if (!isIsoDay(iso[1]) || Number.isNaN(time)) return fail("Cette date de publication n'existe pas.")
  if (time < now.getTime() + SCHEDULE_MIN_LEAD_MS) return fail("Choisissez une date et une heure à venir, au moins une minute après maintenant.")
  if (time > now.getTime() + SCHEDULE_MAX_AHEAD_MS) return fail("Une publication se programme au plus un an à l'avance.")
  return ok(new Date(time).toISOString())
}

/** Mot-clé principal : forme canonique, ou null pour le retirer. */
export function parseTargetKeyword(value: unknown): Parsed<string | null> {
  if (value === null || value === undefined) return ok(null)
  if (typeof value !== "string") return fail("Mot-clé principal invalide.")
  const keyword = canonicalKeyword(value)
  if (!keyword) return ok(null)
  if (looksLikeUrl(keyword)) return fail("Le mot-clé principal est une requête, pas une adresse web.")
  if (keyword.length < KEYWORD_MIN_LENGTH) return fail(`Un mot-clé compte au moins ${KEYWORD_MIN_LENGTH} caractères.`)
  if (keyword.length > KEYWORD_MAX_LENGTH) return fail(`Un mot-clé compte au plus ${KEYWORD_MAX_LENGTH} caractères.`)
  return ok(keyword)
}

/** Texte alternatif de la couverture : espaces réduits, ou null s'il est vide. */
export function parseCoverAlt(value: unknown): Parsed<string | null> {
  if (value === null || value === undefined) return ok(null)
  if (typeof value !== "string") return fail("Texte alternatif invalide.")
  const alt = value.replace(/\s+/g, " ").trim()
  if (!alt) return ok(null)
  if (/[<>]/.test(alt)) return fail("Le texte alternatif ne peut pas contenir les signes « < » ni « > ».")
  if (alt.length > COVER_ALT_MAX) return fail(`Texte alternatif de ${COVER_ALT_MAX} caractères au plus.`)
  return ok(alt)
}

/** Adresse d'un article : minuscules sans accents, chiffres, tirets (slugify, lib/seo/articles/check.ts). */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
export const SLUG_MAX = 120

/**
 * Adresse d'un article après « /blog/ » : tirets en trop retirés (adresse
 * coupée juste après un tiret), puis contrôlée. Vide : erreur (une adresse
 * est obligatoire).
 */
export function parseSlug(value: unknown): Parsed<string> {
  if (typeof value !== "string") return fail("Adresse de l'article invalide.")
  const slug = value.trim().replace(/-{2,}/g, "-").replace(/^-+|-+$/g, "")
  if (!slug) return fail("L'adresse de l'article est obligatoire.")
  if (slug.length > SLUG_MAX) return fail(`Adresse de ${SLUG_MAX} caractères au plus.`)
  if (!SLUG_PATTERN.test(slug)) return fail("Adresse invalide : lettres minuscules sans accents, chiffres et tirets seulement.")
  return ok(slug)
}

export const COVER_URL_MAX = 2048

/**
 * Adresse de la couverture : adresse web complète (http ou https) ou chemin du
 * site (« /images/… »), sans espace, guillemet ni chevron (elle part dans un
 * attribut src) ; null si elle est vide. Le fragment des dimensions
 * (« #w=1600&h=900 », lib/blog-images/policy.ts) est gardé.
 */
export function parseCoverUrl(value: unknown): Parsed<string | null> {
  if (value === null || value === undefined) return ok(null)
  if (typeof value !== "string") return fail("Adresse de l'image de couverture invalide.")
  const url = value.trim()
  if (!url) return ok(null)
  if (url.length > COVER_URL_MAX) return fail(`Adresse de l'image de couverture trop longue (${COVER_URL_MAX} caractères au plus).`)
  if (/[\s"'<>`\\]/.test(url)) return fail("Adresse de l'image de couverture invalide : espaces, guillemets et chevrons ne sont pas admis.")
  if (url.startsWith("/") && !url.startsWith("//")) return ok(url)
  try {
    const parsed = new URL(url)
    if ((parsed.protocol === "https:" || parsed.protocol === "http:") && parsed.hostname) return ok(url)
  } catch {
    // Adresse illisible : même message
  }
  return fail("L'image de couverture doit avoir une adresse web complète (https://…).")
}

/** Champs reçus par les routes de l'éditeur (seulement ceux présents dans le corps). */
export interface EditorFields {
  target_keyword?: string | null
  cover_alt?: string | null
  scheduled_at?: string | null
}

/**
 * Lit les trois champs d'un corps de requête ; un champ absent (undefined)
 * reste absent (rien n'est écrasé). Première erreur rendue telle quelle.
 */
export function parseEditorFields(body: unknown, now: Date = new Date()): Parsed<EditorFields> {
  const b = body && typeof body === "object" ? (body as Record<string, unknown>) : {}
  const out: EditorFields = {}
  if (b.target_keyword !== undefined) {
    const r = parseTargetKeyword(b.target_keyword)
    if (!r.ok) return r
    out.target_keyword = r.value
  }
  if (b.cover_alt !== undefined) {
    const r = parseCoverAlt(b.cover_alt)
    if (!r.ok) return r
    out.cover_alt = r.value
  }
  if (b.scheduled_at !== undefined) {
    const r = parseScheduledAt(b.scheduled_at, now)
    if (!r.ok) return r
    out.scheduled_at = r.value
  }
  return ok(out)
}

/* ------------------------------------------------------------------ */
/* Jour et heure de Paris (panneau Publication)                        */
/* ------------------------------------------------------------------ */

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

/** Instant ISO d'un jour et d'une heure de Paris (« 2026-10-22 », « 08:00 ») ; null si l'un manque ou n'existe pas. */
export function scheduledAtFromParis(day: string, time: string): string | null {
  if (!isIsoDay(day) || !TIME.test(time)) return null
  const at = parisInstant(day, time)
  return Number.isNaN(at.getTime()) ? null : at.toISOString()
}

/** Ce qui empêche de programmer à ce jour et à cette heure de Paris (null : rien). */
export function scheduleProblem(day: string, time: string, now: Date = new Date()): string | null {
  if (!day) return "Choisissez le jour de publication."
  if (!time) return "Choisissez l'heure de publication."
  const iso = scheduledAtFromParis(day, time)
  if (!iso) return "Cette date n'existe pas."
  const parsed = parseScheduledAt(iso, now)
  return parsed.ok ? null : parsed.error
}
