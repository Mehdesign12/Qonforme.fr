/**
 * Accès à la base pour l'onglet SEO : clé service_role (tables en RLS sans
 * politique, migration 20261009_seo_admin.sql), à n'utiliser que côté serveur,
 * derrière isAdminAuthenticated() ou CRON_SECRET.
 *
 * Deux échecs à distinguer d'une liste vide (règle « erreur réseau et pas de
 * données » de CLAUDE.md) :
 * - migration pas encore appliquée → l'écran affiche « Cette section s'active
 *   après la mise à jour de la base de données » ;
 * - lecture en échec → « Données indisponibles ».
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { createAdminClient } from "@/lib/supabase/server"
import { isMissingSchemaError } from "@/lib/supabase/schema-guard"

export type SeoDb = SupabaseClient

export function seoDb(): SeoDb {
  return createAdminClient()
}

export type SeoReadFailure = "migration_pending" | "read_failed"

/** Lecture en échec, avec sa nature. */
export class SeoDbError extends Error {
  readonly kind: SeoReadFailure
  constructor(kind: SeoReadFailure, message?: string) {
    super(message ?? (kind === "migration_pending" ? "Migration SEO non appliquée" : "Lecture impossible"))
    this.name = "SeoDbError"
    this.kind = kind
  }
}

type DbError = { code?: string | null; message?: string | null } | null | undefined

/** Lève SeoDbError si `error` est présent ; rend `data` sinon. */
export function must<T>(res: { data: T; error: DbError }, what = "les données SEO"): T {
  if (res.error) {
    if (isMissingSchemaError(res.error)) throw new SeoDbError("migration_pending")
    throw new SeoDbError("read_failed", `Lecture impossible : ${what} (${res.error.message ?? res.error.code ?? "erreur"})`)
  }
  return res.data
}

/** Nature d'une erreur attrapée dans une page (null : pas une erreur de lecture SEO). */
export function failureOf(error: unknown): SeoReadFailure | null {
  if (error instanceof SeoDbError) return error.kind
  return null
}

/** Résultat d'une lecture de page : données, ou nature de l'échec. */
export type Loaded<T> = { ok: true; data: T } | { ok: false; failure: SeoReadFailure }

/** Exécute une lecture et range l'échec dans { ok: false } au lieu de lever. */
export async function load<T>(fn: () => Promise<T>): Promise<Loaded<T>> {
  try {
    return { ok: true, data: await fn() }
  } catch (error) {
    const failure = failureOf(error)
    if (failure) return { ok: false, failure }
    console.error("[seo] lecture en échec", error)
    return { ok: false, failure: "read_failed" }
  }
}

/** Réponse JSON d'une route admin pour une erreur attrapée (503 : réessayable). */
export function errorPayload(error: unknown): { status: number; body: { error: string; code?: string } } {
  const failure = failureOf(error)
  if (failure === "migration_pending") {
    return { status: 503, body: { error: "Cette section s'active après la mise à jour de la base de données.", code: "migration_pending" } }
  }
  if (failure === "read_failed") {
    return { status: 503, body: { error: "Lecture impossible pour le moment. Réessayez dans un instant.", code: "read_failed" } }
  }
  console.error("[seo] erreur", error)
  return { status: 500, body: { error: "Une erreur est survenue. Réessayez dans un instant." } }
}
