/**
 * Gemini AI integration for blog content and cover image generation.
 *
 * - generateBlogPost(): generates a full SEO-optimized blog article in French
 * - generateCoverImage(): generates a blog cover image via Nano Banana 2
 *   (Gemini 3.1 Flash Image) through the generateContent endpoint
 *
 * Requires GEMINI_API_KEY in environment variables.
 */

import { createAdminClient } from "@/lib/supabase/server"
import type { TopicCategory } from "@/lib/ai/seo-topics"

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta"
const TEXT_MODEL = "gemini-2.5-flash"
const IMAGE_MODEL = "gemini-3.1-flash-image-preview"

function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error("GEMINI_API_KEY is not set")
  return key
}

// ── Text generation ──────────────────────────────────────────────────────────

interface BlogPostResult {
  title: string
  slug: string
  excerpt: string
  content: string
  keywords: string[]
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
}

const SYSTEM_PROMPT = `Tu es un expert SEO francophone spécialisé dans la facturation électronique, les TPE et les artisans en France.

Tu rédiges des articles de blog professionnels, informatifs et optimisés pour le référencement Google.

Règles de rédaction :
- Rédige en français courant, accessible, sans jargon inutile
- Titre accrocheur et optimisé SEO (H1)
- Structure avec des H2 et H3 clairs et logiques
- Longueur : entre 1500 et 2500 mots
- Intègre naturellement les mots-clés SEO fournis (sans keyword stuffing)
- Ajoute une section FAQ (3-5 questions/réponses) en fin d'article
- Termine par une conclusion avec un CTA invitant à essayer Qonforme
- Utilise des listes à puces, des exemples concrets, des chiffres quand pertinent
- Ton : professionnel mais accessible, comme un conseiller bienveillant
- Ne mets jamais de H1 dans le contenu (le H1 est le titre de l'article)

Format de sortie OBLIGATOIRE (JSON strict) :
{
  "title": "Titre SEO de l'article",
  "excerpt": "Description meta de 150-160 caractères pour le SEO",
  "content": "Contenu complet en Markdown (commencer directement par l'introduction, pas de H1)",
  "keywords": ["mot-clé 1", "mot-clé 2", "mot-clé 3"]
}

Réponds UNIQUEMENT avec le JSON, sans texte avant ou après.`

export async function generateBlogPost(
  topic: string,
  keywords: string[]
): Promise<BlogPostResult> {
  const apiKey = getApiKey()

  const userPrompt = `Rédige un article de blog complet sur le sujet suivant :

Sujet : ${topic}
Mots-clés SEO à intégrer : ${keywords.join(", ")}

Contexte : Qonforme est un logiciel français de facturation électronique conforme Factur-X / EN 16931, conçu pour les artisans et TPE. Le logiciel permet de créer des factures, devis, avoirs et bons de commande conformes à la réforme 2026.`

  const response = await fetch(
    `${GEMINI_API_URL}/models/${TEXT_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: 0.7,
          topP: 0.9,
          maxOutputTokens: 8192,
          responseMimeType: "application/json",
        },
      }),
    }
  )

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Gemini API error (${response.status}): ${err}`)
  }

  const data = await response.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error("Empty response from Gemini")

  const parsed = JSON.parse(text) as {
    title: string
    excerpt: string
    content: string
    keywords: string[]
  }

  // Append short timestamp suffix to guarantee slug uniqueness across regenerations
  const ts = Date.now().toString(36).slice(-5)

  return {
    title: parsed.title,
    slug: `${slugify(parsed.title)}-${ts}`,
    excerpt: parsed.excerpt,
    content: parsed.content,
    keywords: parsed.keywords || keywords,
  }
}

// ── Image generation (Nano Banana 2 via generateContent) ─────────────────────

/**
 * Visual elements mapped to each topic category for diverse cover images.
 */
const CATEGORY_VISUALS: Record<TopicCategory, string> = {
  "réglementation": "official government documents with stamps and seals, a gavel, legal scales of justice, official certificates with ribbons",
  "tutoriel": "a step-by-step workflow with numbered stages, arrows connecting screens, hands typing on a laptop, a checklist being completed",
  "guide": "an open guidebook with bookmarks, a magnifying glass over documents, organized folders and binders, a compass pointing the way",
  "actualité": "a large wall calendar with dates circled, a clock showing urgency, newspaper headlines, a megaphone announcing news",
  "comparatif": "side-by-side comparison charts, a balance scale weighing two options, bar graphs and pie charts, a podium with rankings",
  "pratique": "artisan tools (wrench, hammer, paintbrush) next to a tablet showing an invoice, a workshop desk with organized paperwork",
  "gestion": "a modern dashboard on a large screen showing graphs and KPIs, rising revenue charts, a CEO desk with analytics reports",
  "comptabilité": "neat stacks of accounting ledgers, a calculator next to organized receipts, spreadsheet columns with green checkmarks",
  "digital": "a cloud connected to multiple devices (phone, tablet, laptop), wireless signals, a futuristic smart office with holograms",
  "cas-usage": "a confident artisan in work clothes standing proudly in a modern workshop, tools and a tablet coexisting on the workbench",
}

export async function generateCoverImage(
  title: string,
  excerpt: string,
  category: TopicCategory = "guide"
): Promise<string> {
  const apiKey = getApiKey()

  const visualElements = CATEGORY_VISUALS[category] || CATEGORY_VISUALS["guide"]

  // Prompt designed to avoid ANY text generation by Imagen
  // - No brand names, no article titles, no hex codes
  // - Triple emphasis on no-text
  // - Full-bleed edge-to-edge instruction
  const imagePrompt = `A photorealistic high-quality blog cover image, 16:9 widescreen format.

Scene: ${visualElements}

Style: Ultra-realistic photograph with cinematic lighting, shallow depth of field, warm natural tones mixed with cool blue accents. The scene feels professional, modern, and aspirational. Think editorial photography for a premium business magazine.

Composition: The subject fills the entire frame edge-to-edge with no empty space, no margins, no borders. Full-bleed composition that extends beyond the canvas edges.

CRITICAL RULES — you MUST follow these strictly:
- ABSOLUTELY NO TEXT anywhere in the image
- NO words, NO letters, NO numbers, NO labels, NO watermarks, NO logos
- NO writing on any surface, document, screen, or sign
- Any documents or screens shown must have abstract blurred content, never readable text
- The image must work as a visual-only banner with zero textual elements`

  const response = await fetch(
    `${GEMINI_API_URL}/models/${IMAGE_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: imagePrompt }] }],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
          imageConfig: {
            aspectRatio: "16:9",
          },
        },
      }),
    }
  )

  if (!response.ok) {
    const err = await response.text()
    console.error(`[gemini] Nano Banana 2 image generation failed (${response.status}): ${err}`)
    return ""
  }

  const data = await response.json()

  // Nano Banana 2 returns parts array: iterate to find inline_data (image)
  const parts = data.candidates?.[0]?.content?.parts
  if (!parts || !Array.isArray(parts)) {
    console.error("[gemini] No parts in Nano Banana 2 response:", JSON.stringify(data).slice(0, 800))
    return ""
  }

  const imagePart = parts.find(
    (p: { inlineData?: { mimeType: string; data: string } }) => p.inlineData?.data
  )

  if (!imagePart?.inlineData) {
    console.error("[gemini] No image data in Nano Banana 2 response parts:", JSON.stringify(parts.map((p: Record<string, unknown>) => Object.keys(p))).slice(0, 500))
    return ""
  }

  const { data: base64Image, mimeType } = imagePart.inlineData as {
    data: string
    mimeType: string
  }
  const ext = mimeType === "image/jpeg" ? "jpg" : "png"

  // Upload to Supabase Storage
  const buffer = Buffer.from(base64Image, "base64")
  const slug = slugify(title)
  const fileName = `${slug}-${Date.now()}.${ext}`

  const supabase = createAdminClient()
  const { error: uploadError } = await supabase.storage
    .from("blog-covers")
    .upload(fileName, buffer, {
      contentType: mimeType,
      upsert: true,
    })

  if (uploadError) {
    console.error("[gemini] Storage upload failed:", uploadError)
    return ""
  }

  const { data: publicUrl } = supabase.storage
    .from("blog-covers")
    .getPublicUrl(fileName)

  return publicUrl.publicUrl
}
