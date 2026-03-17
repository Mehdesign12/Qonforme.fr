/**
 * Gemini AI integration for blog content and cover image generation.
 *
 * - generateBlogPost(): generates a full SEO-optimized blog article in French
 * - generateCoverImage(): generates a blog cover image via Gemini Imagen
 *
 * Requires GEMINI_API_KEY in environment variables.
 */

import { createAdminClient } from "@/lib/supabase/server"

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta"
const TEXT_MODEL = "gemini-2.5-flash"
const IMAGE_MODEL = "imagen-4.0-generate-001"

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

  return {
    title: parsed.title,
    slug: slugify(parsed.title),
    excerpt: parsed.excerpt,
    content: parsed.content,
    keywords: parsed.keywords || keywords,
  }
}

// ── Image generation ─────────────────────────────────────────────────────────

export async function generateCoverImage(
  title: string,
  excerpt: string
): Promise<string> {
  const apiKey = getApiKey()

  const imagePrompt = `High-quality professional blog cover illustration for a French SaaS invoicing platform called "Qonforme".

Article: "${title}" — ${excerpt}

Style requirements:
- Clean, modern flat illustration or isometric design
- Primary color: royal blue (#2563EB) with white and light gray accents
- Professional business atmosphere: digital documents, invoices, charts, or artisan tools
- Subtle tech elements: clean UI mockups, data visualization, cloud icons
- Soft gradients and rounded shapes, no harsh edges
- Photorealistic lighting on flat/isometric elements for depth
- No text, no letters, no watermarks on the image
- 16:9 aspect ratio, suitable as a blog hero banner
- Inspired by modern SaaS marketing visuals (Stripe, Linear, Notion style)`

  const response = await fetch(
    `${GEMINI_API_URL}/models/${IMAGE_MODEL}:predict?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instances: [{ prompt: imagePrompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio: "16:9",
          safetyFilterLevel: "block_few",
        },
      }),
    }
  )

  if (!response.ok) {
    const err = await response.text()
    console.error(`[gemini] Image generation failed (${response.status}): ${err}`)
    return ""
  }

  const data = await response.json()

  // Imagen 4.0 returns: predictions[0].generatedImages[0].bytesBase64Encoded
  // Imagen 3.x returned: predictions[0].bytesBase64Encoded
  const prediction = data.predictions?.[0]
  const base64Image =
    prediction?.generatedImages?.[0]?.bytesBase64Encoded ??
    prediction?.bytesBase64Encoded

  if (!base64Image) {
    console.error("[gemini] No image data in Imagen response:", JSON.stringify(data).slice(0, 800))
    return ""
  }

  // Detect mime type from Imagen 4.0 response, fallback to PNG
  const mimeType = prediction?.generatedImages?.[0]?.mimeType ?? "image/png"
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
