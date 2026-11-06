import { describe, expect, it } from "vitest"
import { auditArticle } from "@/lib/blog-audit"

const ids = (text: string) => Array.from(new Set(auditArticle(text).map((f) => f.rule.id)))

describe("auditArticle", () => {
  it("repère les anciens seuils, quelle que soit l'espace des milliers", () => {
    expect(ids("Le seuil est de 36 800 € pour les services")).toEqual(["franchise-anciens-seuils"])
    expect(ids("Le seuil est de 91 900 € pour la vente")).toEqual(["franchise-anciens-seuils"])
    expect(ids("Plafond micro : 77.700 euros")).toEqual(["micro-anciens-plafonds"])
  })

  it("repère le calcul faux des pénalités et l'article 283-1", () => {
    expect(ids("Le taux par défaut est le taux directeur de la BCE × 3")).toContain("penalites-bce-x3")
    expect(ids("soit trois fois le taux de la BCE")).toContain("penalites-bce-x3")
    expect(ids("mention « Autoliquidation — article 283-1 du CGI »")).toEqual(["autoliquidation-283-1"])
  })

  it("repère l'ancien seuil de 150 € du devis obligatoire", () => {
    expect(ids("Le devis est obligatoire pour les travaux de plus de 150 € TTC.")).toEqual(["devis-seuil-150"])
    expect(ids("Au-delà de 150 euros, un devis détaillé est exigé.")).toEqual(["devis-seuil-150"])
    // Le n° de TVA du client au-delà de 150 € HT concerne la facture, pas le devis
    expect(ids("Sur la facture, le numéro de TVA du client est exigé au-delà de 150 € HT.")).toEqual([])
  })

  it("laisse passer les valeurs justes", () => {
    const juste = "Seuils 2026 : 37 500 € pour les services, 85 000 € pour la vente. Pénalités : jamais moins de 3 fois le taux d'intérêt légal ; à défaut, taux BCE + 10 points. Plateforme agréée."
    expect(auditArticle(juste)).toEqual([])
  })

  it("renvoie un extrait autour de la valeur", () => {
    const [f] = auditArticle("Pour 2026, le seuil de franchise reste à 36 800 € selon cet article.")
    expect(f.excerpt).toContain("36 800 €")
    expect(f.rule.correction).toContain("37")
  })
})

describe("plateforme agréée et PPF", () => {
  const ids = (t: string) => auditArticle(t).map((f) => f.rule.id)
  it("repère Qonforme présenté comme une PDP ou une plateforme agréée", () => {
    expect(ids("Qonforme est une PDP (Plateforme de Dématérialisation Partenaire) en cours d'immatriculation.")).toContain("qonforme-plateforme-agreee")
    expect(ids("Qonforme est une plateforme agréée.")).toContain("qonforme-plateforme-agreee")
  })
  it("laisse passer Qonforme raccordé à une plateforme agréée", () => {
    expect(ids("Qonforme est raccordé à la plateforme agréée Super PDP.")).not.toContain("qonforme-plateforme-agreee")
    expect(ids("Qonforme n'est pas une plateforme agréée.")).not.toContain("qonforme-plateforme-agreee")
  })
  it("repère le PPF présenté comme une voie d'envoi", () => {
    expect(ids("via une Plateforme de Dématérialisation Partenaire (PDP) ou le Portail Public de Facturation (PPF).")).toContain("ppf-alternative")
    expect(ids("Vous pouvez choisir d'utiliser le Portail Public de Facturation (PPF).")).toContain("ppf-alternative")
    expect(ids("Le portail public de facturation ne transmet pas les factures entre entreprises.")).not.toContain("ppf-alternative")
  })
})
