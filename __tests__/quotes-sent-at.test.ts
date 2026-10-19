// @vitest-environment node
/**
 * La table `quotes` n'a pas de colonne `sent_at` en production tant que la migration
 * 20261019_quotes_sent_at.sql n'est pas appliquée (constat du 19/10/2026, parcours
 * d'achat sur téléphone). Conséquences corrigées ici :
 *  - un devis envoyé par email restait « Brouillon » : la mise à jour du statut et de la
 *    date d'envoi échouait en bloc, sans erreur visible ;
 *  - la cloche « À surveiller » (GET /api/attention) répondait 500.
 * Le code doit fonctionner avec ET sans la colonne.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

type Result = { data?: unknown; error?: { code?: string; message?: string } | null; count?: number | null }

const h = vi.hoisted(() => ({
  withSentAt: false,
  statusUpdateFails: false,
  updates: [] as Record<string, unknown>[],
  emails: [] as unknown[],
  quote: {
    id: "q1", status: "draft", quote_number: "D-2026-001", issue_date: "2026-10-01", valid_until: "2026-11-01",
    subtotal_ht: 100, total_vat: 20, total_ttc: 120, notes: null,
    client: { id: "c1", name: "Mehdi", email: "client@example.fr" },
  } as Record<string, unknown>,
  /** Devis envoyé il y a longtemps : la cloche doit le signaler. */
  sentQuote: { id: "q2", quote_number: "D-2026-002", issue_date: "2026-09-01", client: { name: "Mehdi" } } as Record<string, unknown>,
}))

const MISSING_COLUMN = { code: "42703", message: "column quotes.sent_at does not exist" }

/** Client Supabase minimal : toute chaîne de filtres se résout selon la table et les colonnes demandées. */
function fakeClient() {
  const chain = (table: string, resolve: () => Result) => {
    const c: Record<string, unknown> = {}
    for (const m of ["select", "eq", "neq", "in", "or", "lt", "gt", "is", "not", "order", "limit"]) c[m] = () => c
    c.single = async () => resolve()
    c.maybeSingle = async () => resolve()
    c.then = (ok: (r: Result) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(resolve()).then(ok, ko)
    void table
    return c
  }
  return {
    auth: { getUser: async () => ({ data: { user: { id: "user-1", email: "moi@example.fr" } } }) },
    from(table: string) {
      return {
        select(cols: string) {
          return chain(table, () => {
            if (table === "quotes" && /sent_at/.test(cols)) {
              return h.withSentAt ? { data: [h.sentQuote], error: null, count: 1 } : { data: null, error: MISSING_COLUMN, count: null }
            }
            if (table === "quotes" && /issue_date/.test(cols) && !/created_at/.test(cols) && !/valid_until/.test(cols)) {
              return { data: [h.sentQuote], error: null, count: 1 }
            }
            if (table === "quotes" && cols.startsWith("*")) return { data: h.quote, error: null }
            return { data: [], error: null, count: 0 }
          })
        },
        update(values: Record<string, unknown>) {
          h.updates.push(values)
          return chain(table, () => {
            if (h.statusUpdateFails && "status" in values) return { error: { code: "XX000", message: "boom" } }
            if (!h.withSentAt && "sent_at" in values) return { error: MISSING_COLUMN }
            return { error: null }
          })
        },
      }
    },
  }
}

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => fakeClient(), createAdminClient: () => fakeClient() }))
vi.mock("@/lib/legal/issuer", () => ({ requireIssuerIdentity: async () => null }))
vi.mock("@/lib/legal/db", () => ({ selectCompanyWithProfile: async () => ({ data: { name: "Plâtrerie Garnier", email: "moi@example.fr" }, error: null }) }))
vi.mock("@/lib/pdf/quote", () => ({ generateQuotePdf: async () => Buffer.from("pdf") }))
vi.mock("@/lib/signature/share", () => ({ shareLinkForEmail: async () => null, markShareLinkSent: async () => {} }))
vi.mock("@/lib/email/resend", () => ({ sendEmail: async (o: unknown) => { h.emails.push(o); return { id: "email-1" } } }))

import { POST as sendQuote } from "@/app/api/quotes/[id]/send/route"
import { GET as attention } from "@/app/api/attention/route"

const send = () => sendQuote(new NextRequest("http://localhost/api/quotes/q1/send", { method: "POST" }), { params: Promise.resolve({ id: "q1" }) })

beforeEach(() => {
  h.withSentAt = false
  h.statusUpdateFails = false
  h.updates = []
  h.emails = []
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("envoi d'un devis par email", () => {
  it("sans la colonne sent_at : l'email part et le statut passe quand même à « envoyé »", async () => {
    const res = await send()
    expect(res.status).toBe(200)
    expect(h.emails).toHaveLength(1)
    expect(h.updates[0]).toEqual({ status: "sent" })
    expect((await res.json()).success).toBe(true)
  })

  it("avec la colonne sent_at : statut puis date d'envoi", async () => {
    h.withSentAt = true
    const res = await send()
    expect(res.status).toBe(200)
    expect(h.updates[0]).toEqual({ status: "sent" })
    expect(typeof h.updates[1]?.sent_at).toBe("string")
  })

  it("statut impossible à écrire : l'erreur est dite (l'email est parti), jamais silencieuse", async () => {
    h.statusUpdateFails = true
    const res = await send()
    expect(res.status).toBe(502)
    expect(h.emails).toHaveLength(1)
    expect((await res.json()).error).toContain("statut")
  })
})

describe("cloche « À surveiller »", () => {
  it("sans la colonne sent_at : répond 200 et signale le devis sans réponse (date d'émission)", async () => {
    const res = await attention()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.counts.quotes).toBe(1)
    expect(JSON.stringify(body.items)).toContain("D-2026-002")
  })

  it("avec la colonne sent_at : même résultat", async () => {
    h.withSentAt = true
    const res = await attention()
    expect(res.status).toBe(200)
    expect((await res.json()).counts.quotes).toBe(1)
  })
})
