/**
 * Numéro de facture attribué à l'émission (lib/utils/document-numbering.ts).
 *
 * CGI, annexe II, art. 242 nonies A, I, 7° : numéro unique, séquence
 * chronologique et continue. Un brouillon n'a pas de numéro ; il le reçoit
 * quand il est émis, sans trou ni doublon, et l'émission concurrente de deux
 * factures ne produit jamais deux fois le même numéro.
 */
import { describe, expect, it } from "vitest"
import {
  DRAFT_INVOICE_LABEL, emissionDates, insertDraftInvoice, invoiceNumberLabel, invoiceSeriesPrefix, issueDraftInvoice,
} from "@/lib/utils/document-numbering"
import { fakeInvoicesDb, type Row } from "./helpers/fake-invoices-db"

type InvoiceRow = Row & { status?: string; invoice_number?: string | null }

const USER = "user-1"
const TODAY = "2026-10-03"

const issued = (n: string, extra: Partial<Row> = {}): Row => ({
  id: `id-${n}`, user_id: USER, invoice_number: n, status: "sent", issue_date: "2026-09-01", due_date: "2026-10-01", ...extra,
})
const draft = (id: string, extra: Partial<Row> = {}): Row => ({
  id, user_id: USER, invoice_number: null, status: "draft", issue_date: "2026-09-20", due_date: "2026-10-20", ...extra,
})

function emit(db: ReturnType<typeof fakeInvoicesDb>, id: string, maxAttempts?: number) {
  const row = db.rows.find((r) => r.id === id)!
  return issueDraftInvoice<InvoiceRow>(db.client, {
    invoiceId: id,
    userId: USER,
    companyPrefix: "F",
    draft: {
      status: row.status as string,
      invoice_number: row.invoice_number as string | null,
      issue_date: row.issue_date as string,
      due_date: row.due_date as string,
    },
    status: "sent",
    today: TODAY,
    maxAttempts,
  })
}

describe("libellé et série", () => {
  it("affiche « Brouillon » tant qu'il n'y a pas de numéro", () => {
    expect(invoiceNumberLabel(null)).toBe(DRAFT_INVOICE_LABEL)
    expect(invoiceNumberLabel("")).toBe("Brouillon")
    expect(invoiceNumberLabel("F-2026-012")).toBe("F-2026-012")
  })
  it("prend l'année de la date d'émission et le préfixe de l'entreprise", () => {
    expect(invoiceSeriesPrefix("FA", "2027-01-02")).toBe("FA-2027-")
    expect(invoiceSeriesPrefix(null, "2026-10-03")).toBe("F-2026-")
    expect(invoiceSeriesPrefix("  ", "2026-10-03")).toBe("F-2026-")
  })
})

describe("emissionDates", () => {
  it("date la facture du jour de l'émission et garde le délai de paiement", () => {
    expect(emissionDates("2026-09-20", "2026-10-20", TODAY)).toEqual({ issue_date: TODAY, due_date: "2026-11-02" })
  })
  it("ramène aussi à aujourd'hui un brouillon daté dans le futur", () => {
    expect(emissionDates("2026-10-10", "2026-10-10", TODAY)).toEqual({ issue_date: TODAY, due_date: TODAY })
  })
  it("ne place jamais l'échéance avant l'émission", () => {
    expect(emissionDates("2026-10-01", "2026-09-25", TODAY)).toEqual({ issue_date: TODAY, due_date: TODAY })
    expect(emissionDates(null, "2026-09-01", TODAY)).toEqual({ issue_date: TODAY, due_date: TODAY })
  })
  it("sans échéance, ne l'invente pas", () => {
    expect(emissionDates("2026-09-20", null, TODAY)).toEqual({ issue_date: TODAY, due_date: null })
  })
})

describe("insertDraftInvoice", () => {
  it("crée le brouillon sans numéro", async () => {
    const db = fakeInvoicesDb([issued("F-2026-001")])
    const res = await insertDraftInvoice<Row>(db.client, { userId: USER, companyPrefix: "F", today: TODAY, row: { user_id: USER, status: "draft" } })
    expect(res.error).toBeNull()
    expect(res.numbered).toBe(false)
    expect(res.data?.invoice_number).toBeNull()
  })
  it("avant la migration (numéro obligatoire), numérote à la création comme avant", async () => {
    const db = fakeInvoicesDb([issued("F-2026-001")])
    db.numberRequired = true
    const res = await insertDraftInvoice<Row>(db.client, { userId: USER, companyPrefix: "F", today: TODAY, row: { user_id: USER, status: "draft" } })
    expect(res.error).toBeNull()
    expect(res.numbered).toBe(true)
    expect(res.data?.invoice_number).toBe("F-2026-002")
  })
})

describe("issueDraftInvoice", () => {
  it("attribue le numéro suivant de la série, avec le statut et la date du jour", async () => {
    const db = fakeInvoicesDb([issued("F-2026-001"), issued("F-2026-002"), issued("F-2026-003"), draft("d1")])
    const res = await emit(db, "d1")
    expect(res.error).toBeNull()
    expect(res.numbered).toBe(true)
    expect(res.data).toMatchObject({ invoice_number: "F-2026-004", status: "sent", issue_date: TODAY, due_date: "2026-11-02" })
  })

  it("suit l'ordre des émissions, pas celui des créations : pas de trou si un brouillon est supprimé", async () => {
    const db = fakeInvoicesDb([issued("F-2026-001"), draft("ancien"), draft("recent"), draft("supprime")])
    db.rows = db.rows.filter((r) => r.id !== "supprime") // brouillon supprimé : aucun numéro consommé
    const a = await emit(db, "recent")
    const b = await emit(db, "ancien")
    expect(a.data?.invoice_number).toBe("F-2026-002")
    expect(b.data?.invoice_number).toBe("F-2026-003")
  })

  it("ignore les brouillons sans numéro et les autres comptes dans le calcul", async () => {
    const db = fakeInvoicesDb([
      issued("F-2026-007"), draft("d1"), draft("d2"),
      { ...issued("F-2026-050"), id: "autre", user_id: "user-2" },
    ])
    expect((await emit(db, "d1")).data?.invoice_number).toBe("F-2026-008")
  })

  it("réessaie avec le numéro suivant quand une émission concurrente a pris le même", async () => {
    const db = fakeInvoicesDb([issued("F-2026-001"), draft("d1")])
    // Entre le calcul du numéro et l'écriture, une autre facture prend F-2026-002
    db.beforeUpdate = (attempt) => {
      if (attempt === 0) db.rows.push(issued("F-2026-002", { id: "concurrente" }))
    }
    const res = await emit(db, "d1")
    expect(res.error).toBeNull()
    expect(res.data?.invoice_number).toBe("F-2026-003")
    const numbers = db.rows.map((r) => r.invoice_number).filter(Boolean)
    expect(new Set(numbers).size).toBe(numbers.length) // aucun doublon
  })

  it("abandonne après le nombre d'essais prévu sans écrire de doublon", async () => {
    const db = fakeInvoicesDb([issued("F-2026-001"), draft("d1")])
    let n = 2
    db.beforeUpdate = () => { db.rows.push(issued(`F-2026-${String(n++).padStart(3, "0")}`, { id: `c${n}` })) }
    const res = await emit(db, "d1", 3)
    expect(res.data).toBeNull()
    expect(res.error?.code).toBe("23505")
    expect(db.rows.find((r) => r.id === "d1")).toMatchObject({ status: "draft", invoice_number: null })
  })

  it("ne numérote pas deux fois une facture émise entre-temps par une autre requête", async () => {
    const db = fakeInvoicesDb([issued("F-2026-001"), draft("d1")])
    db.beforeUpdate = (attempt) => {
      if (attempt === 0) Object.assign(db.rows.find((r) => r.id === "d1")!, { status: "sent", invoice_number: "F-2026-002" })
    }
    const res = await emit(db, "d1")
    expect(res.error).toBeNull()
    expect(res.numbered).toBe(false)
    expect(res.data?.invoice_number).toBe("F-2026-002")
    expect(db.rows.filter((r) => r.invoice_number === "F-2026-003")).toHaveLength(0)
  })

  it("garde le numéro et les dates d'un brouillon numéroté avant la migration", async () => {
    const db = fakeInvoicesDb([issued("F-2026-001"), { ...draft("ancien"), invoice_number: "F-2026-002" }])
    const res = await emit(db, "ancien")
    expect(res.error).toBeNull()
    expect(res.numbered).toBe(false)
    expect(res.data).toMatchObject({ invoice_number: "F-2026-002", status: "sent", issue_date: "2026-09-20", due_date: "2026-10-20" })
  })

  it("refuse d'émettre une facture qui n'est plus un brouillon", async () => {
    const db = fakeInvoicesDb([issued("F-2026-001")])
    const res = await emit(db, "id-F-2026-001")
    expect(res.data).toBeNull()
    expect(res.error).not.toBeNull()
    expect(db.updates).toBe(0)
  })

  it("ouvre une nouvelle série au changement d'année", async () => {
    const db = fakeInvoicesDb([issued("F-2026-118"), draft("d1")])
    const res = await issueDraftInvoice<InvoiceRow>(db.client, {
      invoiceId: "d1", userId: USER, companyPrefix: "F",
      draft: { status: "draft", invoice_number: null, issue_date: "2026-12-30", due_date: "2027-01-29" },
      status: "sent", today: "2027-01-02",
    })
    expect(res.data?.invoice_number).toBe("F-2027-001")
  })
})
