/**
 * Plan du site (app/sitemap.ts) : adresses uniques et sans pages de connexion,
 * outils et modèles présents, et surtout des `lastmod` vrais : aucune date
 * « maintenant » sur les pages statiques (104 adresses en portaient une jusqu'au
 * 15/10/2026), les guides à leur date de vérification, le blog à ses mises à jour.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

const posts = [
  { slug: "ancien", updated_at: "2026-09-01T08:00:00Z" },
  { slug: "recent", updated_at: "2026-10-12T14:30:00Z" },
  { slug: "cache", updated_at: "2026-10-14T09:00:00Z" },
]

/** Faux client Supabase : la requête « noindex » (select("slug")) renvoie l'article masqué. */
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => ({
    from: () => {
      let colonnes = ""
      const builder: { select: (c: string) => typeof builder; eq: () => typeof builder; then: (r: (v: unknown) => void) => void } = {
        select: (c: string) => ((colonnes = c), builder),
        eq: () => builder,
        then: (resolve) => resolve({ data: colonnes === "slug" ? [{ slug: "cache" }] : posts }),
      }
      return builder
    },
  }),
}))

import sitemap from "@/app/sitemap"
import { GUIDES } from "@/lib/pseo/guides"
import { METIERS } from "@/lib/pseo/metiers"
import { MODELES } from "@/lib/pseo/modeles"
import { GLOSSAIRE } from "@/lib/pseo/glossaire"
import { INSTALLATIONS } from "@/lib/pseo/installation"

const BASE = "https://qonforme.fr"
let entries: Awaited<ReturnType<typeof sitemap>>
const urls = () => entries.map((e) => e.url)
const entree = (path: string) => entries.find((e) => e.url === `${BASE}${path}`)

beforeEach(async () => {
  entries = await sitemap()
})

describe("adresses", () => {
  it("toutes sur qonforme.fr, sans doublon, sans paramètre ni ancre", () => {
    expect(new Set(urls()).size).toBe(urls().length)
    for (const u of urls()) {
      expect(u.startsWith(BASE), u).toBe(true)
      expect(u, u).not.toMatch(/[?#]/)
      expect(u.endsWith("/") && u !== `${BASE}/`, u).toBe(false)
    }
  })

  it("ni connexion ni mot de passe oublié : pages sans valeur de recherche", () => {
    expect(entree("/login")).toBeUndefined()
    expect(entree("/forgot-password")).toBeUndefined()
    expect(entree("/signup")).toBeDefined()
  })

  it("contient les 14 outils, tous les modèles, guides, métiers, installations et termes du glossaire", () => {
    expect(urls().filter((u) => u.startsWith(`${BASE}/outils/`)).length).toBe(14)
    expect(entree("/outils/calculateur-beton")).toBeDefined()
    expect(entree("/outils/calculateur-pente")).toBeDefined()
    for (const m of MODELES) expect(entree(`/modele/${m.slug}`), m.slug).toBeDefined()
    for (const g of GUIDES) expect(entree(`/guide/${g.slug}`), g.slug).toBeDefined()
    for (const m of METIERS) expect(entree(`/facturation/${m.slug}`), m.slug).toBeDefined()
    for (const i of INSTALLATIONS) expect(entree(`/devenir-a-son-compte/${i.slug}`), i.slug).toBeDefined()
    for (const t of GLOSSAIRE) expect(entree(`/glossaire/${t.slug}`), t.slug).toBeDefined()
    expect(entree("/modele/devis-electricien")).toBeDefined()
  })

  it("blog : article visible présent, article « noindex » absent", () => {
    expect(entree("/blog/recent")).toBeDefined()
    expect(entree("/blog/ancien")).toBeDefined()
    expect(entree("/blog/cache")).toBeUndefined()
  })
})

describe("lastmod", () => {
  const pasBlog = () => entries.filter((e) => !e.url.startsWith(`${BASE}/blog/`) && e.url !== `${BASE}/blog`)

  it("jamais une date « maintenant » sur une page statique : minuit UTC ou rien", () => {
    for (const e of pasBlog()) {
      if (!e.lastModified) continue
      const d = new Date(e.lastModified)
      expect(Number.isNaN(d.getTime()), e.url).toBe(false)
      expect([d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMilliseconds()], e.url).toEqual([0, 0, 0, 0])
      expect(d.getTime(), `${e.url} dans le futur`).toBeLessThanOrEqual(Date.now())
    }
  })

  it("beaucoup de pages sans date plutôt que des dates inventées", () => {
    expect(pasBlog().filter((e) => !e.lastModified).length).toBeGreaterThan(40)
  })

  it("guides : date de vérification", () => {
    for (const g of GUIDES) {
      const e = entree(`/guide/${g.slug}`)!
      if (g.verifieLe) expect(new Date(e.lastModified!).toISOString().slice(0, 10), g.slug).toBe(g.verifieLe)
      else expect(e.lastModified, g.slug).toBeUndefined()
    }
  })

  it("pages modifiées le 15/10/2026 : outils neufs, hubs, modèles de devis", () => {
    for (const p of ["/outils", "/outils/calculateur-beton", "/outils/calculateur-pente", "/modele", "/modele/devis-electricien", "/modele/devis-travaux", "/facturation"])
      expect(new Date(entree(p)!.lastModified!).toISOString().slice(0, 10), p).toBe("2026-10-15")
    // un modèle qu'on n'a pas touché n'affiche pas de date
    expect(entree("/modele/facture-classique")!.lastModified).toBeUndefined()
  })

  it("articles : leur mise à jour ; hub du blog : le plus récent des articles visibles (pas l'article masqué)", () => {
    expect(new Date(entree("/blog/ancien")!.lastModified!).toISOString()).toBe("2026-09-01T08:00:00.000Z")
    expect(new Date(entree("/blog")!.lastModified!).toISOString()).toBe("2026-10-12T14:30:00.000Z")
  })
})
