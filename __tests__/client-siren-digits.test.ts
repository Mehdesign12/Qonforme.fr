import { describe, expect, it } from "vitest"
import { sirenDigits } from "@/components/clients/ClientForm"

describe("SIREN d'un client (jamais bloquant pour sa clé)", () => {
  it("garde les chiffres, ramène un SIRET à son SIREN", () => {
    expect(sirenDigits("948 211 370")).toBe("948211370")
    expect(sirenDigits("94821137000017")).toBe("948211370")
    expect(sirenDigits("")).toBe("")
  })
})
