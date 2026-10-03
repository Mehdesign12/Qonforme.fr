/**
 * Lien ajouté à l'envoi classique d'un devis ou d'un bon de commande
 * (POST /api/quotes/[id]/send, /api/purchase-orders/[id]/send) :
 * - formule Essentiel ou Artisan, signature activée : lien « Consulter et signer » ;
 * - sinon : lien de consultation (DECISIONS § 12, point 4 : « le devis part par
 *   email avec le PDF et un lien de consultation »).
 *
 * Ne bloque jamais l'envoi : migration absente, erreur ou devis expiré → pas
 * de lien (ou un lien de consultation), l'email part comme avant.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { createAdminClient } from "@/lib/supabase/server"
import { hasSignatureAccess } from "@/lib/signature/access"
import { canCreateLink, linkExpiry } from "@/lib/signature/rules"
import { ensureLink, getSignatureSettings, linkUrl, loadDocument, recordEvent } from "@/lib/signature/server"
import type { SignatureDocType, SignatureMode, SignatureRow } from "@/lib/signature/types"

export interface EmailShareLink {
  url: string
  mode: SignatureMode
  row: SignatureRow
}

export async function shareLinkForEmail(
  supabase: SupabaseClient,
  userId: string,
  type: SignatureDocType,
  documentId: string,
): Promise<EmailShareLink | null> {
  try {
    const admin = createAdminClient()
    const { available, settings } = await getSignatureSettings(admin, userId)
    if (!available) return null
    const doc = await loadDocument(admin, type, documentId, userId)
    if (!doc) return null

    let mode: SignatureMode = settings.enabled && (await hasSignatureAccess(supabase, userId)) === true ? "sign" : "view"
    if (mode === "sign") {
      const signable = canCreateLink(type, doc.status, "sign")
        && linkExpiry({ docType: type, mode: "sign", validUntil: doc.valid_until, linkValidityDays: settings.link_validity_days, now: new Date() })
      if (!signable) mode = "view"
    }
    const { row, token } = await ensureLink(admin, { doc, mode, settings })
    // Un lien de signature repris pour un document qui n'est plus signable (accepté, expiré…)
    // s'annonce comme une simple consultation : la page ne proposera pas de signer
    return { url: linkUrl(token), mode: mode === "view" ? "view" : row.mode, row }
  } catch (err) {
    console.error("[signature] lien pour l'email :", err)
    return null
  }
}

/** Après l'envoi de l'email : date d'envoi et journal du lien. */
export async function markShareLinkSent(link: EmailShareLink | null, to: string): Promise<void> {
  if (!link) return
  try {
    const admin = createAdminClient()
    await admin.from("document_signatures").update({ sent_at: new Date().toISOString(), sent_to: to }).eq("id", link.row.id)
    await recordEvent(admin, link.row, "sent", {}, { to, with: "document_email" })
  } catch (err) {
    console.error("[signature] envoi du lien :", err)
  }
}
