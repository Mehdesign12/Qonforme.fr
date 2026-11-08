// @vitest-environment happy-dom
/**
 * Enregistrement automatique des documents en cours (08/11/2026) : trois nouveaux inscrits
 * sur trois avaient tapé leur premier devis puis l'avaient perdu, faute d'avoir cliqué sur
 * « Enregistrer le brouillon ». Copie sur l'appareil dès la première saisie, puis vrai
 * brouillon (POST, puis PATCH) dès que le document est complet.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import * as React from "react"
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { useDocumentForm } from "@/components/documents/useDocumentForm"
import {
  AUTOSAVE_DELAY_MS, autosaveStatusText, canAutosave, payloadLinesOf, useDocumentAutosave,
  type DocumentAutosave,
} from "@/components/documents/useDocumentAutosave"
import { newLine, type DocForm } from "@/components/documents/model"
import {
  LOCAL_DRAFT_MAX_AGE_MS, clearAllLocalDrafts, localDraftKey, parseLocalDraft, readLocalDraft, writeLocalDraft,
} from "@/lib/documents/local-draft"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
;(globalThis as { React?: typeof React }).React = React

const OWNER = "user-1"
const blank = (): DocForm => ({
  client_id: "", issue_date: "2026-11-08", due_date: "", valid_until: "2026-12-08",
  delivery_date: "", reference: "", notes: "", lines: [newLine()],
})

type Api = { doc: ReturnType<typeof useDocumentForm>; autosave: DocumentAutosave }
let api: Api
let root: Root
let host: HTMLElement
const fetchMock = vi.fn()

function Harness({ owner }: { owner: string | null }) {
  const doc = useDocumentForm("quote", blank)
  const autosave = useDocumentAutosave({
    kind: "quote", doc, endpoint: "/api/quotes", entity: "quote", owner, blank,
    buildPayload: (f) => ({ client_id: f.client_id, lines: payloadLinesOf(f), status: "draft" }),
  })
  api = { doc, autosave }
  return null
}

const mount = async (owner: string | null = OWNER) => {
  await act(async () => { root.render(createElement(Harness, { owner })) })
}
const flush = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms) }) }
const type = async (fn: () => void) => { await act(async () => { fn() }) }
const fillLine = async () => {
  const id = api.doc.form.lines[0].id
  await type(() => {
    api.doc.setLineValue(id, "description", "Pose de carrelage")
    api.doc.setLineValue(id, "unit_price_ht", "45")
  })
}
const ok = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body })

beforeEach(() => {
  vi.useFakeTimers()
  window.localStorage.clear()
  fetchMock.mockReset()
  vi.stubGlobal("fetch", fetchMock)
  host = document.createElement("div")
  root = createRoot(host)
})
afterEach(async () => {
  await act(async () => root.unmount())
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe("copie sur l'appareil", () => {
  it("garde la saisie d'un devis sans client, sans rien envoyer au serveur", async () => {
    await mount()
    await fillLine()
    await flush(AUTOSAVE_DELAY_MS + 100)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(readLocalDraft("quote", OWNER)?.form.lines[0].description).toBe("Pose de carrelage")
  })

  it("reprend la saisie à la réouverture, puis « Effacer et recommencer » repart de zéro", async () => {
    writeLocalDraft("quote", OWNER, { ...blank(), notes: "Chantier Martin", lines: [{ ...newLine(), description: "Dalle" }] })
    await mount()
    expect(api.doc.form.lines[0].description).toBe("Dalle")
    expect(api.autosave.restoredAt).not.toBeNull()
    expect(api.doc.dirty).toBe(true)
    await type(() => api.autosave.discardRestored())
    expect(api.doc.form.lines[0].description).toBe("")
    expect(api.autosave.restoredAt).toBeNull()
    expect(readLocalDraft("quote", OWNER)).toBeNull()
  })

  it("ne reprend jamais la copie d'un autre compte", async () => {
    writeLocalDraft("quote", "autre-compte", { ...blank(), lines: [{ ...newLine(), description: "Secret" }] })
    await mount()
    expect(api.doc.form.lines[0].description).toBe("")
  })

  it("sans compte connu, rien n'est écrit", async () => {
    await mount(null)
    await fillLine()
    await flush(1000)
    expect(window.localStorage.length).toBe(0)
  })
})

describe("brouillon dans les documents", () => {
  it("crée le brouillon une fois complet, puis le met à jour sans en créer un second", async () => {
    fetchMock.mockResolvedValueOnce(ok({ quote: { id: "q-1" } }, 201))
    await mount()
    await fillLine()
    await flush(600)
    expect(readLocalDraft("quote", OWNER)).not.toBeNull()
    await type(() => api.doc.setValue("client_id", "c-1"))
    await flush(AUTOSAVE_DELAY_MS + 100)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe("/api/quotes")
    expect(fetchMock.mock.calls[0][1].method).toBe("POST")
    expect(api.autosave.documentId).toBe("q-1")
    expect(api.doc.dirty).toBe(false)
    expect(readLocalDraft("quote", OWNER)).toBeNull()

    // Rien de neuf : pas d'appel
    await flush(AUTOSAVE_DELAY_MS * 2)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    // Modification : PATCH du même brouillon, sans statut
    fetchMock.mockResolvedValueOnce(ok({ quote: { id: "q-1" } }))
    await type(() => api.doc.setValue("notes", "Accès par la cour"))
    await flush(AUTOSAVE_DELAY_MS + 100)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1][0]).toBe("/api/quotes/q-1")
    expect(fetchMock.mock.calls[1][1].method).toBe("PATCH")
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).status).toBeUndefined()

    // Le bouton « Enregistrer le brouillon » met à jour, ne recrée pas
    fetchMock.mockResolvedValueOnce(ok({ quote: { id: "q-1" } }))
    let res: Awaited<ReturnType<DocumentAutosave["persist"]>> | undefined
    await act(async () => { res = await api.autosave.persist(api.doc.form, "draft") })
    expect(fetchMock.mock.calls[2][0]).toBe("/api/quotes/q-1")
    expect(res).toMatchObject({ ok: true, id: "q-1", created: false })
  })

  it("le bouton enregistre aussitôt un document jamais enregistré (création)", async () => {
    fetchMock.mockResolvedValueOnce(ok({ quote: { id: "q-9" } }, 201))
    await mount()
    let res: Awaited<ReturnType<DocumentAutosave["persist"]>> | undefined
    await act(async () => { res = await api.autosave.persist({ ...api.doc.form, client_id: "c-1" }, "send") })
    expect(fetchMock.mock.calls[0][1].method).toBe("POST")
    expect(res).toMatchObject({ ok: true, id: "q-9", created: true })
  })

  it("un refus de formule (402) arrête l'enregistrement automatique sans erreur affichée", async () => {
    fetchMock.mockResolvedValue(ok({ code: "ARTISAN_REQUIRED" }, 402))
    await mount()
    await fillLine()
    await type(() => api.doc.setValue("client_id", "c-1"))
    await flush(AUTOSAVE_DELAY_MS + 100)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(api.autosave.status).toBe("idle")
    await type(() => api.doc.setValue("notes", "x"))
    await flush(AUTOSAVE_DELAY_MS * 2)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("une panne réseau est dite, la saisie reste sur l'appareil", async () => {
    fetchMock.mockRejectedValueOnce(new Error("offline"))
    await mount()
    await fillLine()
    await type(() => api.doc.setValue("client_id", "c-1"))
    await flush(AUTOSAVE_DELAY_MS + 100)
    expect(api.autosave.status).toBe("error")
    expect(readLocalDraft("quote", OWNER)?.form.client_id).toBe("c-1")
  })
})

describe("règles pures", () => {
  it("canAutosave : client, lignes complètes et contenu requis", () => {
    const line = { ...newLine(), description: "Pose", unit_price_ht: "10" }
    expect(canAutosave("quote", { ...blank(), lines: [line] })).toBe(false)
    expect(canAutosave("quote", { ...blank(), client_id: "c", lines: [line] })).toBe(true)
    expect(canAutosave("quote", { ...blank(), client_id: "c", lines: [line, newLine()] })).toBe(false)
    expect(canAutosave("quote", { ...blank(), client_id: "c" })).toBe(false)
  })

  it("parseLocalDraft : relu sans confiance, trop ancien ignoré", () => {
    const now = Date.UTC(2026, 10, 8)
    expect(parseLocalDraft(null, now)).toBeNull()
    expect(parseLocalDraft("{oops", now)).toBeNull()
    expect(parseLocalDraft(JSON.stringify({ savedAt: now, form: { lines: "x" } }), now)).toBeNull()
    expect(parseLocalDraft(JSON.stringify({ savedAt: now - LOCAL_DRAFT_MAX_AGE_MS - 1, form: blank() }), now)).toBeNull()
    const d = parseLocalDraft(JSON.stringify({
      savedAt: now, form: { client_id: 5, lines: [{ description: "Dalle", vat_rate: 7, discount_kind: "zz" }] },
    }), now)
    expect(d?.form.client_id).toBe("")
    expect(d?.form.lines[0]).toMatchObject({ description: "Dalle", vat_rate: 20, discount_kind: "pct", quantity: "1" })
  })

  it("la déconnexion efface toutes les copies, et seulement elles", () => {
    writeLocalDraft("quote", OWNER, blank())
    writeLocalDraft("invoice", OWNER, blank())
    window.localStorage.setItem("qonforme:last-auth", "email")
    clearAllLocalDrafts()
    expect(window.localStorage.getItem(localDraftKey("quote", OWNER))).toBeNull()
    expect(window.localStorage.getItem(localDraftKey("invoice", OWNER))).toBeNull()
    expect(window.localStorage.getItem("qonforme:last-auth")).toBe("email")
  })

  it("la ligne d'état dit ce qui est vraiment enregistré", () => {
    const base = { status: "idle" as const, savedAt: null, documentId: null, hasLocalCopy: true }
    expect(autosaveStatusText("quote", base, false, false)).toMatch(/enregistré automatiquement dès que le client/)
    expect(autosaveStatusText("quote", base, true, true)).toMatch(/gardée sur cet appareil/)
    const saved = { ...base, status: "saved" as const, documentId: "q", savedAt: Date.UTC(2026, 10, 8, 16, 22), hasLocalCopy: false }
    expect(autosaveStatusText("quote", saved, false, true)).toBe("Brouillon enregistré dans vos devis à 17 h 22")
    expect(autosaveStatusText("invoice", saved, true, true)).toMatch(/vos factures à 17 h 22 · modifications en cours/)
    expect(autosaveStatusText("quote", { ...base, status: "error" }, true, true)).toMatch(/Enregistrer le brouillon/)
  })
})

describe("recherche d'entreprise sans résultat : saisie à la main préremplie", () => {
  it("un nom tapé devient le nom, un numéro devient le SIREN", async () => {
    const { manualPrefill } = await import("@/components/onboarding/inscription/CompanyStep")
    expect(manualPrefill("Garnier Plâtrerie")).toEqual({ name: "Garnier Plâtrerie" })
    expect(manualPrefill("948 211 370")).toEqual({ siren: "948211370" })
    expect(manualPrefill("x")).toEqual({})
  })
})
