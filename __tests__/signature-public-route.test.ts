/**
 * Route publique POST /api/signature/public/[id] avec une base simulée :
 * accès par le seul jeton du cookie, défense contre les requêtes d'un autre
 * site, signature enregistrée une fois avec sa preuve, statut du devis passé
 * à « accepté » par la liste blanche, emails au client et à l'artisan.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { generateToken, hashToken } from "@/lib/signature/crypto"
// vi.mock est remonté avant ces imports : la route utilise la base simulée ci-dessous
import { POST } from "@/app/api/signature/public/[id]/route"
import { documentFingerprint, loadDocument } from "@/lib/signature/server"

/* ── Base simulée ─────────────────────────────────────────────────── */

type Op = { table: string; kind: "select" | "update" | "insert"; values?: Record<string, unknown>; filters: [string, unknown][]; returning: boolean }

const db: {
  ops: Op[]
  signature: Record<string, unknown> | null
  quote: Record<string, unknown> | null
  uploads: string[]
} = { ops: [], signature: null, quote: null, uploads: [] }

function from(table: string) {
  const op: Op = { table, kind: "select", filters: [], returning: false }
  db.ops.push(op)
  const result = () => {
    if (op.kind === "update" && table === "document_signatures") {
      const pendingGuard = op.filters.find(([k]) => k === "status")
      if (pendingGuard && db.signature && db.signature.status !== pendingGuard[1]) return { data: [], error: null }
      if (db.signature) Object.assign(db.signature, op.values)
      return { data: op.returning ? [{ ...db.signature }] : null, error: null }
    }
    if (op.kind === "update" && table === "quotes") {
      if (db.quote) Object.assign(db.quote, op.values)
      return { data: null, error: null }
    }
    if (op.kind === "select" && table === "document_signature_events") return { data: [], error: null }
    return { data: null, error: null }
  }
  const api = {
    select: () => { if (op.kind !== "select") op.returning = true; return api },
    update: (values: Record<string, unknown>) => { op.kind = "update"; op.values = values; return api },
    insert: (values: Record<string, unknown>) => { op.kind = "insert"; op.values = values; return Promise.resolve({ error: null }) },
    eq: (k: string, v: unknown) => { op.filters.push([k, v]); return api },
    in: () => api,
    order: () => api,
    limit: () => api,
    maybeSingle: () => {
      if (table === "document_signatures") {
        const id = op.filters.find(([k]) => k === "id")?.[1]
        return Promise.resolve({ data: db.signature && db.signature.id === id ? { ...db.signature } : null, error: null })
      }
      if (table === "quotes") return Promise.resolve({ data: db.quote ? { ...db.quote } : null, error: null })
      if (table === "companies") return Promise.resolve({ data: { name: "Garnier Plâtrerie", email: "contact@garnier.example.com", accent_color: "#2563EB" }, error: null })
      return Promise.resolve({ data: null, error: null })
    },
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(result()).then(resolve, reject),
  }
  return api
}

const admin = {
  from,
  storage: { from: () => ({ upload: (p: string) => { db.uploads.push(p); return Promise.resolve({ error: null }) } }) },
  auth: { admin: { getUserById: () => Promise.resolve({ data: { user: { email: "artisan@example.com" } } }) } },
}

let cookieToken: string | undefined
const sent: { to: string; subject: string; attachments?: unknown[] }[] = []

vi.mock("@/lib/supabase/server", () => ({ createAdminClient: () => admin, createClient: () => admin }))
vi.mock("next/headers", () => ({ cookies: () => ({ get: () => (cookieToken ? { value: cookieToken } : undefined) }) }))
vi.mock("@/lib/email/resend", () => ({
  sendEmail: (o: { to: string; subject: string; attachments?: unknown[] }) => { sent.push(o); return Promise.resolve({ id: "x" }) },
}))


/* ── Données ──────────────────────────────────────────────────────── */

const ID = "0b3f6a2e-1c1d-4e5f-9a8b-7c6d5e4f3a2b"
const DOC_ID = "6f1e2d3c-4b5a-4987-8a6b-5c4d3e2f1a0b"
let token = ""

async function reset() {
  token = generateToken()
  cookieToken = token
  db.ops = []
  db.uploads = []
  sent.length = 0
  db.quote = {
    id: DOC_ID, user_id: "user-1", quote_number: "D-2026-035", status: "sent", issue_date: "2026-09-28", valid_until: "2099-12-31",
    lines: [{ description: "Isolation des combles", quantity: 85, unit_price_ht: 36, vat_rate: 5.5, total_ht: 3060 }],
    subtotal_ht: 3060, total_vat: 168.3, total_ttc: 3228.3, notes: null, client_id: "c1",
    client: { id: "c1", name: "Nadia Lambert", email: "lambert@example.com", address: null, zip_code: null, city: null, siren: null, vat_number: null },
  }
  const doc = await loadDocument(admin as never, "quote", DOC_ID, "user-1")
  db.signature = {
    id: ID, user_id: "user-1", document_type: "quote", document_id: DOC_ID, document_number: "D-2026-035", version: 1, mode: "sign",
    content_sha256: documentFingerprint(doc!), token_hash: hashToken(token), token_ciphertext: null, status: "pending", client_kind: "consumer",
    expires_at: "2099-12-31T22:59:59Z", sent_at: "2026-10-01T08:00:00Z", view_count: 0, last_viewed_at: null, first_viewed_at: null,
    code_required: false, code_attempts: 0, code_sent_count: 0, code_verified_at: null, consents: {},
  }
  db.ops = []
}

function req(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(`https://qonforme.fr/api/signature/public/${ID}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://qonforme.fr", "x-real-ip": "203.0.113.24", "user-agent": "Test", ...headers },
    body: JSON.stringify(body),
  })
}

const call = (body: unknown, headers?: Record<string, string>, id = ID) => POST(req(body, headers), { params: { id } })

describe("POST /api/signature/public/[id]", () => {
  beforeEach(reset)

  it("refuse sans cookie, avec un mauvais jeton ou un identifiant invalide", async () => {
    cookieToken = undefined
    expect((await call({ action: "view" })).status).toBe(404)
    cookieToken = generateToken()
    expect((await call({ action: "view" })).status).toBe(404)
    cookieToken = token
    expect((await call({ action: "view" }, {}, "pas-un-uuid")).status).toBe(404)
  })

  it("refuse une requête venue d'un autre site ou qui n'est pas du JSON", async () => {
    expect((await call({ action: "view" }, { origin: "https://pirate.example" })).status).toBe(403)
    expect((await call({ action: "view" }, { "content-type": "text/plain" })).status).toBe(415)
  })

  it("compte une consultation", async () => {
    const res = await call({ action: "view" })
    expect(res.status).toBe(200)
    expect(db.signature?.view_count).toBe(1)
    expect(db.ops.some((o) => o.table === "document_signature_events" && o.values?.type === "viewed")).toBe(true)
  })

  it("refuse une signature incomplète (certification de TVA réduite manquante)", async () => {
    const res = await call({ action: "sign", signer_name: "Nadia Lambert", signer_email: "lambert@example.com", method: "typed", typed_name: "Nadia Lambert", consents: { accepted_document: true } })
    expect(res.status).toBe(400)
    expect((await res.json()).field).toBe("reduced_vat_certified")
    expect(db.signature?.status).toBe("pending")
  })

  it("signe une fois : preuve, devis accepté, PDF conservé, emails envoyés", async () => {
    const body = {
      action: "sign", signer_name: "Nadia Lambert", signer_email: "lambert@example.com", method: "typed", typed_name: "Nadia Lambert",
      consents: { accepted_document: true, reduced_vat_certified: true, early_start_requested: true },
    }
    const res = await call(body)
    expect(res.status).toBe(200)
    expect(db.signature).toMatchObject({ status: "signed", signer_name: "Nadia Lambert", signer_ip: "203.0.113.24", signature_method: "typed", signature_context: "distance" })
    expect(String(db.signature?.document_sha256)).toMatch(/^[0-9a-f]{64}$/)
    expect(db.signature?.consents).toMatchObject({ accepted_document: true, reduced_vat_certified: true, early_start_requested: true, withdrawal_information_shown: true })
    // Statut du devis : sent → accepted, avec la garde sur le statut lu
    const quoteUpdate = db.ops.find((o) => o.table === "quotes" && o.kind === "update")
    expect(quoteUpdate?.values?.status).toBe("accepted")
    expect(quoteUpdate?.filters).toContainEqual(["status", "sent"])
    expect(db.quote?.status).toBe("accepted")
    // PDF d'origine et PDF signé dans le stockage privé
    expect(db.uploads).toEqual(["user-1/" + ID + "/original.pdf", "user-1/" + ID + "/signe.pdf"])
    // Exemplaire signé au client (avec le PDF), notification à l'artisan (adresse de son entreprise)
    expect(sent.map((s) => s.to)).toEqual(["lambert@example.com", "contact@garnier.example.com"])
    expect(sent[0].attachments).toHaveLength(1)

    // Une seconde signature est refusée : le lien n'attend plus rien
    const again = await call(body)
    expect(again.status).toBe(409)
  })

  it("lien remplacé si le devis a changé depuis l'envoi", async () => {
    db.quote!.total_ttc = 9999
    const res = await call({ action: "sign", signer_name: "Nadia Lambert", signer_email: "lambert@example.com", method: "typed", typed_name: "N", consents: { accepted_document: true, reduced_vat_certified: true } })
    expect(res.status).toBe(409)
    expect(db.signature?.status).toBe("superseded")
  })

  it("enregistre un refus et passe le devis à « refusé »", async () => {
    const res = await call({ action: "refuse", reason: "price", message: "Trop cher" })
    expect(res.status).toBe(200)
    expect(db.signature).toMatchObject({ status: "refused", refusal_reason: "price", refusal_message: "Trop cher" })
    expect(db.quote?.status).toBe("rejected")
    expect(sent.map((s) => s.to)).toEqual(["contact@garnier.example.com"])
  })
})
