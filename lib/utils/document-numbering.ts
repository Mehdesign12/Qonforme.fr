import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Numérotation séquentielle partagée par les factures, devis, avoirs et bons
 * de commande — un préfixe (ex: "F-2026-") + un numéro à 3 chiffres minimum.
 *
 * Remplace le pattern historique dupliqué dans chaque route (`.order(numberColumn,
 * { ascending: false }).limit(1)`), qui trie la colonne comme du TEXTE et casse
 * dès le passage à 4 chiffres : "F-2026-999" est lexicographiquement supérieur à
 * "F-2026-1000" (le caractère '9' > '1'), donc le "dernier numéro" renvoyé reste
 * bloqué sur 999 et le document suivant recrée un doublon exact de "F-2026-1000".
 *
 * Cette fonction récupère tous les numéros existants pour le préfixe et calcule
 * le vrai maximum numérique côté application — plus de tri texte.
 */
export async function getNextDocumentNumber(
  supabase: SupabaseClient,
  table: string,
  numberColumn: string,
  userId: string,
  prefix: string,
): Promise<string> {
  const { data, error } = await supabase
    .from(table)
    .select(numberColumn)
    .eq("user_id", userId)
    .like(numberColumn, `${prefix}%`)

  if (error) throw error

  let maxSeq = 0
  for (const row of (data ?? []) as unknown as Record<string, string>[]) {
    const value = row[numberColumn]
    const parts = value?.split("-")
    const seq   = parts ? parseInt(parts[parts.length - 1], 10) : NaN
    if (!isNaN(seq) && seq > maxSeq) maxSeq = seq
  }

  return `${prefix}${String(maxSeq + 1).padStart(3, "0")}`
}

/** Code Postgres pour violation de contrainte UNIQUE. */
const UNIQUE_VIOLATION = "23505"

/**
 * Calcule le prochain numéro et insère la ligne en une opération, en réessayant
 * si l'insertion échoue sur une violation de contrainte unique (deux requêtes
 * concurrentes ayant calculé le même numéro avant que l'une des deux n'insère).
 *
 * Suppose l'existence d'une contrainte UNIQUE(user_id, <numberColumn>) en base —
 * voir supabase/migrations/20260901_unique_document_numbers.sql. Cette migration
 * n'a pas pu être appliquée depuis cette session (pas d'accès au projet Supabase
 * réel de Qonforme) : sans elle, ce garde-fou ne peut jamais se déclencher (la
 * course reste possible en théorie) mais ne casse rien non plus en attendant.
 */
export async function insertWithSequentialNumber<T>(
  supabase: SupabaseClient,
  opts: {
    table: string
    numberColumn: string
    userId: string
    prefix: string
    buildRow: (documentNumber: string) => Record<string, unknown>
    selectClause?: string
    maxAttempts?: number
  },
): Promise<{ data: T | null; error: { message: string; code?: string } | null }> {
  const { table, numberColumn, userId, prefix, buildRow, selectClause = "*", maxAttempts = 3 } = opts

  let lastError: { message: string; code?: string } | null = null

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const documentNumber = await getNextDocumentNumber(supabase, table, numberColumn, userId, prefix)

    const { data, error } = await supabase
      .from(table)
      .insert(buildRow(documentNumber))
      .select(selectClause)
      .single()

    if (!error) return { data: data as T, error: null }

    lastError = error
    if (error.code !== UNIQUE_VIOLATION) break // autre erreur → pas la peine de réessayer
  }

  return { data: null, error: lastError }
}
