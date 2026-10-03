import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { canRemindInvoice } from "@/lib/utils/document-status"
import { requireIssuingAccess } from "@/lib/stripe/subscription"
import { sendEmail } from "@/lib/email/resend"
import { buildReminderEmail } from "@/lib/email/templates/reminder"
import { daysBetween, parisDayOf, todayInParis } from "@/lib/utils/paris-date"
import { loadReminderLog, recordManualReminder } from "@/lib/reminders/store"

interface Params { params: Promise<{ id: string }> }

export const maxDuration = 30

/**
 * POST /api/invoices/[id]/remind — relance envoyée à la main par l'artisan.
 *
 * Journal des relances en place (migration 20261003) : la relance est notée au
 * journal, sans limite de nombre, mais jamais deux le même jour (double clic,
 * relance automatique déjà partie). Sans le journal : deux relances au plus,
 * suivies par reminder_1_sent_at / reminder_2_sent_at, comme avant.
 *
 * La relance ne change pas le statut de la facture : le retard se lit sur la
 * date d'échéance (avant, elle passait en « overdue » et sortait des montants
 * du tableau de bord).
 */
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

    // Les relances font partie des formules payantes
    const blocked = await requireIssuingAccess(supabase, user.id)
    if (blocked) return blocked

    const { id } = await params

    // 1. Facture + client (vérifier que la facture appartient à l'utilisateur)
    const { data: invoice, error: invErr } = await supabase
      .from("invoices")
      .select("*, client:clients(id,name,email,siren)")
      .eq("id", id)
      .eq("user_id", user.id)
      .single()

    if (invErr || !invoice) {
      return NextResponse.json({ error: "Facture introuvable" }, { status: 404 })
    }

    // Une relance ne concerne qu'une facture émise et non réglée : jamais un
    // brouillon, une facture payée, créditée ou refusée.
    if (!canRemindInvoice(invoice.status) || !invoice.invoice_number) {
      return NextResponse.json({ error: "Cette facture ne peut pas être relancée dans son état actuel" }, { status: 422 })
    }

    const clientEmail = invoice.client?.email
    if (!clientEmail) {
      return NextResponse.json({ error: "Le client n'a pas d'adresse email" }, { status: 422 })
    }

    // 2. Rang de la relance : journal si disponible, sinon les deux colonnes historiques
    const today = todayInParis()
    const logRes = await loadReminderLog(supabase, "invoice", [id])
    if (logRes.error) {
      return NextResponse.json({ error: "Impossible de vérifier les relances déjà envoyées. Réessayez." }, { status: 503 })
    }
    const useJournal = logRes.available
    const log = logRes.log.get(id) ?? []

    let reminderNumber: number
    if (useJournal) {
      if (log.some((e) => parisDayOf(e.sent_at) === today)) {
        return NextResponse.json({ error: "Une relance est déjà partie aujourd'hui pour cette facture." }, { status: 422 })
      }
      reminderNumber = log.length + 1
    } else {
      reminderNumber = invoice.reminder_1_sent_at ? 2 : 1
      if (reminderNumber === 2 && invoice.reminder_2_sent_at) {
        return NextResponse.json({ error: "Les deux relances ont déjà été envoyées" }, { status: 422 })
      }
    }

    // 3. Entreprise
    const { data: company } = await supabase
      .from("companies")
      .select("name,iban,accent_color,email")
      .eq("user_id", user.id)
      .single()

    const accentColor = company?.accent_color ?? "#2563EB"
    const companyName = company?.name?.trim() || user.email?.split("@")[0] || "Votre prestataire"
    const senderEmail = company?.email?.trim() || user.email

    // 4. Construire et envoyer l'email de relance (rappel si l'échéance n'est pas passée)
    const dueDay = String(invoice.due_date ?? "").slice(0, 10)
    const late = dueDay ? daysBetween(dueDay, today) : 0
    const { subject, html } = buildReminderEmail({
      reminderNumber,
      kind:          late > 0 ? "after_due" : "before_due",
      daysLate:      Math.max(0, late),
      // Sans journal, la 2ᵉ relance est la dernière possible (comme avant) ;
      // avec le journal, l'artisan peut encore relancer : pas de « dernière relance »
      isLast:        !useJournal && reminderNumber === 2,
      invoiceNumber: invoice.invoice_number,
      issueDate:     invoice.issue_date,
      dueDate:       invoice.due_date,
      subtotalHt:    invoice.subtotal_ht,
      totalVat:      invoice.total_vat,
      totalTtc:      invoice.total_ttc,
      companyName,
      companyIban:   company?.iban,
      accentColor,
      clientName:    invoice.client?.name ?? "",
      clientIsProfessional: Boolean(invoice.client?.siren?.trim()),
    })

    await sendEmail({
      to:       clientEmail,
      subject,
      html,
      fromName: companyName,
      replyTo:  senderEmail,
      // Copie à l'émetteur pour traçabilité
      cc:       senderEmail ? [senderEmail] : [],
      ccSubject: `Copie — Relance ${reminderNumber} — Facture ${invoice.invoice_number} pour ${invoice.client?.name ?? ""}`,
    })

    // 5. Noter la relance (le statut de la facture ne change pas)
    const now = new Date().toISOString()
    let updated = invoice
    if (useJournal) {
      const err = await recordManualReminder(supabase, {
        user_id: user.id, document_type: "invoice", document_id: id, sent_to: clientEmail,
      })
      if (err) console.error("[invoice-remind] relance envoyée mais non journalisée :", err.message)
    } else {
      const { data } = await supabase
        .from("invoices")
        .update(reminderNumber === 1 ? { reminder_1_sent_at: now } : { reminder_2_sent_at: now })
        .eq("id", id)
        .eq("user_id", user.id)
        .select()
        .single()
      if (data) updated = { ...invoice, ...data }
    }

    return NextResponse.json({
      success: true,
      reminderNumber,
      sentTo: clientEmail,
      invoice: updated,
      reminder: useJournal ? { stage: "manual", origin: "manual", sent_at: now } : null,
    })
  } catch (err) {
    console.error("Invoice remind error:", err)
    const message = err instanceof Error ? err.message : "Erreur inconnue"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
