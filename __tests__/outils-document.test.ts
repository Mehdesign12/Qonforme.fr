import { describe, expect, it } from "vitest"
import {
  LIMITES,
  MENTIONS_PAIEMENT_DEFAUT,
  calculerTotaux,
  dateValide,
  ligneVierge,
  nomFichier,
  totalLigneCentimes,
  validerDocument,
  validerLigne,
} from "@/lib/outils/document"
import { genererPdfDocument } from "@/lib/outils/pdf-document"

const base = {
  emetteur: { nom: "Martin Plomberie", adresse: "3 rue Neuve, 33000 Bordeaux", siret: "732 829 320 00074", email: "m@ex.fr" },
  client: { nom: "Mme Durand", adresse: "8 allée des Roses, 33600 Pessac" },
  numero: "F-2026-007",
  date: "2026-10-03",
  echeance: "2026-11-02",
}

describe("totaux des générateurs (un seul calcul pour l'aperçu et le PDF)", () => {
  it("9 € HT à 5,5 % : 9,50 € TTC", () => {
    const t = calculerTotaux([{ description: "x", quantite: 1, prixHT: 9, tauxTVA: 5.5 }])
    expect([t.htCentimes, t.tvaCentimes, t.ttcCentimes]).toEqual([900, 50, 950])
  })

  it("quantité décimale × prix : arrondi au centime par ligne", () => {
    expect(totalLigneCentimes(12.5, 45.8)).toBe(57250)
    expect(totalLigneCentimes(0.333, 10)).toBe(333)
    expect(totalLigneCentimes(1.005, 1)).toBe(101)
    expect(totalLigneCentimes(3, 0.1)).toBe(30)
    expect(totalLigneCentimes(-2, 50)).toBe(-10000)
    expect(totalLigneCentimes(100_000, 10_000_000)).toBe(100_000_000_000_000)
  })

  it("ventilation de la TVA par taux (CGI, ann. II, art. 242 nonies A, I-11°)", () => {
    const t = calculerTotaux([
      { description: "Carrelage", quantite: 12.5, prixHT: 45.8, tauxTVA: 10 },
      { description: "Plinthes A", quantite: 1, prixHT: 10.25, tauxTVA: 5.5 },
      { description: "Plinthes B", quantite: 1, prixHT: 10.25, tauxTVA: 5.5 },
      { description: "Plinthes C", quantite: 1, prixHT: 10.25, tauxTVA: 5.5 },
    ])
    expect(t.ventilation).toEqual([
      { taux: 10, baseCentimes: 57250, tvaCentimes: 5725 },
      // 30,75 € × 5,5 % = 1,69125 € → 1,69 € (TVA sur la base du taux, pas ligne par ligne)
      { taux: 5.5, baseCentimes: 3075, tvaCentimes: 169 },
    ])
    expect([t.htCentimes, t.tvaCentimes, t.ttcCentimes]).toEqual([60325, 5894, 66219])
  })

  it("21 lignes : rien n'est perdu", () => {
    const lignes = Array.from({ length: 21 }, (_, i) => ({ description: `Prestation ${i + 1}`, quantite: 1, prixHT: 100, tauxTVA: 20 }))
    const v = validerDocument({ ...base, lignes }, "facture")
    expect(v.ok).toBe(true)
    if (v.ok) expect([v.document.totaux.lignes.length, v.document.totaux.htCentimes, v.document.totaux.ttcCentimes]).toEqual([21, 210000, 252000])
  })
})

describe("validation des lignes", () => {
  it("accepte la virgule décimale et les espaces", () => {
    const { ligne } = validerLigne({ description: "Pose", quantite: "12,5", prixHT: "1 234,56", tauxTVA: 20 })
    expect(ligne).toEqual({ description: "Pose", quantite: 12.5, prixHT: 1234.56, tauxTVA: 20 })
  })

  it("refuse prix non numérique, désignation absente, négatifs sans choix explicite", () => {
    expect(validerLigne({ description: "x", quantite: 2, prixHT: "abc", tauxTVA: 20 }).erreurs.prixHT).toMatch(/invalide/)
    expect(validerLigne({ quantite: 1, prixHT: 10, tauxTVA: 20 }).erreurs.description).toMatch(/manquante/)
    expect(validerLigne({ description: "Remise", quantite: -2, prixHT: 50, tauxTVA: 20 }).erreurs.quantite).toMatch(/négative/)
    expect(validerLigne({ description: "Remise", quantite: -2, prixHT: 50, tauxTVA: 20 }, { remises: true }).ligne?.quantite).toBe(-2)
    expect(validerLigne({ description: "x", quantite: 1, prixHT: 10.255, tauxTVA: 20 }).erreurs.prixHT).toMatch(/Deux décimales/)
    expect(validerLigne({ description: "x", quantite: 1, prixHT: 10, tauxTVA: 7 }).erreurs.tauxTVA).toBeTruthy()
    expect(validerLigne({ description: "x", quantite: LIMITES.quantite + 1, prixHT: 10, tauxTVA: 20 }).erreurs.quantite).toMatch(/trop élevée/)
  })

  it("ligne vierge ignorée", () => {
    expect(ligneVierge({ description: "", quantite: "1", prixHT: "", tauxTVA: 20 })).toBe(true)
    expect(ligneVierge({ description: " ", quantite: 1, prixHT: 0, tauxTVA: 20 })).toBe(true)
    expect(ligneVierge({ description: "", quantite: 1, prixHT: 10, tauxTVA: 20 })).toBe(false)
  })
})

describe("validation d'un document (API)", () => {
  const ok = (body: object) => validerDocument({ ...base, lignes: [{ description: "X", quantite: 1, prixHT: 1, tauxTVA: 20 }], ...body }, "facture")

  it("messages explicites au lieu d'une erreur 500", () => {
    const sansDesc = validerDocument({ ...base, lignes: [{ quantite: 1, prixHT: 10, tauxTVA: 20 }] }, "facture")
    expect(sansDesc).toEqual({ ok: false, erreur: "Ligne 1 (désignation) : Désignation manquante." })
    const chaine = validerDocument({ ...base, lignes: [{ description: "Chaîne", quantite: "2", prixHT: "abc", tauxTVA: 20 }] }, "facture")
    expect(chaine.ok).toBe(false)
    expect(validerDocument("oops", "facture").ok).toBe(false)
    expect(validerDocument({ emetteur: { nom: "" }, client: { nom: "x" }, lignes: [] }, "facture")).toEqual({ ok: false, erreur: "Nom de l'émetteur manquant." })
    expect(ok({ date: "" }).ok).toBe(false)
    expect(ok({ echeance: "pas une date" }).ok).toBe(false)
    expect(ok({ echeance: "2026-09-01" }).ok).toBe(false)
    expect(ok({ numero: "" }).ok).toBe(false)
    expect(ok({ emetteur: { nom: "x".repeat(LIMITES.nom + 1) } }).ok).toBe(false)
    expect(ok({ notes: 42 }).ok).toBe(false)
  })

  it("un devis n'exige pas de numéro ; les lignes vierges ne sont pas imprimées", () => {
    const v = validerDocument(
      { ...base, numero: "", validite: "2026-11-02", lignes: [{ description: "Pose", quantite: 1, prixHT: 10, tauxTVA: 20 }, { description: "", quantite: 1, prixHT: 0, tauxTVA: 20 }] },
      "devis",
    )
    expect(v.ok && v.document.totaux.lignes.length).toBe(1)
  })

  it("total négatif refusé, même avec des remises", () => {
    const v = validerDocument({ ...base, remises: true, lignes: [{ description: "Remise", quantite: -1, prixHT: 50, tauxTVA: 20 }] }, "facture")
    expect(v.ok).toBe(false)
  })

  it("trop de lignes refusé", () => {
    const lignes = Array.from({ length: LIMITES.lignes + 1 }, () => ({ description: "x", quantite: 1, prixHT: 1, tauxTVA: 20 }))
    expect(validerDocument({ ...base, lignes }, "facture").ok).toBe(false)
  })

  it("dates et noms de fichier", () => {
    expect(dateValide("2026-02-29")).toBe(false)
    expect(dateValide("2028-02-29")).toBe(true)
    expect(nomFichier("facture", 'F/2026 "001"')).toBe("facture-F-2026-001.pdf")
    expect(nomFichier("devis", "")).toBe("devis-brouillon.pdf")
  })

  it("texte de mentions par défaut : pénalités, indemnité de 40 €, escompte", () => {
    expect(MENTIONS_PAIEMENT_DEFAUT).toMatch(/L441-10/)
    expect(MENTIONS_PAIEMENT_DEFAUT).toMatch(/40 €/)
    expect(MENTIONS_PAIEMENT_DEFAUT).toMatch(/escompte/)
  })
})

describe("PDF", () => {
  it("60 lignes longues : plusieurs pages, polices sous-ensemblées", async () => {
    const lignes = Array.from({ length: 60 }, (_, i) => ({
      description: `Prestation ${i + 1} — ${"pose et fourniture de matériaux ".repeat(4)}`,
      quantite: 1.5,
      prixHT: 100,
      tauxTVA: i % 2 ? 10 : 20,
    }))
    const v = validerDocument({ ...base, emetteur: { ...base.emetteur, nom: "Plomberie Martin 🔧" }, lignes, notes: "Ligne 1\nLigne 2" }, "facture")
    expect(v.ok).toBe(true)
    if (!v.ok) return
    const pdf = await genererPdfDocument(v.document)
    expect(Buffer.from(pdf.slice(0, 5)).toString()).toBe("%PDF-")
    expect(pdf.length).toBeLessThan(120_000)
    const { PDFDocument } = await import("pdf-lib")
    const lu = await PDFDocument.load(pdf)
    expect(lu.getPageCount()).toBeGreaterThan(1)
  })
})
