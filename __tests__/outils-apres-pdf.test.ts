import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const posthog = vi.hoisted(() => ({ capture: vi.fn(), identify: vi.fn() }))
vi.mock("posthog-js", () => ({ default: posthog }))

import { messageApresPdf } from "@/lib/outils/apres-pdf"
import { captureEvent, identifyUser } from "@/lib/analytics"

describe("message après le téléchargement du PDF gratuit", () => {
  const messages = (["devis", "facture"] as const).map((t) => ({ type: t, ...messageApresPdf(t) }))

  it("ne parle pas de la signature en ligne (décision du fondateur)", () => {
    for (const m of messages) expect(`${m.titre} ${m.texte} ${m.cta}`).not.toMatch(/signat|sign[ée]/i)
  })

  it("ne promet pas de retrouver le document : l'outil ne l'enregistre pas", () => {
    for (const m of messages) expect(`${m.titre} ${m.texte}`).not.toMatch(/retrouv|sauvegard|enregistr[ée]s? dans votre compte/i)
  })

  it("ne promet ni contact humain, ni nom de concurrent, ni chiffre invérifiable", () => {
    for (const m of messages) {
      expect(m.texte).not.toMatch(/appel|visio|rendez-vous|un humain|conforme|certifi|homologu|\d+\s?%/i)
    }
  })

  it("mène à l'inscription, avec une source propre à chaque outil", () => {
    const [devis, facture] = messages
    expect(devis.href).toBe("/signup?source=outil-devis-pdf")
    expect(facture.href).toBe("/signup?source=outil-facture-pdf")
    expect(devis.titre).toMatch(/devis/i)
    expect(facture.titre).toMatch(/facture/i)
  })
})

describe("analytique PostHog", () => {
  beforeEach(() => {
    posthog.capture.mockReset()
    posthog.identify.mockReset()
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("ne fait rien côté serveur ni sans clé PostHog", () => {
    captureEvent("tool_pdf_generated", { tool: "devis", lines: 2 })
    identifyUser("user-1")
    vi.stubGlobal("window", {})
    captureEvent("tool_pdf_generated", { tool: "devis", lines: 2 })
    identifyUser("user-1")
    expect(posthog.capture).not.toHaveBeenCalled()
    expect(posthog.identify).not.toHaveBeenCalled()
  })

  it("envoie l'événement et l'identifiant quand PostHog est configuré", () => {
    vi.stubGlobal("window", {})
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test")
    captureEvent("tool_pdf_generated", { tool: "facture", lines: 3 })
    identifyUser("0b5e-uuid")
    expect(posthog.capture).toHaveBeenCalledWith("tool_pdf_generated", { tool: "facture", lines: 3 })
    expect(posthog.identify).toHaveBeenCalledWith("0b5e-uuid")
  })

  it("n'identifie pas sans identifiant de compte", () => {
    vi.stubGlobal("window", {})
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test")
    identifyUser(undefined)
    identifyUser("")
    expect(posthog.identify).not.toHaveBeenCalled()
  })

  it("une erreur de PostHog ne casse jamais le parcours", () => {
    vi.stubGlobal("window", {})
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test")
    posthog.capture.mockImplementation(() => {
      throw new Error("réseau")
    })
    posthog.identify.mockImplementation(() => {
      throw new Error("réseau")
    })
    expect(() => captureEvent("x")).not.toThrow()
    expect(() => identifyUser("u")).not.toThrow()
  })
})

describe("marque dans le PDF gratuit", () => {
  const base = {
    emetteur: { nom: "Martin Plomberie", adresse: "3 rue Neuve, 33000 Bordeaux" },
    client: { nom: "Mme Durand" },
    numero: "F-2026-007",
    date: "2026-10-03",
    echeance: "2026-11-02",
    lignes: [{ description: "Remplacement d'un chauffe-eau", quantite: 1, prixHT: 100, tauxTVA: 20 }],
  }

  it("le pied de page dit d'où vient le document, sans le mot « gratuit »", async () => {
    const { piedDocument } = await import("@/lib/outils/pdf-document")
    expect(piedDocument("devis")).toBe("Devis généré sur qonforme.fr")
    expect(piedDocument("facture")).toBe("Facture générée sur qonforme.fr")
    expect(`${piedDocument("devis")} ${piedDocument("facture")}`).not.toMatch(/gratuit/i)
  })

  it("les propriétés du fichier ne disent pas « gratuit » non plus", async () => {
    const { validerDocument } = await import("@/lib/outils/document")
    const { genererPdfDocument } = await import("@/lib/outils/pdf-document")
    const { PDFDocument } = await import("pdf-lib")
    for (const type of ["devis", "facture"] as const) {
      const v = validerDocument(base, type)
      expect(v.ok).toBe(true)
      if (!v.ok) return
      const lu = await PDFDocument.load(await genererPdfDocument(v.document))
      expect(lu.getCreator()).toBe("Qonforme")
      expect(`${lu.getCreator()} ${lu.getProducer() ?? ""} ${lu.getTitle() ?? ""}`).not.toMatch(/gratuit/i)
    }
  })
})
