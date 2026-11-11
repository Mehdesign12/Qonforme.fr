/**
 * Lot 6 : l'ouverture de l'émission par la plateforme tient dans un seul
 * réglage (lib/pa/sending.ts). Tant que la production est fermée, tout texte
 * public dit « prévu pour 2027 » ; une fois ouverte, aucun ne le dit plus et la
 * formule Essentiel liste la fonction.
 */
import { afterEach, describe, expect, it, vi } from "vitest"
import { PLATFORM_SENDING_LIVE, PLATFORM_SENDING_MODES, platformSendingOpenFor, sendingTexts } from "@/lib/pa/sending"
import { demoCreditNotePlatform, demoPlatformInfo } from "@/lib/demo/platform"
import { journeySteps } from "@/lib/pa/outbound-view"

afterEach(() => { vi.resetModules(); vi.doUnmock("@/lib/pa/sending") })

describe("réglage d'ouverture", () => {
  it("production ouverte le 04/11/2026", () => {
    expect(PLATFORM_SENDING_MODES).toEqual(["test", "live"])
    expect(PLATFORM_SENDING_LIVE).toBe(true)
    expect(platformSendingOpenFor("test")).toBe(true)
    expect(platformSendingOpenFor("live")).toBe(true)
    expect(platformSendingOpenFor(null)).toBe(false)
  })

  it("textes : « prévu pour 2027 » fermé, jamais une fois ouvert", () => {
    const closed = sendingTexts(false)
    const open = sendingTexts(true)
    for (const t of Object.values(closed)) expect(t).toMatch(/prévu pour 2027/)
    for (const t of Object.values(open)) expect(t).not.toMatch(/2027|pas encore|prévu/)
    expect(open.sentence).toMatch(/email/)
  })

  it("formule Essentiel fermée : l'émission est « à venir »", async () => {
    vi.doMock("@/lib/pa/sending", async (orig) => ({ ...(await orig<typeof import("@/lib/pa/sending")>()), PLATFORM_SENDING_LIVE: false }))
    const { PLANS } = await import("@/lib/stripe/plans")
    expect(PLANS.starter.upcoming.join(" ")).toMatch(/prévu pour 2027/)
    expect(PLANS.starter.features.join(" ")).not.toMatch(/factures et avoirs à vos clients par la plateforme/)
  })

  it("formule Essentiel ouverte : la fonction est listée, l'envoi n'est plus « à venir »", async () => {
    vi.doMock("@/lib/pa/sending", async (orig) => ({ ...(await orig<typeof import("@/lib/pa/sending")>()), PLATFORM_SENDING_LIVE: true }))
    const { PLANS } = await import("@/lib/stripe/plans")
    expect(PLANS.starter.upcoming.some((u) => u.startsWith("Envoi de vos factures"))).toBe(false)
    expect(PLANS.starter.features).toContain("Envoi de vos factures et avoirs à vos clients par la plateforme agréée")
  })
})

describe("démo", () => {
  const sent = { status: "sent", issue_date: "2026-10-01", sent_at: "2026-10-01T08:00:00Z", client: { siren: "552100554" } }
  it("rien tant que la production est fermée", () => {
    expect(demoPlatformInfo(sent, false)).toBeNull()
    expect(demoCreditNotePlatform(sent.client, false)).toBeNull()
    expect(demoPlatformInfo(sent)).not.toBeNull()
  })
  it("ouverte : parcours d'une facture professionnelle, encaissement si payée", () => {
    const info = demoPlatformInfo(sent, true)!
    expect(info.recipientAddress).toBe("0225:552100554")
    expect(journeySteps(info).map((s) => s.title)).toContain("Reçue par la plateforme du client")
    const paid = demoPlatformInfo({ ...sent, status: "paid", paid_at: "2026-10-20" }, true)!
    expect(paid.lastStatus).toBe("fr:212")
    expect(demoPlatformInfo({ ...sent, client: { siren: null } }, true)).toBeNull()
    expect(demoPlatformInfo({ ...sent, status: "draft" }, true)).toBeNull()
    expect(demoCreditNotePlatform(sent.client, true)).toMatchObject({ offered: true, address: "0225:552100554" })
  })
})
