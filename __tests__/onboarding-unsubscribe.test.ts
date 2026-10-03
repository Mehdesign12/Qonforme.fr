/**
 * Désinscription des conseils de démarrage : lien signé (lib/onboarding/unsubscribe.ts)
 * et route POST /api/emails/unsubscribe (page et désinscription en un clic RFC 8058).
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { fakeOnboardingDb, type FakeOnboardingDb } from "./helpers/fake-onboarding-db"

let db: FakeOnboardingDb
vi.mock("@/lib/supabase/server", () => ({ createAdminClient: () => db.client, createClient: () => db.client }))

const SECRET = "secret-de-test-assez-long-pour-hmac"
process.env.EMAIL_UNSUBSCRIBE_SECRET = SECRET
process.env.NEXT_PUBLIC_APP_URL = "https://qonforme.fr"

import {
  listUnsubscribeHeaders, unsubscribePageUrl, unsubscribeToken, verifyUnsubscribeToken,
} from "@/lib/onboarding/unsubscribe"
import { POST } from "@/app/api/emails/unsubscribe/route"
import * as route from "@/app/api/emails/unsubscribe/route"

const USER = "3f2b8c1e-5a4d-4e7f-9b2a-1c0d9e8f7a6b"

describe("jeton signé", () => {
  it("aller-retour", () => {
    const token = unsubscribeToken(USER, SECRET)!
    expect(token.startsWith(`${USER}.`)).toBe(true)
    expect(verifyUnsubscribeToken(token, SECRET)).toBe(USER)
  })

  it("refuse un jeton modifié, d'un autre compte ou d'un autre secret", () => {
    const token = unsubscribeToken(USER, SECRET)!
    const other = "11111111-2222-4333-8444-555555555555"
    expect(verifyUnsubscribeToken(token.slice(0, -1) + (token.endsWith("A") ? "B" : "A"), SECRET)).toBeNull()
    expect(verifyUnsubscribeToken(`${other}.${token.split(".")[1]}`, SECRET)).toBeNull()
    expect(verifyUnsubscribeToken(token, "un-autre-secret-bien-long")).toBeNull()
  })

  it("refuse les formes invalides et l'absence de secret", () => {
    for (const bad of ["", "abc", `${USER}`, `${USER}.`, `${USER}.x.y`, null, 42]) {
      expect(verifyUnsubscribeToken(bad, SECRET)).toBeNull()
    }
    expect(unsubscribeToken(USER, null)).toBeNull()
    expect(unsubscribeToken("pas-un-uuid", SECRET)).toBeNull()
  })

  it("lien de page et en-têtes de désinscription en un clic", () => {
    const url = unsubscribePageUrl(USER)!
    expect(url).toMatch(/^https:\/\/qonforme\.fr\/desinscription\?t=/)
    expect(verifyUnsubscribeToken(decodeURIComponent(url.split("t=")[1]))).toBe(USER)
    const headers = listUnsubscribeHeaders(USER)!
    expect(headers["List-Unsubscribe"]).toMatch(/^<https:\/\/qonforme\.fr\/api\/emails\/unsubscribe\?t=.+>$/)
    expect(headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click")
  })
})

describe("POST /api/emails/unsubscribe", () => {
  beforeEach(() => { db = fakeOnboardingDb() })
  const token = () => unsubscribeToken(USER, SECRET)!

  const json = (body: unknown) =>
    new NextRequest("https://qonforme.fr/api/emails/unsubscribe", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    })

  it("désinscrit depuis la page, puis réabonne", async () => {
    const res = await POST(json({ token: token() }))
    expect(res.status).toBe(200)
    expect(db.tables.email_preferences).toHaveLength(1)
    expect(db.tables.email_preferences[0]).toMatchObject({ user_id: USER, onboarding_emails: false })
    expect(db.tables.email_preferences[0].unsubscribed_at).toBeTruthy()

    await POST(json({ token: token(), subscribe: true }))
    expect(db.tables.email_preferences).toHaveLength(1)
    expect(db.tables.email_preferences[0]).toMatchObject({ onboarding_emails: true, unsubscribed_at: null })
  })

  it("désinscription en un clic depuis la messagerie (RFC 8058)", async () => {
    const req = new NextRequest(`https://qonforme.fr/api/emails/unsubscribe?t=${encodeURIComponent(token())}`, {
      method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "List-Unsubscribe=One-Click",
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(db.tables.email_preferences[0]).toMatchObject({ user_id: USER, onboarding_emails: false })
  })

  it("lien invalide : 400, rien d'écrit", async () => {
    const res = await POST(json({ token: `${USER}.faux` }))
    expect(res.status).toBe(400)
    expect(db.tables.email_preferences ?? []).toHaveLength(0)
  })

  it("aucune action sur GET (les analyseurs de liens ouvrent les URL)", () => {
    expect("GET" in route).toBe(false)
  })

  it("migration absente : 503 sans erreur levée", async () => {
    db.missing.add("email_preferences")
    const res = await POST(json({ token: token() }))
    expect(res.status).toBe(503)
  })
})
