/**
 * Emails au fondateur (nouvel inscrit, nouvel abonnement) : contenu, destinataire,
 * et surtout « ne lève jamais » : une panne d'envoi ne doit jamais casser une inscription.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const sendEmail = vi.hoisted(() => vi.fn())
const getUserById = vi.hoisted(() => vi.fn())
vi.mock("@/lib/email/resend", () => ({ sendEmail }))
vi.mock("@/lib/supabase/server", () => ({ createAdminClient: () => ({ auth: { admin: { getUserById } } }) }))

import { adminNotifyAddress, notifyNewSignup, notifyNewSubscription } from "@/lib/email/admin-notify"
import { buildNewSignupNotice, buildNewSubscriptionNotice } from "@/lib/email/templates/admin-notice"

const ENV = ["ADMIN_NOTIFY_EMAIL", "ADMIN_EMAIL", "RESEND_API_KEY", "NEXT_PUBLIC_APP_URL"] as const
const saved: Record<string, string | undefined> = {}

beforeEach(() => {
  for (const k of ENV) saved[k] = process.env[k]
  for (const k of ENV) delete process.env[k]
  sendEmail.mockReset().mockResolvedValue({ id: "x" })
  getUserById.mockReset().mockResolvedValue({ data: { user: { email: "client@exemple.fr" } } })
  vi.spyOn(console, "error").mockImplementation(() => {})
})
afterEach(() => {
  for (const k of ENV) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
  vi.restoreAllMocks()
})

describe("adresse du fondateur", () => {
  it("préfère ADMIN_NOTIFY_EMAIL, puis ADMIN_EMAIL", () => {
    process.env.ADMIN_EMAIL = "admin@exemple.fr"
    expect(adminNotifyAddress()).toBe("admin@exemple.fr")
    process.env.ADMIN_NOTIFY_EMAIL = "moi@exemple.fr"
    expect(adminNotifyAddress()).toBe("moi@exemple.fr")
  })
  it("ignore une adresse invalide et retombe sur l'autre", () => {
    process.env.ADMIN_NOTIFY_EMAIL = "pas-une-adresse"
    process.env.ADMIN_EMAIL = "admin@exemple.fr"
    expect(adminNotifyAddress()).toBe("admin@exemple.fr")
  })
  it("rend null sans adresse valide", () => {
    expect(adminNotifyAddress()).toBeNull()
  })
})

describe("contenu des emails", () => {
  it("nouvel inscrit : adresse, méthode, lien vers la fiche, échappement", () => {
    const n = buildNewSignupNotice({ email: "a<b>@x.fr", method: "google", userId: "u-1", baseUrl: "https://qonforme.fr" })
    expect(n.subject).toBe("Nouvel inscrit : a<b>@x.fr")
    expect(n.html).toContain("Google")
    expect(n.html).toContain("https://qonforme.fr/admin/users/u-1")
    expect(n.html).not.toContain("<b>")
    expect(n.html).toContain("a&lt;b&gt;@x.fr")
  })
  it("nouvel abonnement : formule, période, prix de la grille, mention essai", () => {
    const live = buildNewSubscriptionNotice({ email: "c@x.fr", plan: "starter", period: "monthly", mode: "live", userId: "u-2", baseUrl: "https://qonforme.fr" })
    expect(live.subject).toBe("Nouvel abonnement : Essentiel mensuel")
    expect(live.html).toContain("24")
    expect(live.html).toContain("/admin/users/u-2")
    const test = buildNewSubscriptionNotice({ email: null, plan: "starter", period: "yearly", mode: "test", userId: "u-3", baseUrl: "https://qonforme.fr" })
    expect(test.subject).toContain("essai")
    expect(test.html).toContain("adresse inconnue")
    expect(test.html).toContain("240")
  })
})

describe("envoi", () => {
  it("n'envoie rien sans adresse du fondateur", async () => {
    process.env.RESEND_API_KEY = "re_x"
    await notifyNewSignup({ email: "a@x.fr", method: "email", userId: "u" })
    expect(sendEmail).not.toHaveBeenCalled()
  })
  it("n'envoie rien sans clé Resend", async () => {
    process.env.ADMIN_EMAIL = "admin@exemple.fr"
    await notifyNewSignup({ email: "a@x.fr", method: "email", userId: "u" })
    expect(sendEmail).not.toHaveBeenCalled()
  })
  it("envoie un nouvel inscrit au fondateur", async () => {
    process.env.ADMIN_NOTIFY_EMAIL = "moi@exemple.fr"
    process.env.RESEND_API_KEY = "re_x"
    process.env.NEXT_PUBLIC_APP_URL = "https://app.exemple.fr/"
    await notifyNewSignup({ email: "a@x.fr", method: "email", userId: "u-9" })
    expect(sendEmail).toHaveBeenCalledTimes(1)
    const arg = sendEmail.mock.calls[0][0]
    expect(arg.to).toBe("moi@exemple.fr")
    expect(arg.html).toContain("https://app.exemple.fr/admin/users/u-9")
  })
  it("un inscrit sans adresse ne déclenche rien", async () => {
    process.env.ADMIN_EMAIL = "admin@exemple.fr"
    process.env.RESEND_API_KEY = "re_x"
    await notifyNewSignup({ email: null, method: "google", userId: "u" })
    expect(sendEmail).not.toHaveBeenCalled()
  })
  it("ne lève jamais quand Resend échoue", async () => {
    process.env.ADMIN_EMAIL = "admin@exemple.fr"
    process.env.RESEND_API_KEY = "re_x"
    sendEmail.mockRejectedValue(new Error("Resend en panne"))
    await expect(notifyNewSignup({ email: "a@x.fr", method: "email", userId: "u" })).resolves.toBeUndefined()
    await expect(notifyNewSubscription({ userId: "u", plan: "starter", period: "monthly", mode: "live" })).resolves.toBeUndefined()
  })
  it("l'abonnement part même si l'adresse du compte est illisible", async () => {
    process.env.ADMIN_EMAIL = "admin@exemple.fr"
    process.env.RESEND_API_KEY = "re_x"
    getUserById.mockRejectedValue(new Error("auth en panne"))
    await notifyNewSubscription({ userId: "u-5", plan: "pro", period: "yearly", mode: "live" })
    expect(sendEmail).toHaveBeenCalledTimes(1)
    expect(sendEmail.mock.calls[0][0].html).toContain("/admin/users/u-5")
  })
})
