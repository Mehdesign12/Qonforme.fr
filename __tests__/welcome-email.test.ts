/**
 * Email de bienvenue (lib/email/templates/welcome.ts) depuis l'inscription en
 * deux champs : sans prénom par défaut, première étape « Terminez votre
 * inscription » vers le tableau de bord, prénom échappé s'il est fourni,
 * lien de désinscription des conseils seulement quand la séquence est active.
 */
import { describe, expect, it } from "vitest"
import { buildWelcomeEmail } from "@/lib/email/templates/welcome"

describe("buildWelcomeEmail", () => {
  it("sans prénom : objet « Bienvenue sur Qonforme », titre « Bienvenue ! »", () => {
    for (const firstName of [undefined, null, "", "   "]) {
      const { subject, html } = buildWelcomeEmail({ firstName })
      expect(subject).toBe("Bienvenue sur Qonforme")
      expect(html).toContain("Bienvenue&nbsp;!")
      expect(html).not.toMatch(/Bienvenue, /)
      expect(html).not.toContain("undefined")
      expect(html).not.toContain("null")
    }
  })

  it("première étape : « Terminez votre inscription », vers le tableau de bord", () => {
    const { html } = buildWelcomeEmail({})
    const step = html.indexOf("Terminez votre inscription")
    expect(step).toBeGreaterThan(-1)
    // L'étape vient avant les deux autres, et son lien mène à /dashboard
    expect(step).toBeLessThan(html.indexOf("Ajoutez votre premier client"))
    const link = html.slice(step).match(/href="([^"]+)"/)
    expect(link?.[1]).toMatch(/\/dashboard$/)
    // L'ancienne étape vers Paramètres › Entreprise a disparu
    expect(html).not.toContain("/settings/company")
  })

  it("avec un prénom : objet et titre personnalisés, prénom échappé dans le HTML", () => {
    const { subject, html } = buildWelcomeEmail({ firstName: " Thomas " })
    expect(subject).toBe("Bienvenue sur Qonforme, Thomas")
    expect(html).toContain("Bienvenue, Thomas&nbsp;!")

    const risky = buildWelcomeEmail({ firstName: "<b>Tom</b>" })
    expect(risky.html).toContain("Bienvenue, &lt;b&gt;Tom&lt;/b&gt;&nbsp;!")
    expect(risky.html).not.toContain("<b>Tom</b>")
  })

  it("objet court, sans emoji", () => {
    expect(buildWelcomeEmail({}).subject.length).toBeLessThan(55)
    // Lettres latines et ponctuation seulement (plus de 👋)
    expect(buildWelcomeEmail({ firstName: "Thomas" }).subject).toMatch(/^[\u0020-\u024F]+$/)
  })

  it("lien de désinscription seulement quand il est fourni", () => {
    expect(buildWelcomeEmail({}).html).not.toContain("Ne plus recevoir ces conseils")
    const { html } = buildWelcomeEmail({ unsubscribeUrl: "https://qonforme.fr/desinscription?t=a&b" })
    expect(html).toContain("Ne plus recevoir ces conseils")
    expect(html).toContain('href="https://qonforme.fr/desinscription?t=a&amp;b"')
  })
})
