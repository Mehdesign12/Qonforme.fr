/**
 * Accueil (17/10/2026) : la page reprend la structure d'une page de référence
 * avec un contenu vrai. Ces tests gardent ce qui ne se voit pas à l'écran :
 * le balisage FAQ égal aux questions affichées, l'ancienne adresse /design qui
 * renvoie vers l'accueil, et les ancres que le reste du site vise.
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"
import * as React from "react"
import { beforeAll, describe, expect, it } from "vitest"

import type { FAQ_ITEMS as FaqItems } from "@/components/home/Closing"

let FAQ_ITEMS: typeof FaqItems

beforeAll(async () => {
  // Le JSX du dépôt est compilé en React.createElement : React global avant le chargement des composants
  ;(globalThis as { React?: typeof React }).React = React
  ;({ FAQ_ITEMS } = await import("@/components/home/Closing"))
})

const lire = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8")

describe("accueil", () => {
  it("le JSON-LD FAQPage est construit sur les questions affichées, et sur elles seules", () => {
    const page = lire("app/page.tsx")
    expect(page).toContain("FAQ_ITEMS.map")
    expect(page).toContain('"@type": "FAQPage"')
    expect(page.match(/"@type": "FAQPage"/g)).toHaveLength(1)
    expect(FAQ_ITEMS.length).toBeGreaterThanOrEqual(5)
    for (const item of FAQ_ITEMS) {
      expect(item.q.trim()).not.toBe("")
      expect(item.a.trim()).not.toBe("")
    }
  })

  it("FAQ de conversion : chaque réponse commence par « Oui », jamais « certifié », le chantier a sa question", () => {
    for (const item of FAQ_ITEMS) expect(item.a).toMatch(/^Oui\b/)
    const toutes = FAQ_ITEMS.map((i) => `${i.q} ${i.a}`).join(" ")
    expect(toutes).not.toMatch(/certifi|homologu|agréé par l'État/i)
    expect(toutes).not.toMatch(/est une plateforme agréée/i)
    expect(FAQ_ITEMS.some((i) => /chantiers?/.test(i.q))).toBe(true)
  })

  it("titre de l'accueil : « Chiffrez, organisez, encaissez. » puis la seconde voix", () => {
    const hero = lire("components/home/HomeHero.tsx")
    expect(hero).toContain("Chiffrez, organisez, encaissez.")
    expect(hero).toMatch(/<span className="q-serif block">Tout votre chantier dans une seule appli\.<\/span>/)
    expect(hero).toContain("Zéro euro pour chiffrer. Tout ce qu'il faut pour encaisser. Sans carte bancaire.")
    // Artisan aux quatre bras, détouré : arche sur ordinateur, bandeau bleu sur téléphone (canevas du 04/11/2026)
    expect(hero).toContain("/landing/hero/artisan-quatre-bras.webp")
    expect(hero).toContain("<HeroParallax")
  })

  it("aucune phrase d'auto-justification ni de « ne fait pas » sur l'accueil", () => {
    const tout = ["HomeHero", "Bands", "Features", "ConvertBand", "TradesCarousel", "Closing", "Resources"]
      .map((n) => lire(`components/home/${n}.tsx`))
      .join("\n")
      .replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "")
    expect(tout).not.toMatch(/ne fait pas|Pas d'avis inventés|noir sur blanc|rien d'annoncé/i)
  })

  it("canonical vers « / », titre et description du layout, un seul h1", () => {
    const page = lire("app/page.tsx")
    expect(page).toMatch(/alternates:\s*\{\s*canonical:\s*"\/"\s*\}/)
    expect(page).not.toMatch(/\btitle:/)
    const sections = ["HomeHero", "Bands", "Features", "ConvertBand", "TradesCarousel", "Closing", "Resources"]
      .map((n) => lire(`components/home/${n}.tsx`))
    const h1 = sections.join("\n").match(/<h1\b/g) ?? []
    expect(h1).toHaveLength(1)
  })

  it("/design renvoie définitivement vers l'accueil, sans rester une page publique", () => {
    expect(lire("next.config.mjs")).toMatch(/source:\s*'\/design',\s*destination:\s*'\/',\s*permanent:\s*true/)
    expect(lire("lib/supabase/middleware.ts")).not.toMatch(/'\/design'/)
    expect(lire("public/sw.js")).not.toMatch(/'\/design'/)
  })

  it("les ancres visées par l'en-tête et le pied de page existent sur l'accueil", () => {
    const tout = ["HomeHero", "Features", "Closing"].map((n) => lire(`components/home/${n}.tsx`)).join("\n")
    expect(lire("components/layout/Footer.tsx")).toContain('href: "/#devis"')
    expect(lire("components/layout/PublicNav.tsx")).toContain("`${prefix}#devis`")
    expect(tout).toContain('id="devis"')
    expect(tout).toContain('id="facture-electronique"')
    // Plus de section tarifs sur l'accueil : « Tarifs » mène à la page /pricing
    expect(lire("components/layout/PublicNav.tsx")).toContain('href: "/pricing"')
    expect(lire("components/layout/PublicNav.tsx")).not.toContain("#pricing")
  })

  it("le bloc « Ressources » lie les 12 métiers du bâtiment", () => {
    const ressources = lire("components/home/Resources.tsx")
    const slugs = Array.from(ressources.matchAll(/slug: "([a-z]+)"/g), (m) => m[1])
    expect(slugs.sort()).toEqual(
      ["carreleur", "chauffagiste", "couvreur", "electricien", "macon", "menuisier", "peintre", "plaquiste", "plombier", "serrurier", "paysagiste", "climaticien"].sort(),
    )
  })
})

describe("parallaxe du héros", () => {
  it("avance de 0 à 1 pendant que le cadre traverse l'écran, décalage borné", async () => {
    const { parallaxOffset, parallaxProgress } = await import("@/components/home/HeroParallax")
    expect(parallaxProgress(900, 500, 900)).toBe(0)
    expect(parallaxProgress(-500, 500, 900)).toBe(1)
    expect(parallaxProgress(200, 500, 900)).toBeCloseTo(0.5, 5)
    expect(parallaxProgress(2000, 500, 900)).toBe(0)
    expect(parallaxOffset(0.5, 40)).toBe(20)
    expect(parallaxOffset(3, 40)).toBe(40)
    expect(parallaxOffset(-1, 40)).toBe(0)
  })
  it("translate seul, jamais will-change ni backdrop-filter, rien avec « Réduire les animations »", () => {
    const src = lire("components/home/HeroParallax.tsx").replace(/\/\*[\s\S]*?\*\//g, "")
    expect(src).toContain("style.translate")
    expect(src).toContain("prefers-reduced-motion: reduce")
    expect(src).not.toMatch(/will-change|willChange|backdrop/i)
  })
})
