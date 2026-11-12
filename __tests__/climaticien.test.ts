/**
 * Climaticien (12/11/2026) : page métier, page « s'installer », exemple de devis de
 * climatisation, section TVA du guide, métier de l'application et mots-clés du plan.
 * TVA vérifiée sur l'arrêté du 13 juillet 2026 et le BOFiP du 09/09/2026.
 */
import { describe, expect, it } from "vitest"
import { getMetierBySlug } from "@/lib/pseo/metiers"
import { getInstallationBySlug } from "@/lib/pseo/installation"
import { getModeleBySlug } from "@/lib/pseo/modeles"
import { EXEMPLE_DEVIS_PAR_METIER } from "@/lib/pseo/modeles-metiers"
import { getGuideBySlug } from "@/lib/pseo/guides"
import { totauxExemple } from "@/lib/pseo/exemple-devis"
import { MODELES_TELECHARGEABLES } from "@/lib/modeles/fichier"
import { DESCRIPTION_MAX, TITLE_MAX, fitTitle } from "@/lib/seo/meta"
import { TRADES, isTradeId } from "@/lib/legal/profile"
import { TRADE_CATALOGUES, proposedVatRate } from "@/lib/catalogue/trades"
import { detectTrade } from "@/lib/blog-images/trades"
import { PLAN_KEYWORDS } from "@/lib/seo/keywords/plan"
import { autoLinkPseo } from "@/lib/blog-autolink"

const rendered = (t: ReturnType<typeof fitTitle>) => (typeof t === "string" ? `${t} | Qonforme` : (t as { absolute: string }).absolute)

describe("pages publiques", () => {
  it("page métier : title, description, introduction et FAQ", () => {
    const m = getMetierBySlug("climaticien")!
    expect(m.titre).toBe("Logiciel de devis gratuit pour climaticien")
    expect(m.description.length).toBeGreaterThanOrEqual(120)
    expect(m.description.length).toBeLessThanOrEqual(DESCRIPTION_MAX)
    expect(m.intro).toMatch(/^Chiffrez vos devis de climatisation gratuitement/)
    expect(m.motsCles).toEqual(expect.arrayContaining(["logiciel climatisation", "logiciel frigoriste"]))
    const faq = m.faq.map((q) => q.reponse).join(" ")
    expect(faq).toMatch(/18 juillet 2026/)
    expect(faq).toMatch(/attestation de capacité/)
    expect(getMetierBySlug("chauffagiste")!.metiersProches).toContain("climaticien")
  })

  it("page « s'installer » : balises et fiche officielle", () => {
    const i = getInstallationBySlug("climaticien")!
    expect(rendered(fitTitle(i.titreSeo)).length).toBeLessThanOrEqual(TITLE_MAX)
    expect(i.description.length).toBeLessThanOrEqual(DESCRIPTION_MAX)
    expect(i.fiche.href).toBe("https://entreprendre.service-public.gouv.fr/vosdroits/F39053")
  })

  it("exemple de devis : 5,5 % sous critères, sinon appareil à 20 % et pose à 10 %", () => {
    const m = getModeleBySlug("devis-climatisation")!
    expect(rendered(fitTitle(m.titreSeo ?? m.titre)).length).toBeLessThanOrEqual(TITLE_MAX)
    expect(m.description.length).toBeLessThanOrEqual(DESCRIPTION_MAX)
    const a = totauxExemple(m.exemple!)
    expect(a.ventilation.map((v) => v.taux)).toEqual([5.5])
    const b = totauxExemple(m.autresExemples![0].exemple)
    expect(b.ventilation.map((v) => v.taux).sort()).toEqual([10, 20])
    expect(MODELES_TELECHARGEABLES[m.telechargement!].lignes?.length).toBe(m.exemple!.lignes.length)
    expect(EXEMPLE_DEVIS_PAR_METIER.climaticien.href).toBe("/modele/devis-climatisation")
    expect(autoLinkPseo("<p>Un exemple de devis de climatisation.</p>")).toContain('href="/modele/devis-climatisation"')
  })

  it("guide de la TVA : la climatisation n'est plus dite exclue sans nuance", () => {
    const g = getGuideBySlug("tva-travaux")!
    const texte = JSON.stringify(g)
    expect(texte).not.toMatch(/électroménager, climatisation, fourniture sans pose/)
    const section = g.sections.find((s) => s.titre.startsWith("TVA climatisation"))!
    expect(section.contenu).toMatch(/18 juillet 2026/)
    expect(g.faq.some((q) => /climatisation réversible/.test(q.question))).toBe(true)
    expect(g.sources?.some((s) => s.href?.includes("JORFARTI000054436391"))).toBe(true)
  })
})

describe("application", () => {
  it("le métier se choisit et son catalogue s'importe", () => {
    expect(isTradeId("climaticien")).toBe(true)
    expect(TRADES.find((t) => t.id === "climaticien")?.label).toBe("Climaticien, frigoriste")
    const items = TRADE_CATALOGUES.climaticien
    expect(items.length).toBeGreaterThanOrEqual(6)
    const vat = (id: string) => proposedVatRate(items.find((i) => i.id === id)!.vat, "renovation")
    expect(vat("pac-air-air")).toBe(5.5)
    expect(vat("climatiseur-fourniture")).toBe(20)
    expect(vat("climatiseur-pose")).toBe(10)
  })

  it("couvertures du blog : le climaticien est reconnu avant le chauffagiste", () => {
    expect(detectTrade("TVA climatisation réversible")).toBe("climaticien")
    expect(detectTrade("Pompe à chaleur air/air : quel taux ?")).toBe("climaticien")
    expect(detectTrade("Pompe à chaleur air/eau")).toBe("chauffagiste")
  })
})

describe("mots-clés du plan", () => {
  it("chaque mot-clé climatisation vise une page qui existe", () => {
    const clim = PLAN_KEYWORDS.filter((k) => /clim|frigori/.test(k.keyword))
    expect(clim.length).toBeGreaterThanOrEqual(10)
    for (const k of clim) expect(k.targetPath, k.keyword).toMatch(/^\/(facturation|modele|guide|devenir-a-son-compte)\//)
  })
})
