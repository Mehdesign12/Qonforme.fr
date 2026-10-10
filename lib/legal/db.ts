/**
 * Lectures en base du profil légal, tolérantes à une migration pas encore
 * appliquée (lib/supabase/schema-guard.ts) : sans la colonne
 * `companies.legal_profile` ou `<document>.legal_snapshot`, la lecture se
 * refait sans elle et les documents gardent leurs mentions d'avant.
 *
 * Utilisables côté serveur (routes) comme dans le navigateur (pages).
 */
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js"
import { isMissingSchemaError } from "@/lib/supabase/schema-guard"

// Lignes non typées : le client Supabase du projet n'a pas de schéma généré
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CompanyRow = Record<string, any>

export interface CompanyResult {
  data: CompanyRow | null
  error: PostgrestError | null
  /** Faux si la colonne `legal_profile` n'existe pas encore. */
  profileAvailable: boolean
}

/**
 * Entreprise de l'utilisateur avec les colonnes demandées, son profil légal et
 * ses modèles de documents (`document_templates`, lib/pdf/theme.ts), chacun
 * relu sans lui si sa migration manque.
 * @param userId filtre explicite (routes serveur) ; omis, la RLS suffit (navigateur).
 */
export async function selectCompanyWithProfile(
  db: SupabaseClient,
  columns: string,
  userId?: string | null,
): Promise<CompanyResult> {
  const run = async (cols: string) => {
    let q = db.from("companies").select(cols)
    if (userId) q = q.eq("user_id", userId)
    const { data, error } = await q.maybeSingle()
    return { data: (data as CompanyRow | null) ?? null, error }
  }
  const withTemplates = await run(`${columns},legal_profile,document_templates`)
  if (!withTemplates.error || !isMissingSchemaError(withTemplates.error)) return { ...withTemplates, profileAvailable: true }
  const first = await run(`${columns},legal_profile`)
  if (first.error && isMissingSchemaError(first.error)) {
    const second = await run(columns)
    return { ...second, profileAvailable: false }
  }
  return { ...first, profileAvailable: true }
}

/**
 * Modèles de documents d'un compte, pour les lectures de l'entreprise qui ne
 * passent pas par selectCompanyWithProfile. Vide si la colonne manque.
 */
export async function loadDocumentTemplates(db: SupabaseClient, userId: string): Promise<unknown> {
  const { data, error } = await db.from("companies").select("document_templates").eq("user_id", userId).maybeSingle()
  if (error) return {}
  return (data as { document_templates?: unknown } | null)?.document_templates ?? {}
}

/** Vrai si la colonne `companies.legal_profile` existe (réglages à afficher ou non). */
export async function legalProfileAvailable(db: SupabaseClient): Promise<boolean> {
  const { error } = await db.from("companies").select("legal_profile").limit(1)
  return !isMissingSchemaError(error)
}

/**
 * Instantané des mentions d'un document émis (`legal_snapshot`), pour les
 * lectures qui ne sélectionnent pas toutes les colonnes. Null s'il n'existe
 * pas, si la colonne manque ou en cas d'erreur : le document est alors traité
 * comme émis avant l'instantané.
 */
export async function loadLegalSnapshot(
  db: SupabaseClient,
  table: "invoices" | "quotes" | "purchase_orders" | "credit_notes",
  id: string,
): Promise<unknown> {
  const { data, error } = await db.from(table).select("legal_snapshot").eq("id", id).maybeSingle()
  if (error) return null
  return (data as { legal_snapshot?: unknown } | null)?.legal_snapshot ?? null
}
