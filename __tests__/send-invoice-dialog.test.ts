// @vitest-environment happy-dom
/**
 * Fenêtre d'envoi d'une facture (planches D14 et M13) : plateforme agréée quand
 * le serveur la propose, email sinon, comme avant.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import * as React from "react"
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import type { DeliveryOptions } from "@/lib/pa/delivery"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let SendInvoiceDialog: typeof import("@/components/invoices/SendInvoiceDialog").SendInvoiceDialog
beforeAll(async () => {
  ;(globalThis as { React?: typeof React }).React = React
  ;({ SendInvoiceDialog } = await import("@/components/invoices/SendInvoiceDialog"))
})

let root: Root
let host: HTMLElement
beforeEach(() => { host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host) })
afterEach(() => { act(() => root.unmount()); host.remove(); document.body.innerHTML = "" })

const flush = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 0)) }) }
const invoice = { id: "inv-1", invoice_number: null, status: "draft", client: { name: "SCI Les Tilleuls", email: "gestion@tilleuls.fr" } }

const offered = (over: Partial<Extract<DeliveryOptions["platform"], { offered: true }>> = {}): DeliveryOptions => ({
  platform: { offered: true, addresses: [{ identifier: "0225:443061841", main: true }], defaultAddress: "0225:443061841", sender: "0225:552100554", manualEntry: false, ...over },
  email: { offered: true, to: "gestion@tilleuls.fr" },
  recommended: "platform",
  connected: true,
})

async function mount(options: DeliveryOptions | null, extra: Record<string, unknown> = {}) {
  const onSend = vi.fn()
  act(() => {
    root.render(createElement(SendInvoiceDialog, {
      open: true, onOpenChange: () => {}, invoice, companyName: "Plâtrerie Martin", loading: false, onSend,
      loadOptions: async () => options, ...extra,
    }))
  })
  await flush()
  return onSend
}
const button = (text: RegExp) => Array.from(document.querySelectorAll("button")).find((b) => text.test(b.textContent ?? "")) as HTMLButtonElement | undefined
const radios = () => Array.from(document.querySelectorAll('[role="radio"]')) as HTMLButtonElement[]

describe("fenêtre d'envoi", () => {
  it("sans plateforme proposée : la fenêtre d'avant, envoi par email", async () => {
    const onSend = await mount(null)
    expect(radios()).toHaveLength(0)
    expect(document.body.textContent).toContain("À : gestion@tilleuls.fr")
    act(() => button(/^Envoyer$/)!.click())
    expect(onSend).toHaveBeenCalledWith({ channel: "email" })
  })

  it("raccordé, client absent de l'annuaire : la raison est dite", async () => {
    await mount({ ...offered(), platform: { offered: false, reason: "not_in_directory" }, recommended: "email" })
    expect(document.body.textContent).toContain("pas encore inscrit dans l'annuaire")
  })

  it("envoi par la plateforme pas encore ouvert : rien n'est dit", async () => {
    await mount({ ...offered(), platform: { offered: false, reason: "disabled" }, recommended: "email" })
    expect(document.body.textContent).not.toContain("pas encore ouvert")
  })

  it("client dans l'annuaire : plateforme choisie d'office, adresse affichée, email au choix", async () => {
    const onSend = await mount(offered())
    expect(radios().map((r) => r.getAttribute("aria-checked"))).toEqual(["true", "false"])
    expect(document.body.textContent).toContain("0225:443061841")
    expect(document.body.textContent).toContain("Recommandé")
    act(() => button(/Envoyer par la plateforme/)!.click())
    expect(onSend).toHaveBeenCalledWith({ channel: "platform", address: "0225:443061841" })
    act(() => radios()[1].click())
    act(() => button(/^Envoyer$/)!.click())
    expect(onSend).toHaveBeenLastCalledWith({ channel: "email" })
  })

  it("plusieurs adresses sans adresse principale : à choisir avant d'envoyer", async () => {
    const onSend = await mount(offered({
      addresses: [{ identifier: "0225:552081317_A", main: false }, { identifier: "0225:552081317_B", main: false }],
      defaultAddress: null,
    }))
    const send = button(/Envoyer par la plateforme/)!
    expect(send.disabled).toBe(true)
    const select = document.querySelector("select") as HTMLSelectElement
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!
      setter.call(select, "0225:552081317_B")
      select.dispatchEvent(new Event("change", { bubbles: true }))
    })
    expect(send.disabled).toBe(false)
    act(() => send.click())
    expect(onSend).toHaveBeenCalledWith({ channel: "platform", address: "0225:552081317_B" })
  })

  it("client sans email : l'adresse se tape dans la fenêtre, puis part avec l'envoi (jamais de blocage)", async () => {
    const onSend = await mount(null, { invoice: { ...invoice, client: { name: "SCI", email: null } } })
    const send = button(/^Envoyer$/)!
    expect(send.disabled).toBe(true)
    const input = document.querySelector('input[type="email"]') as HTMLInputElement
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, " Compta@SCI.fr ")
      input.dispatchEvent(new Event("input", { bubbles: true }))
    })
    expect(send.disabled).toBe(false)
    act(() => send.click())
    expect(onSend).toHaveBeenCalledWith({ channel: "email", email: "compta@sci.fr" })
  })
})
