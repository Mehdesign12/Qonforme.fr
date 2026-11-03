/**
 * Choix du canal d'envoi d'une facture (lib/pa/delivery.ts, lib/pa/delivery-server.ts).
 * Annuaire : formes réelles relevées le 03/11/2026 (EDF : adresse SIREN seul inactive,
 * plusieurs adresses de service actives ; SUPER G : SIREN seul et SIRET actifs).
 */
import { describe, expect, it, vi } from "vitest"
import {
  activeAddresses, addressMatchesSiren, choiceAllowed, defaultAddress, deliveryOptions, needsDirectory,
  normalizeAddress, parseDeliveryChoice, PLATFORM_SENDING_MODES, type DeliveryInput,
} from "@/lib/pa/delivery"

const EDF = [
  { identifier: "0225:552081317", is_active: false },
  { identifier: "0225:552081317_DCNEM5200TDA", is_active: true },
  { identifier: "0225:552081317_DCO_CORDIS1", is_active: true },
]
const SUPERG = [
  { identifier: "0225:853322915", is_active: true },
  { identifier: "0225:853322915_85332291500010", is_active: true },
]

describe("annuaire", () => {
  it("garde les adresses actives du SIREN, l'adresse principale en tête, sans doublon ni adresse d'un autre SIREN", () => {
    expect(activeAddresses(EDF, "552081317").map((a) => a.identifier)).toEqual(["0225:552081317_DCNEM5200TDA", "0225:552081317_DCO_CORDIS1"])
    expect(activeAddresses([...SUPERG, SUPERG[0], { identifier: "0225:111111111", is_active: true }], "853322915")).toEqual([
      { identifier: "0225:853322915", main: true },
      { identifier: "0225:853322915_85332291500010", main: false },
    ])
  })
  it("adresse d'office : la principale, ou la seule ; à choisir sinon (EDF)", () => {
    expect(defaultAddress(activeAddresses(SUPERG, "853322915"))).toBe("0225:853322915")
    expect(defaultAddress(activeAddresses(EDF, "552081317"))).toBeNull()
    expect(defaultAddress(activeAddresses(EDF.slice(0, 2), "552081317"))).toBe("0225:552081317_DCNEM5200TDA")
  })
  it("adresse saisie : schéma 0225 ajouté, caractères douteux refusés", () => {
    expect(normalizeAddress(" 315143296_117728 ")).toBe("0225:315143296_117728")
    expect(normalizeAddress("0225:853322915")).toBe("0225:853322915")
    expect(normalizeAddress("0225:<script>")).toBeNull()
    expect(normalizeAddress("")).toBeNull()
    expect(addressMatchesSiren("0225:552081317_X", "552081317")).toBe(true)
    expect(addressMatchesSiren("0225:5520813170", "552081317")).toBe(false)
  })
})

/** Ouvre des modes le temps d'un test, puis rend la liste telle qu'elle était. */
function openModes(...extra: string[]) {
  const modes = PLATFORM_SENDING_MODES as unknown as string[]
  const before = [...modes]
  modes.push(...extra)
  return () => { modes.length = 0; modes.push(...before) }
}

describe("canaux proposés", () => {
  const live = (over: Partial<DeliveryInput> = {}): DeliveryInput => ({
    mode: "live", outboundInstalled: true, connection: { status: "active", address: "0225:552100554" }, hasPlan: true,
    client: { email: "compta@client.fr", siren: "853 322 915", country: "FR" }, directory: SUPERG, ...over,
  })

  it("ouvert au bac à sable seul (lot 3) : en production, email seul, raison tue", () => {
    expect(PLATFORM_SENDING_MODES).toEqual(["test"])
    const o = deliveryOptions(live())
    expect(o.platform).toEqual({ offered: false, reason: "disabled" })
    expect(o.recommended).toBe("email")
    expect(needsDirectory(live())).toBeNull()
  })

  describe("une fois ouvert", () => {
    it.each([
      ["sans migration", { outboundInstalled: false }, "not_installed"],
      ["sans raccordement", { connection: null }, "not_connected"],
      ["raccordement en vérification", { connection: { status: "verifying", address: null } }, "not_connected"],
      ["sans formule", { hasPlan: false }, "no_plan"],
      ["client particulier", { client: { email: "a@b.fr", siren: null } }, "particulier"],
      ["client à l'étranger", { client: { email: "a@b.fr", siren: "853322915", country: "BE" } }, "abroad"],
      ["client absent de l'annuaire", { directory: [] }, "not_in_directory"],
      ["annuaire injoignable", { directory: null }, "directory_down"],
      ["déjà transmise", { alreadySent: true }, "already_sent"],
    ])("%s : email", (_l, over, reason) => {
      const restore = openModes("live")
      try {
        const o = deliveryOptions(live(over as Partial<DeliveryInput>))
        expect(o.platform).toEqual({ offered: false, reason })
        expect(o.recommended).toBe("email")
      } finally { restore() }
    })

    it("client dans l'annuaire : plateforme recommandée, adresse principale choisie, email possible", () => {
      const restore = openModes("live")
      try {
        const input = live()
        expect(needsDirectory(input)).toBe("853322915")
        const o = deliveryOptions(input)
        expect(o.recommended).toBe("platform")
        expect(o.platform).toMatchObject({ offered: true, defaultAddress: "0225:853322915", sender: "0225:552100554", manualEntry: false })
        expect(o.email).toEqual({ offered: true, to: "compta@client.fr" })
        expect(choiceAllowed(o, { channel: "platform", address: "0225:853322915_85332291500010" })).toBe(true)
        // Une adresse hors de l'annuaire n'est jamais acceptée en production
        expect(choiceAllowed(o, { channel: "platform", address: "0225:853322915_INVENTEE" })).toBe(false)
      } finally { restore() }
    })

    it("bac à sable : saisie manuelle, sans SIREN ni annuaire", () => {
      const restore = openModes("test")
      try {
        const o = deliveryOptions(live({ mode: "test", client: { email: null, siren: null }, directory: undefined }))
        expect(o.platform).toMatchObject({ offered: true, addresses: [], manualEntry: true, defaultAddress: null })
        expect(o.email.offered).toBe(false)
        expect(choiceAllowed(o, { channel: "platform", address: "0225:315143296_117728" })).toBe(true)
        expect(choiceAllowed(o, { channel: "email" })).toBe(false)
      } finally { restore() }
    })
  })
})

describe("choix reçu par la route d'envoi", () => {
  it("sans corps ou « email » : email, comme avant", () => {
    expect(parseDeliveryChoice(undefined)).toEqual({ channel: "email" })
    expect(parseDeliveryChoice({})).toEqual({ channel: "email" })
    expect(parseDeliveryChoice({ channel: "email" })).toEqual({ channel: "email" })
  })
  it("email tapé pour un client qui n'en avait pas : normalisé, ou refusé s'il est faux", () => {
    expect(parseDeliveryChoice({ channel: "email", email: " Compta@SCI.fr " })).toEqual({ channel: "email", email: "compta@sci.fr" })
    expect(parseDeliveryChoice({ channel: "email", email: "pas-un-email" })).toHaveProperty("error")
    expect(parseDeliveryChoice({ channel: "email", email: "" })).toEqual({ channel: "email" })
  })
  it("plateforme : adresse obligatoire et valide ; canal inconnu refusé", () => {
    expect(parseDeliveryChoice({ channel: "platform", address: "853322915" })).toEqual({ channel: "platform", address: "0225:853322915" })
    expect(parseDeliveryChoice({ channel: "platform" })).toHaveProperty("error")
    expect(parseDeliveryChoice({ channel: "platform", address: "a b" })).toHaveProperty("error")
    expect(parseDeliveryChoice({ channel: "fax" })).toHaveProperty("error")
  })
})

describe("lecture côté serveur", () => {
  it("l'annuaire est interrogé sans jeton ; une panne ou une lenteur rend null", async () => {
    vi.resetModules()
    const { lookupDirectory } = await import("@/lib/pa/delivery-server")
    const f = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toContain("/v1.beta/french_directory/entries?number=853322915")
      expect((init?.headers as Record<string, string>).Authorization).toBeUndefined()
      return new Response(JSON.stringify({ data: SUPERG }), { status: 200, headers: { "Content-Type": "application/json" } })
    })
    expect(await lookupDirectory("853322915", f as never)).toEqual(SUPERG)
    expect(await lookupDirectory("853322915", (async () => { throw new Error("réseau") }) as never)).toBeNull()
  })
})
