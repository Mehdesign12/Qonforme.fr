/**
 * Validation des saisies de l'écran Mots-clés (fenêtre « Ajouter un mot-clé »,
 * panneau de détail). Messages en français, champ par champ. Module pur.
 */
import { z } from "zod"
import type { KeywordIntent, KeywordStatus } from "@/lib/seo/types"
import { toSitePath } from "@/lib/seo/site"
import { normalizeKeyword } from "@/lib/seo/keywords/normalize"
import { KEYWORD_INTENTS, KEYWORD_STATUSES } from "@/lib/seo/keywords/types"

export const NOTES_MAX = 5000
export const PATH_MAX = 500

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string; fieldErrors: Record<string, string> }

function fail<T>(field: string, message: string): Parsed<T> {
  return { ok: false, error: message, fieldErrors: { [field]: message } }
}

/**
 * Page cible : chemin du site (« /modele ») ou adresse de qonforme.fr, rendue
 * en chemin normalisé ; vide → null (aucune page cible).
 */
export function parseTargetPath(value: unknown): { ok: true; path: string | null } | { ok: false; error: string } {
  if (value === null || value === undefined) return { ok: true, path: null }
  if (typeof value !== "string") return { ok: false, error: "Chemin du site attendu, par exemple /modele." }
  const raw = value.trim()
  if (!raw) return { ok: true, path: null }
  if (raw.length > PATH_MAX) return { ok: false, error: `${PATH_MAX} caractères au plus.` }
  const path = toSitePath(raw)
  if (!path) return { ok: false, error: "Chemin du site attendu, par exemple /modele (une page de qonforme.fr)." }
  return { ok: true, path }
}

const initialStatus = z.enum(["candidate", "targeted", "covered"] as const)
const anyStatus = z.enum(KEYWORD_STATUSES as [KeywordStatus, ...KeywordStatus[]])
const intent = z.enum(KEYWORD_INTENTS as [KeywordIntent, ...KeywordIntent[]])

export interface CreateKeywordInput {
  keyword: string
  target_path: string | null
  status: "candidate" | "targeted" | "covered"
}

/** Corps de POST /api/admin/seo/keywords. */
export function parseCreateKeyword(body: unknown): Parsed<CreateKeywordInput> {
  if (!body || typeof body !== "object" || Array.isArray(body)) return fail("_", "Corps attendu : { keyword, target_path, status }.")
  const b = body as Record<string, unknown>
  const keyword = normalizeKeyword(b.keyword)
  if (!keyword.ok) return fail("keyword", keyword.error)
  const path = parseTargetPath(b.target_path)
  if (!path.ok) return fail("target_path", path.error)
  const status = b.status === undefined ? { success: true as const, data: "candidate" as const } : initialStatus.safeParse(b.status)
  if (!status.success) return fail("status", "Statut initial attendu : candidat, ciblé ou couvert.")
  return { ok: true, value: { keyword: keyword.keyword, target_path: path.path, status: status.data } }
}

export interface PatchKeywordInput {
  status?: KeywordStatus
  target_path?: string | null
  notes?: string | null
  intent?: KeywordIntent | null
}

const PATCH_FIELDS = ["status", "target_path", "notes", "intent"]

/** Corps de PATCH /api/admin/seo/keywords/[id] : au moins un champ, aucun champ inconnu. */
export function parsePatchKeyword(body: unknown): Parsed<PatchKeywordInput> {
  if (!body || typeof body !== "object" || Array.isArray(body)) return fail("_", "Corps attendu : { status, target_path, notes, intent }.")
  const b = body as Record<string, unknown>
  const unknownField = Object.keys(b).find((k) => !PATCH_FIELDS.includes(k))
  if (unknownField) return fail(unknownField, `Champ non modifiable : ${unknownField}.`)
  const out: PatchKeywordInput = {}

  if (b.status !== undefined) {
    const s = anyStatus.safeParse(b.status)
    if (!s.success) return fail("status", "Statut inconnu.")
    out.status = s.data
  }
  if (b.target_path !== undefined) {
    const p = parseTargetPath(b.target_path)
    if (!p.ok) return fail("target_path", p.error)
    out.target_path = p.path
  }
  if (b.notes !== undefined) {
    if (b.notes !== null && typeof b.notes !== "string") return fail("notes", "Texte attendu.")
    const notes = typeof b.notes === "string" ? b.notes.replace(/\r\n/g, "\n") : null
    if (notes && notes.length > NOTES_MAX) return fail("notes", `${NOTES_MAX} caractères au plus.`)
    out.notes = notes && notes.trim() ? notes : null
  }
  if (b.intent !== undefined) {
    if (b.intent === null || b.intent === "") out.intent = null
    else {
      const i = intent.safeParse(b.intent)
      if (!i.success) return fail("intent", "Intention inconnue.")
      out.intent = i.data
    }
  }
  if (Object.keys(out).length === 0) return fail("_", "Aucun changement à enregistrer.")
  return { ok: true, value: out }
}

/** Titre proposé pour un sujet d'article tiré d'un mot-clé (l'admin le retouche ensuite). */
export function topicTitleFor(keyword: string): string {
  const k = keyword.trim()
  return k ? k.charAt(0).toLocaleUpperCase("fr-FR") + k.slice(1) : k
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value)
}
