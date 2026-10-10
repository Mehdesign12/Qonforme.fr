/**
 * PDF d'un lien de signature, pour le client (page publique) et pour l'artisan :
 * - signé : l'exemplaire conservé dans le stockage privé au moment de la
 *   signature ; à défaut (stockage indisponible), il est reconstruit à partir
 *   du dossier de preuve enregistré en base ;
 *   Un document signé puis rétracté garde son exemplaire signé (preuve).
 * - pas encore signé : le PDF actuel du document.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { decodeSignaturePng } from "@/lib/signature/crypto"
import { buildSignedPdf } from "@/lib/signature/pdf"
import { maskEmail } from "@/lib/signature/rules"
import { generateDocumentPdf, listEvents, loadCompany, loadDocument, pdfFilename, readPdf } from "@/lib/signature/server"
import type { SignatureRow } from "@/lib/signature/types"

export async function pdfForLink(admin: SupabaseClient, row: SignatureRow): Promise<{ bytes: Uint8Array; filename: string } | null> {
  const wasSigned = row.status === "signed" || row.status === "withdrawn"
  if (wasSigned) {
    const stored = await readPdf(admin, row.signed_pdf_path)
    if (stored) return { bytes: stored, filename: pdfFilename(row.document_number, true) }
  }

  const [doc, company] = await Promise.all([
    loadDocument(admin, row.document_type, row.document_id, row.user_id),
    loadCompany(admin, row.user_id),
  ])
  if (!doc) return null
  const original = await generateDocumentPdf(doc, company)
  if (!wasSigned || !row.signed_at || !row.signer_name || !row.signer_email || !row.signature_method) {
    return { bytes: original, filename: pdfFilename(doc.number, false) }
  }

  const consents = (row.consents ?? {}) as Record<string, unknown>
  const bytes = await buildSignedPdf({
    original,
    docLabel: row.document_type === "quote" ? "Devis" : "Bon de commande",
    docNumber: row.document_number,
    companyName: company?.name?.trim() || "L'entreprise",
    version: row.version,
    totalTtc: doc.total_ttc,
    contentSha256: row.content_sha256,
    documentSha256: row.document_sha256 ?? "",
    signer: { name: row.signer_name, email: row.signer_email, role: row.signer_role, company: row.signer_company },
    clientOrderNumber: row.client_order_number,
    clientKind: row.client_kind,
    method: row.signature_method,
    imagePng: decodeSignaturePng(row.signature_image),
    typedName: typeof consents.typed_name === "string" ? consents.typed_name : row.signer_name,
    context: row.signature_context ?? "distance",
    consents: row.consents ?? {},
    reducedVatText: typeof consents.reduced_vat_text === "string" ? consents.reduced_vat_text : null,
    signedAt: new Date(row.signed_at),
    ip: row.signer_ip,
    userAgent: row.signer_user_agent,
    code: row.code_verified_at ? { verifiedAt: new Date(row.code_verified_at), sentTo: maskEmail(row.code_sent_to) } : null,
    events: await listEvents(admin, row.id),
  })
  return { bytes, filename: pdfFilename(row.document_number, true) }
}

export function pdfResponse(file: { bytes: Uint8Array; filename: string }, inline = false): Response {
  return new Response(Buffer.from(file.bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${file.filename}"`,
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  })
}
