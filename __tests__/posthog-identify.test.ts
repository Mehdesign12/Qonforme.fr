import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { CONSENT_KEY, serializeConsent } from "@/lib/consent"

/**
 * Relier le visiteur de l'outil gratuit au compte qu'il crée : `identifyUser` (components/shared/PostHogProvider.tsx).
 * Elle respecte le bandeau de cookies et les pages sans traceur, comme `captureEvent`, et ne charge
 * posthog-js (chargement différé) qu'au moment où elle sert.
 */
const ph = vi.hoisted(() => ({
  init: vi.fn(),
  identify: vi.fn(),
  get_distinct_id: vi.fn(() => "anonyme-123"),
}))
vi.mock("posthog-js", () => ({ default: ph }))

function navigateur(opts: { consent?: "accepted" | "refused" | null; pathname?: string }) {
  const store: Record<string, string> = {}
  if (opts.consent) store[CONSENT_KEY] = serializeConsent(opts.consent)
  vi.stubGlobal("window", {
    localStorage: { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => (store[k] = v) },
    location: { pathname: opts.pathname ?? "/signup" },
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  })
}

async function charger() {
  vi.resetModules()
  return import("@/components/shared/PostHogProvider")
}

describe("identifyUser (PostHog, après accord du visiteur)", () => {
  beforeEach(() => {
    ph.init.mockReset()
    ph.identify.mockReset()
    ph.get_distinct_id.mockReset().mockReturnValue("anonyme-123")
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test")
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("accord donné : charge PostHog et relie le visiteur au compte", async () => {
    navigateur({ consent: "accepted" })
    const { identifyUser } = await charger()
    identifyUser("0b5e-uuid")
    await vi.waitFor(() => expect(ph.identify).toHaveBeenCalledWith("0b5e-uuid"))
    expect(ph.init).toHaveBeenCalledTimes(1)
  })

  it("sans accord ou avec refus : rien n'est chargé ni envoyé", async () => {
    for (const consent of [null, "refused"] as const) {
      navigateur({ consent })
      const { identifyUser } = await charger()
      identifyUser("0b5e-uuid")
      await new Promise((r) => setTimeout(r, 20))
      expect(ph.init).not.toHaveBeenCalled()
      expect(ph.identify).not.toHaveBeenCalled()
    }
  })

  it("page sans traceur (signature, règlement, admin) : rien", async () => {
    navigateur({ consent: "accepted", pathname: "/signer/abc" })
    const { identifyUser } = await charger()
    identifyUser("0b5e-uuid")
    await new Promise((r) => setTimeout(r, 20))
    expect(ph.identify).not.toHaveBeenCalled()
  })

  it("déjà identifié avec ce compte : pas de second appel", async () => {
    ph.get_distinct_id.mockReturnValue("0b5e-uuid")
    navigateur({ consent: "accepted" })
    const { identifyUser } = await charger()
    identifyUser("0b5e-uuid")
    await vi.waitFor(() => expect(ph.init).toHaveBeenCalled())
    await new Promise((r) => setTimeout(r, 20))
    expect(ph.identify).not.toHaveBeenCalled()
  })

  it("pas d'identifiant, ou pas de clé PostHog : rien", async () => {
    navigateur({ consent: "accepted" })
    const { identifyUser } = await charger()
    identifyUser(undefined)
    identifyUser("")
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "")
    const sansCle = await charger()
    sansCle.identifyUser("0b5e-uuid")
    await new Promise((r) => setTimeout(r, 20))
    expect(ph.init).not.toHaveBeenCalled()
    expect(ph.identify).not.toHaveBeenCalled()
  })
})
