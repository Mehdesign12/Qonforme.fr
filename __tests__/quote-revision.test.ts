import { describe, expect, it } from "vitest"
import { canReviseQuote, finalizeRevision, originDecision, reviseRefusal } from "@/lib/quotes/revision"
import { buildQuoteEmail } from "@/lib/email/templates/quote"

describe("« Corriger ce devis » : qui peut être corrigé", () => {
  it("seul un devis envoyé, non facturé et pas déjà remplacé se corrige", () => {
    expect(canReviseQuote({ status: "sent" })).toBe(true)
    expect(canReviseQuote({ status: "draft" })).toBe(false)
    expect(canReviseQuote({ status: "accepted" })).toBe(false)
    expect(canReviseQuote({ status: "rejected" })).toBe(false)
    expect(canReviseQuote({ status: "superseded" })).toBe(false)
    expect(canReviseQuote({ status: "sent", converted_invoice_id: "x" })).toBe(false)
    expect(canReviseQuote({ status: "sent", superseded_by_quote_id: "y" })).toBe(false)
  })

  it("donne une raison lisible pour chaque refus", () => {
    expect(reviseRefusal({ status: "sent" })).toBeNull()
    expect(reviseRefusal({ status: "draft" })).toMatch(/brouillon/)
    expect(reviseRefusal({ status: "accepted" })).toMatch(/accepté/)
    expect(reviseRefusal({ status: "sent", converted_invoice_id: "x" })).toMatch(/facture/)
    expect(reviseRefusal({ status: "superseded" })).toMatch(/remplacé/)
  })
})

describe("devis d'origine relu à l'envoi de la correction", () => {
  const base = { id: "o", quote_number: "D-2026-010" }
  it("toujours envoyé : il sera remplacé", () => {
    expect(originDecision({ ...base, status: "sent" })).toEqual({ kind: "replace", id: "o", number: "D-2026-010" })
  })
  it("accepté ou facturé entre-temps : l'envoi est refusé", () => {
    expect(originDecision({ ...base, status: "accepted" }).kind).toBe("blocked")
    expect(originDecision({ ...base, status: "sent", converted_invoice_id: "f" }).kind).toBe("blocked")
  })
  it("refusé ou rétracté : la correction part seule, sans rien remplacer", () => {
    expect(originDecision({ ...base, status: "rejected" }).kind).toBe("detached")
    expect(originDecision({ ...base, status: "withdrawn" }).kind).toBe("detached")
  })
  it("supprimé : devis ordinaire", () => {
    expect(originDecision(null).kind).toBe("none")
  })
})

/** Faux client Supabase : enregistre les mises à jour et rend les lignes touchées. */
function fakeClient(rowsTouched: number) {
  const calls: { table: string; update: Record<string, unknown>; filters: [string, unknown][] }[] = []
  const client = {
    from(table: string) {
      const call = { table, update: {} as Record<string, unknown>, filters: [] as [string, unknown][] }
      calls.push(call)
      const q = {
        update(u: Record<string, unknown>) { call.update = u; return q },
        eq(col: string, v: unknown) { call.filters.push([col, v]); return q },
        select() { return Promise.resolve({ data: Array.from({ length: rowsTouched }, () => ({ id: "o" })), error: null }) },
        then(resolve: (v: unknown) => void) { resolve({ data: null, error: null }) },
      }
      return q
    },
  }
  return { client: client as never, calls }
}

describe("remplacement de l'ancien devis", () => {
  it("passe l'ancien devis en « superseded » s'il est encore envoyé, et ferme ses liens de signature", async () => {
    const db = fakeClient(1)
    const admin = fakeClient(1)
    const ok = await finalizeRevision(db.client, admin.client, "u1", "new", { kind: "replace", id: "o", number: "D-2026-010" })
    expect(ok).toBe(true)
    expect(db.calls[0].update).toMatchObject({ status: "superseded", superseded_by_quote_id: "new" })
    expect(db.calls[0].filters).toContainEqual(["status", "sent"])
    expect(db.calls[0].filters).toContainEqual(["user_id", "u1"])
    expect(admin.calls[0].table).toBe("document_signatures")
    expect(admin.calls[0].update).toMatchObject({ status: "superseded" })
    expect(admin.calls[0].filters).toContainEqual(["document_id", "o"])
    expect(admin.calls[0].filters).toContainEqual(["status", "pending"])
  })

  it("ne touche à rien hors remplacement, ni si l'ancien devis n'est plus envoyé", async () => {
    const db = fakeClient(1)
    expect(await finalizeRevision(db.client, null, "u1", "new", { kind: "none" })).toBe(false)
    expect(await finalizeRevision(db.client, null, "u1", "new", { kind: "detached", number: "D" })).toBe(false)
    expect(db.calls).toHaveLength(0)
    const gone = fakeClient(0)
    const admin = fakeClient(0)
    expect(await finalizeRevision(gone.client, admin.client, "u1", "new", { kind: "replace", id: "o", number: "D" })).toBe(false)
    expect(admin.calls).toHaveLength(0)
  })
})

describe("email du devis corrigé", () => {
  const base = {
    quoteNumber: "D-2026-011", issueDate: "2026-11-06", validUntil: "2026-12-06",
    subtotalHt: 100, totalVat: 20, totalTtc: 120, companyName: "ETC", accentColor: "#2563EB",
    clientName: "Client", appUrl: "https://qonforme.fr",
  }
  it("annonce le devis remplacé dans l'objet et le texte", () => {
    const { subject, html } = buildQuoteEmail({ ...base, replacesNumber: "D-2026-010" })
    expect(subject).toBe("Devis D-2026-011 (remplace D-2026-010) — ETC")
    expect(html).toContain("annule et remplace le devis <strong>D-2026-010</strong>")
    expect(html).toContain("Votre devis corrigé,")
  })
  it("reste inchangé pour un devis ordinaire", () => {
    const { subject, html } = buildQuoteEmail(base)
    expect(subject).toBe("Devis D-2026-011 — ETC")
    expect(html).not.toContain("remplace")
  })
})
