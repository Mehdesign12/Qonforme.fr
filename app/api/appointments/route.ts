/**
 * Planning : rendez-vous de l'artisan (visite, chantier, livraison).
 *
 * GET  : rendez-vous qui chevauchent la fenêtre `from`–`to` (instants ISO,
 *        7 à 62 jours au plus) ; `available: false` tant que la migration
 *        20261021_planning_appointments.sql n'est pas appliquée.
 * POST : crée un rendez-vous (date, heure et durée à l'heure de Paris).
 *
 * Ouvert à tous les comptes, gratuits compris : aucun mur de paiement.
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isMissingSchemaError } from "@/lib/supabase/schema-guard"
import { ownsClient } from "@/lib/artisan/server"
import { APPOINTMENT_COLUMNS, appointmentFromRow, parseAppointmentInput, parisToIso, weekStart } from "@/lib/planning/appointments"
import { addDays, todayInParis } from "@/lib/utils/paris-date"

export const dynamic = "force-dynamic"

const MAX_RANGE_MS = 62 * 86_400_000

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const today = todayInParis()
  const params = request.nextUrl.searchParams
  const monday = weekStart(today)
  const from = params.get("from") ?? parisToIso(monday, "00:00")
  const to = params.get("to") ?? parisToIso(addDays(monday, 7), "00:00")
  const fromMs = Date.parse(from)
  const toMs = Date.parse(to)
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs <= fromMs || toMs - fromMs > MAX_RANGE_MS) {
    return NextResponse.json({ error: "Période invalide." }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("appointments")
    .select(APPOINTMENT_COLUMNS)
    .eq("user_id", user.id)
    .lt("starts_at", new Date(toMs).toISOString())
    .gt("ends_at", new Date(fromMs).toISOString())
    .order("starts_at", { ascending: true })
    .limit(500)
  if (error) {
    if (isMissingSchemaError(error)) return NextResponse.json({ available: false, today, appointments: [] })
    console.error("[planning] liste :", error.message)
    return NextResponse.json({ error: "Impossible de charger le planning." }, { status: 500 })
  }
  return NextResponse.json(
    { available: true, today, appointments: (data ?? []).map((r) => appointmentFromRow(r as unknown as Record<string, unknown>)) },
    { headers: { "Cache-Control": "no-store" } },
  )
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const parsed = parseAppointmentInput(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  if (parsed.value.client_id && !(await ownsClient(supabase, user.id, parsed.value.client_id))) {
    return NextResponse.json({ error: "Client introuvable" }, { status: 404 })
  }

  const { data, error } = await supabase
    .from("appointments")
    .insert({ ...parsed.value, user_id: user.id })
    .select(APPOINTMENT_COLUMNS)
    .single()
  if (error) {
    if (isMissingSchemaError(error)) return NextResponse.json({ error: "Le planning n'est pas encore activé." }, { status: 503 })
    if (error.code === "23503") return NextResponse.json({ error: "Client ou chantier introuvable." }, { status: 404 })
    console.error("[planning] création :", error.message)
    return NextResponse.json({ error: "Le rendez-vous n'a pas pu être créé. Réessayez." }, { status: 500 })
  }
  return NextResponse.json({ appointment: appointmentFromRow(data as unknown as Record<string, unknown>) }, { status: 201 })
}
