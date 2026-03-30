/**
 * Admin API pour les campagnes outreach
 *
 * GET  /api/admin/outreach          — liste des campagnes
 * POST /api/admin/outreach          — créer une campagne
 * PUT  /api/admin/outreach          — mettre à jour le statut (pause/reprendre)
 */

import { NextRequest, NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { createAdminClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  const supabase = createAdminClient()
  const { data: campaigns, error } = await supabase
    .from("campaigns")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ campaigns })
}

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  const body = await request.json()
  const { nom, type, metier_cible, departements, template_id, date_envoi } = body as {
    nom: string
    type: string
    metier_cible?: string
    departements?: string[]
    template_id: string
    date_envoi?: string
  }

  if (!nom || !type || !template_id) {
    return NextResponse.json({ error: "Champs obligatoires : nom, type, template_id" }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("campaigns")
    .insert({
      nom,
      type,
      metier_cible: metier_cible || null,
      departements: departements || null,
      template_id,
      statut: date_envoi ? "planifiee" : "brouillon",
      date_envoi: date_envoi || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, campaign: data })
}

export async function PUT(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  const body = await request.json()
  const { id, statut } = body as { id: string; statut: string }

  if (!id || !statut) {
    return NextResponse.json({ error: "Champs obligatoires : id, statut" }, { status: 400 })
  }

  const supabase = createAdminClient()

  const updates: Record<string, unknown> = { statut }
  // Si on lance la campagne, enregistrer la date d'envoi
  if (statut === "en_cours") {
    updates.date_envoi = new Date().toISOString()
  }

  const { error } = await supabase
    .from("campaigns")
    .update(updates)
    .eq("id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
