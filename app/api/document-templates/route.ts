import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isMissingSchemaError } from "@/lib/supabase/schema-guard"
import { parseDocumentTemplates } from "@/lib/pdf/theme"

/**
 * Modèles de mise en page des documents (Paramètres › Modèles de documents).
 * GET : { available, templates } — available=false tant que la migration
 * 20261010_document_templates.sql n'est pas appliquée (le choix se masque).
 * PUT : { templates } — modèle par type de document, valeurs inconnues ignorées.
 */
export const dynamic = "force-dynamic"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const { data, error } = await supabase.from("companies").select("document_templates").eq("user_id", user.id).maybeSingle()
  if (error) {
    if (isMissingSchemaError(error)) return NextResponse.json({ available: false, templates: {} })
    return NextResponse.json({ error: "Modèles indisponibles pour le moment." }, { status: 503 })
  }
  return NextResponse.json({ available: true, hasCompany: !!data, templates: parseDocumentTemplates(data?.document_templates) })
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  let body: { templates?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: "Requête invalide" }, { status: 400 }) }
  const templates = parseDocumentTemplates(body.templates)

  const { data, error } = await supabase
    .from("companies").update({ document_templates: templates }).eq("user_id", user.id).select("document_templates")
  if (error) {
    if (isMissingSchemaError(error)) return NextResponse.json({ error: "Les modèles de documents ne sont pas encore activés." }, { status: 503 })
    return NextResponse.json({ error: "Modèle non enregistré. Réessayez dans un instant." }, { status: 500 })
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Renseignez d'abord votre entreprise dans Paramètres › Entreprise." }, { status: 409 })
  }
  return NextResponse.json({ templates: parseDocumentTemplates(data[0].document_templates) })
}
