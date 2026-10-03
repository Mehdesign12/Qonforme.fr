/**
 * POST /api/accountant-access/[id]/resend — renvoie une invitation en attente
 * ou expirée : nouveau lien valable 7 jours, l'ancien cesse de fonctionner.
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { resendInvitation } from "@/lib/accountant/server"

export const dynamic = "force-dynamic"

interface Params { params: Promise<{ id: string }> }

export async function POST(_request: NextRequest, { params }: Params) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    const { id } = await params
    const meta = user.user_metadata ?? {}
    const name = [meta.first_name, meta.last_name].filter((v) => typeof v === "string" && v.trim()).join(" ").trim()
    const result = await resendInvitation({ owner: { id: user.id, email: user.email ?? null, name: name || null }, accessId: id })
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json({ access: result.access })
  } catch (err) {
    console.error("[accountant-access] resend", err)
    return NextResponse.json({ error: "L'invitation n'a pas pu être renvoyée. Réessayez." }, { status: 500 })
  }
}
