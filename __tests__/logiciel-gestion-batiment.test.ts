/**
 * Page « Logiciel de gestion bâtiment et devis » (24/10/2026).
 *
 * Ces tests gardent ce qui ne se voit pas à l'écran : balises sous les limites de
 * Google, route enregistrée partout où une page publique doit l'être (plan du site,
 * middleware, service worker, pied de page, liens automatiques), JSON-LD égal aux
 * questions affichées, et les règles d'honnêteté de CLAUDE.md (aucun concurrent,
 * aucun « certifié », « gratuit » seulement pour les devis, prix lus dans plans.ts).
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"
import * as React from "react"
import { beforeAll, describe, expect, it } from "vitest"
import { DESCRIPTION_MAX, TITLE_MAX } from "@/lib/seo/meta"
import { autoLinkPseo } from "@/lib/blog-autolink"
import { MAIN_PAGES } from "@/lib/seo/links/catalog"

beforeAll(() => {
  // Le JSX du dépôt est compilé en React.createElement : React global avant le chargement de la page
  ;(globalThis as { React?: typeof React }).React = React
})

const lire = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8")
const PAGE = "app/logiciel-gestion-batiment/page.tsx"
const ROUTE = "/logiciel-gestion-batiment"

describe("balises", () => {
  it("title et description tiennent sous le lien Google, avec le mot-clé", async () => {
    // metadata ne dépend pas des composants : on lit le module tel quel
    const { metadata } = await import("@/app/logiciel-gestion-batiment/page")
    const title = String(metadata.title)
    expect(title).toMatch(/^Logiciel de gestion bâtiment et devis/)
    // Le suffixe « | Qonforme » est ajouté par le layout
    expect(`${title} | Qonforme`.length).toBeLessThanOrEqual(TITLE_MAX)
    const d = String(metadata.description)
    expect(d.length).toBeGreaterThanOrEqual(120)
    expect(d.length).toBeLessThanOrEqual(DESCRIPTION_MAX)
    expect(d).toMatch(/logiciel de gestion/i)
    expect((metadata.alternates as { canonical: string }).canonical).toBe(ROUTE)
  })

  it("un seul H1, qui porte le nom de la page", () => {
    const src = lire(PAGE)
    expect(src).toContain('const TITRE = "Logiciel de gestion bâtiment et devis"')
    expect(src).toContain("title={TITRE}")
    expect(src.match(/<h1/g)).toBeNull() // le H1 vient de ContentHero, une seule fois
  })
})

describe("JSON-LD", () => {
  it("la FAQ est construite sur les questions affichées, et seulement sur elles", () => {
    const src = lire(PAGE)
    expect(src).toContain("FAQ.map((f) => ({ question: f.question, answer: f.reponse }))")
    expect(src).toContain("FAQ.map((f) => ({ \"@type\": \"Question\"")
    expect(src.match(/"@type": "FAQPage"/g)).toHaveLength(1)
    expect(src.match(/"@type": "BreadcrumbList"/g)).toHaveLength(1)
    // Les schémas du site (Organization, WebApplication) restent dans le layout : jamais dupliqués ici
    expect(src).not.toMatch(/"@type": "(WebApplication|SoftwareApplication)"/)
  })
})

describe("la route est enregistrée partout", () => {
  it("plan du site XML, avec une date vraie", () => {
    const s = lire("app/sitemap.ts")
    expect(s).toContain(`"${ROUTE}": "2026-10-24"`)
    expect(s).toContain("url: `${baseUrl}/logiciel-gestion-batiment`")
  })

  it("middleware et service worker restent alignés (page publique, identique pour tous)", () => {
    expect(lire("lib/supabase/middleware.ts")).toContain(`'${ROUTE}'`)
    expect(lire("public/sw.js")).toContain(`'${ROUTE}'`)
  })

  it("liée du pied de page (donc de toutes les pages publiques) et du plan du site HTML", () => {
    expect(lire("components/layout/Footer.tsx")).toContain(`href: "${ROUTE}"`)
    expect(lire("app/plan-du-site/page.tsx")).toContain(`href: "${ROUTE}"`)
  })

  it("proposée à l'éditeur d'articles et liée automatiquement dans le blog", () => {
    expect(MAIN_PAGES.some((p) => p.path === ROUTE)).toBe(true)
    const html = autoLinkPseo("<p>Un logiciel de gestion pour le bâtiment évite les ressaisies.</p>")
    expect(html).toContain(`href="${ROUTE}"`)
    // Jamais dans un attribut de balise
    expect(autoLinkPseo('<img alt="logiciel de gestion bâtiment" src="/a.png">')).not.toContain(`href="${ROUTE}"`)
  })
})

describe("honnêteté (CLAUDE.md, DECISIONS-STRATEGIQUES.md § 2 et § 10)", () => {
  const src = lire(PAGE)
  // Le texte visible : on retire les commentaires et les imports
  const texte = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^import .*$/gm, "")

  it("aucun concurrent nommé, aucun mot interdit", () => {
    expect(texte).not.toMatch(/certifi|homologu|agréé par|solution compatible/i)
    expect(texte).not.toMatch(/costructor|obat|batappli|kalitics|henrri|tolteck|indy\b|freebe|sellsy|zervant|pennylane/i)
    // « conforme » : jamais en promesse de conformité du produit
    expect(texte).not.toMatch(/\bconforme/i)
  })

  it("« gratuit » ne vise que les devis, jamais les factures ni les relances", () => {
    expect(texte).not.toMatch(/factures? gratuites?|relances? gratuites?|facturation gratuite|gratuitement (vos )?factur/i)
  })

  it("aucun chiffre, avis ni utilisateur inventé", () => {
    expect(texte).not.toMatch(/\d[\d  ]* (utilisateurs|clients satisfaits|artisans nous font confiance)/i)
    expect(texte).not.toMatch(/\b(4,[0-9]|5)\/5\b|\bavis (clients|vérifiés)\b|étoiles/i)
  })

  it("les prix, les fonctions et les « à venir » viennent de plans.ts, jamais écrits en dur", () => {
    expect(texte).toContain("PLANS.starter")
    expect(texte).toContain("PLANS.pro")
    expect(texte).toContain("TAX_SUFFIX")
    // Aucun montant d'abonnement en dur (24, 34, 240, 340 €)
    expect(texte).not.toMatch(/\b(24|34|240|340) ?€/)
  })

  it("la formule Artisan n'est décrite comme disponible que si elle est en vente", () => {
    expect(texte).toContain("const artisanEnVente = artisan.available")
    expect(texte).toMatch(/artisanEnVente\s*\?/)
    expect(texte).toContain("bientôt disponible")
  })

  it("ne promet ni la signature en ligne, ni l'émission par plateforme, ni un raccordement", () => {
    expect(texte).not.toMatch(/signature en ligne|signer en ligne|signer (vos |le )?devis en ligne/i)
    expect(texte).not.toMatch(/raccordé|raccordement|transmis(e|sion)? par une plateforme/i)
  })

  it("aucune promesse de contact humain ni de délai de réponse (CLAUDE.md)", () => {
    expect(texte).not.toMatch(/sous 24 ?h|appel (téléphonique|vidéo)|\bvisio\b|un humain|réponse garantie/i)
  })
})
