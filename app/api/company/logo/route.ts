import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// POST /api/company/logo — upload logo vers Supabase Storage
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get("file") as File | null

  if (!file) return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 })

  // Validation type
  if (!["image/png", "image/jpeg", "image/webp", "image/svg+xml"].includes(file.type)) {
    return NextResponse.json({ error: "Format non supporté. Utilisez PNG, JPG, WEBP ou SVG." }, { status: 400 })
  }

  // Validation taille (max 2 MB)
  if (file.size > 2 * 1024 * 1024) {
    return NextResponse.json({ error: "Fichier trop lourd (max 2 Mo)" }, { status: 400 })
  }

  const ext = file.name.split(".").pop() || "png"
  const path = `logos/${user.id}/logo.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const buffer = new Uint8Array(arrayBuffer)

  // Upload dans le bucket "company-assets" (public)
  const { error: uploadError } = await supabase.storage
    .from("company-assets")
    .upload(path, buffer, {
      contentType: file.type,
      upsert: true, // remplace si existe déjà
    })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  // Récupérer l'URL publique
  const { data: { publicUrl } } = supabase.storage
    .from("company-assets")
    .getPublicUrl(path)

  // Sauvegarder l'URL dans la table companies
  const { error: updateError } = await supabase
    .from("companies")
    .update({ logo_url: publicUrl })
    .eq("user_id", user.id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ logo_url: publicUrl })
}

// DELETE /api/company/logo — supprimer le logo
export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  // Supprimer dans storage
  await supabase.storage
    .from("company-assets")
    .remove([`logos/${user.id}/logo.png`, `logos/${user.id}/logo.jpg`, `logos/${user.id}/logo.webp`, `logos/${user.id}/logo.svg`])

  // Effacer l'URL en DB
  await supabase
    .from("companies")
    .update({ logo_url: null })
    .eq("user_id", user.id)

  return NextResponse.json({ success: true })
}
