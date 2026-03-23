/**
 * POST /api/admin/brand-studio
 *
 * Brand Studio API — analyze inspiration image and generate branded version.
 * Auth: Admin cookie (isAdminAuthenticated)
 *
 * Actions:
 * - action: "analyze" — analyze an uploaded image (base64)
 * - action: "generate" — generate a branded image from analysis
 * - action: "gallery" — list previously generated images
 */

import { NextRequest, NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { createAdminClient } from "@/lib/supabase/server"
import {
  analyzeInspirationImage,
  generateBrandedImage,
  type ImageAnalysis,
} from "@/lib/ai/gemini"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Max body size: 10MB for image uploads
export const maxDuration = 120

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  const body = await request.json()
  const { action } = body

  // ── Analyze inspiration image ──────────────────────────────────────────────
  if (action === "analyze") {
    const { image, mimeType } = body as {
      image: string      // base64
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

  // ── Generate branded image ─────────────────────────────────────────────────
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
      const result = await generateBrandedImage(
        analysis,
        instructions || "",
        aspectRatio || "16:9"
      )
      return NextResponse.json({
        url: result.url,
        mimeType: result.mimeType,
        // Only send base64 if URL is empty (upload failed)
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

// ── GET: Gallery of generated images ────────────────────────────────────────

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()
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
          name: f.name,
          url: urlData.publicUrl,
          created_at: f.created_at,
        }
      })

    return NextResponse.json({ images })
  } catch {
    return NextResponse.json({ images: [] })
  }
}
