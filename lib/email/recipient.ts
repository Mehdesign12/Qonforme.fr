/**
 * Destinataire d'un document envoyé par email (devis, bon de commande). Si le
 * client n'a pas d'adresse, celle tapée dans la fenêtre d'envoi (`{ email }`)
 * est validée puis enregistrée sur sa fiche : l'envoi n'est jamais bloqué par
 * une fiche client incomplète.
 */
import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { normalizeEmail } from "@/lib/pa/delivery"
import { CLIENT_EMAIL_REQUIRED } from "@/lib/email/client-email"

type ClientRef = { id?: string | null; email?: string | null } | null | undefined

export async function resolveRecipient(
  req: Request,
  supabase: SupabaseClient,
  userId: string,
  client: ClientRef,
): Promise<{ email: string } | { response: NextResponse }> {
  if (client?.email) return { email: client.email }
  const body = await req.json().catch(() => null) as { email?: unknown } | null
  const raw = body?.email
  if (raw === undefined || raw === null || raw === "") {
    return { response: NextResponse.json({ error: "Le client n'a pas d'adresse email", code: CLIENT_EMAIL_REQUIRED }, { status: 422 }) }
  }
  const email = normalizeEmail(raw)
  if (!email) return { response: NextResponse.json({ error: "Adresse email invalide" }, { status: 400 }) }
  if (client?.id) {
    const { error } = await supabase.from("clients").update({ email }).eq("id", client.id).eq("user_id", userId)
    if (error) {
      return { response: NextResponse.json({ error: "L'adresse email du client n'a pas pu être enregistrée. Réessayez." }, { status: 500 }) }
    }
  }
  return { email }
}
