/**
 * Parcours d'un nouvel inscrit lu en base : les cinq étapes, le « bloqué avant le premier devis »,
 * et la lecture qui ne prend jamais une erreur pour « zéro » (colonne Parcours d'Admin › Utilisateurs).
 */
import { describe, expect, it, vi } from "vitest"
import { HELP_AFTER_DAYS, ageLabel, computeProgress, hasSiren, type ProgressCounts } from "@/lib/admin/onboarding-progress"
import { fetchProgressCounts } from "@/lib/admin/progress-data"

const NOW = Date.parse("2026-11-10T12:00:00Z")
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString()
const none: ProgressCounts = { siren: null, quotes: 0, quotesSent: 0, invoices: 0, invoicesSent: 0 }

describe("hasSiren", () => {
  it("accepte 9 chiffres, avec ou sans espaces", () => {
    expect(hasSiren("124214214")).toBe(true)
    expect(hasSiren("124 214 214")).toBe(true)
  })
  it("refuse le reste", () => {
    for (const v of [null, undefined, "", "12421421", "1242142145", "12421421A"]) expect(hasSiren(v)).toBe(false)
  })
})

describe("computeProgress", () => {
  it("compte neuf : aucune étape, en cours, pas encore « bloqué »", () => {
    const p = computeProgress(none, daysAgo(0), NOW)
    expect(p.completed).toBe(0)
    expect(p.status).toBe("in_progress")
    expect(p.next).toBe("Entreprise")
    expect(p.stuckAt).toBeNull()
  })

  it("plus d'un jour sans SIREN : bloqué à l'entreprise", () => {
    const p = computeProgress(none, daysAgo(HELP_AFTER_DAYS), NOW)
    expect(p.status).toBe("needs_help")
    expect(p.stuckAt).toBe("Entreprise")
    expect(p.ageDays).toBe(HELP_AFTER_DAYS)
  })

  it("SIREN renseigné mais aucun devis après deux jours : bloqué avant le premier devis", () => {
    const p = computeProgress({ ...none, siren: "124214214" }, daysAgo(2), NOW)
    expect(p.done).toEqual([true, false, false, false, false])
    expect(p.status).toBe("needs_help")
    expect(p.stuckAt).toBe("Devis créé")
  })

  it("devis créé, pas envoyé : en cours, prochaine étape « Devis envoyé »", () => {
    const p = computeProgress({ ...none, siren: "124214214", quotes: 1 }, daysAgo(5), NOW)
    expect(p.status).toBe("in_progress")
    expect(p.next).toBe("Devis envoyé")
    expect(p.completed).toBe(2)
  })

  it("une facture sans devis compte : les étapes sont indépendantes", () => {
    const p = computeProgress({ ...none, siren: "124214214", invoices: 1 }, daysAgo(3), NOW)
    expect(p.done).toEqual([true, false, false, true, false])
    // Il a créé une facture : il n'est pas « bloqué avant son premier devis » parce que le devis manque
    expect(p.status).toBe("in_progress")
    expect(p.stuckAt).toBeNull()
  })

  it("première facture envoyée : terminé, quel que soit l'âge", () => {
    const all: ProgressCounts = { siren: "124214214", quotes: 2, quotesSent: 1, invoices: 1, invoicesSent: 1 }
    const p = computeProgress(all, daysAgo(40), NOW)
    expect(p.status).toBe("complete")
    expect(p.completed).toBe(5)
    expect(p.next).toBeNull()
  })

  it("date d'inscription absente ou illisible : âge zéro, jamais « bloqué » à tort", () => {
    expect(computeProgress(none, null, NOW).ageDays).toBe(0)
    expect(computeProgress(none, "pas une date", NOW).status).toBe("in_progress")
  })
})

describe("ageLabel", () => {
  it("dit depuis quand", () => {
    expect(ageLabel(0)).toBe("aujourd'hui")
    expect(ageLabel(3)).toBe("3 j")
  })
})

/** Faux client : `from(table).select().in().range()` rend les lignes de la table, tranchées par `range`. */
function fakeDb(tables: Record<string, Array<Record<string, unknown>> | "error">) {
  return {
    from: (table: string) => ({
      select: () => ({
        in: () => ({
          range: async (from: number, to: number) => {
            const t = tables[table]
            if (t === "error") return { data: null, error: { message: "boom" } }
            return { data: t.slice(from, to + 1), error: null }
          },
        }),
      }),
    }),
  } as never
}

describe("fetchProgressCounts", () => {
  const sirens = new Map<string, string | null>([["a", "124214214"], ["b", null]])

  it("compte devis, devis envoyés, factures et factures envoyées par compte", async () => {
    const db = fakeDb({
      quotes: [
        { user_id: "a", status: "draft" },
        { user_id: "a", status: "sent" },
        { user_id: "b", status: "draft" },
      ],
      invoices: [{ user_id: "a", status: "draft" }],
    })
    const counts = await fetchProgressCounts(db, ["a", "b"], sirens)
    expect(counts?.get("a")).toEqual({ siren: "124214214", quotes: 2, quotesSent: 1, invoices: 1, invoicesSent: 0 })
    expect(counts?.get("b")).toEqual({ siren: null, quotes: 1, quotesSent: 0, invoices: 0, invoicesSent: 0 })
  })

  it("un compte sans document existe à zéro", async () => {
    const counts = await fetchProgressCounts(fakeDb({ quotes: [], invoices: [] }), ["a"], sirens)
    expect(counts?.get("a")).toEqual({ siren: "124214214", quotes: 0, quotesSent: 0, invoices: 0, invoicesSent: 0 })
  })

  it("lit plus de 1 000 lignes sans s'arrêter au plafond de la réponse", async () => {
    const many = Array.from({ length: 2500 }, () => ({ user_id: "a", status: "draft" }))
    const counts = await fetchProgressCounts(fakeDb({ quotes: many, invoices: [] }), ["a"], sirens)
    expect(counts?.get("a")?.quotes).toBe(2500)
  })

  it("une erreur de lecture rend null, jamais « zéro »", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    expect(await fetchProgressCounts(fakeDb({ quotes: "error", invoices: [] }), ["a"], sirens)).toBeNull()
    expect(await fetchProgressCounts(fakeDb({ quotes: [], invoices: "error" }), ["a"], sirens)).toBeNull()
  })
})
