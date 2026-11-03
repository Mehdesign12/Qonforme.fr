/**
 * Émission par la plateforme : enregistrement des envois (lib/pa/outbound.ts).
 * La fausse base reproduit la table pa_outbound et ses index uniques
 * (une tentative active par document, un identifiant de plateforme par mode).
 */
import { describe, expect, it } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  applyOutboundEvents, canReportPayment, canResend, claimPaymentReport, latestOfficial, loadActiveOutbound,
  loadOutboundHistory, markDeposited, markFailed, mergeEvents, phaseAfter, releasePaymentReport, reserveOutbound,
  STALE_SENDING_MS, toOutboundEvent, type OutboundEvent, type OutboundRow,
} from "@/lib/pa/outbound"
import type { SpEvent } from "@/lib/pa/superpdp/api"

type Row = Record<string, unknown>
type Filter = (r: Row) => boolean

function fakeDb(opts: { missing?: boolean } = {}) {
  const rows: Row[] = []
  let seq = 0
  const violates = (candidate: Row, self?: Row): boolean =>
    rows.some((r) => r !== self && (
      (r.document_type === candidate.document_type && r.document_id === candidate.document_id && r.superseded_at == null && candidate.superseded_at == null) ||
      (r.document_type === candidate.document_type && r.document_id === candidate.document_id && r.attempt === candidate.attempt) ||
      (candidate.platform_invoice_id != null && r.mode === candidate.mode && r.platform_invoice_id === candidate.platform_invoice_id)
    ))
  const db = {
    rows,
    from(table: string) {
      expect(table).toBe("pa_outbound")
      const filters: Filter[] = []
      let action: "select" | "update" | "insert" = "select"
      let payload: Row = {}
      let order: { col: string; asc: boolean } | null = null
      let returning = false
      const run = (): { data: unknown; error: unknown } => {
        if (opts.missing) return { data: null, error: { code: "PGRST205", message: "Could not find the table 'public.pa_outbound' in the schema cache" } }
        if (action === "insert") {
          const now = new Date().toISOString()
          const row: Row = { id: `o${++seq}`, provider: "superpdp", attempt: 1, phase: "sending", events: [], superseded_at: null, platform_invoice_id: null, payment_reported_at: null, payment_event_id: null, last_status_code: null, created_at: now, updated_at: now, ...payload }
          if (violates(row)) return { data: null, error: { code: "23505", message: "duplicate key" } }
          rows.push(row)
          return { data: [{ ...row }], error: null }
        }
        const hit = rows.filter((r) => filters.every((f) => f(r)))
        if (action === "update") {
          for (const r of hit) {
            const next = { ...r, ...payload }
            if (violates(next, r)) return { data: null, error: { code: "23505", message: "duplicate key" } }
          }
          for (const r of hit) Object.assign(r, payload)
          return { data: returning ? hit.map((r) => ({ id: r.id })) : null, error: null }
        }
        const out = [...hit]
        if (order) { const { col, asc } = order; out.sort((a, b) => (Number(a[col]) - Number(b[col])) * (asc ? 1 : -1)) }
        return { data: out.map((r) => ({ ...r })), error: null }
      }
      const b = {
        select: () => { if (action !== "select") returning = true; return b },
        insert: (p: Row) => { action = "insert"; payload = p; return b },
        update: (p: Row) => { action = "update"; payload = p; return b },
        eq: (c: string, v: unknown) => { filters.push((r) => r[c] === v); return b },
        is: (c: string, v: null) => { filters.push((r) => (r[c] ?? null) === v); return b },
        in: (c: string, vs: unknown[]) => { filters.push((r) => vs.includes(r[c])); return b },
        order: (col: string, o: { ascending: boolean }) => { order = { col, asc: o.ascending }; return b },
        maybeSingle: async () => { const r = run(); if (r.error) return r; const d = r.data as Row[]; return { data: d[0] ?? null, error: null } },
        single: async () => { const r = run(); if (r.error) return r; const d = r.data as Row[]; return { data: d[0] ?? null, error: d.length ? null : { message: "no row" } } },
        then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(run()).then(res, rej),
      }
      return b
    },
  }
  return db as typeof db & SupabaseClient
}

const base = { userId: "u1", mode: "test" as const, type: "invoice" as const, documentId: "inv-1", documentNumber: "F-2026-004", recipientAddress: "0225:315143296_117753" }
const ev = (id: number, code: string, at: string, extra: Partial<SpEvent> = {}): SpEvent => ({ id, invoice_id: 1700416, status_code: code, created_at: at, ...extra })

describe("statuts (pur)", () => {
  it("dédoublonne et trie par date, même rendus dans le désordre (comme Super PDP)", () => {
    const a = [ev(3, "fr:203", "2026-11-03T10:22:41Z"), ev(2, "fr:202", "2026-11-03T10:22:42Z"), ev(1, "fr:201", "2026-11-03T10:22:40Z")].map(toOutboundEvent)
    const merged = mergeEvents(a.slice(0, 1), [...a, a[0]])
    expect(merged.map((e) => e.code)).toEqual(["fr:201", "fr:203", "fr:202"])
    expect(merged).toHaveLength(3)
  })
  it("le dernier statut affiché est le dernier statut officiel (fr:*), jamais api:* ni ppf:*", () => {
    const events: OutboundEvent[] = [
      { id: 1, code: "api:uploaded", at: "2026-11-03T10:00:00Z" },
      { id: 2, code: "fr:200", at: "2026-11-03T10:00:01Z" },
      { id: 3, code: "ppf:flow-1-ack", at: "2026-11-03T10:00:02Z" },
    ]
    expect(latestOfficial(events)?.code).toBe("fr:200")
    expect(latestOfficial([events[0]])).toBeNull()
  })
  it("rejet par une plateforme : envoi rejeté, renvoi possible ; refus du client : non", () => {
    expect(phaseAfter("sent", [{ id: 1, code: "fr:213", at: "x" }])).toBe("rejected")
    expect(phaseAfter("sent", [{ id: 1, code: "api:invalid", at: "x" }])).toBe("rejected")
    expect(phaseAfter("sent", [{ id: 1, code: "fr:210", at: "x" }])).toBe("sent")
    expect(phaseAfter("sending", [{ id: 1, code: "fr:213", at: "x" }])).toBe("sending")
  })
  it("motif de l'événement : raison ou note du client", () => {
    expect(toOutboundEvent(ev(9, "fr:210", "t", { details: [{ reason: "TX_TVA_ERR" }] })).reason).toBe("TX_TVA_ERR")
    expect(toOutboundEvent(ev(9, "fr:210", "t", { details: [{ notes: [{ contents: [{ content: "Montant erroné" }] }] }] })).reason).toBe("Montant erroné")
    expect(toOutboundEvent(ev(9, "fr:201", "t")).reason).toBeNull()
  })
  it("renvoi après échec ou rejet, ou réservation restée en cours trop longtemps", () => {
    const now = Date.parse("2026-11-03T12:00:00Z")
    expect(canResend({ phase: "failed", created_at: "2026-11-03T11:59:00Z" }, now)).toBe(true)
    expect(canResend({ phase: "rejected", created_at: "2026-11-03T11:59:00Z" }, now)).toBe(true)
    expect(canResend({ phase: "sent", created_at: "2026-11-01T00:00:00Z" }, now)).toBe(false)
    expect(canResend({ phase: "sending", created_at: new Date(now - 60_000).toISOString() }, now)).toBe(false)
    expect(canResend({ phase: "sending", created_at: new Date(now - STALE_SENDING_MS - 1).toISOString() }, now)).toBe(true)
  })
  it("encaissement : seulement pour un envoi déposé, une fois", () => {
    expect(canReportPayment({ phase: "sent", platform_invoice_id: 1, payment_reported_at: null })).toBe(true)
    expect(canReportPayment({ phase: "sent", platform_invoice_id: 1, payment_reported_at: "x" })).toBe(false)
    expect(canReportPayment({ phase: "rejected", platform_invoice_id: 1, payment_reported_at: null })).toBe(false)
    expect(canReportPayment({ phase: "sent", platform_invoice_id: null, payment_reported_at: null })).toBe(false)
  })
})

describe("réservation et dépôt", () => {
  it("sans la migration : « missing », rien ne casse", async () => {
    const db = fakeDb({ missing: true })
    expect(await loadActiveOutbound(db, "u1", "invoice", "inv-1")).toEqual({ ok: false, reason: "missing" })
    expect(await reserveOutbound(db, base)).toEqual({ ok: false, reason: "missing" })
    expect(await applyOutboundEvents(db, "test", [ev(1, "fr:201", "t")])).toEqual({ updated: 0, changed: [] })
  })

  it("une facture partie par email n'a pas de ligne", async () => {
    expect(await loadActiveOutbound(fakeDb(), "u1", "invoice", "inv-1")).toEqual({ ok: true, row: null })
  })

  it("réserve, puis refuse un second envoi tant que le premier est en cours ou déposé", async () => {
    const db = fakeDb()
    const r = await reserveOutbound(db, base)
    expect(r.ok && r.row.phase).toBe("sending")
    expect(await reserveOutbound(db, base)).toMatchObject({ ok: false, reason: "in_progress" })
    if (!r.ok) throw new Error()
    expect(await markDeposited(db, r.row, { platformInvoiceId: 1700416, events: [toOutboundEvent(ev(1, "api:uploaded", "2026-11-03T10:22:39Z"))] })).toBe(true)
    expect(await reserveOutbound(db, base)).toMatchObject({ ok: false, reason: "already_sent" })
    const active = await loadActiveOutbound(db, "u1", "invoice", "inv-1")
    expect(active.ok && active.row).toMatchObject({ phase: "sent", platform_invoice_id: 1700416, last_status_code: null, error: null })
  })

  it("deux réservations simultanées : une seule passe (index unique)", async () => {
    const db = fakeDb()
    const [a, b] = await Promise.all([reserveOutbound(db, base), reserveOutbound(db, base)])
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1)
    expect(db.rows).toHaveLength(1)
  })

  it("échec au dépôt : raison gardée, nouvelle tentative possible, la première reste dans l'historique", async () => {
    const db = fakeDb()
    const r1 = await reserveOutbound(db, base)
    if (!r1.ok) throw new Error()
    await markFailed(db, r1.row.id, "pre-check: receiver address <0225:315143296_999999> does not exist in peppol directory")
    const r2 = await reserveOutbound(db, base)
    expect(r2.ok && r2.row.attempt).toBe(2)
    const history = await loadOutboundHistory(db, "u1", "invoice", "inv-1")
    expect(history?.map((h) => [h.attempt, h.phase, h.superseded_at != null])).toEqual([[1, "failed", true], [2, "sending", false]])
    expect(history?.[0].error).toContain("does not exist")
  })

  it("un dépôt ne s'écrit que sur une réservation en cours (jamais sur une tentative close)", async () => {
    const db = fakeDb()
    const r = await reserveOutbound(db, base)
    if (!r.ok) throw new Error()
    await markFailed(db, r.row.id, "panne")
    expect(await markDeposited(db, r.row, { platformInvoiceId: 5 })).toBe(false)
  })

  it("réservation restée en cours trop longtemps : fermée en échec, la suivante est permise", async () => {
    const db = fakeDb()
    const r = await reserveOutbound(db, base)
    if (!r.ok) throw new Error()
    const later = Date.now() + STALE_SENDING_MS + 1000
    const r2 = await reserveOutbound(db, base, later)
    expect(r2.ok && r2.row.attempt).toBe(2)
    expect(db.rows[0]).toMatchObject({ phase: "failed", error: "Envoi interrompu avant la réponse de la plateforme." })
  })
})

describe("statuts relevés", () => {
  async function deposited(db: ReturnType<typeof fakeDb>, platformInvoiceId = 1700416) {
    const r = await reserveOutbound(db, base)
    if (!r.ok) throw new Error()
    await markDeposited(db, r.row, { platformInvoiceId })
    return (await loadActiveOutbound(db, "u1", "invoice", "inv-1")) as { ok: true; row: OutboundRow }
  }

  it("rejoignent leur envoi, triés ; les événements d'une autre facture ou d'un autre mode sont ignorés", async () => {
    const db = fakeDb()
    await deposited(db)
    const res = await applyOutboundEvents(db, "test", [
      ev(12, "fr:203", "2026-11-03T10:22:43Z"),
      ev(11, "fr:202", "2026-11-03T10:22:42Z"),
      ev(10, "fr:201", "2026-11-03T10:22:41Z"),
      { ...ev(99, "fr:205", "2026-11-03T10:30:00Z"), invoice_id: 42 },
    ])
    expect(res?.updated).toBe(1)
    expect(res?.changed[0]?.last_status_code).toBe("fr:203")
    expect(await applyOutboundEvents(db, "live", [ev(13, "fr:205", "2026-11-03T11:00:00Z")])).toEqual({ updated: 0, changed: [] })
    const again = await applyOutboundEvents(db, "test", [ev(12, "fr:203", "2026-11-03T10:22:43Z")])
    expect(again).toEqual({ updated: 0, changed: [] })
    const row = (await loadActiveOutbound(db, "u1", "invoice", "inv-1")) as { ok: true; row: OutboundRow }
    expect(row.row.events.map((e) => e.code)).toEqual(["fr:201", "fr:202", "fr:203"])
  })

  it("rejet par la plateforme : envoi rejeté, renvoi permis", async () => {
    const db = fakeDb()
    await deposited(db)
    const res = await applyOutboundEvents(db, "test", [ev(20, "fr:213", "2026-11-03T10:23:00Z", { details: [{ reason: "Destinataire inconnu" }] })])
    expect(res?.changed[0]).toMatchObject({ phase: "rejected", last_status_code: "fr:213" })
    const r2 = await reserveOutbound(db, base)
    expect(r2.ok && r2.row.attempt).toBe(2)
  })

  it("encaissement déclaré une seule fois, libéré si l'appel échoue", async () => {
    const db = fakeDb()
    const { row } = await deposited(db)
    const [a, b] = await Promise.all([claimPaymentReport(db, row.id), claimPaymentReport(db, row.id)])
    expect([a, b].filter(Boolean)).toHaveLength(1)
    expect(await releasePaymentReport(db, row.id)).toBe(true)
    expect(await claimPaymentReport(db, row.id)).toBe(true)
  })
})
