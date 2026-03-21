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

// ── Editorial angles for variety ──────────────────────────────────────────────

/**
 * Pool of editorial angles. One is randomly assigned to each article to
 * prevent every post from reading the same way.
 */
const EDITORIAL_ANGLES = [
  {
    name: "guide-pratique",
    instruction: "Rédige sous forme de guide pratique étape par étape, avec des actions concrètes numérotées que le lecteur peut appliquer immédiatement.",
  },
  {
    name: "checklist",
    instruction: "Structure l'article autour d'une checklist complète. Chaque section est un point à vérifier ou une action à cocher. Utilise des cases à cocher Markdown (- [ ]) dans le contenu.",
  },
  {
    name: "erreurs-a-eviter",
    instruction: "Angle 'erreurs courantes' : présente le sujet à travers les 7-10 erreurs les plus fréquentes que font les artisans, avec pour chaque erreur la solution correcte.",
  },
  {
    name: "cas-concret",
    instruction: "Illustre le sujet avec un cas concret fictif mais réaliste (un artisan nommé, son métier, sa situation) qui sert de fil rouge tout au long de l'article. Le lecteur doit pouvoir s'identifier.",
  },
  {
    name: "avant-apres",
    instruction: "Structure 'avant/après' : compare systématiquement la situation sans solution vs avec solution, en montrant les gains concrets (temps, argent, stress) pour un artisan.",
  },
  {
    name: "faq-etendue",
    instruction: "Format questions-réponses étendu : structure tout l'article comme une FAQ complète (10-15 questions), du plus basique au plus avancé, comme si tu répondais aux vraies questions des artisans.",
  },
  {
    name: "chronologie",
    instruction: "Rédige sous forme chronologique : mois par mois ou étape par étape dans le temps, pour aider le lecteur à planifier ses actions avec un calendrier clair.",
  },
  {
    name: "comparaison-metiers",
    instruction: "Aborde le sujet en montrant les différences selon les métiers (plombier, électricien, peintre, maçon). Chaque section adapte les conseils au métier spécifique.",
  },
]

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
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
  keywords: string[],
  recentTitles: string[] = []
): Promise<BlogPostResult> {
  const apiKey = getApiKey()

  const angle = pickRandom(EDITORIAL_ANGLES)

  // Build differentiation context from recent articles
  const recentContext = recentTitles.length > 0
    ? `\n\nARTICLES RÉCEMMENT PUBLIÉS (à ne PAS répéter ni paraphraser — trouve un angle DIFFÉRENT) :\n${recentTitles.map((t) => `- ${t}`).join("\n")}`
    : ""

  const userPrompt = `Rédige un article de blog complet sur le sujet suivant :

Sujet : ${topic}
Mots-clés SEO à intégrer : ${keywords.join(", ")}

ANGLE ÉDITORIAL OBLIGATOIRE : ${angle.instruction}

Contexte : Qonforme est un logiciel français de facturation électronique conforme Factur-X / EN 16931, conçu pour les artisans et TPE. Le logiciel permet de créer des factures, devis, avoirs et bons de commande conformes à la réforme 2026.${recentContext}`

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
 * Multiple visual variants per category — one is picked randomly so that
 * two articles in the same category never look the same.
 */
const CATEGORY_VISUAL_VARIANTS: Record<TopicCategory, string[]> = {
  "réglementation": [
    "a bright modern office desk with a laptop open on a compliance dashboard, a coffee cup, and a potted plant, sunlight streaming through a window",
    "an artisan reading an official letter in his workshop, tools neatly hung on the wall behind him, warm afternoon light",
    "a French town hall building façade with tricolor flag, focus on the entrance doors, blue sky, architectural photography",
    "a close-up of hands stamping an official document on a wooden desk, ink pad nearby, shallow depth of field",
    "an aerial flat-lay of organized administrative paperwork, colored folders, a pen, and reading glasses on a white marble surface",
  ],
  "tutoriel": [
    "hands typing on a laptop keyboard with a modern invoicing interface visible on screen, cozy home office setting",
    "a split-screen composition: left side shows paper invoices, right side shows a sleek digital tablet with the same invoice, visual transformation",
    "an artisan at a standing desk following a tutorial on his screen, workshop tools visible in the background, warm lighting",
    "a flat-lay of a notebook with hand-drawn flowchart arrows, a smartphone, a stylus pen, and sticky notes on a wooden table",
    "close-up of a tablet screen showing a step-by-step progress bar at 60%, fingers tapping the next button, blurred colorful background",
  ],
  "guide": [
    "an open book lying flat on a desk with a magnifying glass and colorful bookmarks sticking out, soft library lighting",
    "a well-organized filing cabinet with color-coded folders pulled halfway out, in a modern minimalist office",
    "hands holding a printed checklist with checkmarks, a pen in hand, desk background with laptop and coffee",
    "a compass placed on top of a road map next to a laptop, metaphor for navigation and guidance, warm tones",
    "a mentor and apprentice artisan looking at a document together in a bright workshop, collaborative atmosphere",
  ],
  "actualité": [
    "a modern newsroom-style desk with multiple screens showing data visualizations and charts, dynamic blue lighting",
    "a wall calendar pinned with colorful markers on important dates, a clock nearby, office environment",
    "morning newspaper and a tablet side by side on a breakfast table, fresh orange juice, sunlight through curtains",
    "a press conference podium with microphones, blurred audience in the background, professional event photography",
    "a smartphone showing push notifications on a table, with a coffee cup and morning pastries, cozy morning scene",
  ],
  "comparatif": [
    "two different tools placed side by side on a workbench, visual comparison setup, split lighting warm vs cool",
    "a balance scale on a clean desk with abstract objects on each side, soft gradient background, product photography",
    "a radar chart visualization on a large monitor, colorful data points, modern analytics office setting",
    "two paths diverging in a garden, aerial drone photography, metaphor for choosing between options",
    "a chef tasting two dishes side by side, decision-making moment, warm kitchen environment, editorial style",
  ],
  "pratique": [
    "a plumber working under a sink with a tablet propped up nearby showing an invoice, real workshop environment",
    "an electrician's hands holding wires with safety gloves, toolbox open beside him, professional worksite",
    "a painter in overalls taking a break to check his phone in a freshly painted room, rollers and paint cans around",
    "a carpenter measuring wood at his workbench, sawdust in the air catching sunlight, traditional craftsmanship",
    "a mason laying bricks with precision, construction site background, hard hat, golden hour photography",
  ],
  "gestion": [
    "a small business owner reviewing graphs on a tablet in a cozy office, bookshelf and plants in the background",
    "an overhead shot of a desk with a laptop showing analytics, a notepad with handwritten goals, and a calculator",
    "a team of two people high-fiving in a small office, growth chart visible on a whiteboard behind them",
    "a person organizing a Kanban board with sticky notes in different colors, modern open-space office",
    "a hand drawing an upward arrow on a glass board with a marker, city skyline visible through the window behind",
  ],
  "comptabilité": [
    "a vintage wooden desk with a modern calculator, a stack of receipts, and a laptop showing a spreadsheet, warm lamp light",
    "an accountant's hands sorting colorful receipts into categorized piles on a clean white desk, top-down view",
    "a jar of coins next to a small plant sprouting, ledger book open nearby, metaphor for financial growth",
    "a professional reviewing bank statements on a dual-monitor setup, organized desk with minimal accessories",
    "close-up of a fountain pen writing figures in a ledger, ink still wet, classic accounting aesthetic with modern twist",
  ],
  "digital": [
    "a smartphone, tablet, and laptop arranged in a triangle on a minimalist desk, all showing synchronized dashboards",
    "an artisan in his van using a tablet to send an invoice, scenic French countryside visible through the windshield",
    "a time-lapse-style photo of a desk transitioning from paper clutter on the left to clean digital setup on the right",
    "a cloud icon reflected in a glass window of a modern building, city background, abstract technology concept",
    "hands scanning a QR code on a document with a smartphone, instant digitization, bright modern office",
  ],
  "cas-usage": [
    "a proud artisan leaning on his van with his company branding, tablet in hand, suburban French street background",
    "before-and-after split: left side cluttered desk with paper invoices, right side clean desk with just a laptop, dramatic transformation",
    "an artisan shaking hands with a satisfied client at a front door, completed work visible inside, trust and professionalism",
    "a small business team celebrating around a laptop in a workshop, champagne or coffee toasts, milestone moment",
    "a young artisan opening the doors of his new workshop for the first time, morning light, fresh start feeling",
  ],
}

/**
 * Pool of photographic styles — one is randomly selected per image to prevent
 * the monotone "stock photo" look across articles.
 */
const PHOTO_STYLES = [
  "Ultra-realistic photograph with cinematic lighting, shallow depth of field, warm natural tones mixed with cool blue accents. Editorial photography for a premium business magazine.",
  "Bright and airy photograph with soft natural light, clean whites, and pastel accents. Lifestyle editorial style, like a Scandinavian design magazine.",
  "Rich and moody photograph with dramatic chiaroscuro lighting, deep shadows, and warm amber highlights. Documentary photography style.",
  "Vibrant and modern photograph with bold colors, high contrast, and sharp details. Contemporary commercial photography with a dynamic feel.",
  "Soft-focus dreamy photograph with golden hour warm light, lens flare, and a romantic atmosphere. Artisanal storytelling photography.",
  "Clean minimalist photograph with geometric composition, negative space, and muted earth tones. Architectural photography meets product photography.",
]

export async function generateCoverImage(
  title: string,
  excerpt: string,
  category: TopicCategory = "guide"
): Promise<string> {
  const apiKey = getApiKey()

  // Pick a random visual variant for this category
  const variants = CATEGORY_VISUAL_VARIANTS[category] || CATEGORY_VISUAL_VARIANTS["guide"]
  const visualScene = pickRandom(variants)

  // Pick a random photographic style
  const photoStyle = pickRandom(PHOTO_STYLES)

  // Inject the article title context so the image relates to the specific topic
  const topicContext = `The image should evoke the theme: "${title}".`

  const imagePrompt = `A high-quality blog cover image, 16:9 widescreen format.

Scene: ${visualScene}

Topic context: ${topicContext}

Style: ${photoStyle}

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
