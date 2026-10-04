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

describe("devis et installation par métier (PushRank, 04/10/2026)", () => {
  it("le guide des mentions d'un devis vise sa requête, cite ses sources et ne reprend pas l'ancien seuil de 150 €", async () => {
    const { getGuideBySlug } = await import("@/lib/pseo/guides")
    const g = getGuideBySlug("mentions-obligatoires-devis")!
    expect(g.titreSeo).toMatch(/^Mentions obligatoires d'un devis/)
    const description = fitDescription(g.description)
    expect(description.length).toBeGreaterThanOrEqual(120)
    expect(description.length).toBeLessThanOrEqual(DESCRIPTION_MAX)
    expect(g.essentiel?.length).toBeGreaterThan(5)
    expect(g.sources?.some((s) => s.href?.includes("F31144"))).toBe(true)
    expect(g.verifieLe).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    // Le devis est dû dès le premier euro depuis le 1er avril 2017 (arrêté du 24 janvier 2017)
    const devis = getGuideBySlug("devis-obligatoire")!
    for (const guide of [g, devis]) {
      expect(JSON.stringify(guide), guide.slug).not.toMatch(/(au-delà|au-dessus|à partir) de 150 €/)
    }
    // Les deux guides ne se disputent pas la même requête
    expect(devis.motsCles).not.toContain("mentions obligatoires devis")
  })

  it("chaque page « Devenir … à son compte » a un title, une description et un contenu qui lui sont propres", async () => {
    const { INSTALLATIONS, etapes } = await import("@/lib/pseo/installation")
    const { getMetierBySlug } = await import("@/lib/pseo/metiers")
    const { TRADE_PHOTOS } = await import("@/components/content/metier")
    expect(INSTALLATIONS.length).toBeGreaterThanOrEqual(9)

    const seen = { titres: new Set<string>(), descriptions: new Set<string>(), questions: new Set<string>(), intros: new Set<string>() }
    for (const i of INSTALLATIONS) {
      const title = rendered(fitTitle(i.titreSeo))
      expect(title.length, i.slug).toBeLessThanOrEqual(TITLE_MAX)
      expect(i.titreSeo.toLowerCase(), i.slug).toContain(`devenir ${i.metier.split(" ")[0]}`)
      expect(i.description.length, i.slug).toBeGreaterThanOrEqual(120)
      expect(i.description.length, i.slug).toBeLessThanOrEqual(DESCRIPTION_MAX)
      // Même slug que la page « Logiciel de facturation pour … » et une photo du métier
      expect(getMetierBySlug(i.slug), i.slug).toBeTruthy()
      expect(i.slug in TRADE_PHOTOS, i.slug).toBe(true)
      expect(i.fiche.href, i.slug).toMatch(/^https:\/\/entreprendre\.service-public\.gouv\.fr\//)
      expect(i.specificites.length, i.slug).toBeGreaterThanOrEqual(3)
      expect(i.faq.length, i.slug).toBeGreaterThanOrEqual(3)
      expect(etapes(i).length, i.slug).toBe(6)

      for (const [set, value] of [[seen.titres, i.titreSeo], [seen.descriptions, i.description], [seen.intros, i.intro]] as const) {
        expect(set.has(value), `${i.slug} : ${value}`).toBe(false)
        set.add(value)
      }
      for (const f of i.faq) {
        expect(seen.questions.has(f.question), `${i.slug} : ${f.question}`).toBe(false)
        seen.questions.add(f.question)
      }
      // Aucune promesse invérifiable ni concurrent (DECISIONS-STRATEGIQUES.md)
      expect(JSON.stringify(i), i.slug).not.toMatch(/certifi[ée] par|homologu|n°\s?1|leader|meilleur|un humain|rendez-vous/i)
    }
  })

  it("les chiffres des pages d'installation viennent des constantes vérifiées des outils", async () => {
    const { CHIFFRES } = await import("@/lib/pseo/installation")
    const { ACTIVITES } = await import("@/lib/outils/charges")
    const { SEUILS_FRANCHISE_TVA } = await import("@/lib/outils/franchise-tva")
    const services = ACTIVITES.find((a) => a.id === "prestations-bic")!
    const franchise = SEUILS_FRANCHISE_TVA.find((s) => s.id === "services")!
    const digits = (s: string) => Number(s.replace(/\D/g, ""))
    expect(digits(CHIFFRES.plafondServices)).toBe(services.plafondCA)
    expect(digits(CHIFFRES.franchiseServices)).toBe(franchise.seuilBase)
    expect(CHIFFRES.cotisationsServices.replace(/\s/g, " ")).toBe(`${services.tauxCotisations.toLocaleString("fr-FR")} %`)
  })
})

it("un montant n'est jamais coupé en fin de ligne", async () => {
  const { fr } = await import("@/components/content/text")
  const nb = " "
  expect(fr("une amende de 7 500 € et 75 000 €")).toBe(`une amende de 7${nb}500${nb}€ et 75${nb}000${nb}€`)
  expect(fr("cotisations de 21,2 % du chiffre")).toBe(`cotisations de 21,2${nb}% du chiffre`)
  expect(fr("jusqu'à 1 000 000 €")).toBe(`jusqu'à 1${nb}000${nb}000${nb}€`)
  // Les dates et les références ne sont pas touchées
  expect(fr("arrêté du 24 janvier 2017, décret n° 2020-1817")).toBe("arrêté du 24 janvier 2017, décret n° 2020-1817")
  expect(fr("le 1er avril 2017 : 10 jours")).toBe(`le 1er avril 2017${nb}: 10 jours`)
})
