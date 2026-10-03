/**
 * POST /api/accountant-access/accept — le comptable connecté accepte
 * l'invitation dont le jeton est dans le cookie posé par le lien de l'email.
 *
 * Refusé si le compte connecté n'est pas à l'adresse invitée, s'il s'agit du
 * compte de l'entreprise elle-même, ou si l'invitation a expiré, a été
 * annulée ou déjà utilisée (lib/accountant/server.ts, acceptInvitation).
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { acceptInvitation } from "@/lib/accountant/server"
import { INVITE_COOKIE } from "@/lib/accountant/types"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Connectez-vous pour accepter l'invitation." }, { status: 401 })

    const token = request.cookies.get(INVITE_COOKIE)?.value
    const result = await acceptInvitation({ token, user: { id: user.id, email: user.email ?? null } })
    const res = result.ok
      ? NextResponse.json({ accessId: result.accessId })
      : NextResponse.json({ error: result.error }, { status: result.status })
    // Jeton consommé, ou invitation qui ne servira plus : le cookie disparaît
    if (result.ok || result.status === 404 || result.status === 410) res.cookies.delete(INVITE_COOKIE)
    res.headers.set("Cache-Control", "no-store")
    return res
  } catch (err) {
    console.error("[accountant-access] accept", err)
    return NextResponse.json({ error: "L'acceptation a échoué. Réessayez dans un instant." }, { status: 500 })
  }
}
