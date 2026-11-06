/**
 * « Corriger ce devis » : nouvelle version d'un devis déjà envoyé.
 *
 * Un devis envoyé ne se modifie pas (lib/utils/document-status.ts) : le client a
 * reçu une version précise, peut-être signée en ligne. Pour le corriger, on crée
 * une nouvelle version en brouillon, liée à l'ancienne (`revises_quote_id`).
 * L'ancien devis reste valable tant que la correction n'est pas partie : à son
 * envoi (email, « Marquer comme envoyé » ou lien de signature), il passe en
 * « superseded » (Remplacé) et son lien de signature est fermé.
 *
 * Migration : supabase/migrations/20261106_quote_revisions.sql. Sans elle, la
 * correction répond qu'elle n'est pas encore activée ; rien d'autre ne change.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { isMissingSchemaError } from "@/lib/supabase/schema-guard"

export const REVISION_UNAVAILABLE = "La correction des devis n'est pas encore activée. Dupliquez le devis en attendant."

type QuoteLike = {
  status: string
  converted_invoice_id?: string | null
  superseded_by_quote_id?: string | null
}

/** Seul un devis envoyé, sans réponse et pas encore facturé, se corrige. */
export function canReviseQuote(q: QuoteLike): boolean {
  return q.status === "sent" && !q.converted_invoice_id && !q.superseded_by_quote_id
}

/** Raison lisible du refus de corriger (null si la correction est possible). */
export function reviseRefusal(q: QuoteLike): string | null {
  if (canReviseQuote(q)) return null
  if (q.superseded_by_quote_id || q.status === "superseded") return "Ce devis a déjà été remplacé par une nouvelle version."
  if (q.status === "draft") return "Ce devis est encore un brouillon : modifiez-le directement."
  if (q.converted_invoice_id) return "Ce devis a déjà été converti en facture : il ne se corrige plus."
  if (q.status === "accepted") return "Ce devis a été accepté par votre client : il vaut commande et ne se corrige plus. Pour un changement, faites un nouveau devis (Dupliquer)."
  return "Ce devis ne peut plus être corrigé. Dupliquez-le pour proposer une nouvelle version."
}

/** Devis d'origine encore « envoyé » : la correction peut le remplacer à son envoi. */
export type OriginCheck =
  | { kind: "none" }                         // devis ordinaire, ou origine supprimée
  | { kind: "replace"; id: string; number: string }
  | { kind: "detached"; number: string }     // origine refusée ou rétractée : la correction part seule
  | { kind: "blocked"; message: string }     // origine acceptée entre-temps

/** Décision pure à partir du devis d'origine relu au moment de l'envoi. */
export function originDecision(origin: { id: string; quote_number: string; status: string; converted_invoice_id?: string | null } | null): OriginCheck {
  if (!origin) return { kind: "none" }
  if (origin.status === "sent" && !origin.converted_invoice_id) return { kind: "replace", id: origin.id, number: origin.quote_number }
  if (origin.status === "accepted" || origin.converted_invoice_id) {
    return {
      kind: "blocked",
      message: `Le devis ${origin.quote_number} a été accepté par votre client entre-temps : cette correction ne peut plus le remplacer. Supprimez-la, ou faites un nouveau devis si votre client le demande.`,
    }
  }
  return { kind: "detached", number: origin.quote_number }
}

/**
 * Lit le devis d'origine d'une correction en brouillon. `null` : devis ordinaire
 * (ou colonne absente : migration pas encore appliquée).
 */
export async function checkRevisionOrigin(
  supabase: SupabaseClient,
  userId: string,
  quote: { status: string; revises_quote_id?: string | null },
): Promise<OriginCheck> {
  if (quote.status !== "draft" || !quote.revises_quote_id) return { kind: "none" }
  const { data, error } = await supabase
    .from("quotes")
    .select("id, quote_number, status, converted_invoice_id")
    .eq("id", quote.revises_quote_id)
    .eq("user_id", userId)
    .maybeSingle()
  if (error) {
    if (!isMissingSchemaError(error)) console.error("[quote-revision] devis d'origine illisible :", error.message)
    return { kind: "none" }
  }
  return originDecision(data as never)
}

/** Même lecture à partir de l'identifiant du devis (partage d'un lien de signature). */
export async function checkRevisionOriginById(supabase: SupabaseClient, userId: string, quoteId: string): Promise<OriginCheck> {
  const { data, error } = await supabase.from("quotes").select("*").eq("id", quoteId).eq("user_id", userId).maybeSingle()
  if (error || !data) return { kind: "none" }
  return checkRevisionOrigin(supabase, userId, data as { status: string; revises_quote_id?: string | null })
}

/**
 * La correction vient de partir : l'ancien devis passe en « Remplacé » (s'il est
 * toujours « envoyé ») et ses liens de signature actifs sont fermés. Ne lève jamais :
 * la correction est déjà chez le client, un échec ici est seulement journalisé.
 */
export async function finalizeRevision(
  supabase: SupabaseClient,
  admin: SupabaseClient | null,
  userId: string,
  newQuoteId: string,
  origin: OriginCheck,
): Promise<boolean> {
  if (origin.kind !== "replace") return false
  try {
    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from("quotes")
      .update({ status: "superseded", superseded_by_quote_id: newQuoteId, superseded_at: now, updated_at: now })
      .eq("id", origin.id)
      .eq("user_id", userId)
      .eq("status", "sent")
      .select("id")
    if (error) {
      console.error("[quote-revision] ancien devis non remplacé :", error.message)
      return false
    }
    if (!data?.length) return false
    if (admin) {
      const { error: sigError } = await admin
        .from("document_signatures")
        .update({ status: "superseded", superseded_at: now })
        .eq("user_id", userId)
        .eq("document_type", "quote")
        .eq("document_id", origin.id)
        .eq("status", "pending")
      if (sigError && !isMissingSchemaError(sigError)) console.error("[quote-revision] lien de signature non fermé :", sigError.message)
    }
    return true
  } catch (err) {
    console.error("[quote-revision] remplacement :", err)
    return false
  }
}
