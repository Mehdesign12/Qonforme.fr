/**
 * Fonctions dont la migration n'est peut-être pas encore appliquée.
 *
 * Chaque push sur la branche de travail est fusionné automatiquement dans main,
 * donc mis en production, avant que les migrations ne soient passées sur la base.
 * Une table, une colonne ou une fonction SQL absente doit donc masquer la
 * nouvelle fonction ou revenir au comportement existant, jamais casser l'existant.
 * Une fois la migration appliquée, la fonction s'active d'elle-même.
 */

type DbError = { code?: string | null; message?: string | null } | null | undefined

/**
 * Codes d'une erreur de schéma :
 * - Postgres : table absente (42P01), colonne absente (42703), fonction absente (42883) ;
 * - PostgREST : colonne (PGRST204), table (PGRST205), relation (PGRST200)
 *   ou fonction RPC (PGRST202) inconnues de son cache de schéma.
 */
const SCHEMA_CODES = new Set(["42P01", "42703", "42883", "PGRST200", "PGRST202", "PGRST204", "PGRST205"])

/** Vrai si l'erreur vient d'un élément de schéma absent (migration pas encore appliquée). */
export function isMissingSchemaError(error: DbError): boolean {
  if (!error) return false
  if (error.code && SCHEMA_CODES.has(error.code)) return true
  return /does not exist|schema cache|Could not find the/i.test(error.message ?? "")
}
