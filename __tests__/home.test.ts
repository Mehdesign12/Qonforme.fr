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

  it("aucune réponse de la FAQ ne dit que la plateforme agréée transmet déjà l'émission de 2027", () => {
    const toutes = FAQ_ITEMS.map((i) => `${i.q} ${i.a}`).join(" ")
    expect(toutes).not.toMatch(/prêt pour la facture électronique/i)
    expect(toutes).not.toMatch(/certifi|homologu/i)
    expect(toutes).toMatch(/pas une plateforme agréée/)
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

  it("le bloc « Ressources » lie les 11 métiers du bâtiment", () => {
    const ressources = lire("components/home/Resources.tsx")
    const slugs = Array.from(ressources.matchAll(/slug: "([a-z]+)"/g), (m) => m[1])
    expect(slugs.sort()).toEqual(
      ["carreleur", "chauffagiste", "couvreur", "electricien", "macon", "menuisier", "peintre", "plaquiste", "plombier", "serrurier", "paysagiste"].sort(),
    )
  })
})
