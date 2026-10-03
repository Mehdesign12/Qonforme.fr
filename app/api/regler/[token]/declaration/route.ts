import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { isMissingSchemaError } from "@/lib/supabase/schema-guard"
import { sendEmail } from "@/lib/email/resend"
import { buildTransferDeclaredEmail } from "@/lib/email/templates/transfer-declared"
import { todayParis } from "@/components/search/model"
import { DECLARATIONS_TABLE, resolvePaymentToken } from "@/lib/payment-link/server"
import { DECLARATIONS_PER_DAY, parseDeclaration } from "@/lib/payment-link/rules"
import { isTokenShape } from "@/lib/payment-link/token"

/**
 * POST /api/regler/[token]/declaration — « J'ai effectué le virement », depuis
 * la page publique de règlement (sans connexion, accès par jeton seulement).
 *
 * Garde-fous : jeton de 256 bits vérifié par son empreinte, facture émise et
 * non réglée, une seule déclaration ouverte à la fois (index unique partiel en
 * base), trois au plus par facture sur 24 heures, entrées contrôlées
 * (lib/payment-link/rules.ts), corps limité à 4 Ko. Rien n'est marqué payé :
 * l'artisan est prévenu par email et confirme lui-même à réception.
 */

export const dynamic = "force-dynamic"

const HEADERS = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" }
const MAX_BODY = 4096

const fail = (status: number, error: string, field?: string) =>
  NextResponse.json(field ? { error, field } : { error }, { status, headers: HEADERS })

interface Params { params: Promise<{ token: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const { token } = await params
  if (!isTokenShape(token)) return fail(404, "Lien introuvable.")

  const raw = await request.text()
  if (raw.length > MAX_BODY) return fail(413, "Demande trop volumineuse.")
  let body: unknown
  try { body = JSON.parse(raw) } catch { return fail(400, "Demande invalide.") }

  const { data, ctx } = await resolvePaymentToken(token)
  if (data.state === "unavailable") return fail(503, "Service momentanément indisponible, réessayez dans un instant.")
  if (data.state === "not_found") return fail(404, "Lien introuvable.")
  if (data.state === "disabled") return fail(410, "Ce lien de paiement a été désactivé.")
  if (data.state !== "payable" || !ctx) return fail(409, "Cette facture n'est plus à régler.")
  if (data.declaration) {
    return fail(409, "Un virement est déjà déclaré pour cette facture. L'entreprise a été prévenue.")
  }

  const parsed = parseDeclaration(body, { today: todayParis(), issueDate: ctx.invoice.issue_date, remaining: ctx.remaining })
  if (!parsed.ok) return fail(400, parsed.error, parsed.field)

  const db = createAdminClient()
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  const { count, error: countErr } = await db
    .from(DECLARATIONS_TABLE)
    .select("id", { count: "exact", head: true })
    .eq("invoice_id", ctx.invoice.id)
    .gte("created_at", since)
  if (countErr) {
    if (isMissingSchemaError(countErr)) return fail(404, "Lien introuvable.")
    console.error("[regler] count", countErr)
    return fail(503, "Service momentanément indisponible, réessayez dans un instant.")
  }
  if ((count ?? 0) >= DECLARATIONS_PER_DAY) {
    return fail(429, "Trop de déclarations pour cette facture aujourd'hui. Réessayez demain.")
  }

  const { value } = parsed
  const { data: inserted, error } = await db
    .from(DECLARATIONS_TABLE)
    .insert({
      invoice_id: ctx.invoice.id,
      user_id: ctx.userId,
      link_id: ctx.linkId,
      transfer_date: value.transferDate,
      amount: value.amount,
      note: value.note,
      status: "open",
    })
    .select("transfer_date, amount, created_at")
    .single()
  if (error || !inserted) {
    // Index unique partiel : une autre déclaration vient d'être ouverte
    if (error?.code === "23505") return fail(409, "Un virement est déjà déclaré pour cette facture. L'entreprise a été prévenue.")
    console.error("[regler] insert", error)
    return fail(503, "Service momentanément indisponible, réessayez dans un instant.")
  }

  // Prévenir l'artisan. Un échec d'envoi n'annule pas la déclaration : elle
  // apparaît de toute façon sur la fiche facture et dans « À surveiller ».
  try {
    const company = ctx.company
    let to = typeof company?.email === "string" && company.email.trim() ? company.email.trim() : null
    if (!to) {
      const { data: owner } = await db.auth.admin.getUserById(ctx.userId)
      to = owner?.user?.email ?? null
    }
    if (to) {
      const { data: client } = ctx.invoice.client_id
        ? await db.from("clients").select("name").eq("id", ctx.invoice.client_id as string).eq("user_id", ctx.userId).maybeSingle()
        : { data: null }
      const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://qonforme.fr").replace(/\/+$/, "")
      const { subject, html } = buildTransferDeclaredEmail({
        invoiceNumber: ctx.invoice.invoice_number,
        clientName: (client?.name as string | undefined) ?? null,
        amount: value.amount,
        transferDate: value.transferDate,
        note: value.note,
        invoiceUrl: `${appUrl}/invoices/${ctx.invoice.id}`,
      })
      await sendEmail({ to, subject, html, fromName: "Qonforme" })
    }
  } catch (err) {
    console.error("[regler] email artisan", err)
  }

  return NextResponse.json(
    { declaration: { transferDate: String(inserted.transfer_date), amount: Number(inserted.amount), declaredAt: String(inserted.created_at) } },
    { status: 201, headers: HEADERS },
  )
}
