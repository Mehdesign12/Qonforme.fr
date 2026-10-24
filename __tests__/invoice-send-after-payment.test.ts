// @vitest-environment happy-dom
/**
 * « Envoyer ma première facture » après le paiement : la fenêtre d'activation ajoute
 * `?send=1` à la fiche de la facture, où l'artisan se trouve déjà. La fiche doit alors
 * ouvrir l'envoi (avant, elle ne lisait le paramètre qu'au chargement : le bouton ne
 * faisait rien), ou dire pourquoi elle ne le peut pas.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import * as React from "react"
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const replace = vi.fn()
let search = ""
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}))

const toastError = vi.fn()
const toastInfo = vi.fn()
vi.mock("sonner", () => ({ toast: { error: (m: string) => toastError(m), info: (m: string) => toastInfo(m), success: vi.fn() } }))

const noRow = { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }) }
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ from: () => noRow }) }))
vi.mock("@/lib/legal/db", () => ({ selectCompanyWithProfile: () => Promise.resolve({ data: null }) }))
vi.mock("@/components/invoices/InvoiceDetailView", () => ({ InvoiceDetailView: () => null }))
vi.mock("@/components/payment-link/usePaymentLink", () => ({
  usePaymentLink: () => ({ state: null, busy: false, create: vi.fn(), disable: vi.fn(), enable: vi.fn() }),
}))
vi.mock("@/components/billing/PaywallDialog", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/billing/PaywallDialog")>()),
  PaywallDialog: () => null,
}))

let InvoiceDetail: typeof import("@/components/invoices/InvoiceDetail").InvoiceDetail
let invoice: Record<string, unknown>

beforeAll(async () => {
  ;(globalThis as { React?: typeof React }).React = React
  ;({ InvoiceDetail } = await import("@/components/invoices/InvoiceDetail"))
})

function makeInvoice(over: Record<string, unknown> = {}) {
  return {
    id: "inv-1",
    invoice_number: null,
    status: "draft",
    is_archived: false,
    issue_date: "2026-10-23",
    due_date: "2026-11-22",
    lines: [],
    subtotal_ht: 0,
    total_vat: 0,
    total_ttc: 0,
    notes: null,
    payment_terms: null,
    pdf_url: null,
    ppf_status: null,
    created_at: "2026-10-23T10:00:00Z",
    reminder_1_sent_at: null,
    reminder_2_sent_at: null,
    client: { id: "c1", name: "Client test", email: "client@test.fr" },
    ...over,
  }
}

let root: Root
let host: HTMLElement

beforeEach(() => {
  replace.mockClear()
  toastError.mockClear()
  toastInfo.mockClear()
  search = ""
  invoice = makeInvoice()
  vi.stubGlobal("fetch", vi.fn((url: string) => {
    const body = url.startsWith("/api/invoices/inv-1") && !url.includes("payment-link") ? { invoice } : {}
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) })
  }))
  host = document.createElement("div")
  document.body.appendChild(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
  document.body.innerHTML = ""
  vi.unstubAllGlobals()
})

const render = async () => {
  await act(async () => { root.render(createElement(InvoiceDetail, { invoiceId: "inv-1" })) })
  await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
}
/** Le paramètre change alors que la page est déjà affichée, comme au clic sur le bouton. */
const askSend = async () => {
  search = "send=1"
  await act(async () => { root.render(createElement(InvoiceDetail, { invoiceId: "inv-1" })) })
  await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
}
const sendDialogOpen = () => document.body.textContent?.includes("Envoyer la facture") ?? false

describe("envoi de la facture après le paiement", () => {
  it("ouvre l'envoi quand ?send=1 arrive sur une fiche déjà affichée", async () => {
    await render()
    expect(sendDialogOpen()).toBe(false)
    await askSend()
    expect(sendDialogOpen()).toBe(true)
    expect(replace).toHaveBeenCalledWith("/invoices/inv-1")
  })

  it("ouvre l'envoi quand la fiche se charge déjà avec ?send=1", async () => {
    search = "send=1"
    await render()
    expect(sendDialogOpen()).toBe(true)
  })

  it("dit que le client n'a pas d'adresse email au lieu de ne rien faire", async () => {
    invoice = makeInvoice({ client: { id: "c1", name: "Client test", email: null } })
    await render()
    await askSend()
    expect(sendDialogOpen()).toBe(false)
    expect(toastError).toHaveBeenCalledWith(expect.stringContaining("adresse email du client"))
  })

  it("dit que la facture est déjà émise au lieu de ne rien faire", async () => {
    invoice = makeInvoice({ status: "sent", invoice_number: "F-2026-001" })
    await render()
    await askSend()
    expect(sendDialogOpen()).toBe(false)
    expect(toastInfo).toHaveBeenCalledWith(expect.stringContaining("déjà été émise"))
  })

  it("ne fait rien sans le paramètre", async () => {
    await render()
    expect(sendDialogOpen()).toBe(false)
    expect(replace).not.toHaveBeenCalled()
    expect(toastError).not.toHaveBeenCalled()
    expect(toastInfo).not.toHaveBeenCalled()
  })
})
