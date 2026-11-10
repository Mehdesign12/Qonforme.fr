import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { templateForSteps, SHORTCUT_LABELS } from "@/lib/email/account-templates"

describe("raccourci d'email selon le parcours", () => {
  it("choisit le modèle de l'étape qui bloque", () => {
    expect(templateForSteps([false, false, false, false, false])).toBe("manual_company")
    expect(templateForSteps([true, false, false, false, false])).toBe("manual_first_quote")
    expect(templateForSteps([true, true, false, false, false])).toBe("manual_quote_send")
    expect(templateForSteps([true, true, true, false, false])).toBe("manual_free")
    expect(templateForSteps([true, false, false, true, false])).toBe("manual_free")
    expect(SHORTCUT_LABELS[templateForSteps([false])]).toBe("Aider : entreprise")
  })
})

describe("tâches planifiées de Vercel", () => {
  it("vercel.json lance les trois tâches", () => {
    const crons = JSON.parse(readFileSync("vercel.json", "utf8")).crons.map((c: { path: string }) => c.path)
    expect(crons).toEqual(expect.arrayContaining(["/api/cron/onboarding", "/api/cron/seo", "/api/cron/send-reminders"]))
  })
})
