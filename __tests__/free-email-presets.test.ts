import { describe, expect, it } from "vitest"
import { FREE_EMAIL_PRESETS } from "@/lib/email/account-templates"

describe("sujets de l'email libre", () => {
  it("ont un identifiant unique, un objet et un texte dans les limites du formulaire", () => {
    const ids = new Set(FREE_EMAIL_PRESETS.map((p) => p.id))
    expect(ids.size).toBe(FREE_EMAIL_PRESETS.length)
    for (const p of FREE_EMAIL_PRESETS) {
      expect(p.subject.length).toBeGreaterThan(0)
      expect(p.subject.length).toBeLessThanOrEqual(150)
      expect(p.body.length).toBeLessThanOrEqual(5000)
      expect(p.body.split(/\n\s*\n/).length).toBeGreaterThanOrEqual(2)
    }
  })

  it("ne promettent ni appel, ni rendez-vous, ni délai, et vouvoient", () => {
    for (const p of FREE_EMAIL_PRESETS) {
      const t = `${p.subject} ${p.body}`.toLowerCase()
      expect(t).not.toMatch(/(^|[\s'])appel|téléphon(e|ez)-nous|rendez-vous|visio|sous \d+ ?h|24 ?h|(^|\s)(tu|ton|tes|toi)[\s,.]/)
      expect(t).not.toMatch(/certifi|homologu|super pdp/)
      expect(p.body.startsWith("Bonjour")).toBe(false)
    }
  })
})
