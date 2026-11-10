/**
 * Pages « exemple de devis » par métier et devis vierge (10/11/2026, plan mots-clés du 16/10/2026) :
 * balises, exemples chiffrés justes, fichiers Word, Excel et PDF identiques à la page, liens, règles.
 */
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { MODELES, getModeleBySlug } from "@/lib/pseo/modeles"
import { EXEMPLE_DEVIS_PAR_METIER, MODELES_DEVIS_METIERS } from "@/lib/pseo/modeles-metiers"
import { PLAN_KEYWORDS } from "@/lib/seo/keywords/plan"
import { totauxExemple } from "@/lib/pseo/exemple-devis"
import { MODELES_TELECHARGEABLES, analyserNomFichier, genererFichierModele } from "@/lib/modeles/fichier"
import { DESCRIPTION_MAX, TITLE_MAX, fitTitle } from "@/lib/seo/meta"
import { autoLinkPseo } from "@/lib/blog-autolink"

const SLUGS = ["devis-auto-entrepreneur", "devis-paysagiste", "devis-peinture", "devis-vierge", "devis-maconnerie", "devis-plomberie", "devis-placo"]
const rendered = (t: ReturnType<typeof fitTitle>) => (typeof t === "string" ? `${t} | Qonforme` : (t as { absolute: string }).absolute)

describe("les 7 pages du plan", () => {
  it("existent, une fois chacune, et répondent aux adresses du plan mots-clés", () => {
    for (const slug of SLUGS) expect(MODELES.filter((m) => m.slug === slug)).toHaveLength(1)
    const visees = new Set(PLAN_KEYWORDS.map((k) => k.targetPath).filter((p): p is string => !!p && p.startsWith("/modele/")))
    for (const p of Array.from(visees)) expect(getModeleBySlug(p.replace("/modele/", "")), p).toBeDefined()
  })

  it("title de 70 caractères au plus, description de 120 à 155, accents corrects", () => {
    for (const m of MODELES_DEVIS_METIERS) {
      expect(rendered(fitTitle(m.titreSeo ?? m.titre)).length, m.slug).toBeLessThanOrEqual(TITLE_MAX)
      expect(m.description.length, m.slug).toBeGreaterThanOrEqual(120)
      expect(m.description.length, m.slug).toBeLessThanOrEqual(DESCRIPTION_MAX)
      expect(`${m.titre} ${m.description}`).not.toMatch(/\b(macon|maconnerie|electricite|devis vierge a)\b/i)
    }
  })

  it("le mot-clé exact de chaque page est dans ses mots-clés, et son title parle comme la recherche", () => {
    const attendu: Record<string, RegExp> = {
      "devis-auto-entrepreneur": /devis auto-entrepreneur/i,
      "devis-paysagiste": /devis paysagiste/i,
      "devis-peinture": /devis peinture/i,
      "devis-vierge": /devis vierge/i,
      "devis-maconnerie": /devis maçonnerie/i,
      "devis-plomberie": /devis plomberie/i,
      "devis-placo": /devis placo/i,
    }
    for (const m of MODELES_DEVIS_METIERS) expect(m.titreSeo ?? m.titre, m.slug).toMatch(attendu[m.slug])
  })

  it("jamais « certifié », « homologué », concurrent ou facturation gratuite", () => {
    const tout = JSON.stringify(MODELES_DEVIS_METIERS)
    expect(tout).not.toMatch(/certifi[ée] par|homologu|agréé par l'État/i)
    expect(tout).not.toMatch(/factur(e|ation)s?\s+gratuite/i)
  })
})

describe("exemples chiffrés", () => {
  it("chaque page de métier porte un exemple aux prix annoncés fictifs", () => {
    for (const m of MODELES_DEVIS_METIERS.filter((x) => x.slug !== "devis-vierge")) {
      expect(m.exemple, m.slug).toBeDefined()
      expect(m.exemple!.contexte, m.slug).toMatch(/Exemple fictif/)
      expect(m.exemple!.conditions.join(" "), m.slug).toMatch(/Bon pour accord/)
    }
  })

  it("auto-entrepreneur : aucune TVA, total = prix à payer, mention 293 B", () => {
    const e = getModeleBySlug("devis-auto-entrepreneur")!.exemple!
    expect(e.franchise).toBe(true)
    const t = totauxExemple(e)
    expect(t.tvaCentimes).toBe(0)
    expect(t.ttcCentimes).toBe(t.htCentimes)
    expect(e.conditions.join(" ")).toMatch(/TVA non applicable, art\. 293 B du CGI/)
  })

  it("paysagiste : espaces verts à 20 %, allée à 10 % ; placo : 10 % et 5,5 %", () => {
    const p = totauxExemple(getModeleBySlug("devis-paysagiste")!.exemple!)
    expect(p.ventilation.map((v) => v.taux)).toEqual([20, 10])
    const q = totauxExemple(getModeleBySlug("devis-placo")!.exemple!)
    expect(q.ventilation.map((v) => v.taux)).toEqual([10, 5.5])
  })

  it("peinture : un second exemple de façade extérieure", () => {
    const m = getModeleBySlug("devis-peinture")!
    expect(m.autresExemples?.[0].exemple.titre).toMatch(/façade/)
  })

  it("devis vierge : le fichier vierge, sans exemple", () => {
    const m = getModeleBySlug("devis-vierge")!
    expect(m.exemple).toBeUndefined()
    expect(m.telechargement).toBe("modele-devis-artisan")
  })
})

describe("fichiers à télécharger", () => {
  it("chaque page a son fichier dans le registre, aux trois formats", () => {
    for (const m of MODELES_DEVIS_METIERS) {
      expect(MODELES_TELECHARGEABLES[m.telechargement!], m.slug).toBeDefined()
      for (const f of ["docx", "xlsx", "pdf"]) expect(analyserNomFichier(`${m.telechargement}.${f}`), `${m.slug}.${f}`).not.toBeNull()
    }
  })

  it("le fichier reprend les lignes de l'exemple de la page", async () => {
    for (const m of MODELES_DEVIS_METIERS.filter((x) => x.exemple)) {
      const o = MODELES_TELECHARGEABLES[m.telechargement!]
      expect(o.lignes?.map((l) => l.designation), m.slug).toEqual(m.exemple!.lignes.map((l) => l.designation))
      expect(o.lignes?.map((l) => l.tva), m.slug).toEqual(m.exemple!.lignes.map((l) => l.tauxTva ?? m.exemple!.tauxTva))
      const docx = await genererFichierModele(o, "docx")
      expect(docx.data.byteLength, m.slug).toBeGreaterThan(1000)
    }
  }, 30_000)
})

describe("liens", () => {
  it("chaque page métier qui a un exemple y renvoie, ainsi que la page « s'installer »", () => {
    const facturation = readFileSync("app/facturation/[slug]/page.tsx", "utf8")
    const installation = readFileSync("app/devenir-a-son-compte/[slug]/page.tsx", "utf8")
    expect(facturation).toContain("EXEMPLE_DEVIS_PAR_METIER[metier.slug]")
    expect(installation).toContain("EXEMPLE_DEVIS_PAR_METIER[inst.slug]")
    for (const { href } of Object.values(EXEMPLE_DEVIS_PAR_METIER)) expect(getModeleBySlug(href.replace("/modele/", "")), href).toBeDefined()
  })

  it("les liens automatiques du blog trouvent les nouvelles pages", () => {
    const html = autoLinkPseo("<p>Voici un exemple de devis de maçonnerie et un devis vierge.</p>")
    expect(html).toContain('href="/modele/devis-maconnerie"')
  })

  it("dates vraies dans le plan du site", () => {
    const sitemap = readFileSync("app/sitemap.ts", "utf8")
    for (const slug of SLUGS) expect(sitemap).toContain(`"/modele/${slug}": "2026-11-10"`)
  })
})
