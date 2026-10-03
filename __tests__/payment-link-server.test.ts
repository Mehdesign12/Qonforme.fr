/**
 * Lien de paiement, partie serveur, contre une fausse base en mémoire (pas
 * d'accès à la vraie base depuis les tests) : création et stabilité du lien,
 * désactivation, migration absente, page publique (états, reste dû, aucune
 * donnée d'une autre facture), route de déclaration (garde-fous anti-abus).
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { applyLinkAction, dismissDeclaration, paymentLinkFor, paymentLinkState, resolvePaymentToken } from "@/lib/payment-link/server"
import { hashToken } from "@/lib/payment-link/token"
import { POST as declare } from "@/app/api/regler/[token]/declaration/route"
import { GET as attention } from "@/app/api/attention/route"

// Fausse base et faux envoi d'email, branchés avant le chargement des modules testés
const mocks = vi.hoisted(() => ({
  db: undefined as unknown,
  sendEmail: undefined as unknown as (o: { to: string; html: string }) => Promise<{ id: string }>,
}))
vi.mock("@/lib/supabase/server", () => ({ createAdminClient: () => mocks.db, createClient: async () => mocks.db }))
vi.mock("@/lib/email/resend", () => ({ sendEmail: (o: { to: string; html: string }) => mocks.sendEmail(o) }))

/* ------------------------------------------------------------------ */
/* Fausse base Supabase (sous-ensemble utilisé par lib/payment-link)   */
/* ------------------------------------------------------------------ */

type Row = Record<string, unknown>
type Result = { data: unknown; error: { code: string; message: string } | null; count?: number | null }

class FakeDb {
  tables: Record<string, Row[]> = {}
  missing = new Set<string>()
  seq = 0
  emails: string[] = []
  from(table: string) { return new Query(this, table) }
  auth = {
    getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }),
    admin: { getUserById: async (id: string) => ({ data: { user: { id, email: "artisan@example.com" } }, error: null }) },
  }
}

class Query {
  private filters: ((r: Row) => boolean)[] = []
  private op: "select" | "insert" | "update" = "select"
  private payload: Row | null = null
  private wantCount = false
  private head = false
  private orderBy: { col: string; asc: boolean } | null = null
  private max: number | null = null
  constructor(private db: FakeDb, private table: string) {}

  select(_cols?: string, opts?: { count?: string; head?: boolean }) {
    if (opts?.count) this.wantCount = true
    if (opts?.head) this.head = true
    return this
  }
  insert(row: Row) { this.op = "insert"; this.payload = row; return this }
  update(p: Row) { this.op = "update"; this.payload = p; return this }
  eq(k: string, v: unknown) { this.filters.push((r) => r[k] === v); return this }
  neq(k: string, v: unknown) { this.filters.push((r) => r[k] !== v); return this }
  gte(k: string, v: string) { this.filters.push((r) => String(r[k]) >= v); return this }
  in(k: string, vs: unknown[]) { this.filters.push((r) => vs.includes(r[k])); return this }
  lt(k: string, v: string) { this.filters.push((r) => String(r[k]) < v); return this }
  // Filtres composés de /api/attention : hors du périmètre testé ici, aucune ligne retenue
  or(_expr: string) { this.filters.push(() => false); return this }
  order(col: string, o?: { ascending?: boolean }) { this.orderBy = { col, asc: o?.ascending ?? true }; return this }
  limit(n: number) { this.max = n; return this }

  private run(): Result {
    if (this.db.missing.has(this.table)) {
      return { data: null, error: { code: "PGRST205", message: `Could not find the table 'public.${this.table}' in the schema cache` } }
    }
    const rows = (this.db.tables[this.table] ??= [])
    if (this.op === "insert") {
      const row: Row = { id: `id-${++this.db.seq}`, created_at: new Date().toISOString(), disabled_at: null, ...this.payload }
      if (this.table === "invoice_payment_links" && rows.some((r) => r.invoice_id === row.invoice_id || r.token_hash === row.token_hash)) {
        return { data: null, error: { code: "23505", message: "duplicate key" } }
      }
      if (this.table === "invoice_payment_declarations" && row.status === "open"
        && rows.some((r) => r.invoice_id === row.invoice_id && r.status === "open")) {
        return { data: null, error: { code: "23505", message: "duplicate key" } }
      }
      rows.push(row)
      return { data: [row], error: null }
    }
    let found = rows.filter((r) => this.filters.every((f) => f(r)))
    if (this.op === "update") {
      found.forEach((r) => Object.assign(r, this.payload))
      return { data: found, error: null }
    }
    if (this.orderBy) {
      const { col, asc } = this.orderBy
      found = [...found].sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : 1) * (asc ? 1 : -1))
    }
    const count = found.length
    if (this.max !== null) found = found.slice(0, this.max)
    return { data: this.head ? null : found, error: null, count: this.wantCount ? count : null }
  }
  maybeSingle(): Promise<Result> {
    const r = this.run()
    return Promise.resolve(r.error ? r : { data: (r.data as Row[])[0] ?? null, error: null })
  }
  single(): Promise<Result> {
    const r = this.run()
    if (r.error) return Promise.resolve(r)
    const first = (r.data as Row[])[0]
    return Promise.resolve(first ? { data: first, error: null } : { data: null, error: { code: "PGRST116", message: "no rows" } })
  }
  then<T>(resolve: (r: Result) => T) { return Promise.resolve(this.run()).then(resolve) }
}

let db: FakeDb
const sendEmail = vi.fn(async (opts: { to: string; html: string }) => { db.emails.push(opts.to); return { id: "e" } })
mocks.sendEmail = sendEmail

/* ------------------------------------------------------------------ */
/* Données                                                             */
/* ------------------------------------------------------------------ */

const USER = "user-1"
const OTHER = "user-2"
const IBAN = "FR1420041010050500013M02606"

function seed() {
  db = new FakeDb()
  mocks.db = db
  db.tables.companies = [
    { user_id: USER, name: "Garnier Plâtrerie", iban: IBAN, bic: "BNPAFRPPXXX", bank_account_holder: "", email: "contact@garnier.example.com", logo_url: "https://evil.example.com/pixel.png", siren: "948211375" },
    { user_id: OTHER, name: "Autre", iban: IBAN },
  ]
  db.tables.invoices = [
    { id: "inv-sent", user_id: USER, client_id: "cl-1", invoice_number: "F-2026-0142", status: "sent", issue_date: "2026-09-12", due_date: "2026-10-12", total_ttc: 1200 },
    { id: "inv-draft", user_id: USER, client_id: "cl-1", invoice_number: "F-2026-0145", status: "draft", issue_date: "2026-10-01", due_date: "2026-10-31", total_ttc: 300 },
    { id: "inv-paid", user_id: USER, client_id: "cl-1", invoice_number: "F-2026-0138", status: "paid", issue_date: "2026-08-05", due_date: "2026-09-04", total_ttc: 500 },
    { id: "inv-other", user_id: OTHER, client_id: "cl-9", invoice_number: "X-1", status: "sent", issue_date: "2026-09-01", due_date: "2026-10-01", total_ttc: 99 },
  ]
  db.tables.clients = [{ id: "cl-1", user_id: USER, name: "Bâti Ouest SAS" }]
  db.tables.credit_notes = [{ original_invoice_id: "inv-sent", user_id: USER, total_ttc: 200 }]
  db.tables.invoice_payment_links = []
  db.tables.invoice_payment_declarations = []
}

const tokenOf = (url: string | null) => url?.split("/regler/")[1] ?? ""

beforeEach(() => {
  vi.stubEnv("PAYMENT_LINK_SECRET", "secret-de-test-de-plus-de-32-caracteres")
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://qonforme.fr")
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abcdefghijklmnopqrst.supabase.co")
  sendEmail.mockClear()
  seed()
})

/* ------------------------------------------------------------------ */
/* paymentLinkFor                                                      */
/* ------------------------------------------------------------------ */

describe("paymentLinkFor", () => {
  it("crée un lien stable pour une facture émise, ne stocke que l'empreinte", async () => {
    const url = await paymentLinkFor({ invoiceId: "inv-sent", userId: USER })
    expect(url).toMatch(/^https:\/\/qonforme\.fr\/regler\/[A-Za-z0-9_-]{43}$/)
    expect(await paymentLinkFor({ invoiceId: "inv-sent", userId: USER })).toBe(url)
    const rows = db.tables.invoice_payment_links
    expect(rows).toHaveLength(1)
    expect(rows[0].token_hash).toBe(hashToken(tokenOf(url)))
    expect(JSON.stringify(rows)).not.toContain(tokenOf(url))
  })

  it("jamais pour un brouillon, sauf pendant l'émission", async () => {
    expect(await paymentLinkFor({ invoiceId: "inv-draft", userId: USER })).toBeNull()
    expect(await paymentLinkFor({ invoiceId: "inv-draft", userId: USER, issuing: true })).toMatch(/\/regler\//)
  })

  it("rien pour la facture d'un autre compte, sans IBAN valide, ou sans secret", async () => {
    expect(await paymentLinkFor({ invoiceId: "inv-other", userId: USER })).toBeNull()
    db.tables.companies[0].iban = "FR1420041010050500013M02607"
    expect(await paymentLinkFor({ invoiceId: "inv-sent", userId: USER })).toBeNull()
    db.tables.companies[0].iban = IBAN
    vi.stubEnv("PAYMENT_LINK_SECRET", "")
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "")
    expect(await paymentLinkFor({ invoiceId: "inv-sent", userId: USER })).toBeNull()
  })

  it("ne crée pas de lien pour une facture réglée, ne recrée jamais un lien désactivé", async () => {
    expect(await paymentLinkFor({ invoiceId: "inv-paid", userId: USER })).toBeNull()
    await paymentLinkFor({ invoiceId: "inv-sent", userId: USER })
    db.tables.invoice_payment_links[0].disabled_at = "2026-10-02T10:00:00Z"
    expect(await paymentLinkFor({ invoiceId: "inv-sent", userId: USER })).toBeNull()
    expect(db.tables.invoice_payment_links).toHaveLength(1)
  })

  it("migration absente : null, sans erreur", async () => {
    db.missing.add("invoice_payment_links")
    expect(await paymentLinkFor({ invoiceId: "inv-sent", userId: USER })).toBeNull()
    expect((await paymentLinkState({ invoiceId: "inv-sent", userId: USER })).available).toBe(false)
  })
})

/* ------------------------------------------------------------------ */
/* Fiche facture                                                       */
/* ------------------------------------------------------------------ */

describe("actions de l'artisan", () => {
  it("créer, désactiver, recréer : le nouveau lien remplace l'ancien", async () => {
    expect(await applyLinkAction({ invoiceId: "inv-sent", userId: USER, status: "sent", action: "create" })).toBeNull()
    const first = (await paymentLinkState({ invoiceId: "inv-sent", userId: USER })).link!.url
    await applyLinkAction({ invoiceId: "inv-sent", userId: USER, status: "sent", action: "disable" })
    const off = await paymentLinkState({ invoiceId: "inv-sent", userId: USER })
    expect(off.link).toBeNull()
    expect(off.disabledAt).not.toBeNull()
    expect((await resolvePaymentToken(tokenOf(first))).data.state).toBe("disabled")

    await applyLinkAction({ invoiceId: "inv-sent", userId: USER, status: "sent", action: "enable" })
    const second = (await paymentLinkState({ invoiceId: "inv-sent", userId: USER })).link!.url
    expect(second).not.toBe(first)
    expect((await resolvePaymentToken(tokenOf(first))).data.state).toBe("not_found")
    expect((await resolvePaymentToken(tokenOf(second))).data.state).toBe("payable")
  })

  it("refuse de créer un lien pour un brouillon ou une facture réglée, ou sans IBAN valide", async () => {
    expect(await applyLinkAction({ invoiceId: "inv-draft", userId: USER, status: "draft", action: "create" })).toMatch(/envoi/)
    expect(await applyLinkAction({ invoiceId: "inv-paid", userId: USER, status: "paid", action: "create" })).toMatch(/plus à régler/)
    db.tables.companies[0].iban = ""
    expect(await applyLinkAction({ invoiceId: "inv-sent", userId: USER, status: "sent", action: "create" })).toMatch(/IBAN/)
    expect((await paymentLinkState({ invoiceId: "inv-sent", userId: USER })).iban).toBe("missing")
  })

  it("« Pas reçu » écarte la déclaration ouverte de cette facture seulement", async () => {
    db.tables.invoice_payment_declarations.push(
      { id: "d1", invoice_id: "inv-sent", user_id: USER, status: "open", transfer_date: "2026-10-01", amount: 1000, created_at: "2026-10-01T10:00:00Z" },
      { id: "d2", invoice_id: "inv-other", user_id: OTHER, status: "open", transfer_date: "2026-10-01", amount: 99, created_at: "2026-10-01T10:00:00Z" },
    )
    expect((await paymentLinkState({ invoiceId: "inv-sent", userId: USER })).declaration?.id).toBe("d1")
    // Identifiant d'une déclaration d'un autre compte : sans effet
    await dismissDeclaration({ invoiceId: "inv-sent", userId: USER, declarationId: "d2" })
    expect(db.tables.invoice_payment_declarations[1].status).toBe("open")
    await dismissDeclaration({ invoiceId: "inv-sent", userId: USER, declarationId: "d1" })
    expect(db.tables.invoice_payment_declarations[0].status).toBe("dismissed")
    expect((await paymentLinkState({ invoiceId: "inv-sent", userId: USER })).declaration).toBeNull()
  })
})

/* ------------------------------------------------------------------ */
/* Page publique                                                       */
/* ------------------------------------------------------------------ */

describe("resolvePaymentToken", () => {
  it("jeton mal formé ou inconnu : introuvable, sans requête inutile", async () => {
    expect((await resolvePaymentToken("abc")).data.state).toBe("not_found")
    expect((await resolvePaymentToken("a".repeat(43))).data.state).toBe("not_found")
  })

  it("facture à régler : reste dû après avoirs, coordonnées, QR code, rien d'interne", async () => {
    const url = await paymentLinkFor({ invoiceId: "inv-sent", userId: USER })
    const { data } = await resolvePaymentToken(tokenOf(url))
    expect(data.state).toBe("payable")
    if (data.state !== "payable") return
    expect(data.invoice).toEqual({ number: "F-2026-0142", issueDate: "2026-09-12", dueDate: "2026-10-12", totalTtc: 1200, credited: 200, remaining: 1000 })
    expect(data.account).toEqual({ holder: "Garnier Plâtrerie", iban: IBAN, bic: "BNPAFRPPXXX" })
    expect(data.qr?.path).toMatch(/^M\d/)
    // Logo hors du Storage du projet : jamais affiché au client
    expect(data.company.logoUrl).toBeNull()
    const json = JSON.stringify(data)
    for (const secret of ["inv-sent", USER, "cl-1", "id-"]) expect(json).not.toContain(secret)
  })

  it("brouillon : introuvable ; réglée : « réglée » ; avoirs couvrant tout : « rien à régler »", async () => {
    const draftUrl = await paymentLinkFor({ invoiceId: "inv-draft", userId: USER, issuing: true })
    expect((await resolvePaymentToken(tokenOf(draftUrl))).data.state).toBe("not_found")

    const url = await paymentLinkFor({ invoiceId: "inv-sent", userId: USER })
    db.tables.invoices[0].status = "paid"
    expect((await resolvePaymentToken(tokenOf(url))).data.state).toBe("paid")
    db.tables.invoices[0].status = "sent"
    db.tables.credit_notes.push({ original_invoice_id: "inv-sent", user_id: USER, total_ttc: 1000 })
    expect((await resolvePaymentToken(tokenOf(url))).data.state).toBe("credited")
  })

  it("IBAN retiré depuis l'envoi : page sans coordonnées ni QR code", async () => {
    const url = await paymentLinkFor({ invoiceId: "inv-sent", userId: USER })
    db.tables.companies[0].iban = null
    const { data } = await resolvePaymentToken(tokenOf(url))
    expect(data.state === "payable" && data.account === null && data.qr === null).toBe(true)
  })

  it("migration absente : introuvable, sans erreur", async () => {
    db.missing.add("invoice_payment_links")
    expect((await resolvePaymentToken("a".repeat(43))).data.state).toBe("not_found")
  })
})

/* ------------------------------------------------------------------ */
/* Route publique de déclaration                                       */
/* ------------------------------------------------------------------ */

function post(token: string, body: unknown) {
  const req = new Request(`https://qonforme.fr/api/regler/${token}/declaration`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return declare(req as any, { params: Promise.resolve({ token }) })
}

describe("POST /api/regler/[token]/declaration", () => {
  const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date())

  it("enregistre la déclaration et prévient l'artisan, note échappée", async () => {
    const token = tokenOf(await paymentLinkFor({ invoiceId: "inv-sent", userId: USER }))
    const res = await post(token, { transfer_date: today(), amount: "1000,00", note: "<script>alert(1)</script>" })
    expect(res.status).toBe(201)
    const rows = db.tables.invoice_payment_declarations
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ invoice_id: "inv-sent", user_id: USER, amount: 1000, status: "open" })
    expect(sendEmail).toHaveBeenCalledTimes(1)
    const mail = sendEmail.mock.calls[0][0] as { to: string; html: string }
    expect(mail.to).toBe("contact@garnier.example.com")
    expect(mail.html).not.toContain("<script>")
    expect(mail.html).toContain("&lt;script&gt;")
    expect(mail.html).toContain("Bâti Ouest SAS")
  })

  it("une seule déclaration ouverte à la fois", async () => {
    const token = tokenOf(await paymentLinkFor({ invoiceId: "inv-sent", userId: USER }))
    expect((await post(token, { transfer_date: today(), amount: 1000 })).status).toBe(201)
    expect((await post(token, { transfer_date: today(), amount: 1000 })).status).toBe(409)
    expect(db.tables.invoice_payment_declarations).toHaveLength(1)
  })

  it("trois déclarations au plus par facture sur 24 heures", async () => {
    const token = tokenOf(await paymentLinkFor({ invoiceId: "inv-sent", userId: USER }))
    for (let i = 0; i < 3; i++) {
      expect((await post(token, { transfer_date: today(), amount: 10 })).status).toBe(201)
      db.tables.invoice_payment_declarations.forEach((d) => { d.status = "dismissed" })
    }
    expect((await post(token, { transfer_date: today(), amount: 10 })).status).toBe(429)
  })

  it("refuse entrées invalides, montant supérieur au reste dû, corps trop gros", async () => {
    const token = tokenOf(await paymentLinkFor({ invoiceId: "inv-sent", userId: USER }))
    const bad = await post(token, { transfer_date: today(), amount: 1000.01 })
    expect(bad.status).toBe(400)
    expect(await bad.json()).toMatchObject({ field: "amount" })
    expect((await post(token, "pas du json")).status).toBe(400)
    expect((await post(token, { transfer_date: today(), amount: 1, note: "x".repeat(5000) })).status).toBe(413)
    expect(db.tables.invoice_payment_declarations).toHaveLength(0)
  })

  it("jeton inconnu, lien désactivé, facture réglée : rien n'est enregistré", async () => {
    expect((await post("a".repeat(43), { transfer_date: today(), amount: 1 })).status).toBe(404)
    expect((await post("../../etc", { transfer_date: today(), amount: 1 })).status).toBe(404)
    const token = tokenOf(await paymentLinkFor({ invoiceId: "inv-sent", userId: USER }))
    db.tables.invoices[0].status = "paid"
    expect((await post(token, { transfer_date: today(), amount: 1 })).status).toBe(409)
    db.tables.invoices[0].status = "sent"
    db.tables.invoice_payment_links[0].disabled_at = "2026-10-02T10:00:00Z"
    expect((await post(token, { transfer_date: today(), amount: 1 })).status).toBe(410)
    expect(db.tables.invoice_payment_declarations).toHaveLength(0)
    expect(sendEmail).not.toHaveBeenCalled()
  })
})

/* ------------------------------------------------------------------ */
/* Cloche « À surveiller »                                             */
/* ------------------------------------------------------------------ */

describe("GET /api/attention : virements déclarés", () => {
  it("signale les virements déclarés sur une facture à encaisser, pas ceux écartés ni réglés", async () => {
    db.tables.invoice_payment_declarations.push(
      { id: "d-open", invoice_id: "inv-sent", user_id: USER, status: "open", transfer_date: "2026-09-30", amount: 1000, created_at: "2026-09-30T16:12:00Z" },
      { id: "d-paid", invoice_id: "inv-paid", user_id: USER, status: "open", transfer_date: "2026-09-01", amount: 500, created_at: "2026-09-01T10:00:00Z" },
      { id: "d-gone", invoice_id: "inv-sent", user_id: USER, status: "dismissed", transfer_date: "2026-09-20", amount: 1000, created_at: "2026-09-20T10:00:00Z" },
      { id: "d-other", invoice_id: "inv-other", user_id: OTHER, status: "open", transfer_date: "2026-09-30", amount: 99, created_at: "2026-09-30T10:00:00Z" },
    )
    const body = await (await attention()).json()
    expect(body.counts.transfers).toBe(1)
    expect(body.items[0]).toMatchObject({ id: "transfer-d-open", kind: "transfer", href: "/invoices/inv-sent" })
    expect(body.items[0].meta).toContain("F-2026-0142")
    expect(body.items[0].meta).toContain("30/09/2026")
    expect(body.total).toBe(1)
  })

  it("migration absente : la cloche fonctionne comme avant", async () => {
    db.missing.add("invoice_payment_declarations")
    const res = await attention()
    expect(res.status).toBe(200)
    expect((await res.json()).counts.transfers).toBe(0)
  })
})
