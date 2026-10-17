import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import sharp from "sharp"

const state = vi.hoisted(() => ({
  admin: true,
  uploads: [] as { bucket: string; path: string; data: Buffer; opts: Record<string, unknown> }[],
  uploadError: null as null | { message: string },
  settingsRows: [] as { key: string; value: unknown; updated_at: string }[],
  settingsError: null as null | { code?: string; message: string },
  generate: null as null | ((input: { model: string; prompt: string; aspect: string; timeoutMs?: number }) => Promise<unknown>),
  generateCalls: [] as { model: string; prompt: string; aspect: string; timeoutMs?: number }[],
}))

const SUPABASE = "https://proj.supabase.co"

vi.mock("@/lib/admin-require", () => ({ isAdminAuthenticated: async () => state.admin }))
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => fakeClient(),
  createAdminClient: () => fakeClient(),
}))
vi.mock("@/lib/seo/articles/models", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/seo/articles/models")>()),
  generateImage: async (input: { model: string; prompt: string; aspect: string; timeoutMs?: number }) => {
    state.generateCalls.push(input)
    if (!state.generate) throw new Error("aucune génération prévue dans ce test")
    return state.generate(input)
  },
}))

function fakeClient() {
  return {
    from: (table: string) => ({
      select: async () =>
        table === "seo_settings" ? { data: state.settingsError ? null : state.settingsRows, error: state.settingsError } : { data: [], error: null },
    }),
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string, data: Buffer, opts: Record<string, unknown>) => {
          if (state.uploadError) return { data: null, error: state.uploadError }
          state.uploads.push({ bucket, path, data, opts })
          return { data: { path }, error: null }
        },
        getPublicUrl: (path: string) => ({ data: { publicUrl: `${SUPABASE}/storage/v1/object/public/${bucket}/${path}` } }),
      }),
    },
  }
}

import {
  BLOG_IMAGE_BUCKET,
  MAX_UPLOAD_BYTES,
  editorImagePath,
  isBlogImageUrl,
  isGeneratedBlogImage,
  isQonformeCover,
  readImageSize,
  withImageSize,
} from "@/lib/blog-images/policy"
import { sniffImage } from "@/lib/blog-images/sniff"
import {
  IMAGE_STYLE_CHIPS,
  MAX_IMAGE_DESCRIPTION,
  altFromDescription,
  buildImagePrompt,
  defaultImageDescription,
  hasStyleChip,
  toggleStyleChip,
} from "@/lib/blog-images/prompt"
import { BlogImageError, storeBlogImage } from "@/lib/blog-images/server"
import { ModelError } from "@/lib/seo/articles/models"
import { SETTINGS_DEFAULTS } from "@/lib/seo/settings-schema"
import { POST as uploadRoute } from "@/app/api/admin/blog/images/upload/route"
import { POST as generateRoute } from "@/app/api/admin/blog/images/generate/route"

const env = { ...process.env }

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE
  state.admin = true
  state.uploads = []
  state.uploadError = null
  state.settingsRows = []
  state.settingsError = null
  state.generate = null
  state.generateCalls = []
})

afterEach(() => {
  process.env = { ...env }
  vi.restoreAllMocks()
})

const PUBLIC = `${SUPABASE}/storage/v1/object/public/${BLOG_IMAGE_BUCKET}/`

/* ------------------------------------------------------------------ */
/* Octets fabriqués                                                    */
/* ------------------------------------------------------------------ */

const bytes = (...parts: (number[] | string)[]) =>
  Uint8Array.from(parts.flatMap((p) => (typeof p === "string" ? Array.from(p, (c) => c.charCodeAt(0)) : p)))
const be32 = (n: number) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]
const be16 = (n: number) => [(n >> 8) & 0xff, n & 0xff]
const le16 = (n: number) => [n & 0xff, (n >> 8) & 0xff]
const le24 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff]

function pngHeader(width: number, height: number) {
  return bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], be32(13), "IHDR", be32(width), be32(height), [8, 6, 0, 0, 0], [0, 0, 0, 0])
}

function jpegHeader(width: number, height: number, sof = 0xc0) {
  return bytes(
    [0xff, 0xd8],
    // APP0 (JFIF), longueur 16
    [0xff, 0xe0], be16(16), "JFIF", [0, 1, 1, 0, 0, 1, 0, 1, 0, 0],
    // DHT (C4) : jamais pris pour un SOF
    [0xff, 0xc4], be16(5), [0, 0, 0],
    // Octets de remplissage avant le marqueur
    [0xff, 0xff],
    [0xff, sof], be16(11), [8], be16(height), be16(width), [1, 1, 0x11, 0],
  )
}

function riff(chunk: string, payload: number[]) {
  const body = bytes("WEBP", chunk, le24(payload.length).concat([0]), payload)
  return bytes("RIFF", le24(body.length).concat([0]), Array.from(body))
}

/* ------------------------------------------------------------------ */
/* Adresses                                                            */
/* ------------------------------------------------------------------ */

describe("isBlogImageUrl", () => {
  it("admet une image publique du compartiment du blog, fragment des dimensions compris", () => {
    expect(isBlogImageUrl(`${PUBLIC}editor/2026/10/photo.jpg`, SUPABASE)).toBe(true)
    expect(isBlogImageUrl(`${PUBLIC}editor/2026/10/photo.jpg#w=1600&h=900`, SUPABASE)).toBe(true)
    expect(isBlogImageUrl(`${PUBLIC}seo/ancienne-couverture.png`, SUPABASE)).toBe(true)
  })

  it("refuse un autre hôte, http, un autre compartiment ou une adresse vide après le compartiment", () => {
    expect(isBlogImageUrl(`https://autre.supabase.co/storage/v1/object/public/${BLOG_IMAGE_BUCKET}/a.jpg`, SUPABASE)).toBe(false)
    expect(isBlogImageUrl(PUBLIC.replace("https:", "http:") + "a.jpg", SUPABASE)).toBe(false)
    expect(isBlogImageUrl(`${SUPABASE}/storage/v1/object/public/logos/a.jpg`, SUPABASE)).toBe(false)
    expect(isBlogImageUrl(`${SUPABASE}/storage/v1/object/sign/${BLOG_IMAGE_BUCKET}/a.jpg`, SUPABASE)).toBe(false)
    expect(isBlogImageUrl(PUBLIC, SUPABASE)).toBe(false)
    expect(isBlogImageUrl(`https://proj.supabase.co:8443/storage/v1/object/public/${BLOG_IMAGE_BUCKET}/a.jpg`, SUPABASE)).toBe(false)
    expect(isBlogImageUrl(`https://user:pass@proj.supabase.co/storage/v1/object/public/${BLOG_IMAGE_BUCKET}/a.jpg`, SUPABASE)).toBe(false)
  })

  it("refuse « .. », les guillemets, chevrons, espaces et une adresse illisible", () => {
    expect(isBlogImageUrl(`${PUBLIC}%2e%2e/logos/x.jpg`, SUPABASE)).toBe(false)
    expect(isBlogImageUrl(`${PUBLIC}../logos/x.jpg`, SUPABASE)).toBe(false)
    expect(isBlogImageUrl(`${PUBLIC}a.jpg"onerror="alert(1)`, SUPABASE)).toBe(false)
    expect(isBlogImageUrl(`${PUBLIC}a.jpg'x`, SUPABASE)).toBe(false)
    expect(isBlogImageUrl(`${PUBLIC}a b.jpg`, SUPABASE)).toBe(false)
    expect(isBlogImageUrl(`${PUBLIC}<a>.jpg`, SUPABASE)).toBe(false)
    expect(isBlogImageUrl("pas une adresse", SUPABASE)).toBe(false)
    // Projet inconnu (variable absente) : aucune image admise
    expect(isBlogImageUrl(`${PUBLIC}a.jpg`, "")).toBe(false)
  })

  it("lit NEXT_PUBLIC_SUPABASE_URL par défaut", () => {
    expect(isBlogImageUrl(`${PUBLIC}a.jpg`)).toBe(true)
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://autre.supabase.co"
    expect(isBlogImageUrl(`${PUBLIC}a.jpg`)).toBe(false)
  })
})

describe("isQonformeCover", () => {
  it("vrai seulement pour une image du blog rangée sous covers/", () => {
    expect(isQonformeCover(`${PUBLIC}covers/2026/10/comment-facturer-abc.webp#w=1600&h=900`, SUPABASE)).toBe(true)
    expect(isQonformeCover(`${PUBLIC}editor/ia/2026/10/photo.webp`, SUPABASE)).toBe(false)
    expect(isQonformeCover(`${PUBLIC}seo/ancienne.jpg`, SUPABASE)).toBe(false)
    expect(isQonformeCover("https://autre.fr/storage/v1/object/public/blog-covers/covers/a.webp", SUPABASE)).toBe(false)
    expect(isQonformeCover(null, SUPABASE)).toBe(false)
    expect(isQonformeCover("", SUPABASE)).toBe(false)
  })
})

describe("withImageSize et readImageSize", () => {
  it("écrit puis relit les dimensions dans le fragment", () => {
    const url = withImageSize(`${PUBLIC}a.jpg`, 1600, 900)
    expect(url).toBe(`${PUBLIC}a.jpg#w=1600&h=900`)
    expect(readImageSize(url)).toEqual({ src: `${PUBLIC}a.jpg`, width: 1600, height: 900 })
  })

  it("remplace un fragment existant et arrondit", () => {
    expect(withImageSize(`${PUBLIC}a.jpg#w=10&h=10`, 1599.6, 899.4)).toBe(`${PUBLIC}a.jpg#w=1600&h=899`)
  })

  it("dimensions absentes ou invalides : null, adresse sans fragment", () => {
    expect(withImageSize(`${PUBLIC}a.jpg#w=1&h=1`, 0, 900)).toBe(`${PUBLIC}a.jpg`)
    expect(readImageSize(`${PUBLIC}a.jpg`)).toEqual({ src: `${PUBLIC}a.jpg`, width: null, height: null })
    expect(readImageSize(`${PUBLIC}a.jpg#w=1600`)).toMatchObject({ width: null, height: null })
    expect(readImageSize(`${PUBLIC}a.jpg#w=0&h=900`)).toMatchObject({ width: null, height: null })
    expect(readImageSize(`${PUBLIC}a.jpg#w=20000&h=900`)).toMatchObject({ width: null, height: null })
    expect(readImageSize(`${PUBLIC}a.jpg#h=900&w=1600`)).toMatchObject({ width: 1600, height: 900 })
  })
})

describe("editorImagePath", () => {
  const now = new Date("2026-10-16T08:30:00Z")

  it("range l'image par année et mois, nom lisible sans accents, horodatage et aléa", () => {
    const path = editorImagePath({ hint: "Rénovation d'une salle de bains à Évreux", ext: "jpg", now, random: "a1B2c3d4" })
    expect(path).toBe(`editor/2026/10/renovation-d-une-salle-de-bains-a-evreux-${now.getTime().toString(36)}a1b2c3.jpg`)
  })

  it("indice vide ou sans lettre : « image » ; aléa nettoyé ; 48 caractères au plus", () => {
    expect(editorImagePath({ hint: "!!!", ext: "png", now, random: "../" })).toMatch(/^editor\/2026\/10\/image-[a-z0-9]+0\.png$/)
    // Image générée par IA : sous editor/ia/, reconnue comme telle ; une image importée ne l'est pas
    const generated = editorImagePath({ hint: "Maçon", ext: "jpg", now, random: "a1b2c3", generated: true })
    expect(generated).toMatch(/^editor\/ia\/2026\/10\/macon-[a-z0-9]+\.jpg$/)
    expect(isGeneratedBlogImage(`${PUBLIC}${generated}#w=1600&h=900`, SUPABASE)).toBe(true)
    expect(isGeneratedBlogImage(`${PUBLIC}editor/2026/10/photo.jpg`, SUPABASE)).toBe(false)
    expect(isGeneratedBlogImage(`https://autre.fr/storage/v1/object/public/blog-covers/editor/ia/a.jpg`, SUPABASE)).toBe(false)
    expect(isGeneratedBlogImage(null, SUPABASE)).toBe(false)
    const long = editorImagePath({ hint: "a ".repeat(80), ext: "webp", now, random: "zz" })
    const name = long.split("/").pop()!
    expect(name.split("-").slice(0, -1).join("-").length).toBeLessThanOrEqual(48)
    expect(long).not.toMatch(/--/)
  })
})

/* ------------------------------------------------------------------ */
/* Reconnaissance des images                                           */
/* ------------------------------------------------------------------ */

describe("sniffImage", () => {
  it("PNG : dimensions du bloc IHDR", () => {
    expect(sniffImage(pngHeader(1600, 900))).toEqual({ mimeType: "image/png", width: 1600, height: 900 })
  })

  it("JPEG : premier SOF après APP0, DHT et octets de remplissage (SOF0 et SOF2)", () => {
    expect(sniffImage(jpegHeader(1200, 800))).toEqual({ mimeType: "image/jpeg", width: 1200, height: 800 })
    expect(sniffImage(jpegHeader(640, 480, 0xc2))).toEqual({ mimeType: "image/jpeg", width: 640, height: 480 })
  })

  it("JPEG sans SOF avant les données compressées ou tronqué : refusé", () => {
    expect(sniffImage(bytes([0xff, 0xd8, 0xff, 0xda], be16(8), [0, 0, 0, 0, 0, 0, 0, 0]))).toBeNull()
    expect(sniffImage(jpegHeader(1200, 800).slice(0, 30))).toBeNull()
    expect(sniffImage(bytes([0xff, 0xd8, 0xff, 0xe0], be16(16), "JFIF"))).toBeNull()
  })

  it("WebP : VP8 (avec perte), VP8L (sans perte) et VP8X (étendu)", () => {
    const vp8 = riff("VP8 ", [0x30, 0x01, 0x00, 0x9d, 0x01, 0x2a, ...le16(1024), ...le16(768), 0, 0, 0, 0])
    expect(sniffImage(vp8)).toEqual({ mimeType: "image/webp", width: 1024, height: 768 })

    // Largeur − 1 = 799 et hauteur − 1 = 599 sur 14 bits chacune
    const w = 799
    const h = 599
    const vp8l = riff("VP8L", [0x2f, w & 0xff, ((w >> 8) & 0x3f) | ((h & 0x3) << 6), (h >> 2) & 0xff, (h >> 10) & 0x0f, 0, 0, 0, 0, 0])
    expect(sniffImage(vp8l)).toEqual({ mimeType: "image/webp", width: 800, height: 600 })

    const vp8x = riff("VP8X", [0x10, 0, 0, 0, ...le24(1919), ...le24(1079), 0, 0])
    expect(sniffImage(vp8x)).toEqual({ mimeType: "image/webp", width: 1920, height: 1080 })
  })

  it("refuse ce qui n'est pas une image JPEG, PNG ou WebP, même avec la bonne extension", () => {
    expect(sniffImage(bytes("GIF89a", [1, 0, 1, 0, 0, 0, 0, 0, 0, 0]))).toBeNull()
    expect(sniffImage(bytes('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull()
    expect(sniffImage(bytes("<!doctype html><script>alert(1)</script>"))).toBeNull()
    expect(sniffImage(bytes("RIFF", [0, 0, 0, 0], "WAVEfmt ", new Array(20).fill(0)))).toBeNull()
    expect(sniffImage(bytes("%PDF-1.7\n", new Array(20).fill(0)))).toBeNull()
    expect(sniffImage(new Uint8Array(0))).toBeNull()
    expect(sniffImage(pngHeader(0, 900))).toBeNull()
    expect(sniffImage(pngHeader(1600, 900).slice(0, 20))).toBeNull()
  })

  it("lit les vraies images produites par sharp (JPEG, progressif, PNG, WebP des trois sortes)", async () => {
    const base = () => sharp({ create: { width: 37, height: 21, channels: 3, background: "#336699" } })
    const alpha = () => sharp({ create: { width: 37, height: 21, channels: 4, background: { r: 51, g: 102, b: 153, alpha: 0.5 } } })
    const cases: [Buffer, string][] = [
      [await base().jpeg().toBuffer(), "image/jpeg"],
      [await base().jpeg({ progressive: true }).toBuffer(), "image/jpeg"],
      [await alpha().png().toBuffer(), "image/png"],
      [await base().webp().toBuffer(), "image/webp"],
      [await base().webp({ lossless: true }).toBuffer(), "image/webp"],
      [await alpha().webp().toBuffer(), "image/webp"],
    ]
    for (const [buffer, mimeType] of cases) {
      expect(sniffImage(buffer)).toEqual({ mimeType, width: 37, height: 21 })
    }
  })
})

/* ------------------------------------------------------------------ */
/* Consigne                                                            */
/* ------------------------------------------------------------------ */

describe("buildImagePrompt", () => {
  it("encadre la description et place les règles strictes à la fin", () => {
    const prompt = buildImagePrompt({ description: "Un plombier change un robinet.", aspect: "4:3", purpose: "inline" })
    expect(prompt).toContain("Un plombier change un robinet.")
    expect(prompt).toContain("4:3 landscape")
    const rules = prompt.indexOf("STRICT RULES")
    expect(rules).toBeGreaterThan(prompt.indexOf("Un plombier"))
    const tail = prompt.slice(rules)
    expect(tail).toContain("No text, letters, numbers")
    expect(tail).toContain("logos")
    expect(tail).toContain("No brand names")
    expect(tail).toContain("blurred and unreadable")
    expect(tail).toContain("artisans du bâtiment en France")
  })

  it("photo réaliste : consigne de photographe, mains et outils plausibles, rien de « stock photo »", () => {
    const prompt = buildImagePrompt({ description: "Un électricien raccorde un tableau.", aspect: "4:3", purpose: "inline" })
    expect(prompt).toContain("PHOTOGRAPHIC LOOK")
    expect(prompt).toContain("35 mm lens")
    expect(prompt).toContain("do not look at the camera")
    expect(prompt).toContain("worn and scuffed tools")
    const rules = prompt.slice(prompt.indexOf("STRICT RULES"))
    expect(rules).toContain("five fingers per hand")
    expect(rules).toContain("no posed smiles")
    expect(rules).toContain("not a 3D render")
    // La description reste avant les règles, qui l'emportent
    expect(prompt.indexOf("Un électricien")).toBeLessThan(prompt.indexOf("STRICT RULES"))
  })

  it("couverture : composition pleine image, format du blog", () => {
    const prompt = buildImagePrompt({ description: "Un maçon au travail.", aspect: "16:9", purpose: "cover" })
    expect(prompt).toContain("cover of a blog article")
    expect(prompt).toContain("16:9 widescreen")
    expect(buildImagePrompt({ description: "x x x", aspect: "1:1", purpose: "inline" })).toContain("1:1 square")
  })

  it("retire chevrons et caractères de contrôle, réduit les espaces", () => {
    const prompt = buildImagePrompt({ description: "Un <b>peintre</b>\u0007 au\n\n travail <script>", aspect: "16:9", purpose: "inline" })
    const scene = prompt.slice(prompt.indexOf("SCENE"), prompt.indexOf("STRICT RULES"))
    expect(scene).not.toMatch(/[<>\u0007]/)
    expect(scene).toContain("Un b peintre /b au travail script")
  })

  it("garde 1 200 caractères de description au plus", () => {
    const prompt = buildImagePrompt({ description: "é".repeat(5000), aspect: "16:9", purpose: "inline" })
    expect(prompt.match(/é+/)![0].length).toBe(MAX_IMAGE_DESCRIPTION)
    expect(prompt.endsWith("job sites.")).toBe(true)
  })
})

describe("description proposée et puces de style", () => {
  it("chaque métier a une scène précise : geste, outils et matériaux", () => {
    for (const text of ["plomberie", "electricien", "chauffagiste", "macon", "peintre", "carreleur", "menuisier", "couvreur", "plaquiste", "serrurier", "paysagiste"]) {
      const scene = defaultImageDescription({ title: text, keyword: null, purpose: "inline" })
      expect(scene.length).toBeGreaterThan(90)
      expect(scene).toMatch(/Cadrage resserré/)
    }
  })

  it("reconnaît le métier dans le mot-clé ou le titre, sans accents ni casse", () => {
    expect(defaultImageDescription({ title: "Facture d'un plombier", keyword: null, purpose: "cover" })).toMatch(/^Un plombier/)
    expect(defaultImageDescription({ title: "Devis", keyword: "devis electricien", purpose: "cover" })).toMatch(/^Un électricien/)
    expect(defaultImageDescription({ title: "TVA d'une pompe à chaleur", keyword: null, purpose: "inline" })).toMatch(/^Un chauffagiste/)
    expect(defaultImageDescription({ title: "Devis de MAÇONNERIE", keyword: null, purpose: "cover" })).toMatch(/^Un maçon/)
    expect(defaultImageDescription({ title: "Créer une terrasse", keyword: "paysagiste", purpose: "cover" })).toMatch(/^Un paysagiste/)
  })

  it("sans métier : devis d'artisan pour un sujet de gestion, chantier sinon ; cadrage selon l'usage", () => {
    expect(defaultImageDescription({ title: "Relancer une facture impayée", keyword: null, purpose: "cover" })).toMatch(/relit un devis/)
    expect(defaultImageDescription({ title: "Bien choisir ses outils", keyword: null, purpose: "cover" })).toMatch(/^Un chantier de rénovation/)
    expect(defaultImageDescription({ title: "x", keyword: null, purpose: "cover" })).toMatch(/Cadrage large/)
    expect(defaultImageDescription({ title: "x", keyword: null, purpose: "inline" })).toMatch(/Cadrage resserré/)
  })

  it("une puce ajoute sa phrase (avec un point avant si besoin), puis la retire", () => {
    const chip = IMAGE_STYLE_CHIPS.find((c) => c.id === "soir")!
    const on = toggleStyleChip("Un couvreur sur un toit", chip)
    expect(on).toBe(`Un couvreur sur un toit. ${chip.text}`)
    expect(hasStyleChip(on, chip)).toBe(true)
    const off = toggleStyleChip(on, chip)
    expect(off).toBe("Un couvreur sur un toit.")
    expect(hasStyleChip(off, chip)).toBe(false)
    expect(toggleStyleChip("", chip)).toBe(chip.text)
    expect(toggleStyleChip("x".repeat(MAX_IMAGE_DESCRIPTION - 5), chip)).toBe("x".repeat(MAX_IMAGE_DESCRIPTION - 5))
  })

  it("texte alternatif proposé : première phrase, sans les puces ni le point final", () => {
    const chip = IMAGE_STYLE_CHIPS[0]
    expect(altFromDescription(`Un plombier installe des tuyaux. Cadrage large. ${chip.text}`)).toBe("Un plombier installe des tuyaux")
    expect(altFromDescription(chip.text)).toBe("")
    const long = altFromDescription(`${"mot ".repeat(80)}fin.`)
    expect(long.length).toBeLessThanOrEqual(180)
    expect(long.endsWith(" ")).toBe(false)
  })
})

/* ------------------------------------------------------------------ */
/* Enregistrement                                                      */
/* ------------------------------------------------------------------ */

describe("storeBlogImage", () => {
  const now = new Date("2026-10-16T08:30:00Z")

  it("enregistre sous editor/AAAA/MM/ sans écraser, en cache un an, avec les dimensions dans l'adresse", async () => {
    const data = await sharp({ create: { width: 800, height: 450, channels: 3, background: "#cccccc" } }).jpeg().toBuffer()
    const stored = await storeBlogImage({ data, hint: "Salle de bains", now })
    expect(state.uploads).toHaveLength(1)
    const up = state.uploads[0]
    expect(up.bucket).toBe(BLOG_IMAGE_BUCKET)
    expect(up.path).toMatch(/^editor\/2026\/10\/salle-de-bains-[a-z0-9]+\.webp$/)
    expect(up.opts).toMatchObject({ contentType: "image/webp", upsert: false, cacheControl: "31536000" })
    expect(stored).toEqual({ url: `${PUBLIC}${up.path}#w=800&h=450`, width: 800, height: 450 })
    expect(isBlogImageUrl(stored.url)).toBe(true)
  })

  it("réduit une grande image à 1 600 px de large et retire les métadonnées (position GPS comprise)", async () => {
    const data = await sharp({ create: { width: 3200, height: 1800, channels: 3, background: "#996633" } })
      .jpeg()
      .withExif({ IFD0: { Copyright: "Téléphone" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "48/1 51/1 0/1" } })
      .toBuffer()
    expect((await sharp(data).metadata()).exif).toBeDefined()
    const stored = await storeBlogImage({ data, hint: "chantier", now })
    expect(stored).toMatchObject({ width: 1600, height: 900 })
    const meta = await sharp(state.uploads[0].data).metadata()
    expect(meta.exif).toBeUndefined()
    expect(meta.width).toBe(1600)
  })

  it("toute image est enregistrée en WebP (JPEG, PNG et WebP reçus), sans perdre la transparence", async () => {
    const png = await sharp({ create: { width: 64, height: 48, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0.3 } } }).png().toBuffer()
    const converted = await storeBlogImage({ data: png, hint: "capture", now })
    expect(state.uploads[0].opts.contentType).toBe("image/webp")
    expect(converted.url).toMatch(/\.webp#w=64&h=48$/)
    expect((await sharp(state.uploads[0].data).metadata()).hasAlpha).toBe(true)
    const jpeg = await sharp({ create: { width: 64, height: 48, channels: 3, background: "#996633" } }).jpeg().toBuffer()
    await storeBlogImage({ data: jpeg, hint: "photo", now })
    expect(state.uploads[1].opts.contentType).toBe("image/webp")
    expect(state.uploads[1].path).toMatch(/\.webp$/)
    const webp = await sharp({ create: { width: 64, height: 48, channels: 3, background: "#996633" } }).webp().toBuffer()
    await storeBlogImage({ data: webp, hint: "deja-webp", now })
    expect(state.uploads[2].opts.contentType).toBe("image/webp")
  })

  it("métadonnées : seules celles de Qonforme sont écrites (titre, description, mots-clés, auteur, origine IA), jamais celles du fichier", async () => {
    const data = await sharp({ create: { width: 640, height: 360, channels: 3, background: "#996633" } })
      .jpeg()
      .withExif({ IFD0: { Make: "Canon", Copyright: "Téléphone" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "48/1 51/1 0/1" } })
      .toBuffer()
    await storeBlogImage({
      data,
      hint: "comment facturer un chantier",
      generated: true,
      meta: { title: "Comment facturer un chantier", description: "Un électricien raccorde un tableau électrique", keywords: ["comment facturer un chantier", "devis"], creator: "Qonforme", source: "ai" },
      now,
    })
    const meta = await sharp(state.uploads[0].data).metadata()
    const xmp = meta.xmp?.toString("utf8") ?? ""
    expect(xmp).toContain("Comment facturer un chantier")
    expect(xmp).toContain("<rdf:li>comment facturer un chantier</rdf:li>")
    expect(xmp).toContain("<dc:creator><rdf:Seq><rdf:li>Qonforme</rdf:li>")
    expect(xmp).toContain("© 2026 Qonforme")
    expect(xmp).toContain("trainedAlgorithmicMedia")
    expect(xmp).not.toMatch(/GPS|Canon|Téléphone/)
    const exif = meta.exif?.toString("latin1") ?? ""
    expect(exif).toContain("Qonforme")
    expect(exif).not.toMatch(/GPS|Canon/)
    expect(state.uploads[0].path).toMatch(/^editor\/ia\/2026\/10\/comment-facturer-un-chantier-[a-z0-9]+\.webp$/)
    // Une image importée : rien n'est ajouté
    await storeBlogImage({ data, hint: "import", now })
    const plain = await sharp(state.uploads[1].data).metadata()
    expect(plain.xmp).toBeUndefined()
    expect(plain.exif).toBeUndefined()
  })

  it("couverture dessinée : sous covers/, qualité graphique, origine « digitalArt »", async () => {
    const data = await sharp({ create: { width: 1600, height: 900, channels: 3, background: "#ffffff" } }).png().toBuffer()
    const stored = await storeBlogImage({ data, hint: "Comment facturer un chantier", cover: true, meta: { title: "Comment facturer un chantier", creator: "Qonforme", source: "graphic" }, now })
    expect(state.uploads[0].path).toMatch(/^covers\/2026\/10\/comment-facturer-un-chantier-[a-z0-9]+\.webp$/)
    expect(stored).toMatchObject({ width: 1600, height: 900 })
    expect((await sharp(state.uploads[0].data).metadata()).xmp?.toString("utf8")).toContain("digitalArt")
  })

  it("refuse un fichier qui n'est pas une image, une image trop grande ou trop lourde", async () => {
    await expect(storeBlogImage({ data: Buffer.from("<svg></svg>"), hint: "x" })).rejects.toMatchObject({ code: "type" })
    await expect(storeBlogImage({ data: Buffer.from(pngHeader(12000, 100)), hint: "x" })).rejects.toMatchObject({ code: "size" })
    const data = await sharp({ create: { width: 100, height: 100, channels: 3, background: "#000" } }).png().toBuffer()
    await expect(storeBlogImage({ data, hint: "x", maxBytes: 10 })).rejects.toBeInstanceOf(BlogImageError)
    expect(state.uploads).toHaveLength(0)
  })

  it("refuse une image de plus de 60 mégapixels, même sous 10 000 px de côté (jamais gardée telle quelle)", async () => {
    await expect(storeBlogImage({ data: Buffer.from(pngHeader(9000, 9000)), hint: "x" })).rejects.toMatchObject({
      code: "size",
      message: expect.stringContaining("60 mégapixels"),
    })
    expect(state.uploads).toHaveLength(0)
  })

  it("refuse un fichier que sharp ne sait pas lire : jamais d'original gardé tel quel (métadonnées, position GPS)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    await expect(storeBlogImage({ data: Buffer.from(pngHeader(640, 360)), hint: "abime", now })).rejects.toMatchObject({ code: "type" })
    // Photo de téléphone tronquée, avec sa position GPS : reconnue à ses octets, illisible pour sharp
    const photo = await sharp({ create: { width: 800, height: 600, channels: 3, background: "#996633" } })
      .jpeg()
      .withExif({ IFD3: { GPSLatitudeRef: "N", GPSLatitude: "48/1 51/1 0/1" } })
      .toBuffer()
    const truncated = photo.subarray(0, Math.floor(photo.length * 0.7))
    await expect(storeBlogImage({ data: truncated, hint: "chantier", now })).rejects.toMatchObject({ code: "type", message: expect.stringContaining("illisible") })
    expect(state.uploads).toHaveLength(0)
    expect(warn).toHaveBeenCalled()
  })

  it("stockage en échec : erreur « upload » au message en français", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    state.uploadError = { message: "Bucket not found" }
    const data = await sharp({ create: { width: 10, height: 10, channels: 3, background: "#000" } }).jpeg().toBuffer()
    await expect(storeBlogImage({ data, hint: "x" })).rejects.toMatchObject({ code: "upload", message: expect.stringContaining("Réessayez") })
  })
})

/* ------------------------------------------------------------------ */
/* Routes                                                              */
/* ------------------------------------------------------------------ */

function uploadRequest(file: Blob | null, headers: Record<string, string> = {}, name = "photo.jpg") {
  const form = new FormData()
  if (file) form.append("file", file, name)
  return new NextRequest("http://localhost/api/admin/blog/images/upload", { method: "POST", body: form, headers })
}

describe("POST /api/admin/blog/images/upload", () => {
  it("401 hors session admin", async () => {
    state.admin = false
    const res = await uploadRoute(uploadRequest(new Blob(["x"])))
    expect(res.status).toBe(401)
  })

  it("413 dès l'en-tête Content-Length, sans lire le corps", async () => {
    const res = await uploadRoute(uploadRequest(new Blob(["x"]), { "content-length": String(MAX_UPLOAD_BYTES + 200_000) }))
    expect(res.status).toBe(413)
    expect((await res.json()).error).toMatch(/5 Mo/)
  })

  it("413 sur la taille réelle du fichier", async () => {
    const res = await uploadRoute(uploadRequest(new Blob([new Uint8Array(MAX_UPLOAD_BYTES + 1)])))
    expect(res.status).toBe(413)
  })

  it("415 pour un faux .jpg (SVG), 400 sans fichier", async () => {
    const res = await uploadRoute(uploadRequest(new Blob(['<svg onload="alert(1)"/>'], { type: "image/jpeg" })))
    expect(res.status).toBe(415)
    expect((await res.json()).error).toMatch(/JPEG, PNG ou WebP/)
    expect((await uploadRoute(uploadRequest(null))).status).toBe(400)
    expect(state.uploads).toHaveLength(0)
  })

  it("200 : StoredImage, nom de fichier tiré du nom importé", async () => {
    const data = await sharp({ create: { width: 320, height: 240, channels: 3, background: "#123456" } }).webp().toBuffer()
    const res = await uploadRoute(uploadRequest(new Blob([new Uint8Array(data)], { type: "image/webp" }), {}, "Façade rénovée.webp"))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ width: 320, height: 240 })
    expect(body.url).toMatch(/\/editor\/\d{4}\/\d{2}\/facade-renovee-[a-z0-9]+\.webp#w=320&h=240$/)
  })

  it("503 si le stockage refuse l'envoi", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    state.uploadError = { message: "down" }
    const data = await sharp({ create: { width: 20, height: 20, channels: 3, background: "#000" } }).jpeg().toBuffer()
    const res = await uploadRoute(uploadRequest(new Blob([new Uint8Array(data)])))
    expect(res.status).toBe(503)
  })
})

const generateRequest = (body: unknown) =>
  new NextRequest("http://localhost/api/admin/blog/images/generate", { method: "POST", body: JSON.stringify(body) })

function withCompetitor() {
  state.settingsRows = [
    { key: "targeting", value: { ...SETTINGS_DEFAULTS.targeting, competitors: ["batisoft-exemple.fr"] }, updated_at: "2026-10-01T00:00:00Z" },
    { key: "articles", value: { ...SETTINGS_DEFAULTS.articles, imageModel: "gemini-3.1-flash-image" }, updated_at: "2026-10-01T00:00:00Z" },
  ]
}

describe("POST /api/admin/blog/images/generate", () => {
  const ok = { description: "Un plombier installe un chauffe-eau dans une buanderie.", aspect: "4:3", purpose: "inline", title: "Facturer un chauffe-eau" }

  it("401 hors session admin, 400 si la description est trop courte ou le format inconnu", async () => {
    state.admin = false
    expect((await generateRoute(generateRequest(ok))).status).toBe(401)
    state.admin = true
    const short = await generateRoute(generateRequest({ ...ok, description: "x" }))
    expect(short.status).toBe(400)
    expect((await short.json()).fieldErrors.description).toMatch(/Décrivez/)
    expect((await generateRoute(generateRequest({ ...ok, aspect: "9:16" }))).status).toBe(400)
    expect((await generateRoute(generateRequest({ ...ok, description: "x".repeat(1201) }))).status).toBe(400)
  })

  it("422 si la description nomme un concurrent : rien n'est envoyé au modèle", async () => {
    withCompetitor()
    const res = await generateRoute(generateRequest({ ...ok, description: "Un artisan devant le logiciel Batisoft-exemple ouvert" }))
    expect(res.status).toBe(422)
    expect((await res.json()).error).toBe("La description nomme un concurrent : retirez-le.")
    expect(state.generateCalls).toHaveLength(0)
  })

  it("concurrent dont le nom est un mot de la consigne fixe : la description seule est contrôlée", async () => {
    // « france.fr » : le nom « france » figure dans les règles fixes (« artisans du bâtiment en France »)
    state.settingsRows = [
      { key: "targeting", value: { ...SETTINGS_DEFAULTS.targeting, competitors: ["france.fr"] }, updated_at: "2026-10-01T00:00:00Z" },
    ]
    const jpg = await sharp({ create: { width: 160, height: 120, channels: 3, background: "#000" } }).jpeg().toBuffer()
    state.generate = async () => ({ data: jpg, mimeType: "image/jpeg", model: "gemini-nano-banana-2.1" })
    const res = await generateRoute(generateRequest(ok))
    expect(res.status).toBe(200)
    expect(state.generateCalls).toHaveLength(1)
  })

  it("titre qui nomme un concurrent : jamais dans le nom du fichier public", async () => {
    withCompetitor()
    const jpg = await sharp({ create: { width: 160, height: 120, channels: 3, background: "#000" } }).jpeg().toBuffer()
    state.generate = async () => ({ data: jpg, mimeType: "image/jpeg", model: "gemini-nano-banana-2.1" })
    const res = await generateRoute(generateRequest({ ...ok, title: "Batisoft-exemple ou un autre logiciel ?" }))
    expect(res.status).toBe(200)
    const { url } = await res.json()
    expect(url).not.toMatch(/batisoft/i)
    expect(url).toMatch(/\/un-plombier-installe-un-chauffe-eau-[a-z0-9-]*\.webp#/)
  })

  it("503 avec le message du modèle si la clé manque", async () => {
    state.generate = async () => {
      throw new ModelError("not_configured", "Clé GEMINI_API_KEY absente : ajoutez-la dans les variables d'environnement (Paramètres › Connexions).")
    }
    const res = await generateRoute(generateRequest(ok))
    expect(res.status).toBe(503)
    expect(await res.json()).toMatchObject({ code: "not_configured", error: expect.stringContaining("GEMINI_API_KEY") })
  })

  it("502 pour un autre échec du modèle", async () => {
    state.generate = async () => {
      throw new ModelError("refused", "Le modèle d'image a refusé la consigne.", false)
    }
    const res = await generateRoute(generateRequest(ok))
    expect(res.status).toBe(502)
    expect((await res.json()).error).toMatch(/^La génération de l'image a échoué\./)
  })

  it("502 « quota » : la raison de Google est rendue telle quelle, sans « Réessayez »", async () => {
    state.generate = async () => {
      throw new ModelError("quota", "Google refuse gemini-3.1-flash-image (429) : aucun quota pour ce modèle sur le projet de la clé GEMINI_API_KEY.", false)
    }
    const res = await generateRoute(generateRequest(ok))
    expect(res.status).toBe(502)
    const body = await res.json()
    expect(body.code).toBe("quota")
    expect(body.error).toContain("aucun quota")
    expect(body.error).not.toContain("Réessayez")
  })

  it("503 si les réglages ne se lisent pas (concurrents inconnus : rien n'est envoyé)", async () => {
    state.settingsError = { code: "08006", message: "connexion perdue" }
    const res = await generateRoute(generateRequest(ok))
    expect(res.status).toBe(503)
    expect(state.generateCalls).toHaveLength(0)
  })

  it("200 : modèle des Préférences, 75 s, consigne complète, image enregistrée en WebP, repli signalé", async () => {
    withCompetitor()
    const png = await sharp({ create: { width: 1024, height: 768, channels: 3, background: "#8899aa" } }).png().toBuffer()
    state.generate = async () => ({
      data: png,
      mimeType: "image/png",
      model: "gemini-3.1-flash-image",
      fallbackFrom: { model: "gemini-nano-banana-2.1", reason: "Nano Banana a répondu 500." },
    })
    const res = await generateRoute(generateRequest(ok))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ width: 1024, height: 768, model: "Nano Banana 2" })
    // Image générée : rangée sous editor/ia/, le blog affiche « Illustration générée par IA » sous elle
    expect(body.url).toMatch(/\/editor\/ia\/\d{4}\/\d{2}\/facturer-un-chauffe-eau-[a-z0-9]+\.webp#w=1024&h=768$/)
    expect(isGeneratedBlogImage(body.url, SUPABASE)).toBe(true)
    expect(body.notice).toBe("Image par Nano Banana 2 au lieu de Nano Banana 2.1 : Nano Banana a répondu 500.")
    const call = state.generateCalls[0]
    expect(call).toMatchObject({ model: "gemini-3.1-flash-image", aspect: "4:3", timeoutMs: 75_000 })
    expect(call.prompt).toContain(ok.description)
    expect(call.prompt).toContain("STRICT RULES")
  })

  it("une couverture est toujours demandée en 16:9", async () => {
    const jpg = await sharp({ create: { width: 160, height: 90, channels: 3, background: "#000" } }).jpeg().toBuffer()
    state.generate = async () => ({ data: jpg, mimeType: "image/jpeg", model: "gemini-nano-banana-2.1" })
    const res = await generateRoute(generateRequest({ ...ok, purpose: "cover", aspect: "1:1" }))
    expect(res.status).toBe(200)
    expect(state.generateCalls[0].aspect).toBe("16:9")
    expect((await res.json()).notice).toBeNull()
  })

  it("image inexploitable renvoyée par le modèle : 502", async () => {
    state.generate = async () => ({ data: Buffer.from("pas une image"), mimeType: "image/png", model: "gemini-nano-banana-2.1" })
    const res = await generateRoute(generateRequest(ok))
    expect(res.status).toBe(502)
    expect(state.uploads).toHaveLength(0)
  })
})
