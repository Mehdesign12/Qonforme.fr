import { generateKeyPairSync, createVerify } from "node:crypto"
import { describe, expect, it } from "vitest"
import { mergeWithDefaults, parseSettings, SETTINGS_DEFAULTS } from "@/lib/seo/settings"
import { daysOf, missingRecentDays, parsePeriod, resolvePeriod } from "@/lib/seo/period"
import { deltaCount, deltaPosition, deltaRate, fmtDay, fmtPosition, fmtRange, fmtRate } from "@/lib/seo/format"
import { pageTypeOf, siteUrl, toSitePath } from "@/lib/seo/site"
import { assertNoCompetitorInPrompt, brandOfDomain, CompetitorLeakError, findCompetitorMentions } from "@/lib/seo/competitors"
import { readServiceAccount, signServiceAccountJwt } from "@/lib/seo/google"
import { isDailyDue, parisClock } from "@/lib/seo/cron"
import { adminCrumbsFor, isAdminActive } from "@/components/admin/nav"
import { stripLeadingTitle } from "@/lib/blog-utils"

const NBSP = " "

describe("réglages SEO", () => {
  it("complète une valeur enregistrée par les valeurs par défaut, champ par champ", () => {
    const merged = mergeWithDefaults("articles", { publishMode: "direct", lengthMin: "beaucoup", inconnu: 1 })
    expect(merged.publishMode).toBe("direct")
    expect(merged.lengthMin).toBe(SETTINGS_DEFAULTS.articles.lengthMin)
    expect(merged).not.toHaveProperty("inconnu")
    expect(mergeWithDefaults("brand", null)).toEqual(SETTINGS_DEFAULTS.brand)
  })

  it("valide une section et rend des messages par champ", () => {
    const ok = parseSettings("targeting", { ...SETTINGS_DEFAULTS.targeting, competitors: ["https://www.Exemple.fr/page"] })
    expect(ok.ok && ok.value.competitors).toEqual(["exemple.fr"])

    const bad = parseSettings("articles", { ...SETTINGS_DEFAULTS.articles, lengthMin: 3000, lengthMax: 2000 })
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(bad.fieldErrors.lengthMax).toMatch(/longueur maximale/)

    const proofs = Array.from({ length: 6 }, () => ({ claim: "a", source: "b", url: "" }))
    const tooMany = parseSettings("brand", { ...SETTINGS_DEFAULTS.brand, proofs })
    expect(tooMany.ok).toBe(false)

    const goals = parseSettings("strategy", { ...SETTINGS_DEFAULTS.strategy, mainGoal: "conversions" })
    expect(goals.ok).toBe(false)

    const noSection = parseSettings("reports", {
      ...SETTINGS_DEFAULTS.reports,
      weeklyDigest: true,
      sections: { kpis: false, pages: false, articles: false, geo: false },
    })
    expect(noSection.ok).toBe(false)
  })

  it("les réglages par défaut passent leur propre schéma", () => {
    for (const key of Object.keys(SETTINGS_DEFAULTS) as (keyof typeof SETTINGS_DEFAULTS)[]) {
      expect(parseSettings(key, SETTINGS_DEFAULTS[key]).ok, key).toBe(true)
    }
  })
})

describe("périodes", () => {
  const now = new Date("2026-10-07T10:00:00Z")

  it("se termine au dernier jour enregistré et compare à la période précédente", () => {
    const p = resolvePeriod("28j", "2026-10-04", now)
    expect(p.current).toEqual({ from: "2026-09-07", to: "2026-10-04" })
    expect(p.previous).toEqual({ from: "2026-08-10", to: "2026-09-06" })
    expect(daysOf(p.current)).toHaveLength(28)
  })

  it("sans données, prend aujourd'hui moins trois jours", () => {
    expect(resolvePeriod("7j", null, now).current.to).toBe("2026-10-04")
  })

  it("repère les jours pas encore publiés par Search Console", () => {
    expect(missingRecentDays("2026-10-04", now)).toEqual(["2026-10-05", "2026-10-06"])
    expect(parsePeriod("n'importe")).toBe("28j")
  })
})

describe("formats", () => {
  it("écrit taux, positions et évolutions en français", () => {
    expect(fmtRate(0.004)).toBe(`0,4${NBSP}%`)
    expect(fmtPosition(17.64)).toBe("17,6")
    expect(deltaCount(238, 118).text).toBe(`+102${NBSP}%`)
    expect(deltaCount(1, 1).text).toBe("stable")
    expect(deltaRate(0.004, 0).text).toBe(`+0,4${NBSP}pt`)
    expect(deltaPosition(17.6, 19.9)).toEqual({ text: `2,3${NBSP}places de mieux`, trend: "up" })
    expect(deltaPosition(20, 19).trend).toBe("down")
    expect(fmtDay("2026-10-01")).toBe(`1er${NBSP}oct.`)
    expect(fmtRange("2026-09-07", "2026-10-04")).toBe(`7${NBSP}sept.${NBSP}– 4${NBSP}oct.${NBSP}2026`)
  })
})

describe("site suivi", () => {
  it("normalise les URL du site et refuse les autres", () => {
    expect(toSitePath("https://www.qonforme.fr/modele/")).toBe("/modele")
    expect(toSitePath("https://qonforme.fr/")).toBe("/")
    expect(toSitePath("/guide/tva-travaux?x=1")).toBe("/guide/tva-travaux")
    expect(toSitePath("https://evil.example/modele")).toBeNull()
    expect(toSitePath("javascript:alert(1)")).toBeNull()
    expect(siteUrl("/modele")).toBe("https://qonforme.fr/modele")
  })

  it("classe les pages par type", () => {
    expect(pageTypeOf("/")).toBe("accueil")
    expect(pageTypeOf("/facturation/fleuriste")).toBe("metier")
    expect(pageTypeOf("/guide")).toBe("guide")
    expect(pageTypeOf("/plan-du-site")).toBe("autre")
  })
})

describe("concurrents : usage interne seulement", () => {
  const domains = ["tolteck.com", "btp.inprocess.ai", "mediabat.com"]

  it("déduit le nom d'une marque de son domaine", () => {
    expect(brandOfDomain("btp.inprocess.ai")).toBe("inprocess")
    expect(brandOfDomain("www.tolteck.com")).toBe("tolteck")
  })

  it("repère un concurrent cité dans un texte, sans faux positif sur un mot voisin", () => {
    expect(findCompetitorMentions("Comparez avec Tolteck ou MediaBat.", domains)).toEqual(["tolteck.com", "mediabat.com"])
    expect(findCompetitorMentions("Un processus inprocessable", domains)).toEqual([])
  })

  it("bloque une consigne du générateur qui nomme un concurrent", () => {
    expect(() => assertNoCompetitorInPrompt("Écrire sur la TVA des travaux", domains)).not.toThrow()
    expect(() => assertNoCompetitorInPrompt("Faire mieux que tolteck.com", domains)).toThrow(CompetitorLeakError)
  })
})

describe("compte de service Google", () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 })
  const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString()

  it("lit le JSON brut, en base64 ou avec des retours à la ligne échappés", () => {
    const json = JSON.stringify({ client_email: "seo@projet.iam.gserviceaccount.com", private_key: pem.replace(/\n/g, "\\n") })
    expect(readServiceAccount(json)?.private_key).toBe(pem)
    expect(readServiceAccount(Buffer.from(json).toString("base64"))?.client_email).toBe("seo@projet.iam.gserviceaccount.com")
    expect(readServiceAccount("pas du json")).toBeNull()
    expect(readServiceAccount(undefined)).toBeNull()
  })

  it("signe une assertion JWT vérifiable avec la clé publique", () => {
    const jwt = signServiceAccountJwt({ client_email: "seo@projet.iam.gserviceaccount.com", private_key: pem }, "scope-test", 1_000)
    const [h, c, sig] = jwt.split(".")
    const verifier = createVerify("RSA-SHA256")
    verifier.update(`${h}.${c}`)
    expect(verifier.verify(publicKey, Buffer.from(sig, "base64url"))).toBe(true)
    const claims = JSON.parse(Buffer.from(c, "base64url").toString())
    expect(claims).toMatchObject({ iss: "seo@projet.iam.gserviceaccount.com", scope: "scope-test", iat: 1_000, exp: 4_600 })
  })
})

describe("échéances des tâches (heure de Paris)", () => {
  it("lit l'heure de Paris, heure d'été comprise", () => {
    expect(parisClock(new Date("2026-10-09T06:15:00Z"))).toMatchObject({ day: "2026-10-09", minutes: 8 * 60 + 15, weekday: 5, dayOfMonth: 9 })
    expect(parisClock(new Date("2026-12-31T23:30:00Z")).day).toBe("2027-01-01")
  })

  it("une tâche quotidienne ne repasse pas le même jour", () => {
    const now = new Date("2026-10-09T06:15:00Z")
    expect(isDailyDue(null, now)).toBe(true)
    const job = { last_ok_at: "2026-10-09T05:00:00Z" } as Parameters<typeof isDailyDue>[0]
    expect(isDailyDue(job, now)).toBe(false)
    expect(isDailyDue({ ...job!, last_ok_at: "2026-10-08T05:00:00Z" }, now)).toBe(true)
    expect(isDailyDue(null, now, 9 * 60)).toBe(false)
  })
})

describe("articles du blog : titre non répété à l'affichage", () => {
  it("retire un premier titre identique au titre de l'article (accents, casse, ponctuation)", () => {
    const md = "## Auto entrepreneur bâtiment : guide pratique pour le BTP\n\nPremier paragraphe."
    expect(stripLeadingTitle(md, "Auto entrepreneur batiment : guide pratique pour le BTP")).toBe("Premier paragraphe.")
  })

  it("garde un premier titre différent, ou tout le texte sans titre d'article", () => {
    const md = "## Ce qu'il faut savoir\n\nTexte."
    expect(stripLeadingTitle(md, "Autre titre")).toBe(md)
    expect(stripLeadingTitle(md, "")).toBe(md)
    expect(stripLeadingTitle("Texte sans titre", "Texte sans titre")).toBe("Texte sans titre")
  })
})

describe("navigation de l'admin", () => {
  it("la vue d'ensemble SEO n'englobe pas les autres rubriques", () => {
    expect(isAdminActive("/admin/seo", "/admin/seo")).toBe(true)
    expect(isAdminActive("/admin/seo/performance", "/admin/seo")).toBe(false)
    expect(isAdminActive("/admin/seo/performance/audit", "/admin/seo/performance")).toBe(true)
  })

  it("fil d'Ariane des sous-pages", () => {
    expect(adminCrumbsFor("/admin/seo/performance/pagespeed")).toEqual({
      parent: { label: "Performance", href: "/admin/seo/performance" },
      current: "PageSpeed Insights",
    })
    expect(adminCrumbsFor("/admin/seo/mots-cles")).toEqual({ current: "Mots-clés" })
  })
})
