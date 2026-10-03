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

/* ------------------------------------------------------------------ */
/* Factures : numéro attribué à l'émission                              */
/* ------------------------------------------------------------------ */

/*
 * Une facture reçoit son numéro au moment où elle est émise (envoi par email
 * ou « Marquer comme envoyée »), jamais à la création du brouillon.
 *
 * CGI, annexe II, art. 242 nonies A, I (version en vigueur depuis le
 * 1er janvier 2025, décret n° 2024-1195 du 21 décembre 2024) : la facture porte
 * « 6° Sa date d'émission » et « 7° Un numéro unique basé sur une séquence
 * chronologique et continue » (https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000050811276).
 * BOFiP, BOI-TVA-DECLA-30-20-20-10 du 18/10/2013, §§ 70 à 90 : pour chaque
 * série, la numérotation est faite chronologiquement au fur et à mesure de
 * l'émission des factures, elle est continue, et deux factures de la même
 * année ne peuvent pas porter le même numéro.
 *
 * Numéroter dès le brouillon laissait des trous (brouillon supprimé) et des
 * numéros hors de l'ordre chronologique (brouillon envoyé après une facture
 * créée plus tard). Ici :
 * - un brouillon n'a pas de numéro (`invoice_number` vide, affiché « Brouillon ») ;
 * - l'émission pose en une seule écriture conditionnelle le numéro, le statut
 *   et la date d'émission (le jour de l'émission, heure de Paris) ; l'échéance
 *   garde le même délai de paiement ;
 * - une collision de numéro (deux émissions simultanées) est rejetée par la
 *   contrainte UNIQUE(user_id, invoice_number) et l'émission est retentée avec
 *   le numéro suivant ; une émission concurrente de la même facture ne la
 *   numérote qu'une fois (condition `invoice_number IS NULL`).
 *
 * Tant que la migration 20261003_invoice_number_at_issue_and_reminders.sql
 * n'est pas appliquée, la colonne refuse un numéro vide : la création revient
 * alors à la numérotation immédiate (insertDraftInvoice) et l'émission garde
 * le numéro déjà attribué, comme avant.
 */

/** Libellé affiché à la place du numéro d'un brouillon de facture. */
export const DRAFT_INVOICE_LABEL = "Brouillon"

/** Numéro de la facture, ou « Brouillon » tant qu'elle n'est pas émise. */
export function invoiceNumberLabel(invoiceNumber: string | null | undefined): string {
  return invoiceNumber && invoiceNumber.trim() ? invoiceNumber : DRAFT_INVOICE_LABEL
}

/** Préfixe d'une série de factures : « F-2026- » (préfixe de l'entreprise, année d'émission). */
export function invoiceSeriesPrefix(companyPrefix: string | null | undefined, issueDate: string): string {
  const prefix = companyPrefix?.trim() || "F"
  return `${prefix}-${issueDate.slice(0, 4)}-`
}

/** Code Postgres d'une valeur nulle refusée (NOT NULL). */
const NOT_NULL_VIOLATION = "23502"

type DbError = { message: string; code?: string }

/**
 * Crée un brouillon de facture sans numéro. Si la base refuse encore un numéro
 * vide (migration pas encore appliquée), le crée numéroté comme avant.
 */
export async function insertDraftInvoice<T>(
  supabase: SupabaseClient,
  opts: {
    userId: string
    companyPrefix: string | null | undefined
    /** Jour de création (heure de Paris), pour l'année du numéro de repli. */
    today: string
    row: Record<string, unknown>
    selectClause?: string
  },
): Promise<{ data: T | null; error: DbError | null; numbered: boolean }> {
  const { userId, companyPrefix, today, row, selectClause = "*" } = opts

  const { data, error } = await supabase
    .from("invoices")
    .insert({ ...row, invoice_number: null })
    .select(selectClause)
    .single()

  if (!error) return { data: data as T, error: null, numbered: false }
  if (error.code !== NOT_NULL_VIOLATION) return { data: null, error, numbered: false }

  // Repli : la colonne est encore NOT NULL, numérotation à la création
  const fallback = await insertWithSequentialNumber<T>(supabase, {
    table: "invoices",
    numberColumn: "invoice_number",
    userId,
    prefix: invoiceSeriesPrefix(companyPrefix, today),
    selectClause,
    buildRow: (invoice_number) => ({ ...row, invoice_number }),
  })
  return { ...fallback, numbered: !fallback.error }
}

/**
 * Dates d'une facture au moment de son émission : datée du jour où elle est
 * émise (242 nonies A, 6°), l'échéance décalée d'autant pour garder le délai
 * de paiement choisi (jamais avant la date d'émission).
 */
export function emissionDates(
  draftIssueDate: string | null | undefined,
  draftDueDate: string | null | undefined,
  today: string,
): { issue_date: string; due_date: string | null } {
  const iso = (v: string | null | undefined) => (v && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null)
  const issue = iso(draftIssueDate)
  const due = iso(draftDueDate)
  const utc = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10))
  const shift = (d: string, days: number) => new Date(utc(d) + days * 86_400_000).toISOString().slice(0, 10)

  if (!due) return { issue_date: today, due_date: null }
  if (!issue) return { issue_date: today, due_date: due < today ? today : due }
  const delay = Math.max(0, Math.round((utc(due) - utc(issue)) / 86_400_000))
  return { issue_date: today, due_date: shift(today, delay) }
}

export interface DraftToIssue {
  status: string
  invoice_number: string | null
  issue_date: string | null
  due_date: string | null
}

/**
 * Émet un brouillon de facture : numéro définitif, statut, date d'émission (et
 * champs `extra`) en une seule écriture, conditionnée à `status = 'draft'`.
 *
 * - Brouillon déjà numéroté (créé avant la migration) : il garde son numéro et
 *   ses dates, seul le statut change (comportement d'avant).
 * - Brouillon sans numéro : prochain numéro de la série de l'année d'émission,
 *   nouvel essai sur conflit d'unicité (23505).
 * - Facture émise entre-temps par une autre requête : renvoyée telle quelle,
 *   sans second numéro.
 */
export async function issueDraftInvoice<T extends { status?: string; invoice_number?: string | null }>(
  supabase: SupabaseClient,
  opts: {
    invoiceId: string
    userId: string
    companyPrefix: string | null | undefined
    draft: DraftToIssue
    /** Statut après émission (« sent »). */
    status: string
    /** Aujourd'hui, heure de Paris. */
    today: string
    extra?: Record<string, unknown>
    selectClause?: string
    maxAttempts?: number
  },
): Promise<{ data: T | null; error: DbError | null; numbered: boolean }> {
  const { invoiceId, userId, companyPrefix, draft, status, today, extra = {}, selectClause = "*", maxAttempts = 5 } = opts

  if (draft.status !== "draft") {
    return { data: null, error: { message: "Cette facture est déjà émise." }, numbered: false }
  }

  // Relit la facture quand l'écriture conditionnelle n'a touché aucune ligne
  // (émise entre-temps par une autre requête)
  const reread = async (): Promise<{ data: T | null; error: DbError | null; numbered: boolean }> => {
    const { data, error } = await supabase
      .from("invoices").select(selectClause).eq("id", invoiceId).eq("user_id", userId).maybeSingle()
    if (error) return { data: null, error, numbered: false }
    const row = data as unknown as T | null
    if (row && row.status !== "draft" && row.invoice_number) return { data: row, error: null, numbered: false }
    return { data: null, error: { message: "La facture n'a pas pu être émise. Réessayez." }, numbered: false }
  }

  // Brouillon numéroté à sa création (avant la migration) : numéro et dates conservés
  if (draft.invoice_number) {
    const { data, error } = await supabase
      .from("invoices")
      .update({ status, ...extra })
      .eq("id", invoiceId)
      .eq("user_id", userId)
      .eq("status", "draft")
      .select(selectClause)
      .maybeSingle()
    if (error) return { data: null, error, numbered: false }
    return data ? { data: data as unknown as T, error: null, numbered: false } : reread()
  }

  const dates = emissionDates(draft.issue_date, draft.due_date, today)
  const prefix = invoiceSeriesPrefix(companyPrefix, dates.issue_date)
  let lastError: DbError | null = null

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let invoice_number: string
    try {
      invoice_number = await getNextDocumentNumber(supabase, "invoices", "invoice_number", userId, prefix)
    } catch (err) {
      const e = err as Partial<DbError> | null
      return { data: null, error: { message: e?.message ?? "Numérotation impossible", code: e?.code }, numbered: false }
    }

    const { data, error } = await supabase
      .from("invoices")
      .update({
        ...extra,
        invoice_number,
        status,
        issue_date: dates.issue_date,
        ...(dates.due_date ? { due_date: dates.due_date } : {}),
      })
      .eq("id", invoiceId)
      .eq("user_id", userId)
      .eq("status", "draft")
      .is("invoice_number", null)
      .select(selectClause)
      .maybeSingle()

    if (!error) return data ? { data: data as unknown as T, error: null, numbered: true } : reread()

    lastError = error
    if (error.code !== UNIQUE_VIOLATION) break // autre erreur : inutile de réessayer
  }

  return { data: null, error: lastError, numbered: false }
}
