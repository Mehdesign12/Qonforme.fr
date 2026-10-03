/**
 * Accès du comptable, partie serveur, contre une fausse base en mémoire :
 * invitation (jeton haché, expiration, garde-fous), acceptation (adresse,
 * compte de l'entreprise, expiration, usage unique), révocation immédiate,
 * cloisonnement (un comptable ne voit que ses dossiers, jamais un brouillon
 * ni un document d'un autre compte), journal, migration absente, et la route
 * d'export de bout en bout.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { FakeAccountantDb } from "./helpers/fake-accountant-db"

const mocks = vi.hoisted(() => ({
  db: undefined as unknown,
  user: null as { id: string; email: string } | null,
  emails: [] as { to: string; subject: string; html: string }[],
  emailFails: false,
}))
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => mocks.db,
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: mocks.user }, error: null }) } }),
}))
vi.mock("@/lib/email/resend", () => ({
  sendEmail: async (o: { to: string; subject: string; html: string }) => {
    if (mocks.emailFails) throw new Error("Resend en panne")
    mocks.emails.push(o)
    return { id: "e" }
  },
}))

import {
  acceptInvitation, authorizeDossier, getOverview, hasDossiers, inviteAccountant, listDossiers, loadDossier,
  recordView, resendInvitation, resolveInvitation, revokeAccess,
} from "@/lib/accountant/server"
import { hashInviteToken } from "@/lib/accountant/token"
import { GET as exportRoute } from "@/app/api/comptable/[accessId]/export/route"
import type { AccessRow } from "@/lib/accountant/types"

const ARTISAN = { id: "artisan-1", email: "thomas@garnier.example.com", name: "Thomas Garnier" }
const OTHER_ARTISAN = { id: "artisan-2", email: "paul@arvel.example.com", name: "Paul Arvel" }
const ACCOUNTANT = { id: "comptable-1", email: "claire@cabinet.example.com" }
const INTRUDER = { id: "comptable-2", email: "intrus@example.com" }

let db: FakeAccountantDb
const T0 = new Date("2026-10-03T08:00:00.000Z")
const minutes = (n: number) => new Date(T0.getTime() + n * 60_000)

function seed() {
  db = new FakeAccountantDb()
  mocks.db = db
  mocks.user = null
  mocks.emails = []
  mocks.emailFails = false
  // Réception des factures fournisseurs pas encore en place
  db.missing.add("received_invoices")
  db.tables.companies = [
    { id: "co-1", user_id: ARTISAN.id, name: "Garnier Plâtrerie", siren: "948211375", city: "Angers" },
    { id: "co-2", user_id: OTHER_ARTISAN.id, name: "Arvel Construction", siren: "390112234", city: "Cholet" },
  ]
  const client = { id: "cl-1", name: "Bâti Ouest SAS", siren: "501234567", vat_number: null }
  const line = (ht: number, rate: number) => ({ description: "Pose", quantity: 1, unit_price_ht: ht, vat_rate: rate, total_ht: ht, total_vat: Math.round(ht * rate) / 100, total_ttc: ht + Math.round(ht * rate) / 100 })
  db.tables.invoices = [
    { id: "inv-sent", user_id: ARTISAN.id, invoice_number: "F-2026-0001", status: "sent", issue_date: "2026-09-12", due_date: "2026-10-12", subtotal_ht: 1000, total_vat: 200, total_ttc: 1200, lines: [line(1000, 20)], client },
    { id: "inv-paid", user_id: ARTISAN.id, invoice_number: "F-2026-0002", status: "paid", issue_date: "2026-09-20", due_date: "2026-10-20", subtotal_ht: 500, total_vat: 50, total_ttc: 550, lines: [line(500, 10)], client },
    // Brouillon : jamais visible (sans numéro, ou même avec un ancien numéro)
    { id: "inv-draft", user_id: ARTISAN.id, invoice_number: null, status: "draft", issue_date: "2026-09-25", due_date: "2026-10-25", subtotal_ht: 300, total_vat: 60, total_ttc: 360, lines: [line(300, 20)], client },
    { id: "inv-draft-old", user_id: ARTISAN.id, invoice_number: "F-2026-0099", status: "draft", issue_date: "2026-09-26", due_date: "2026-10-26", subtotal_ht: 10, total_vat: 2, total_ttc: 12, lines: [line(10, 20)], client },
    { id: "inv-cancelled", user_id: ARTISAN.id, invoice_number: "F-2026-0003", status: "cancelled", issue_date: "2026-09-27", due_date: "2026-10-27", subtotal_ht: 70, total_vat: 14, total_ttc: 84, lines: [line(70, 20)], client },
    // Facture d'un autre compte, même période
    { id: "inv-other", user_id: OTHER_ARTISAN.id, invoice_number: "A-2026-0001", status: "sent", issue_date: "2026-09-15", due_date: "2026-10-15", subtotal_ht: 9999, total_vat: 1999.8, total_ttc: 11998.8, lines: [line(9999, 20)], client },
  ]
  db.tables.credit_notes = [
    { id: "cn-1", user_id: ARTISAN.id, credit_note_number: "AV-2026-001", issue_date: "2026-09-21", subtotal_ht: 100, total_vat: 10, total_ttc: 110, lines: [line(100, 10)], reason: "Remise", client, original_invoice: { id: "inv-paid", invoice_number: "F-2026-0002" } },
    { id: "cn-other", user_id: OTHER_ARTISAN.id, credit_note_number: "AV-X-1", issue_date: "2026-09-21", subtotal_ht: 5, total_vat: 1, total_ttc: 6, lines: [line(5, 20)], reason: "x", client, original_invoice: null },
  ]
}

/** Jeton du lien de l'email (« …/api/invitation-comptable/<jeton> »). */
function tokenFromEmail(i = mocks.emails.length - 1): string {
  const m = /\/api\/invitation-comptable\/([A-Za-z0-9_-]{43})/.exec(mocks.emails[i]?.html ?? "")
  if (!m) throw new Error("lien absent de l'email")
  return m[1]
}

async function invite(email = ACCOUNTANT.email, now = T0) {
  const r = await inviteAccountant({ owner: ARTISAN, email, label: "Cabinet Lemoine", db: db as never, now })
  if (!r.ok) throw new Error(r.error)
  return { access: r.access, token: tokenFromEmail() }
}

async function inviteAndAccept() {
  const { access, token } = await invite()
  const r = await acceptInvitation({ token, user: ACCOUNTANT, db: db as never, now: minutes(5) })
  if (!r.ok) throw new Error(r.error)
  return { accessId: r.accessId, access, token }
}

const rows = () => db.tables.accountant_accesses as unknown as AccessRow[]
const events = () => (db.tables.accountant_access_events ?? []) as Record<string, unknown>[]

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://qonforme.fr")
  seed()
})

/* ------------------------------------------------------------------ */
/* Invitation                                                          */
/* ------------------------------------------------------------------ */

describe("invitation", () => {
  it("crée l'invitation, n'en stocke que l'empreinte, envoie l'email à l'adresse invitée", async () => {
    const { access, token } = await invite("  Claire@Cabinet.Example.com ")
    expect(access.status).toBe("pending")
    expect(access.email).toBe(ACCOUNTANT.email)
    expect(mocks.emails).toHaveLength(1)
    expect(mocks.emails[0].to).toBe(ACCOUNTANT.email)
    expect(mocks.emails[0].subject).toContain("Garnier Plâtrerie")
    expect(mocks.emails[0].html).toContain("https://qonforme.fr/api/invitation-comptable/")
    const row = rows()[0]
    expect(row.token_hash).toBe(hashInviteToken(token))
    expect(JSON.stringify(db.tables)).not.toContain(token)
    // Valable 7 jours
    expect(new Date(row.expires_at).getTime() - T0.getTime()).toBe(7 * 86_400_000)
    expect(events().map((e) => e.action)).toEqual(["invited"])
  })

  it("échappe le nom saisi dans l'email", async () => {
    await inviteAccountant({ owner: ARTISAN, email: ACCOUNTANT.email, label: "<script>alert(1)</script>", db: db as never, now: T0 })
    expect(mocks.emails[0].html).not.toContain("<script>")
    expect(mocks.emails[0].html).toContain("&lt;script&gt;")
  })

  it("refuse une adresse invalide ou celle de l'artisan lui-même", async () => {
    for (const email of ["", "pas-une-adresse", "a@b", 42]) {
      const r = await inviteAccountant({ owner: ARTISAN, email, label: null, db: db as never, now: T0 })
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.status).toBe(400)
    }
    const self = await inviteAccountant({ owner: ARTISAN, email: "THOMAS@garnier.example.com", label: null, db: db as never, now: T0 })
    expect(self).toMatchObject({ ok: false, status: 400 })
    expect(mocks.emails).toHaveLength(0)
  })

  it("réinviter une adresse en attente change le lien ; l'ancien ne fonctionne plus", async () => {
    const first = await invite()
    const tooSoon = await inviteAccountant({ owner: ARTISAN, email: ACCOUNTANT.email, label: null, db: db as never, now: minutes(0.5) })
    expect(tooSoon).toMatchObject({ ok: false, status: 429 })
    const again = await inviteAccountant({ owner: ARTISAN, email: ACCOUNTANT.email, label: null, db: db as never, now: minutes(2) })
    expect(again.ok).toBe(true)
    const second = tokenFromEmail()
    expect(second).not.toBe(first.token)
    expect(rows()).toHaveLength(1)
    expect(await resolveInvitation(first.token, null, db as never, minutes(3))).toEqual({ state: "not_found" })
    expect((await resolveInvitation(second, null, db as never, minutes(3))).state).toBe("valid")
    expect(events().map((e) => e.action)).toEqual(["invited", "reinvited"])
  })

  it("refuse une adresse qui a déjà accès, et au-delà de 5 accès en cours", async () => {
    await inviteAndAccept()
    expect(await inviteAccountant({ owner: ARTISAN, email: ACCOUNTANT.email, label: null, db: db as never, now: minutes(10) }))
      .toMatchObject({ ok: false, status: 409 })
    for (let i = 0; i < 4; i++) await invite(`p${i}@cabinet.example.com`, minutes(20 + i))
    expect(await inviteAccountant({ owner: ARTISAN, email: "p9@cabinet.example.com", label: null, db: db as never, now: minutes(30) }))
      .toMatchObject({ ok: false, status: 409 })
  })

  it("email qui ne part pas : rien ne reste ouvert", async () => {
    mocks.emailFails = true
    const r = await inviteAccountant({ owner: ARTISAN, email: ACCOUNTANT.email, label: null, db: db as never, now: T0 })
    expect(r).toMatchObject({ ok: false, status: 502 })
    expect(rows()[0].revoked_at).not.toBeNull()
    expect(rows()[0].token_hash).toBeNull()
    expect((await getOverview(ARTISAN.id, db as never, T0)).accesses).toHaveLength(0)
  })

  it("renvoi d'une invitation expirée : nouveau lien valable 7 jours", async () => {
    const { access } = await invite()
    const later = new Date(T0.getTime() + 8 * 86_400_000)
    expect((await getOverview(ARTISAN.id, db as never, later)).accesses[0].status).toBe("expired")
    const r = await resendInvitation({ owner: ARTISAN, accessId: access.id, db: db as never, now: later })
    expect(r.ok).toBe(true)
    expect((await resolveInvitation(tokenFromEmail(), null, db as never, later)).state).toBe("valid")
    // Un autre artisan ne peut pas renvoyer l'invitation
    expect(await resendInvitation({ owner: OTHER_ARTISAN, accessId: access.id, db: db as never, now: later }))
      .toMatchObject({ ok: false, status: 404 })
  })
})

/* ------------------------------------------------------------------ */
/* Acceptation                                                         */
/* ------------------------------------------------------------------ */

describe("acceptation", () => {
  it("accepte avec le compte à l'adresse invitée (casse indifférente), une seule fois", async () => {
    const { token } = await invite()
    const r = await acceptInvitation({ token, user: { id: ACCOUNTANT.id, email: "CLAIRE@cabinet.example.com" }, db: db as never, now: minutes(5) })
    expect(r.ok).toBe(true)
    const row = rows()[0]
    expect(row.accountant_id).toBe(ACCOUNTANT.id)
    expect(row.token_hash).toBeNull()
    // Le lien ne sert plus : ni à lui, ni à personne
    expect(await acceptInvitation({ token, user: ACCOUNTANT, db: db as never, now: minutes(6) })).toMatchObject({ ok: false, status: 404 })
    expect(await acceptInvitation({ token, user: INTRUDER, db: db as never, now: minutes(6) })).toMatchObject({ ok: false, status: 404 })
    expect(events().map((e) => e.action)).toEqual(["invited", "accepted"])
  })

  it("refuse un compte à une autre adresse, le compte de l'entreprise, une invitation expirée", async () => {
    const { token } = await invite()
    const wrong = await acceptInvitation({ token, user: INTRUDER, db: db as never, now: minutes(5) })
    expect(wrong).toMatchObject({ ok: false, status: 403 })
    if (!wrong.ok) expect(wrong.error).not.toContain(ACCOUNTANT.email)
    expect(await acceptInvitation({ token, user: { id: ARTISAN.id, email: ACCOUNTANT.email }, db: db as never, now: minutes(5) }))
      .toMatchObject({ ok: false, status: 403 })
    const late = new Date(T0.getTime() + 7 * 86_400_000 + 1000)
    expect(await acceptInvitation({ token, user: ACCOUNTANT, db: db as never, now: late })).toMatchObject({ ok: false, status: 410 })
    expect(rows()[0].accountant_id ?? null).toBeNull()
  })

  it("jeton mal formé ou inconnu : introuvable, sans requête utile", async () => {
    await invite()
    for (const token of [undefined, "", "abc", "x".repeat(43)]) {
      expect(await acceptInvitation({ token, user: ACCOUNTANT, db: db as never, now: minutes(5) })).toMatchObject({ ok: false, status: 404 })
    }
  })

  it("page d'invitation : adresse masquée, et dit si le visiteur est le bon compte", async () => {
    const { token } = await invite()
    const anon = await resolveInvitation(token, null, db as never, minutes(1))
    expect(anon).toMatchObject({ state: "valid", companyName: "Garnier Plâtrerie", maskedEmail: "c•••@cabinet.example.com", emailMatches: null })
    expect(JSON.stringify(anon)).not.toContain(ACCOUNTANT.email)
    expect(await resolveInvitation(token, INTRUDER, db as never, minutes(1))).toMatchObject({ emailMatches: false, isOwner: false })
    expect(await resolveInvitation(token, ARTISAN, db as never, minutes(1))).toMatchObject({ isOwner: true })
  })
})

/* ------------------------------------------------------------------ */
/* Révocation et cloisonnement                                         */
/* ------------------------------------------------------------------ */

describe("révocation et cloisonnement", () => {
  it("un comptable ne voit que ses dossiers ; un autre compte n'ouvre pas le dossier", async () => {
    const { accessId } = await inviteAndAccept()
    expect((await listDossiers(ACCOUNTANT.id, db as never)).dossiers.map((d) => d.companyName)).toEqual(["Garnier Plâtrerie"])
    expect((await listDossiers(INTRUDER.id, db as never)).dossiers).toEqual([])
    expect(await authorizeDossier(accessId, ACCOUNTANT.id, db as never)).not.toBeNull()
    expect(await authorizeDossier(accessId, INTRUDER.id, db as never)).toBeNull()
    expect(await authorizeDossier(accessId, ARTISAN.id, db as never)).toBeNull()
    expect(await authorizeDossier("pas-un-uuid", ACCOUNTANT.id, db as never)).toBeNull()
    expect(await hasDossiers(ACCOUNTANT.id, db as never)).toBe(true)
    expect(await hasDossiers(INTRUDER.id, db as never)).toBe(false)
  })

  it("une invitation en attente n'ouvre aucun dossier", async () => {
    const { access } = await invite()
    expect(await authorizeDossier(access.id, ACCOUNTANT.id, db as never)).toBeNull()
    expect((await listDossiers(ACCOUNTANT.id, db as never)).dossiers).toEqual([])
  })

  it("révocation immédiate ; seul l'artisan de l'accès peut révoquer", async () => {
    const { accessId } = await inviteAndAccept()
    expect(await revokeAccess({ ownerId: OTHER_ARTISAN.id, accessId, db: db as never })).toMatchObject({ ok: false, status: 404 })
    expect(await authorizeDossier(accessId, ACCOUNTANT.id, db as never)).not.toBeNull()
    expect(await revokeAccess({ ownerId: ARTISAN.id, accessId, db: db as never })).toEqual({ ok: true })
    expect(await authorizeDossier(accessId, ACCOUNTANT.id, db as never)).toBeNull()
    expect((await listDossiers(ACCOUNTANT.id, db as never)).dossiers).toEqual([])
    expect(events().at(-1)?.action).toBe("revoked")
    // Réinviter la même adresse après révocation est possible
    expect((await inviteAccountant({ owner: ARTISAN, email: ACCOUNTANT.email, label: null, db: db as never, now: minutes(60) })).ok).toBe(true)
  })

  it("annuler une invitation rend son lien inutilisable", async () => {
    const { access, token } = await invite()
    await revokeAccess({ ownerId: ARTISAN.id, accessId: access.id, db: db as never })
    expect(await acceptInvitation({ token, user: ACCOUNTANT, db: db as never, now: minutes(5) })).toMatchObject({ ok: false, status: 404 })
    expect(events().at(-1)?.action).toBe("cancelled")
  })

  it("le dossier ne contient que les documents émis de l'entreprise de l'accès", async () => {
    await inviteAndAccept()
    const data = await loadDossier({ ownerId: ARTISAN.id, period: { from: "2026-09-01", to: "2026-09-30" }, today: "2026-10-03", db: db as never })
    expect(data.invoices.map((i) => i.number).sort()).toEqual(["F-2026-0001", "F-2026-0002"])
    expect(data.creditNotes.map((c) => c.number)).toEqual(["AV-2026-001"])
    const json = JSON.stringify(data)
    for (const hidden of ["inv-draft", "F-2026-0099", "F-2026-0003", "A-2026-0001", "AV-X-1", "9999"]) expect(json).not.toContain(hidden)
    expect(data.totals).toMatchObject({ invoiceCount: 2, invoicedHt: 1500, invoicedTtc: 1750, creditCount: 1, paidTtc: 550, openTtc: 1200 })
    // TVA nette : 200 (20 %) ; 50 - 10 (10 %)
    expect(data.vat.map((v) => [v.label, v.base, v.vat])).toEqual([["TVA 20 %", 1000, 200], ["TVA 10 %", 400, 40]])
    // Réception des factures fournisseurs absente : rien
    expect(data.supplierInvoices).toBeNull()
  })

  it("factures fournisseurs lues quand la table de réception existe, sans celles d'un autre compte", async () => {
    db.missing.delete("received_invoices")
    db.tables.received_invoices = [
      { id: "r1", user_id: ARTISAN.id, invoice_number: "P-12", issue_date: "2026-09-03", supplier_name: "Négoce Plâtre", total_ht: 100, total_vat: 20, total_ttc: 120, status: "approved" },
      { id: "r2", user_id: OTHER_ARTISAN.id, invoice_number: "Z-1", issue_date: "2026-09-03", supplier_name: "Autre", total_ht: 1, total_vat: 0, total_ttc: 1, status: "received" },
    ]
    const data = await loadDossier({ ownerId: ARTISAN.id, period: { from: "2026-09-01", to: "2026-09-30" }, today: "2026-10-03", db: db as never })
    expect(data.supplierInvoices?.map((s) => s.number)).toEqual(["P-12"])
  })
})

/* ------------------------------------------------------------------ */
/* Journal                                                             */
/* ------------------------------------------------------------------ */

describe("journal", () => {
  it("une consultation est journalisée au plus toutes les 30 minutes, et datée sur l'accès", async () => {
    const { accessId } = await inviteAndAccept()
    const access = (await authorizeDossier(accessId, ACCOUNTANT.id, db as never))!
    await recordView(db as never, access, minutes(10))
    await recordView(db as never, access, minutes(20))
    await recordView(db as never, access, minutes(41))
    expect(events().filter((e) => e.action === "viewed")).toHaveLength(2)
    expect(rows()[0].last_seen_at).toBe(minutes(41).toISOString())
    const overview = await getOverview(ARTISAN.id, db as never, minutes(42))
    expect(overview.accesses[0]).toMatchObject({ status: "active", lastSeenAt: minutes(41).toISOString() })
    expect(overview.events[0]).toMatchObject({ action: "viewed", email: ACCOUNTANT.email, label: "Cabinet Lemoine" })
    // Le journal d'un autre artisan ne contient rien de ce dossier
    expect((await getOverview(OTHER_ARTISAN.id, db as never, minutes(42))).events).toEqual([])
  })

  it("efface les entrées de plus d'un an", async () => {
    const { accessId } = await inviteAndAccept()
    db.tables.accountant_access_events.push({ id: "old", access_id: accessId, owner_id: ARTISAN.id, action: "viewed", created_at: "2025-09-01T00:00:00.000Z" })
    const access = (await authorizeDossier(accessId, ACCOUNTANT.id, db as never))!
    await recordView(db as never, access, minutes(60))
    expect(events().some((e) => e.id === "old")).toBe(false)
  })
})

/* ------------------------------------------------------------------ */
/* Migration absente                                                   */
/* ------------------------------------------------------------------ */

describe("migration absente", () => {
  it("tout est indisponible, sans erreur", async () => {
    db.missing.add("accountant_accesses")
    db.missing.add("accountant_access_events")
    expect(await getOverview(ARTISAN.id, db as never)).toEqual({ available: false, accesses: [], events: [] })
    expect(await inviteAccountant({ owner: ARTISAN, email: ACCOUNTANT.email, label: null, db: db as never })).toMatchObject({ ok: false, status: 503 })
    expect(mocks.emails).toHaveLength(0)
    expect(await listDossiers(ACCOUNTANT.id, db as never)).toEqual({ available: false, dossiers: [] })
    expect(await authorizeDossier("00000000-0000-4000-8000-000000000001", ACCOUNTANT.id, db as never)).toBeNull()
    expect(await resolveInvitation("A".repeat(43), null, db as never)).toEqual({ state: "unavailable" })
    expect(await hasDossiers(ACCOUNTANT.id, db as never)).toBe(false)
  })
})

/* ------------------------------------------------------------------ */
/* Route d'export                                                      */
/* ------------------------------------------------------------------ */

describe("GET /api/comptable/[accès]/export", () => {
  const call = (accessId: string, query: string) =>
    exportRoute(new Request(`https://qonforme.fr/api/comptable/${accessId}/export?${query}`) as never, { params: Promise.resolve({ accessId }) })

  it("401 sans compte, 404 pour un autre compte ou après révocation", async () => {
    const { accessId } = await inviteAndAccept()
    expect((await call(accessId, "format=csv&du=2026-09-01&au=2026-09-30")).status).toBe(401)
    mocks.user = INTRUDER
    expect((await call(accessId, "format=csv&du=2026-09-01&au=2026-09-30")).status).toBe(404)
    mocks.user = { id: ARTISAN.id, email: ARTISAN.email }
    expect((await call(accessId, "format=csv&du=2026-09-01&au=2026-09-30")).status).toBe(404)
    mocks.user = ACCOUNTANT
    await revokeAccess({ ownerId: ARTISAN.id, accessId, db: db as never })
    expect((await call(accessId, "format=csv&du=2026-09-01&au=2026-09-30")).status).toBe(404)
    expect(events().some((e) => String(e.action).startsWith("export"))).toBe(false)
  })

  it("CSV des ventes de l'entreprise, journalisé, sans brouillon ni document d'un autre compte", async () => {
    const { accessId } = await inviteAndAccept()
    mocks.user = ACCOUNTANT
    const res = await call(accessId, "format=csv&du=2026-09-01&au=2026-09-30")
    expect(res.status).toBe(200)
    expect(res.headers.get("Content-Disposition")).toBe('attachment; filename="ventes-948211375-20260901-20260930.csv"')
    expect(res.headers.get("Cache-Control")).toContain("no-store")
    const csv = await res.text()
    expect(csv).toContain("F-2026-0001")
    expect(csv).toContain("AV-2026-001")
    for (const hidden of ["F-2026-0099", "F-2026-0003", "A-2026-0001", "AV-X-1"]) expect(csv).not.toContain(hidden)
    const ev = events().at(-1)!
    expect(ev).toMatchObject({ action: "export_csv", period_from: "2026-09-01", period_to: "2026-09-30", actor_id: ACCOUNTANT.id, owner_id: ARTISAN.id })
  })

  it("FEC au nom officiel, contenu limité à l'entreprise", async () => {
    const { accessId } = await inviteAndAccept()
    mocks.user = ACCOUNTANT
    const res = await call(accessId, "format=fec&du=2026-01-01&au=2026-12-31")
    expect(res.status).toBe(200)
    expect(res.headers.get("Content-Disposition")).toContain("948211375FEC20261231.txt")
    const fec = await res.text()
    expect(fec).toContain("F-2026-0001")
    expect(fec).not.toContain("A-2026-0001")
    expect(fec).not.toContain("F-2026-0099")
  })

  it("export non journalisable : rien n'est servi", async () => {
    const { accessId } = await inviteAndAccept()
    mocks.user = ACCOUNTANT
    db.failingWrites.add("accountant_access_events")
    expect((await call(accessId, "format=csv&du=2026-09-01&au=2026-09-30")).status).toBe(503)
  })

  it("format ou période invalides : 400", async () => {
    const { accessId } = await inviteAndAccept()
    mocks.user = ACCOUNTANT
    expect((await call(accessId, "format=xls&du=2026-09-01&au=2026-09-30")).status).toBe(400)
    expect((await call(accessId, "format=csv&du=2026-09-30&au=2026-09-01")).status).toBe(400)
    expect((await call(accessId, "format=csv&du=2020-01-01&au=2026-12-31")).status).toBe(400)
    expect((await call(accessId, "format=csv&du=2026-02-30&au=2026-03-01")).status).toBe(400)
  })
})
