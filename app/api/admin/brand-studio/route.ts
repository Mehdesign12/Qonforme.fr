/**
 * POST /api/admin/brand-studio
 *   - action: "analyze" — analyze an uploaded image (base64)
 *   - action: "generate" — generate a branded image from analysis (persists metadata)
 *
 * GET /api/admin/brand-studio
 *   - Gallery: returns images with metadata from brand_studio_generations
 *
 * DELETE /api/admin/brand-studio?name=brand-xxx.jpg
 *   - Delete an image from storage + metadata from DB
 */

import { NextRequest, NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { createAdminClient } from "@/lib/supabase/server"
import {
  analyzeInspirationImage,
  generateBrandedImage,
  fetchBrandGuidelines,
  type ImageAnalysis,
} from "@/lib/ai/gemini"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 120

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  const body = await request.json()
  const { action } = body

  // ── Analyze inspiration image ──────────────────────────────────────
  if (action === "analyze") {
    const { image, mimeType } = body as {
      image: string
      mimeType: string
    }

    if (!image || !mimeType) {
      return NextResponse.json(
        { error: "Image et mimeType requis" },
        { status: 400 }
      )
    }

    try {
      const analysis = await analyzeInspirationImage(image, mimeType)
      return NextResponse.json({ analysis })
    } catch (err) {
      console.error("[brand-studio] Analyze error:", err)
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Erreur lors de l'analyse" },
        { status: 500 }
      )
    }
  }

  // ── Generate branded image ─────────────────────────────────────────
  if (action === "generate") {
    const { analysis, instructions, aspectRatio } = body as {
      analysis: ImageAnalysis
      instructions?: string
      aspectRatio?: "1:1" | "16:9" | "9:16" | "4:3" | "3:4"
    }

    if (!analysis) {
      return NextResponse.json(
        { error: "Analyse requise" },
        { status: 400 }
      )
    }

    try {
      // Fetch dynamic brand guidelines from DB
      const brandGuidelines = await fetchBrandGuidelines()

      const result = await generateBrandedImage(
        analysis,
        instructions || "",
        aspectRatio || "16:9",
        brandGuidelines
      )

      // Persist metadata in brand_studio_generations
      if (result.url) {
        const supabase = createAdminClient()
        const fileName = result.url.split("/").pop() || ""
        await supabase.from("brand_studio_generations").insert({
          file_name: fileName,
          url: result.url,
          aspect_ratio: aspectRatio || "16:9",
          instructions: instructions?.trim() || null,
          analysis,
        }).then(({ error }) => {
          if (error) console.error("[brand-studio] Metadata insert error:", error)
        })
      }

      return NextResponse.json({
        url: result.url,
        mimeType: result.mimeType,
        ...(result.url ? {} : { base64: result.base64 }),
      })
    } catch (err) {
      console.error("[brand-studio] Generate error:", err)
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Erreur lors de la génération" },
        { status: 500 }
      )
    }
  }

  return NextResponse.json({ error: "Action inconnue" }, { status: 400 })
}

// ── GET: Gallery with metadata ─────────────────────────────────────────

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()

    // Try to get from metadata table first (richer data)
    const { data: generations, error: dbError } = await supabase
      .from("brand_studio_generations")
      .select("id, file_name, url, aspect_ratio, instructions, analysis, created_at")
      .order("created_at", { ascending: false })
      .limit(50)

    if (!dbError && generations && generations.length > 0) {
      return NextResponse.json({ images: generations })
    }

    // Fallback: list from storage bucket (for images created before metadata table)
    const { data: files, error } = await supabase.storage
      .from("brand-studio")
      .list("", { limit: 50, sortBy: { column: "created_at", order: "desc" } })

    if (error) {
      console.error("[brand-studio] Gallery list error:", error)
      return NextResponse.json({ images: [] })
    }

    const images = (files || [])
      .filter((f) => f.name.match(/\.(jpg|jpeg|png|webp)$/i))
      .map((f) => {
        const { data: urlData } = supabase.storage
          .from("brand-studio")
          .getPublicUrl(f.name)
        return {
          id: null,
          file_name: f.name,
          url: urlData.publicUrl,
          aspect_ratio: null,
          instructions: null,
          analysis: null,
          created_at: f.created_at,
        }
      })

    return NextResponse.json({ images })
  } catch {
    return NextResponse.json({ images: [] })
  }
}

// ── DELETE: Remove image from storage + metadata ───────────────────────

export async function DELETE(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  const fileName = request.nextUrl.searchParams.get("name")
  if (!fileName) {
    return NextResponse.json({ error: "Paramètre 'name' requis" }, { status: 400 })
  }

  try {
    const supabase = createAdminClient()

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from("brand-studio")
      .remove([fileName])

    if (storageError) {
      console.error("[brand-studio] Storage delete error:", storageError)
    }

    // Delete from metadata table
    const { error: dbError } = await supabase
      .from("brand_studio_generations")
      .delete()
      .eq("file_name", fileName)

    if (dbError) {
      console.error("[brand-studio] Metadata delete error:", dbError)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[brand-studio] Delete error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur lors de la suppression" },
      { status: 500 }
    )
  }
}
