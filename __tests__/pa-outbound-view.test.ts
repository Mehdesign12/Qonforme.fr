/** Parcours d'une facture envoyée par la plateforme (planche D15) et alertes à l'artisan. */
import { describe, expect, it } from "vitest"
import { journeySteps, latestProblem, platformState } from "@/lib/pa/outbound-view"
import { outboundAlertOf } from "@/lib/pa/notify"
import { buildOutboundAlertEmail } from "@/lib/email/templates/e-invoicing"
import type { OutboundEvent } from "@/lib/pa/outbound"

const ev = (id: number, code: string, at: string, reason?: string): OutboundEvent => ({ id, code, at, reason: reason ?? null })
const base = [ev(1, "api:uploaded", "2026-11-03T09:12:00Z"), ev(2, "fr:200", "2026-11-03T09:12:01Z"), ev(3, "fr:201", "2026-11-03T09:12:02Z"), ev(4, "fr:202", "2026-11-03T09:13:00Z"), ev(5, "fr:203", "2026-11-03T09:13:01Z")]

describe("état et parcours", () => {
  it("transmise, reçue : étapes reçues dans l'ordre, puis l'étape attendue sans date", () => {
    const p = { phase: "sent" as const, events: base, lastStatus: "fr:203" }
    expect(platformState(p)).toBe("received")
    const steps = journeySteps(p)
    expect(steps.map((s) => s.title)).toEqual(["Déposée", "Émise par la plateforme", "Reçue par la plateforme du client", "Mise à disposition du client", "Prise en charge par le client"])
    expect(steps.at(-1)).toMatchObject({ state: "todo", at: null })
  })
  it("approuvée : l'étape suivante est l'encaissement, marqué par l'artisan", () => {
    const p = { phase: "sent" as const, events: [...base, ev(6, "fr:204", "2026-11-04T10:00:00Z"), ev(7, "fr:205", "2026-11-04T11:00:00Z")], lastStatus: "fr:205" }
    expect(platformState(p)).toBe("approved")
    expect(journeySteps(p).at(-1)?.title).toBe("Encaissée")
  })
  it("refusée : en alerte, avec le motif, plus d'étape attendue", () => {
    const p = { phase: "sent" as const, events: [...base, ev(6, "fr:210", "2026-11-04T10:00:00Z", "Montant de la facture erroné")], lastStatus: "fr:210", error: null }
    expect(platformState(p)).toBe("refused")
    expect(journeySteps(p).at(-1)).toMatchObject({ title: "Refusée", state: "warn", sub: "Montant de la facture erroné" })
    expect(latestProblem(p)).toBe("Montant de la facture erroné")
  })
  it("rejet technique (api:invalid) : « Rejetée », une seule fois", () => {
    const p = { phase: "rejected" as const, events: [ev(1, "api:uploaded", "t1"), ev(2, "api:invalid", "t2", "BR-FR-05"), ev(3, "fr:213", "t3")], lastStatus: "fr:213", error: null }
    expect(platformState(p)).toBe("rejected")
    expect(journeySteps(p).filter((s) => s.title === "Rejetée")).toHaveLength(1)
  })
  it("échec au dépôt : l'erreur enregistrée sert de motif", () => {
    expect(latestProblem({ events: [], error: "Adresse inconnue" })).toBe("Adresse inconnue")
    expect(platformState({ phase: "failed", lastStatus: null })).toBe("failed")
  })
})

describe("alertes à l'artisan", () => {
  it("refus, litige, rejet : une alerte ; statuts ordinaires : rien", () => {
    expect(outboundAlertOf({ phase: "sent", events: [...base, ev(6, "fr:210", "t", "Prix")], last_status_code: "fr:210" })).toEqual({ kind: "refused", reason: "Prix" })
    expect(outboundAlertOf({ phase: "sent", events: [...base, ev(6, "fr:207", "t")], last_status_code: "fr:207" })).toMatchObject({ kind: "disputed" })
    expect(outboundAlertOf({ phase: "rejected", events: [ev(2, "fr:213", "t", "Destinataire inconnu")], last_status_code: "fr:213" })).toEqual({ kind: "rejected", reason: "Destinataire inconnu" })
    expect(outboundAlertOf({ phase: "sent", events: base, last_status_code: "fr:203" })).toBeNull()
  })
  it("email : motif échappé, lien vers la facture, vouvoiement", () => {
    const m = buildOutboundAlertEmail({ kind: "refused", number: "F-2026-011", reason: "<b>Prix</b>", invoiceUrl: "https://qonforme.fr/invoices/x" })
    expect(m.subject).toBe("Facture F-2026-011 refusée par votre client")
    expect(m.html).toContain("&lt;b&gt;Prix&lt;/b&gt;")
    expect(m.html).toContain("https://qonforme.fr/invoices/x")
    expect(m.html).toContain("corrigez-la par un avoir")
  })
})
