// @vitest-environment happy-dom
/**
 * Invite d'installation (PWA), 19/10/2026. Sur téléphone, elle recouvrait le contenu
 * et le bandeau de cookies dès la première visite du site public, puis cachait le
 * bouton d'un formulaire. Désactivée partout (`INSTALL_PROMPT_ENABLED = false`) ;
 * une fois réactivée, elle ne paraît que sur le tableau de bord.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import * as React from "react"
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
;(globalThis as { React?: typeof React }).React = React

const nav = vi.hoisted(() => ({ path: "/dashboard" }))
const flag = vi.hoisted(() => ({ on: false }))
vi.mock("@/lib/pwa/config", () => ({
  get INSTALL_PROMPT_ENABLED() {
    return flag.on
  },
}))
vi.mock("next/navigation", () => ({ usePathname: () => nav.path }))
vi.mock("next/image", () => ({
  default: (props: { alt: string; className?: string }) => createElement("img", { alt: props.alt, className: props.className }),
}))
vi.mock("@/lib/pwa/hooks", () => ({
  usePlatform: () => ({ ready: true, isIOS: true, isSafari: true, isStandalone: false }),
}))
vi.mock("@/lib/pwa/client", () => ({
  isInstallPromptSnoozed: () => false,
  snoozeInstallPrompt: () => {},
}))

let root: Root | null = null
let host: HTMLDivElement | null = null

beforeEach(() => {
  vi.useFakeTimers()
  flag.on = false
  nav.path = "/dashboard"
  window.history.replaceState({}, "", "/dashboard")
})

afterEach(async () => {
  if (root) await act(async () => root!.unmount())
  host?.remove()
  root = null
  host = null
  vi.useRealTimers()
})

/** Monte l'invite, laisse passer son délai d'apparition, rend le texte affiché. */
async function shown(path: string, search = ""): Promise<string> {
  nav.path = path
  window.history.replaceState({}, "", `${path}${search}`)
  const { InstallPrompt } = await import("@/components/pwa/InstallPrompt")
  host = document.createElement("div")
  document.body.appendChild(host)
  root = createRoot(host)
  await act(async () => root!.render(createElement(InstallPrompt)))
  await act(async () => {
    vi.advanceTimersByTime(10_000)
  })
  return host.textContent ?? ""
}

describe("invite d'installation désactivée (réglage actuel)", () => {
  it("ne paraît nulle part, tableau de bord compris", async () => {
    expect(await shown("/dashboard")).not.toContain("Installer Qonforme")
  })

  it("ne paraît ni sur le site public ni dans un formulaire", async () => {
    for (const path of ["/", "/pricing", "/signup", "/invoices/new", "/clients/new"]) {
      expect(await shown(path)).not.toContain("Installer Qonforme")
      await act(async () => root!.unmount())
      host?.remove()
      root = null
      host = null
    }
  })

  it("le réglage livré est bien « désactivée »", async () => {
    vi.resetModules()
    vi.doUnmock("@/lib/pwa/config")
    const { INSTALL_PROMPT_ENABLED } = await import("@/lib/pwa/config")
    expect(INSTALL_PROMPT_ENABLED).toBe(false)
    vi.doMock("@/lib/pwa/config", () => ({
      get INSTALL_PROMPT_ENABLED() {
        return flag.on
      },
    }))
  })
})

describe("invite d'installation réactivée", () => {
  beforeEach(() => {
    flag.on = true
  })

  it("apparaît sur le tableau de bord", async () => {
    expect(await shown("/dashboard")).toContain("Installer Qonforme")
  })

  it.each(["/", "/pricing", "/blog", "/signup", "/login", "/invoices/new", "/clients", "/demo"])(
    "n'apparaît pas sur %s",
    async (path) => {
      expect(await shown(path)).not.toContain("Installer Qonforme")
    },
  )

  it("n'apparaît pas par-dessus la fenêtre « Bienvenue » de l'inscription", async () => {
    expect(await shown("/dashboard", "?bienvenue=1")).not.toContain("Installer Qonforme")
  })
})
