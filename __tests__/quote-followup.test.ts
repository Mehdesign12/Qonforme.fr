import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { followupStart, isFollowupDue, pickFollowups, type FollowupQuote } from "@/lib/quotes/followup"
import { buildQuoteFollowupEmail } from "@/lib/email/templates/quote-followup-artisan"

const q = (over: Partial<FollowupQuote> = {}): FollowupQuote => ({
  id: "q1", user_id: "u1", status: "sent", quote_number: "D-2026-004", total_ttc: 492,
  issue_date: "2026-11-01", valid_until: "2026-12-31", sent_at: "2026-11-02T10:00:00Z",
  pdf_downloaded_at: null, converted_invoice_id: null, client: { name: "Batiluxe SARL" }, ...over,
})

describe("email de suivi : règles", () => {
  it("devis envoyé : date d'envoi, sinon date du devis", () => {
    expect(followupStart(q())).toEqual({ day: "2026-11-02", origin: "sent" })
    expect(followupStart(q({ sent_at: null }))).toEqual({ day: "2026-11-01", origin: "sent" })
  })
  it("brouillon : seulement si le PDF a été téléchargé", () => {
    expect(followupStart(q({ status: "draft" }))).toBeNull()
    expect(followupStart(q({ status: "draft", pdf_downloaded_at: "2026-11-03T09:00:00Z" }))).toEqual({ day: "2026-11-03", origin: "downloaded" })
  })
  it("entre 10 et 45 jours, encore valable, pas facturé, ni accepté ni refusé", () => {
    expect(isFollowupDue(q(), "2026-11-11")).toBe(false)
    expect(isFollowupDue(q(), "2026-11-12")).toBe(true)
    expect(isFollowupDue(q(), "2026-12-18")).toBe(false)
    expect(isFollowupDue(q({ valid_until: "2026-11-10" }), "2026-11-12")).toBe(false)
    expect(isFollowupDue(q({ converted_invoice_id: "i1" }), "2026-11-12")).toBe(false)
    expect(isFollowupDue(q({ status: "accepted" }), "2026-11-12")).toBe(false)
    expect(isFollowupDue(q({ status: "rejected" }), "2026-11-12")).toBe(false)
  })
  it("un seul devis par compte, le plus ancien", () => {
    const picked = pickFollowups([
      q({ id: "a", sent_at: "2026-11-01T10:00:00Z" }),
      q({ id: "b", sent_at: "2026-10-25T10:00:00Z" }),
      q({ id: "c", user_id: "u2" }),
    ], "2026-11-14")
    expect(picked.map((x) => x.id).sort()).toEqual(["b", "c"])
  })
})

describe("email de suivi : contenu", () => {
  const base = { quoteId: "q1", quoteNumber: "D-2026-004", clientName: "Batiluxe <SARL>", totalTtc: 492, firstName: "Karim", unsubscribeUrl: "https://qonforme.fr/desinscription?t=x" }
  it("échappe le client, lien d'acceptation, rien d'envoyé au client", () => {
    const { subject, html } = buildQuoteFollowupEmail({ ...base, origin: "sent" })
    expect(subject).toBe("Votre devis pour Batiluxe <SARL>, accepté ?")
    expect(html).toContain("Batiluxe &lt;SARL&gt;")
    expect(html).not.toContain("Batiluxe <SARL>")
    expect(html).toContain("/quotes/q1?accepte=1")
    expect(html).toContain("Rien n'est envoyé à votre client")
    expect(html).toContain("desinscription")
  })
  it("devis seulement téléchargé : le dit, et propose l'envoi par Qonforme", () => {
    const { html } = buildQuoteFollowupEmail({ ...base, origin: "downloaded" })
    expect(html).toContain("Vous avez téléchargé")
    expect(html).toContain("avec Essentiel")
  })
})

describe("branchements", () => {
  const read = (p: string) => readFileSync(p, "utf8")
  it("la tâche planifiée lance le suivi, la route du PDF garde la date", () => {
    expect(read("app/api/cron/onboarding/route.ts")).toContain("runQuoteFollowups(admin, now)")
    expect(read("app/api/quotes/[id]/pdf/route.ts")).toContain("pdf_downloaded_at")
  })
  it("la fiche ouvre la fenêtre après le PDF d'un brouillon et à l'arrivée depuis l'email", () => {
    const page = read("app/(app)/quotes/[id]/page.tsx")
    expect(page).toContain('setPrompt("pdf")')
    expect(page).toContain('search.get("accepte") === "1"')
    const view = read("components/quotes/QuoteDetailView.tsx")
    expect(view).toContain("Envoyez-le plutôt par Qonforme.")
    expect(view).toContain("Je l'ai déjà envoyé moi-même")
    expect(view).toContain("Marquer accepté et créer la facture")
  })
})
