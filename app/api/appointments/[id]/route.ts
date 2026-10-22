/**
 * Un rendez-vous : modification (contenu, ou seulement l'état : fait, annulé,
 * à nouveau prévu) et suppression. Toujours limité aux rendez-vous du compte.
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isMissingSchemaError } from "@/lib/supabase/schema-guard"
import { ownsClient } from "@/lib/artisan/server"
import { APPOINTMENT_COLUMNS, appointmentFromRow, parseAppointmentInput, parseStatus } from "@/lib/planning/appointments"

export const dynamic = "force-dynamic"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { id } = await params
  if (!UUID.test(id)) return NextResponse.json({ error: "Rendez-vous introuvable" }, { status: 404 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  let update: Record<string, unknown>
  // Changement d'état seul
  if (body.status !== undefined && body.title === undefined) {
    const status = parseStatus(body.status)
    if (!status) return NextResponse.json({ error: "État inconnu." }, { status: 400 })
    update = { status }
  } else {
    const parsed = parseAppointmentInput(body)
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
    if (parsed.value.client_id && !(await ownsClient(supabase, user.id, parsed.value.client_id))) {
      return NextResponse.json({ error: "Client introuvable" }, { status: 404 })
    }
    update = { ...parsed.value }
    if (body.status !== undefined) {
      const status = parseStatus(body.status)
      if (!status) return NextResponse.json({ error: "État inconnu." }, { status: 400 })
      update.status = status
    }
  }

  const { data, error } = await supabase
    .from("appointments")
    .update(update)
    .eq("id", id)
    .eq("user_id", user.id)
    .select(APPOINTMENT_COLUMNS)
    .maybeSingle()
  if (error) {
    if (isMissingSchemaError(error)) return NextResponse.json({ error: "Le planning n'est pas encore activé." }, { status: 503 })
    if (error.code === "23503") return NextResponse.json({ error: "Client ou chantier introuvable." }, { status: 404 })
    console.error("[planning] modification :", error.message)
    return NextResponse.json({ error: "Le rendez-vous n'a pas pu être modifié. Réessayez." }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: "Rendez-vous introuvable" }, { status: 404 })
  return NextResponse.json({ appointment: appointmentFromRow(data as unknown as Record<string, unknown>) })
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const { id } = await params
  if (!UUID.test(id)) return NextResponse.json({ error: "Rendez-vous introuvable" }, { status: 404 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const { data, error } = await supabase.from("appointments").delete().eq("id", id).eq("user_id", user.id).select("id")
  if (error) {
    if (isMissingSchemaError(error)) return NextResponse.json({ error: "Le planning n'est pas encore activé." }, { status: 503 })
    console.error("[planning] suppression :", error.message)
    return NextResponse.json({ error: "Le rendez-vous n'a pas pu être supprimé. Réessayez." }, { status: 500 })
  }
  if (!data || data.length === 0) return NextResponse.json({ error: "Rendez-vous introuvable" }, { status: 404 })
  return NextResponse.json({ ok: true })
}
