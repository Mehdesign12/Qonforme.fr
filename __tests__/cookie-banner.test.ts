// @vitest-environment happy-dom
/**
 * Bandeau de cookies et pixel Meta (18/10/2026).
 * Le pixel déposait `_fbp` sans demander l'accord, alors que la politique de
 * confidentialité disait le contraire. Ces tests gardent :
 *  - le pixel : rien ne se charge sans accord, un seul PageView par page, retrait
 *    de l'accord (consent revoke + cookies effacés), pages exclues ;
 *  - le stockage du choix (évènements, stockage bloqué, choix périmé) ;
 *  - le bandeau : absent du rendu serveur, deux boutons de même poids, jamais sur
 *    les pages des clients de l'artisan, rouvert par « Gérer les cookies ».
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import * as React from "react"
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { renderToString } from "react-dom/server"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
;(globalThis as { React?: typeof React }).React = React

const nav = vi.hoisted(() => ({ path: "/" }))
vi.mock("next/navigation", () => ({ usePathname: () => nav.path }))
vi.mock("next/link", () => ({
  default: (props: { href: string; children?: React.ReactNode; className?: string }) =>
    createElement("a", { href: props.href, className: props.className }, props.children),
}))

type FbqWindow = Window & { fbq?: { queue: unknown[][] }; _fbq?: unknown }
const w = window as unknown as FbqWindow

let root: Root | null = null
let host: HTMLDivElement | null = null
let appended: HTMLScriptElement[] = []

function expireAllCookies() {
  for (const c of document.cookie.split(";")) {
    const name = c.split("=")[0].trim()
    if (name) document.cookie = `${name}=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
  }
}

beforeEach(() => {
  vi.resetModules()
  nav.path = "/"
  delete w.fbq
  delete w._fbq
  window.localStorage.clear()
  expireAllCookies()
  // Le script du pixel n'est jamais vraiment téléchargé : on le capte
  appended = []
  vi.spyOn(document.head, "appendChild").mockImplementation(((node: Node) => {
    appended.push(node as HTMLScriptElement)
    return node
  }) as typeof document.head.appendChild)
})

afterEach(async () => {
  if (root) await act(async () => root!.unmount())
  host?.remove()
  root = null
  host = null
  vi.useRealTimers()
  vi.restoreAllMocks()
})

/** Appels reçus par fbq, sous forme de tableaux (« init », « track », « consent »…). */
const calls = () => (w.fbq?.queue ?? []).map((a) => Array.from(a as ArrayLike<unknown>))
const pageViews = () => calls().filter((c) => c[0] === "track" && c[1] === "PageView").length

describe("pixel Meta : rien sans accord", () => {
  it("sans choix, rien ne se charge et le cookie laissé par l'ancien pixel est effacé", async () => {
    document.cookie = "_fbp=fb.1.1700000000000.123; path=/"
    document.cookie = "_fbc=fb.1.1700000000000.abc; path=/"
    document.cookie = "theme_pref=clair; path=/"
    const { syncMetaPixel } = await import("@/lib/meta-pixel")
    syncMetaPixel(null, "/")
    expect(w.fbq).toBeUndefined()
    expect(appended).toHaveLength(0)
    expect(document.cookie).not.toContain("_fbp")
    expect(document.cookie).not.toContain("_fbc")
    expect(document.cookie).toContain("theme_pref") // seuls les cookies du pixel partent
  })

  it("après un refus, rien non plus", async () => {
    const { syncMetaPixel } = await import("@/lib/meta-pixel")
    syncMetaPixel("refused", "/pricing")
    expect(w.fbq).toBeUndefined()
    expect(appended).toHaveLength(0)
  })

  it("après un accord : charge fbevents.js, initialise le pixel et envoie un PageView", async () => {
    const { syncMetaPixel, META_PIXEL_ID } = await import("@/lib/meta-pixel")
    syncMetaPixel("accepted", "/")
    expect(appended).toHaveLength(1)
    expect(appended[0].src).toBe("https://connect.facebook.net/en_US/fbevents.js")
    expect(calls()).toEqual([
      ["init", META_PIXEL_ID],
      ["track", "PageView"],
    ])
  })

  it("un seul PageView par page, un de plus à chaque nouvelle page, le script une seule fois", async () => {
    const { syncMetaPixel } = await import("@/lib/meta-pixel")
    syncMetaPixel("accepted", "/")
    syncMetaPixel("accepted", "/")
    expect(pageViews()).toBe(1)
    syncMetaPixel("accepted", "/pricing")
    syncMetaPixel("accepted", "/pricing")
    expect(pageViews()).toBe(2)
    expect(appended).toHaveLength(1)
  })

  it("jamais sur une page de client de l'artisan, même avec l'accord ; reprend ensuite ailleurs", async () => {
    const { syncMetaPixel } = await import("@/lib/meta-pixel")
    syncMetaPixel("accepted", "/regler/jeton-secret")
    syncMetaPixel("accepted", "/signer/42")
    syncMetaPixel("accepted", "/admin/seo")
    expect(w.fbq).toBeUndefined()
    expect(appended).toHaveLength(0)
    syncMetaPixel("accepted", "/")
    expect(pageViews()).toBe(1)
  })

  it("retrait de l'accord : le pixel est coupé et ses cookies effacés ; un nouvel accord le rallume", async () => {
    const { syncMetaPixel } = await import("@/lib/meta-pixel")
    syncMetaPixel("accepted", "/")
    document.cookie = "_fbp=fb.1.1700000000000.123; path=/"
    syncMetaPixel("refused", "/")
    expect(calls()).toContainEqual(["consent", "revoke"])
    expect(document.cookie).not.toContain("_fbp")
    // Un seul « revoke », même si on resynchronise
    syncMetaPixel("refused", "/pricing")
    expect(calls().filter((c) => c[0] === "consent" && c[1] === "revoke")).toHaveLength(1)

    syncMetaPixel("accepted", "/pricing")
    expect(calls()).toContainEqual(["consent", "grant"])
    expect(appended).toHaveLength(1) // le script n'est pas rechargé
    expect(pageViews()).toBe(2)
  })

  it("trackEvent n'envoie rien sans accord, même si le pixel est en mémoire", async () => {
    const { syncMetaPixel, trackEvent } = await import("@/lib/meta-pixel")
    const { writeConsent } = await import("@/lib/consent")

    trackEvent("Lead") // pas de fbq du tout
    expect(w.fbq).toBeUndefined()

    writeConsent("accepted")
    syncMetaPixel("accepted", "/")
    trackEvent("Lead", { currency: "EUR", value: 0 })
    expect(calls()).toContainEqual(["track", "Lead", { currency: "EUR", value: 0 }])

    writeConsent("refused")
    syncMetaPixel("refused", "/")
    const before = calls().length
    trackEvent("Purchase", { value: 12 })
    expect(calls()).toHaveLength(before)
  })
})

describe("stockage du choix", () => {
  it("écrit, relit et prévient les abonnés ; le désabonnement les arrête", async () => {
    const { writeConsent, readConsent, currentConsent, subscribeConsent } = await import("@/lib/consent")
    const seen: number[] = []
    const off = subscribeConsent(() => seen.push(1))
    expect(readConsent()).toBeNull()
    writeConsent("accepted")
    expect(readConsent()).toBe("accepted")
    expect(currentConsent()).toBe("accepted")
    expect(seen).toHaveLength(1)
    off()
    writeConsent("refused")
    expect(seen).toHaveLength(1)
    expect(currentConsent()).toBe("refused")
  })

  it("un choix de plus de six mois est redemandé", async () => {
    const { CONSENT_KEY, CONSENT_MAX_AGE_MS, readConsent } = await import("@/lib/consent")
    const old = Date.now() - CONSENT_MAX_AGE_MS - 86_400_000
    window.localStorage.setItem(CONSENT_KEY, JSON.stringify({ v: 1, choice: "accepted", at: old }))
    expect(readConsent()).toBeNull()
  })

  it("stockage bloqué : le choix vaut pour la visite, sans erreur", async () => {
    // Navigation privée stricte : lire et écrire dans localStorage lève une exception
    const blocked = {
      getItem: () => {
        throw new Error("denied")
      },
      setItem: () => {
        throw new Error("denied")
      },
    }
    const original = Object.getOwnPropertyDescriptor(window, "localStorage")
    Object.defineProperty(window, "localStorage", { value: blocked, configurable: true })
    try {
      const { writeConsent, readConsent, currentConsent } = await import("@/lib/consent")
      expect(() => writeConsent("refused")).not.toThrow()
      expect(readConsent()).toBeNull()
      expect(currentConsent()).toBe("refused")
    } finally {
      if (original) Object.defineProperty(window, "localStorage", original)
      else delete (window as unknown as { localStorage?: unknown }).localStorage
    }
  })
})

async function mount(element: React.ReactElement) {
  host = document.createElement("div")
  document.body.appendChild(host)
  root = createRoot(host)
  await act(async () => {
    root!.render(element)
  })
}
const advance = (ms: number) =>
  act(async () => {
    vi.advanceTimersByTime(ms)
  })
const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]')
const button = (label: string) => Array.from(document.querySelectorAll("button")).find((b) => b.textContent === label) as HTMLButtonElement

async function banner() {
  vi.useFakeTimers()
  const { CookieBanner } = await import("@/components/consent/CookieBanner")
  return CookieBanner
}

describe("bandeau de cookies", () => {
  it("n'est pas dans le rendu serveur (aucun décalage de mise en page)", async () => {
    const CookieBanner = await banner()
    expect(renderToString(createElement(CookieBanner))).toBe("")
  })

  it("apparaît peu après l'affichage, avec deux boutons de même poids et le lien vers la politique", async () => {
    const CookieBanner = await banner()
    await mount(createElement(CookieBanner))
    expect(dialog()).toBeNull() // pas tout de suite : la page s'affiche d'abord
    await advance(700)
    const d = dialog()!
    expect(d).not.toBeNull()
    expect(d.getAttribute("aria-modal")).toBe("false")
    expect(d.getAttribute("aria-label")).toBe("Cookies")
    expect(document.getElementById(d.getAttribute("aria-describedby")!)?.textContent).toContain("seulement si vous acceptez")
    expect(d.querySelector('a[href="/confidentialite#cookies"]')?.textContent).toBe("En savoir plus")

    const refuse = button("Refuser")
    const accept = button("Accepter")
    expect(refuse).toBeTruthy()
    expect(accept).toBeTruthy()
    // Refuser est aussi simple qu'accepter : même taille, même place, même police
    for (const cls of ["h-9", "flex-1", "rounded-full", "px-5", "text-[13px]", "font-semibold"]) {
      expect(refuse.className, cls).toContain(cls)
      expect(accept.className, cls).toContain(cls)
    }
  })

  it("Accepter enregistre le choix, déclenche le pixel et ferme le bandeau", async () => {
    const CookieBanner = await banner()
    const { TrackingLoader } = await import("@/components/consent/TrackingLoader")
    await mount(createElement(React.Fragment, null, createElement(TrackingLoader), createElement(CookieBanner)))
    await advance(700)
    expect(w.fbq).toBeUndefined() // avant le clic, aucun traceur
    await act(async () => button("Accepter").click())
    expect(JSON.parse(window.localStorage.getItem("qonforme-cookie-consent")!)).toMatchObject({ v: 1, choice: "accepted" })
    expect(pageViews()).toBe(1)
    await advance(400)
    expect(dialog()).toBeNull()
  })

  it("Refuser enregistre le refus, ne charge rien et ferme le bandeau", async () => {
    const CookieBanner = await banner()
    const { TrackingLoader } = await import("@/components/consent/TrackingLoader")
    await mount(createElement(React.Fragment, null, createElement(TrackingLoader), createElement(CookieBanner)))
    await advance(700)
    await act(async () => button("Refuser").click())
    expect(JSON.parse(window.localStorage.getItem("qonforme-cookie-consent")!)).toMatchObject({ choice: "refused" })
    expect(w.fbq).toBeUndefined()
    expect(appended).toHaveLength(0)
    await advance(400)
    expect(dialog()).toBeNull()
  })

  it("un visiteur qui a déjà répondu n'est plus dérangé ; le pixel repart tout seul s'il avait accepté", async () => {
    const { writeConsent } = await import("@/lib/consent")
    writeConsent("accepted")
    const CookieBanner = await banner()
    const { TrackingLoader } = await import("@/components/consent/TrackingLoader")
    await mount(createElement(React.Fragment, null, createElement(TrackingLoader), createElement(CookieBanner)))
    await advance(1000)
    expect(dialog()).toBeNull()
    expect(pageViews()).toBe(1)
  })

  it("un choix de plus de six mois est redemandé", async () => {
    const { CONSENT_KEY, CONSENT_MAX_AGE_MS } = await import("@/lib/consent")
    window.localStorage.setItem(
      CONSENT_KEY,
      JSON.stringify({ v: 1, choice: "accepted", at: Date.now() - CONSENT_MAX_AGE_MS - 86_400_000 }),
    )
    const CookieBanner = await banner()
    await mount(createElement(CookieBanner))
    await advance(700)
    expect(dialog()).not.toBeNull()
  })

  it("ne s'affiche jamais sur les pages des clients de l'artisan", async () => {
    nav.path = "/regler/jeton-secret"
    const CookieBanner = await banner()
    await mount(createElement(CookieBanner))
    await advance(1500)
    expect(dialog()).toBeNull()
  })

  it("« Gérer les cookies » le rouvre malgré un choix existant ; Échap le ferme sans toucher au choix", async () => {
    const { writeConsent, openCookieSettings } = await import("@/lib/consent")
    writeConsent("accepted")
    const CookieBanner = await banner()
    await mount(createElement(CookieBanner))
    await advance(1000)
    expect(dialog()).toBeNull()

    await act(async () => openCookieSettings())
    await advance(50)
    expect(dialog()).not.toBeNull()

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))
    })
    await advance(400)
    expect(dialog()).toBeNull()
    expect(JSON.parse(window.localStorage.getItem("qonforme-cookie-consent")!).choice).toBe("accepted")
  })

  it("rouvert, Refuser retire l'accord : le pixel est coupé", async () => {
    const { writeConsent, openCookieSettings } = await import("@/lib/consent")
    writeConsent("accepted")
    const CookieBanner = await banner()
    const { TrackingLoader } = await import("@/components/consent/TrackingLoader")
    await mount(createElement(React.Fragment, null, createElement(TrackingLoader), createElement(CookieBanner)))
    await advance(1000)
    expect(pageViews()).toBe(1)

    await act(async () => openCookieSettings())
    await advance(50)
    await act(async () => button("Refuser").click())
    expect(calls()).toContainEqual(["consent", "revoke"])
    expect(JSON.parse(window.localStorage.getItem("qonforme-cookie-consent")!).choice).toBe("refused")
  })
})
