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
