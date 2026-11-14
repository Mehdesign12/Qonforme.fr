/**
 * Événements de parcours (PostHog) : ils ne partent que par `captureEvent` (donc après l'accord
 * du visiteur), et ne portent jamais de donnée personnelle ni de contenu.
 */
import { readFileSync } from "node:fs"
import { beforeEach, describe, expect, it, vi } from "vitest"

const captureEvent = vi.hoisted(() => vi.fn())
vi.mock("@/components/shared/PostHogProvider", () => ({ captureEvent }))

import { searchKind, trackJourney } from "@/lib/journey"

beforeEach(() => captureEvent.mockReset())

describe("trackJourney", () => {
  it("transmet le nom et les propriétés à captureEvent", () => {
    trackJourney("onboarding_step_completed", { step: "company", manual: true })
    expect(captureEvent).toHaveBeenCalledWith("onboarding_step_completed", { step: "company", manual: true })
  })
  it("un événement sans propriété n'en envoie pas", () => {
    trackJourney("quote_sent")
    expect(captureEvent).toHaveBeenCalledWith("quote_sent", undefined)
  })
})

describe("searchKind", () => {
  it("reconnaît un SIREN ou un SIRET, avec ou sans espaces", () => {
    expect(searchKind("124214214")).toBe("number")
    expect(searchKind("124 214 214")).toBe("number")
    expect(searchKind("124 214 214 00012")).toBe("number")
  })
  it("tout le reste est un nom", () => {
    expect(searchKind("Dupont Plomberie")).toBe("name")
    expect(searchKind("12 rue des Lilas")).toBe("name")
    expect(searchKind("1242")).toBe("name")
  })
})

describe("aucune donnée personnelle dans la liste des événements", () => {
  const source = readFileSync("lib/journey.ts", "utf8")
  // Les commentaires peuvent citer ce qu'on ne doit PAS envoyer : seul le code des types compte
  const types = source
    .slice(source.indexOf("export type JourneyEvents"), source.indexOf("export type JourneyEventName"))
    .replace(/\/\*[\s\S]*?\*\//g, "")

  it("aucune propriété ne porte une donnée d'identité, de contact ou de document", () => {
    // Les noms de propriétés (pas les valeurs : « email » est une méthode d'inscription, pas une adresse)
    const keys = Array.from(types.matchAll(/(\w+)\??\s*:/g), (m) => m[1].toLowerCase())
    expect(keys.length).toBeGreaterThan(10)
    for (const forbidden of ["siren", "siret", "email", "name", "nom", "address", "adresse", "phone", "telephone", "amount", "montant", "number", "numero", "query", "text", "company", "client", "ip", "id"]) {
      expect(keys, forbidden).not.toContain(forbidden)
    }
  })
  it("les valeurs des propriétés sont des listes fermées, pas du texte libre", () => {
    // `step: string` est la seule chaîne libre (4 événements) : un nom d'étape de la fenêtre, jamais une saisie
    const freeStrings = types.match(/:\s*string\b/g) ?? []
    expect(freeStrings.length).toBe(4)
    expect(types.match(/step: string/g)?.length).toBe(4)
  })
})

describe("branchement dans le code", () => {
  const read = (p: string) => readFileSync(p, "utf8")
  it("la fenêtre Bienvenue n'envoie rien en démo", () => {
    const src = read("components/onboarding/InscriptionDialog.tsx")
    const calls = src.match(/trackJourney\(/g) ?? []
    const guarded = src.match(/mode === "app"[^\n]*trackJourney\(/g) ?? []
    // import exclu : chaque appel est protégé par mode === "app" (ou le vérifie sur la ligne d'avant dans l'effet)
    expect(guarded.length).toBeGreaterThanOrEqual(calls.length - 1)
  })
  it("les envois et créations de devis et de factures sont suivis", () => {
    expect(read("components/quotes/NewQuoteForm.tsx")).toContain('trackJourney("quote_created"')
    expect(read("components/invoices/NewInvoiceForm.tsx")).toContain('trackJourney("invoice_created"')
    expect(read("components/invoices/InvoiceDetail.tsx")).toContain('trackJourney("invoice_sent")')
    expect(read("app/(app)/quotes/[id]/page.tsx")).toContain('trackJourney("quote_pdf_downloaded"')
    expect(read("app/(app)/quotes/[id]/page.tsx")).toContain('trackJourney("quote_sent")')
  })
})
