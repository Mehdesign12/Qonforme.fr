/**
 * Liste des factures : export CSV de la sélection et vues enregistrées
 * (lib/export/invoice-list.ts).
 */
import { describe, expect, it } from "vitest"
import { LIST_CSV_HEADER, SAVED_VIEWS_MAX, invoicesToCsv, parseSavedViews, upsertView } from "@/lib/export/invoice-list"

const TABS = ["all", "open", "late", "draft", "paid", "archived"]

describe("export CSV de la sélection", () => {
  const csv = invoicesToCsv([
    { invoice_number: "F-2026-0141", status: "sent", issue_date: "2026-09-15", due_date: "2026-10-15", total_ttc: 5758.4, client_name: "SCI Les Tilleuls", subject: "Rénovation; hall" },
    { invoice_number: null, status: "draft", issue_date: "2026-10-01", due_date: "2026-10-31", total_ttc: 120, client_name: "=HYPERLINK(\"x\")", subject: null, is_archived: true },
  ])
  const lines = csv.replace(/^﻿/, "").split("\r\n")

  it("format des exports comptables : BOM, point-virgule, CRLF, virgule décimale, dates françaises", () => {
    expect(csv.startsWith("﻿")).toBe(true)
    expect(lines[0]).toBe(LIST_CSV_HEADER.join(";"))
    expect(lines[1]).toBe('F-2026-0141;SCI Les Tilleuls;"Rénovation; hall";15/09/2026;15/10/2026;5758,40;Envoyée;Non')
  })

  it("brouillon sans numéro, et formule neutralisée", () => {
    expect(lines[2].startsWith("Brouillon;")).toBe(true)
    expect(lines[2]).toContain(`"'=HYPERLINK(""x"")"`)
    expect(lines[2].endsWith(";Oui")).toBe(true)
  })
})

describe("vues enregistrées", () => {
  it("relit le stockage sans faire confiance à son contenu", () => {
    expect(parseSavedViews(null, TABS)).toEqual([])
    expect(parseSavedViews("pas du json", TABS)).toEqual([])
    expect(parseSavedViews(JSON.stringify([
      { name: "  Retards Arvel ", tab: "late", query: "arvel" },
      { name: "Inconnu", tab: "supprime", query: "" },
      { name: 42, tab: "all", query: "" },
      { name: "", tab: "all", query: "" },
    ]), TABS)).toEqual([{ name: "Retards Arvel", tab: "late", query: "arvel" }])
  })

  it("remplace une vue du même nom, la plus récente en tête, 8 au plus", () => {
    let views = upsertView([], { name: "A", tab: "all", query: "" })
    views = upsertView(views, { name: "B", tab: "late", query: "" })
    views = upsertView(views, { name: "a", tab: "paid", query: "x" })
    expect(views).toEqual([{ name: "a", tab: "paid", query: "x" }, { name: "B", tab: "late", query: "" }])
    for (let i = 0; i < 12; i++) views = upsertView(views, { name: `V${i}`, tab: "all", query: "" })
    expect(views).toHaveLength(SAVED_VIEWS_MAX)
    expect(views[0].name).toBe("V11")
    expect(upsertView(views, { name: "   ", tab: "all", query: "" })).toBe(views)
  })
})
