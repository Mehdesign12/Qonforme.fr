// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest"
import { readLastAuthMethod, rememberAuthMethod } from "@/lib/auth/last-used"

describe("dernière méthode de connexion", () => {
  beforeEach(() => window.localStorage.clear())

  it("rien au départ", () => expect(readLastAuthMethod()).toBeNull())
  it("garde google ou email, et peut l'oublier", () => {
    rememberAuthMethod("google")
    expect(readLastAuthMethod()).toBe("google")
    rememberAuthMethod("email")
    expect(readLastAuthMethod()).toBe("email")
    rememberAuthMethod(null)
    expect(readLastAuthMethod()).toBeNull()
  })
  it("ignore une valeur inconnue du stockage", () => {
    window.localStorage.setItem("qonforme:last-auth", "facebook")
    expect(readLastAuthMethod()).toBeNull()
  })
})
