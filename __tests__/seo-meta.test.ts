import { describe, expect, it } from "vitest"
import { composeDescription, fitDescription, fitTitle, shortenTitle, TITLE_MAX, DESCRIPTION_MAX } from "@/lib/seo/meta"

const rendered = (t: ReturnType<typeof fitTitle>) => (typeof t === "string" ? `${t} | Qonforme` : (t as { absolute: string }).absolute)

describe("titres sous 70 caractères (PushRank : « Raccourcir la balise title »)", () => {
  it("garde le suffixe quand il tient", () => {
    expect(fitTitle("Modèle de devis gratuit")).toBe("Modèle de devis gratuit")
  })

  it("retire le suffixe quand seul le titre tient", () => {
    const t = "Facturation électronique 2026 : le guide complet des artisans et TPE"
    expect(t.length).toBeLessThanOrEqual(TITLE_MAX)
    expect(fitTitle(t)).toEqual({ absolute: t })
  })

  it("retire d'abord les parenthèses", () => {
    expect(shortenTitle("Facture Peintre Bâtiment : Les 9 Erreurs Courantes qui Coûtent Cher (et Comment les Éviter)")).toBe(
      "Facture Peintre Bâtiment : Les 9 Erreurs Courantes qui Coûtent Cher",
    )
  })

  it("coupe à une articulation naturelle, jamais sur un mot outil", () => {
    const t = shortenTitle("Facture Électricien : Les Mentions Indispensables pour une Conformité Sans Faille et Anticiper 2026")
    expect(t).toBe("Facture Électricien : Les Mentions Indispensables")
    const q = shortenTitle("C'est quoi un Avoir en Facturation ? Définition, Exemples et les 9 Erreurs d'Artisans à Éviter Absolument")
    expect(q).toBe("C'est quoi un Avoir en Facturation ? Définition, Exemples")
  })

  it("aucun titre rendu ne dépasse 70 caractères", () => {
    const titres = [
      "Facturation Artisanale et Comptabilité : Guide Complet pour Plombiers, Électriciens, Peintres et Maçons face à la Réforme 2026",
      "Tableau de Bord Artisan : Votre Calendrier Annuel pour un Pilotage Optimisé et un Suivi Chiffre d'Affaires Performant",
      "Plateforme de dématérialisation partenaire (PDP) — Définition facturation",
      "Unmotsansespacequiestbeaucouptroplongpourtenirdansunebaliseunmotsansespacequiestbeaucouptroplong et la suite",
    ]
    for (const t of titres) {
      const out = rendered(fitTitle(t))
      expect(out.length).toBeLessThanOrEqual(TITLE_MAX)
      expect(out.length).toBeGreaterThan(20)
      expect(out).not.toMatch(/[\s,:;–—-]$/)
    }
  })
})

describe("descriptions qui tiennent sous le lien", () => {
  it("ne touche pas une description courte", () => {
    expect(fitDescription("Une phrase courte.")).toBe("Une phrase courte.")
  })

  it("garde les phrases entières quand c'est possible", () => {
    const d =
      "Découvrez les mentions obligatoires et spécifiques pour une facture d'électricien conforme. Gérez votre facturation électricité et devis électricien en toute sérénité avec les conseils d'expert pour artisans."
    expect(fitDescription(d)).toBe("Découvrez les mentions obligatoires et spécifiques pour une facture d'électricien conforme.")
  })

  it("coupe au mot avec « … » quand la première phrase est trop longue", () => {
    const d =
      "Tout comprendre sur la réforme de la facturation électronique : calendrier, formats acceptés, plateformes agréées, obligations par taille d'entreprise et par secteur d'activité en France"
    const out = fitDescription(d)
    expect(out.length).toBeLessThanOrEqual(DESCRIPTION_MAX)
    expect(out.endsWith("…")).toBe(true)
    expect(out).not.toMatch(/\s…$/)
  })

  it("complète une définition trop courte avec la suite du texte", () => {
    const out = composeDescription([
      "Somme versée à la commande qui permet à chaque partie de se désengager.",
      "Contrairement à l'acompte, les arrhes permettent l'annulation : le client perd les arrhes, le professionnel les rembourse au double. Sauf mention contraire, les sommes versées sont présumées être des arrhes.",
    ])
    expect(out.startsWith("Somme versée à la commande")).toBe(true)
    expect(out.length).toBeGreaterThanOrEqual(120)
    expect(out.length).toBeLessThanOrEqual(DESCRIPTION_MAX)
  })
})

describe("glossaire : descriptions entre 120 et 155 caractères", () => {
  it("toutes les entrées du glossaire", async () => {
    const { GLOSSAIRE } = await import("@/lib/pseo/glossaire")
    for (const t of GLOSSAIRE) {
      const d = composeDescription([t.definition, t.explication])
      expect(d.length, t.slug).toBeGreaterThanOrEqual(120)
      expect(d.length, t.slug).toBeLessThanOrEqual(DESCRIPTION_MAX)
      expect(d.startsWith(t.definition.slice(0, 20)), t.slug).toBe(true)
    }
  })
})

it("ne laisse jamais une parenthèse ouverte en fin de description", async () => {
  const { GLOSSAIRE } = await import("@/lib/pseo/glossaire")
  for (const t of GLOSSAIRE) {
    const d = composeDescription([t.definition, t.explication])
    expect((d.match(/\(/g) ?? []).length, t.slug).toBe((d.match(/\)/g) ?? []).length)
  }
})

describe("guides : titres et descriptions (PushRank, 04/10/2026)", () => {
  it("chaque guide a un title sous 70 caractères et une description de 120 à 155 caractères", async () => {
    const { GUIDES } = await import("@/lib/pseo/guides")
    for (const g of GUIDES) {
      const title = rendered(fitTitle(g.titreSeo ?? g.titre))
      expect(title.length, g.slug).toBeLessThanOrEqual(TITLE_MAX)
      expect(fitDescription(g.description).length, g.slug).toBeLessThanOrEqual(DESCRIPTION_MAX)
    }
  })

  it("les guides refondus visent leur requête et citent leurs sources", async () => {
    const { getGuideBySlug } = await import("@/lib/pseo/guides")
    const mentions = getGuideBySlug("mentions-obligatoires-facture")!
    expect(mentions.titreSeo).toMatch(/^Mentions obligatoires d'une facture/)
    const pa = getGuideBySlug("plateforme-agreee")!
    expect(pa.titreSeo).toMatch(/^Plateforme agréée/)
    for (const g of [mentions, pa]) {
      expect(g.description.length, g.slug).toBeGreaterThanOrEqual(120)
      expect(g.essentiel?.length, g.slug).toBeGreaterThan(3)
      expect(g.sources?.some((s) => s.href?.startsWith("https://")), g.slug).toBe(true)
      expect(g.verifieLe, g.slug).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      // Aucun concurrent ni promesse invérifiable (DECISIONS-STRATEGIQUES.md)
      const text = JSON.stringify(g)
      expect(text, g.slug).not.toMatch(/certifi[ée] par|homologu|n°\s?1|leader|meilleur/i)
    }
  })
})
