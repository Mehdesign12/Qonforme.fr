import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import React from "react"
import sharp from "sharp"
;(globalThis as unknown as { React: typeof React }).React = React

const state = vi.hoisted(() => ({
  admin: true,
  uploads: [] as { bucket: string; path: string; data: Buffer; opts: Record<string, unknown> }[],
  uploadError: null as null | { message: string },
  settingsRows: [] as { key: string; value: unknown; updated_at: string }[],
}))

const SUPABASE = "https://proj.supabase.co"

vi.mock("@/lib/admin-require", () => ({ isAdminAuthenticated: async () => state.admin }))
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => fakeClient(),
  createAdminClient: () => fakeClient(),
}))

function fakeClient() {
  return {
    from: (table: string) => ({
      select: async () => (table === "seo_settings" ? { data: state.settingsRows, error: null } : { data: [], error: null }),
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

import { ICON_MARKUP, COVER_ICON_IDS } from "@/lib/blog-images/cover/icon-markup"
import { ICON_COUNT, pickCoverIcons, seedOf } from "@/lib/blog-images/cover/icons"
import {
  COVER_HEIGHT,
  COVER_WIDTH,
  ICON_SLOTS,
  TITLE_MAX_HEIGHT,
  TITLE_MAX_WIDTH,
  iconDataUri,
  layoutTitle,
  measureText,
  splitTitle,
  typesetTitle,
  wrapBalanced,
} from "@/lib/blog-images/cover/layout"
import { SANS_METRICS, SERIF_METRICS } from "@/lib/blog-images/cover/assets.generated"
import { coverAlt, makeCover } from "@/lib/blog-images/cover/make"
import { renderCoverPng } from "@/lib/blog-images/cover/render"
import { detectTrade } from "@/lib/blog-images/trades"
import { asciiOf, cleanKeywords, exifOf, xmpOf } from "@/lib/blog-images/metadata"
import { ALT_MAX } from "@/lib/blog-images/prompt"
import { SETTINGS_DEFAULTS } from "@/lib/seo/settings-schema"
import { POST as coverRoute } from "@/app/api/admin/blog/images/cover/route"

const env = { ...process.env }

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE
  state.admin = true
  state.uploads = []
  state.uploadError = null
  state.settingsRows = []
})

afterEach(() => {
  process.env = { ...env }
  vi.restoreAllMocks()
})

const NBSP = " "

describe("titre de la couverture : typographie et deux voix", () => {
  it("espace insécable avant « : ? ! ; % », apostrophe courbe, espaces réduits", () => {
    expect(typesetTitle("Comment facturer un chantier : l'essentiel ?")).toBe(`Comment facturer un chantier${NBSP}: l’essentiel${NBSP}?`)
    expect(typesetTitle("TVA à 10 %   sur les travaux")).toBe(`TVA à 10${NBSP}% sur les travaux`)
    expect(typesetTitle("« Bon pour accord »")).toBe(`«${NBSP}Bon pour accord${NBSP}»`)
  })

  it("coupe au deux-points d'abord, puis à la virgule, puis aux derniers mots", () => {
    expect(splitTitle("Comment facturer un chantier : la liste de contrôle de l'artisan")).toEqual({
      main: `Comment facturer un chantier${NBSP}:`,
      accent: "la liste de contrôle de l’artisan",
    })
    expect(splitTitle("Exemple de devis de plomberie, prêt à recopier")).toEqual({ main: "Exemple de devis de plomberie,", accent: "prêt à recopier" })
    const noSeparator = splitTitle("Faire une facture d'acompte sans erreur")
    expect(noSeparator.main).toBe("Faire une facture d’acompte")
    expect(noSeparator.accent).toBe("sans erreur")
    // Trop court pour être coupé : tout en gras
    expect(splitTitle("Devis gratuit")).toEqual({ main: "Devis gratuit", accent: "" })
    // Une seule voix quand un côté du deux-points n'a qu'un mot
    expect(splitTitle("Devis : modèle")).toMatchObject({ accent: "" })
  })
})

describe("mesure et coupe des lignes", () => {
  it("largeurs des polices : plus grand = plus large, l'italique serif est plus étroit que le gras", () => {
    const a = measureText("Comment facturer", SANS_METRICS, 50, -0.03)
    const b = measureText("Comment facturer", SANS_METRICS, 100, -0.03)
    expect(b).toBeCloseTo(a * 2, 0)
    expect(measureText("la liste de contrôle", SERIF_METRICS, 100, -0.01)).toBeLessThan(measureText("la liste de contrôle", SANS_METRICS, 100, -0.03))
    // Caractère inconnu : largeur moyenne, jamais NaN
    expect(measureText("日本", SANS_METRICS, 100, 0)).toBeGreaterThan(0)
  })

  it("wrapBalanced : lignes égales, null si un mot dépasse ou si trop de lignes", () => {
    const measure = (t: string) => t.length * 10
    const words = "un deux trois quatre cinq six sept huit".split(" ")
    const lines = wrapBalanced(words, measure, 200, 4)!
    expect(lines.length).toBeGreaterThan(1)
    expect(lines.every((l) => measure(l) <= 200)).toBe(true)
    const widths = lines.map(measure)
    expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(90)
    expect(wrapBalanced(["démesurément"], measure, 50, 4)).toBeNull()
    expect(wrapBalanced(words, measure, 60, 2)).toBeNull()
    expect(wrapBalanced([], measure, 100, 2)).toEqual([])
  })

  it("chaque titre tient dans le cadre : largeur, hauteur, 4 lignes (5 en petits caractères)", () => {
    const titles = [
      "Comment facturer un chantier : la liste de contrôle de l'artisan",
      "Exemple de devis de plomberie, prêt à recopier",
      "TVA à 10 % sur les travaux : la mention à écrire sur le devis",
      "Relancer une facture impayée : le mail en trois étapes",
      "Devis",
      "Plateforme agréée : comment choisir en 2026 sans se tromper sur les obligations de facturation électronique des artisans du bâtiment",
    ]
    for (const title of titles) {
      const layout = layoutTitle(title)
      expect(layout.truncated).toBe(false)
      expect(layout.lines.length).toBeGreaterThan(0)
      expect(layout.lines.length).toBeLessThanOrEqual(layout.size <= 64 ? 5 : 4)
      expect(layout.height).toBeLessThanOrEqual(TITLE_MAX_HEIGHT)
      for (const line of layout.lines) {
        const metrics = line.kind === "sans" ? SANS_METRICS : SERIF_METRICS
        expect(measureText(line.text, metrics, line.size, line.letterSpacing / line.size)).toBeLessThanOrEqual(TITLE_MAX_WIDTH + 1)
      }
      // La voix en gras vient avant celle en italique
      const kinds = layout.lines.map((l) => l.kind)
      expect(kinds.join(",")).toBe([...kinds].sort((x, y) => (x === y ? 0 : x === "sans" ? -1 : 1)).join(","))
    }
    // Un titre court est grand, un titre long est plus petit
    expect(layoutTitle("Devis").size).toBeGreaterThan(layoutTitle(titles[5]).size)
  })

  it("un titre démesuré est raccourci aux mots entiers, avec « … »", () => {
    const layout = layoutTitle(`Facturer ${"un chantier très long et compliqué ".repeat(14)}sans erreur`)
    expect(layout.truncated).toBe(true)
    expect(layout.height).toBeLessThanOrEqual(TITLE_MAX_HEIGHT)
    expect(layout.lines.at(-1)?.text.endsWith("…")).toBe(true)
  })
})

describe("icônes de la couverture", () => {
  it("huit icônes sans doublon, toutes connues, les mêmes pour le même titre", () => {
    for (const title of ["Comment facturer un chantier", "Exemple de devis de plomberie", "Les outils du chantier", "TVA à 10 % sur les travaux"]) {
      const a = pickCoverIcons({ title })
      expect(a.icons).toHaveLength(ICON_COUNT)
      expect(new Set(a.icons).size).toBe(ICON_COUNT)
      for (const id of a.icons) expect(COVER_ICON_IDS).toContain(id)
      expect(pickCoverIcons({ title }).icons).toEqual(a.icons)
    }
    expect(ICON_SLOTS).toHaveLength(ICON_COUNT)
  })

  it("métier reconnu : son icône en grand, un lien avec le devis ; papiers : l'icône du sujet et un casque ; sinon le chantier", () => {
    const plomberie = pickCoverIcons({ title: "Exemple de devis de plomberie, prêt à recopier" })
    expect(plomberie.family).toBe("metier")
    expect(plomberie.icons[0]).toBe("droplets")
    expect(plomberie.icons).toContain("file-text")
    const electricien = pickCoverIcons({ title: "Facturer une borne de recharge", keyword: "installation électricien" })
    expect(electricien.icons[0]).toBe("plug-zap")
    const relance = pickCoverIcons({ title: "Relancer une facture impayée : le mail en trois étapes" })
    expect(relance).toMatchObject({ family: "papiers" })
    expect(relance.icons[0]).toBe("bell")
    expect(relance.icons).toContain("hard-hat")
    const tva = pickCoverIcons({ title: "TVA à 10 % sur les travaux : la mention à écrire sur le devis" })
    expect(tva.icons[0]).toBe("calculator")
    const chantier = pickCoverIcons({ title: "Bien organiser son atelier" })
    expect(chantier.family).toBe("chantier")
    expect(chantier.icons[0]).toBe("hard-hat")
    expect(chantier.icons[4]).toBe("wrench")
  })

  it("les 11 métiers sont reconnus", () => {
    const cases: [string, string][] = [
      ["pompe à chaleur", "chauffagiste"],
      ["devis plomberie", "plombier"],
      ["tableau électrique", "electricien"],
      ["dalle béton", "macon"],
      ["ravalement de façade", "peintre"],
      ["pose de carrelage", "carreleur"],
      ["fenêtre bois", "menuisier"],
      ["toiture", "couvreur"],
      ["placo", "plaquiste"],
      ["serrurier", "serrurier"],
      ["terrasse jardin", "paysagiste"],
    ]
    for (const [text, trade] of cases) expect(detectTrade(text)).toBe(trade)
    expect(detectTrade("facturation")).toBeNull()
  })

  it("trait fin et constant : l'épaisseur voulue en pixels ne dépend pas de la taille", () => {
    const small = Buffer.from(iconDataUri("house", 96, "#A9BFE6").split(",")[1], "base64").toString()
    const large = Buffer.from(iconDataUri("house", 150, "#2563EB").split(",")[1], "base64").toString()
    const width = (svg: string) => Number(/stroke-width="([\d.]+)"/.exec(svg)![1])
    expect(width(small) * (96 / 24)).toBeCloseTo(3.4, 1)
    expect(width(large) * (150 / 24)).toBeCloseTo(3.4, 1)
    expect(small).toContain(ICON_MARKUP.house)
    expect(large).toContain('stroke="#2563EB"')
  })
})

describe("texte alternatif", () => {
  it("le titre, 180 caractères au plus, coupé sur une fin de mot", () => {
    expect(coverAlt("  Comment facturer   un chantier ")).toBe("Comment facturer un chantier")
    const long = coverAlt(`Facturer ${"un chantier très compliqué ".repeat(20)}`)
    expect(long.length).toBeLessThanOrEqual(ALT_MAX)
    expect(long.endsWith(" ")).toBe(false)
  })
})

describe("métadonnées", () => {
  it("XMP : titre, description, mots-clés, auteur, droits, origine ; texte échappé", () => {
    const xmp = xmpOf(
      { title: 'Devis & factures <b>"x"</b>', description: "Un électricien", keywords: ["devis électricien", "Devis Électricien", "tva 10 %", "", null], creator: "Qonforme", source: "graphic" },
      2026,
    )
    expect(xmp).toContain("Devis &amp; factures &lt;b&gt;&quot;x&quot;&lt;/b&gt;")
    expect(xmp).not.toContain("<b>")
    // Mots-clés sans doublon (accents et casse), vides retirés
    expect(xmp.match(/<rdf:li>/g)?.length).toBe(3)
    expect(xmp).toContain("<rdf:li>devis électricien</rdf:li>")
    expect(xmp).toContain("<dc:creator><rdf:Seq><rdf:li>Qonforme</rdf:li></rdf:Seq></dc:creator>")
    expect(xmp).toContain("© 2026 Qonforme")
    expect(xmp).toContain("<photoshop:Credit>Qonforme</photoshop:Credit>")
    expect(xmp).toContain("digitalsourcetype/digitalArt")
    expect(xmpOf({ source: "ai" }, 2026)).toContain("digitalsourcetype/trainedAlgorithmicMedia")
    // Sans auteur : ni droits ni outil
    expect(xmpOf({ title: "x" }, 2026)).not.toContain("dc:rights")
  })

  it("EXIF en ASCII (le texte accentué n'y survit pas), vide sans description ni auteur", () => {
    expect(exifOf({ description: "Un électricien raccorde un tableau — œuvre", creator: "Qonforme" }, 2026).IFD0).toEqual({
      ImageDescription: "Un electricien raccorde un tableau - oeuvre",
      Artist: "Qonforme",
      Copyright: "Copyright 2026 Qonforme",
    })
    expect(exifOf({ keywords: ["x"] }, 2026).IFD0).toEqual({})
    expect(asciiOf("L’été « chaud »")).toBe("L'ete \" chaud \"")
    expect(cleanKeywords(Array.from({ length: 40 }, (_, i) => `mot ${i}`))).toHaveLength(20)
  })
})

describe("rendu de la couverture (PNG 1 600 × 900)", () => {
  it("dessine un PNG de la bonne taille, identique pour le même titre", async () => {
    const a = await renderCoverPng({ title: "Comment facturer un chantier : la liste de contrôle de l'artisan" })
    expect(a.png.subarray(1, 4).toString()).toBe("PNG")
    const meta = await sharp(a.png).metadata()
    expect([meta.width, meta.height]).toEqual([COVER_WIDTH, COVER_HEIGHT])
    expect(a.png.length).toBeGreaterThan(20_000)
    const again = await renderCoverPng({ title: "Comment facturer un chantier : la liste de contrôle de l'artisan" })
    expect(again.png.equals(a.png)).toBe(true)
    // Fond blanc et texte foncé : la moitié de l'image au moins est blanche
    const { data } = await sharp(a.png).resize(160, 90).raw().toBuffer({ resolveWithObject: true })
    let white = 0
    for (let i = 0; i < data.length; i += 3) if (data[i] > 245 && data[i + 1] > 245 && data[i + 2] > 245) white++
    expect(white / (data.length / 3)).toBeGreaterThan(0.7)
    await expect(renderCoverPng({ title: "   " })).rejects.toThrow(/Titre vide/)
  }, 30_000)
})

describe("makeCover", () => {
  it("WebP sous covers/, nommée d'après le mot-clé, métadonnées de Qonforme, texte alternatif = titre", async () => {
    const cover = await makeCover({
      title: "Comment facturer un chantier : la liste de contrôle de l'artisan",
      keyword: "comment facturer un chantier",
      now: new Date("2026-10-17T10:00:00Z"),
    })
    expect(state.uploads).toHaveLength(1)
    const up = state.uploads[0]
    expect(up.path).toMatch(/^covers\/2026\/10\/comment-facturer-un-chantier-[a-z0-9]+\.webp$/)
    expect(up.opts).toMatchObject({ contentType: "image/webp", upsert: false, cacheControl: "31536000" })
    expect(cover).toMatchObject({ width: 1600, height: 900, alt: "Comment facturer un chantier : la liste de contrôle de l'artisan" })
    expect(cover.url).toBe(`${SUPABASE}/storage/v1/object/public/blog-covers/${up.path}#w=1600&h=900`)
    const meta = await sharp(up.data).metadata()
    expect(meta.format).toBe("webp")
    expect(up.data.length).toBeLessThan(150_000)
    const xmp = meta.xmp?.toString("utf8") ?? ""
    expect(xmp).toContain("comment facturer un chantier")
    expect(xmp).toContain("digitalArt")
    expect(xmp).toContain("© 2026 Qonforme")
  }, 30_000)

  it("sans mot-clé, le fichier porte le titre", async () => {
    await makeCover({ title: "Exemple de devis de plomberie, prêt à recopier", now: new Date("2026-10-17T10:00:00Z") })
    expect(state.uploads[0].path).toMatch(/^covers\/2026\/10\/exemple-de-devis-de-plomberie-pret-a-recopier-[a-z0-9]+\.webp$/)
  }, 30_000)
})

describe("POST /api/admin/blog/images/cover", () => {
  const req = (body: unknown) =>
    new NextRequest("http://localhost/api/admin/blog/images/cover", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } })
  const ok = { title: "Comment facturer un chantier : la liste de contrôle de l'artisan", keyword: "comment facturer un chantier" }

  it("401 hors session admin, 400 sans titre ou avec un titre trop court", async () => {
    state.admin = false
    expect((await coverRoute(req(ok))).status).toBe(401)
    state.admin = true
    const short = await coverRoute(req({ title: "ab" }))
    expect(short.status).toBe(400)
    expect(JSON.stringify(await short.json())).toContain("Écrivez d'abord le titre")
    expect((await coverRoute(req({}))).status).toBe(400)
    expect((await coverRoute(new NextRequest("http://localhost/x", { method: "POST", body: "pas du json" }))).status).toBe(400)
    expect(state.uploads).toHaveLength(0)
  })

  it("422 si le titre ou le mot-clé nomme un concurrent (écrit sur l'image publique)", async () => {
    const competitor = SETTINGS_DEFAULTS.targeting.competitors[0]
    const res = await coverRoute(req({ title: `Alternative à ${competitor} pour vos devis` }))
    expect(res.status).toBe(422)
    expect((await res.json()).code).toBe("competitor")
    const viaKeyword = await coverRoute(req({ title: "Comment faire un devis", keyword: competitor }))
    expect(viaKeyword.status).toBe(422)
    expect(state.uploads).toHaveLength(0)
  })

  it("200 : adresse avec dimensions, texte alternatif, famille d'icônes", async () => {
    const res = await coverRoute(req(ok))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ width: 1600, height: 900, alt: ok.title, family: "papiers" })
    expect(body.url).toMatch(/\/covers\/\d{4}\/\d{2}\/comment-facturer-un-chantier-[a-z0-9]+\.webp#w=1600&h=900$/)
    expect(state.uploads).toHaveLength(1)
  }, 30_000)

  it("503 si le stockage est en échec, avec un message en français", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    state.uploadError = { message: "Bucket not found" }
    const res = await coverRoute(req(ok))
    expect(res.status).toBe(503)
    expect((await res.json()).code).toBe("upload")
  }, 30_000)
})
