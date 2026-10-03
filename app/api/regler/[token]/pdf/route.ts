import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { generateInvoicePdf } from "@/lib/pdf/invoice"
import { resolvePaymentToken } from "@/lib/payment-link/server"
import { isTokenShape } from "@/lib/payment-link/token"

/**
 * GET /api/regler/[token]/pdf — PDF de la facture liée au jeton, depuis la page
 * publique de règlement. Même document que le téléchargement de l'artisan
 * (route /api/invoices/[id]/pdf) ; jamais un brouillon, jamais si le lien est
 * désactivé. Aucune autre donnée que cette facture.
 */

export const dynamic = "force-dynamic"
export const maxDuration = 30

const HEADERS = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" }

interface Params { params: Promise<{ token: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { token } = await params
  if (!isTokenShape(token)) return NextResponse.json({ error: "Lien introuvable." }, { status: 404, headers: HEADERS })

  const { data, ctx } = await resolvePaymentToken(token)
  if (data.state === "unavailable") {
    return NextResponse.json({ error: "Service momentanément indisponible." }, { status: 503, headers: HEADERS })
  }
  if (!ctx) return NextResponse.json({ error: "Lien introuvable." }, { status: 404, headers: HEADERS })

  try {
    const db = createAdminClient()
    const { data: invoice, error } = await db
      .from("invoices")
      .select("*, client:clients(id,name,email,address,zip_code,city,siren,vat_number)")
      .eq("id", ctx.invoice.id)
      .eq("user_id", ctx.userId)
      .single()
    if (error || !invoice || invoice.status === "draft") {
      return NextResponse.json({ error: "Lien introuvable." }, { status: 404, headers: HEADERS })
    }
    const pdf = await generateInvoicePdf({ invoice, company: ctx.company })
    const filename = String(invoice.invoice_number).replace(/[^A-Za-z0-9._-]/g, "_")
    return new Response(pdf.buffer as ArrayBuffer, {
      status: 200,
      headers: {
        ...HEADERS,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}.pdf"`,
      },
    })
  } catch (err) {
    console.error("[regler] pdf", err)
    return NextResponse.json({ error: "Le PDF n'a pas pu être généré." }, { status: 500, headers: HEADERS })
  }
}
