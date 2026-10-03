import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { statusAfterSend } from "@/lib/utils/document-status"
import { sendEmail } from "@/lib/email/resend"
import { buildPurchaseOrderEmail } from "@/lib/email/templates/purchase-order"
import { generatePurchaseOrderPdf } from "@/lib/pdf/purchase-order"
import { markShareLinkSent, shareLinkForEmail } from "@/lib/signature/share"
import { selectCompanyWithProfile } from "@/lib/legal/db"

type Params = { params: Promise<{ id: string }> }

export const maxDuration = 30

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

    const { id } = await params

    // 1. Bon de commande + client
    const { data: po, error: poErr } = await supabase
      .from("purchase_orders")
      .select("*, client:clients(id,name,email,address,zip_code,city,siren,vat_number)")
      .eq("id", id)
      .eq("user_id", user.id)
      .single()
    if (poErr || !po) return NextResponse.json({ error: "Bon de commande introuvable" }, { status: 404 })

    const clientEmail = po.client?.email
    if (!clientEmail) return NextResponse.json({ error: "Le client n'a pas d'adresse email" }, { status: 422 })

    // 2. Données entreprise
    // Profil légal compris (mentions automatiques d'un brouillon), s'il existe déjà en base
    const { data: company } = await selectCompanyWithProfile(supabase, "name,siren,siret,vat_number,address,zip_code,city,iban,legal_notice,accent_color,logo_url,email", user.id)

    const companyName = company?.name?.trim() || user.email?.split("@")[0] || "Votre prestataire"
    const senderEmail = company?.email?.trim() || user.email
    const accentColor = company?.accent_color ?? "#4F46E5"
    const clientName  = po.client?.name ?? ""

    // 3. Générer le PDF (même lib que le téléchargement — logo, SIRET, etc.)
    const pdfBuffer = await generatePurchaseOrderPdf({ po, company })

    // Lien en ligne : signature (formule active) ou consultation (compte gratuit) ;
    // null tant que la migration de la signature n'est pas appliquée
    const share = await shareLinkForEmail(supabase, user.id, "purchase_order", id)

    // 4. Construire et envoyer l'email
    const { subject, html } = buildPurchaseOrderEmail({
      poNumber:     po.po_number,
      issueDate:    po.issue_date,
      deliveryDate: po.delivery_date,
      reference:    po.reference,
      subtotalHt:   po.subtotal_ht,
      totalVat:     po.total_vat,
      totalTtc:     po.total_ttc,
      notes:        po.notes,
      companyName,
      accentColor,
      clientName,
      appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "https://qonforme.fr",
      link: share ? { url: share.url, mode: share.mode } : null,
    })

    const cc        = senderEmail ? [senderEmail] : []
    const ccSubject = `Copie — Bon de commande ${po.po_number} pour ${clientName}`

    await sendEmail({
      to:          clientEmail,
      subject,
      html,
      fromName:    companyName,
      ccSubject,
      replyTo:     senderEmail,
      cc,
      attachments: [{ filename: `${po.po_number}.pdf`, content: pdfBuffer }],
    })

    // 5. Mettre à jour le statut → sent
    await supabase
      .from("purchase_orders")
      .update({ status: statusAfterSend("purchase_order", po.status), sent_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id)

    await markShareLinkSent(share, clientEmail)

    return NextResponse.json({ success: true, sentTo: clientEmail, link: share?.mode ?? null })
  } catch (err) {
    console.error("Purchase order send error:", err)
    const message = err instanceof Error ? err.message : "Erreur inconnue"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
