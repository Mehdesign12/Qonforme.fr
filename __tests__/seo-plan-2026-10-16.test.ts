import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { fitTitle, TITLE_MAX, DESCRIPTION_MAX } from "@/lib/seo/meta"

/*
 * Plan mots-clés du 16/10/2026 (MOTS-CLES-COMPACTS-2026-10.md § 0), premier lot :
 * pages qui existent, mots exacts des chercheurs, honnêteté (« gratuit » seulement
 * pour les devis), réponses TVA vérifiées, héritage du layout racine corrigé.
 */

const rendered = (t: ReturnType<typeof fitTitle> | string) => (typeof t === "string" ? `${t} | Qonforme` : (t as { absolute: string }).absolute)
const lire = (chemin: string) => readFileSync(chemin, "utf8")

describe("pages métier : « logiciel devis {métier} »", () => {
  it("title, description et introduction suivent la requête, sans promettre des factures gratuites", async () => {
    const { METIERS } = await import("@/lib/pseo/metiers")
    expect(METIERS).toHaveLength(11)
    const descriptions = new Set<string>()
    for (const m of METIERS) {
      const nom = m.nom.toLowerCase()
      expect(m.titre, m.slug).toBe(`Logiciel de devis gratuit pour ${nom}`)
      expect(rendered(m.titre).length, m.slug).toBeLessThanOrEqual(TITLE_MAX)
      expect(m.description, m.slug).toMatch(/^Logiciel de devis gratuit pour /)
      expect(m.description.length, m.slug).toBeGreaterThanOrEqual(120)
      expect(m.description.length, m.slug).toBeLessThanOrEqual(DESCRIPTION_MAX)
      expect(m.description, m.slug).toMatch(/avec Essentiel\.$/)
      descriptions.add(m.description)
      expect(m.intro, m.slug).toMatch(/^Faites vos devis (de |d')\S/)
      expect(m.intro, m.slug).toContain("gratuitement et sans limite, puis vos factures avec Essentiel.")
      // L'introduction n'est plus la copie de la méta-description
      expect(m.intro, m.slug).not.toBe(m.description)
      expect(`${m.description} ${m.intro}`, m.slug).not.toMatch(/factures? gratuites?|relances? gratuites?/i)
    }
    expect(descriptions.size).toBe(METIERS.length)
  })

  it("la page affiche le H1 « Logiciel de devis et facture » et l'introduction", () => {
    const page = lire("app/facturation/[slug]/page.tsx")
    expect(page).toContain('title="Logiciel de devis et facture"')
    expect(page).toContain("sub={fr(metier.intro)}")
  })

  it("chauffagiste et paysagiste : plus de taux réduit faux", async () => {
    const { getMetierBySlug } = await import("@/lib/pseo/metiers")
    const tva = (slug: string) => getMetierBySlug(slug)!.faq.find((f) => /taux de TVA/i.test(f.question))!.reponse
    // Chaudière gaz ou fioul exclue des taux réduits depuis le 1er mars 2025 (BOFiP, actualité du 22/10/2025)
    expect(tva("chauffagiste")).not.toMatch(/chaudière à condensation\) dans/)
    expect(tva("chauffagiste")).toMatch(/gaz ou au fioul[^.]*20 %/)
    // Espaces verts exclus de l'article 279-0 bis (BOI-TVA-LIQ-30-20-90-30)
    expect(tva("paysagiste")).not.toMatch(/10 % peut s'appliquer à l'entretien/)
    expect(tva("paysagiste")).toMatch(/espaces verts[^.]*20 %/)
  })
})

describe("exemple de devis d'électricien", () => {
  it("vise « remplacement de tableau » et ajoute la maison de 100 m² et la version auto-entrepreneur", async () => {
    const { getModeleBySlug } = await import("@/lib/pseo/modeles")
    const { totauxExemple } = await import("@/lib/pseo/exemple-devis")
    const m = getModeleBySlug("devis-electricien")!
    expect(m.titreSeo).toBe("Exemple de devis électricité : remplacement de tableau")
    expect(rendered(fitTitle(m.titreSeo!)).length).toBeLessThanOrEqual(TITLE_MAX)
    expect(m.titre).toBe("Exemple de devis d'électricien : remplacement du tableau électrique")
    expect(m.description.length).toBeGreaterThanOrEqual(120)
    expect(m.description.length).toBeLessThanOrEqual(DESCRIPTION_MAX)

    const maison = m.autresExemples?.[0]
    expect(maison?.accent).toContain("maison de 100 m²")
    // Totaux calculés par le code des générateurs, jamais recopiés
    const t = totauxExemple(maison!.exemple)
    expect(t.htCentimes).toBe(643_500)
    expect(t.ttcCentimes).toBe(707_850)
    expect(t.acompteCentimes).toBe(212_355)

    const ae = m.sections?.find((s) => s.id === "auto-entrepreneur")
    expect(ae?.titre).toMatch(/auto-entrepreneur/)
    expect(ae?.paragraphes.join(" ")).toContain("TVA non applicable, article 293 B du CGI")
  })
})

describe("modèle de relance de facture impayée", () => {
  it("donne trois mails et la lettre de mise en demeure, avec les taux du semestre", async () => {
    const { getModeleBySlug } = await import("@/lib/pseo/modeles")
    const { SEMESTRE_REFERENCE, TAUX_PENALITES_DEFAUT } = await import("@/lib/outils/penalites")
    const m = getModeleBySlug("lettre-relance-impaye")!
    expect(m.titre).toBe("Modèle de relance de facture impayée : mail et lettre")
    expect(m.description.length).toBeGreaterThanOrEqual(120)
    expect(m.description.length).toBeLessThanOrEqual(DESCRIPTION_MAX)
    const liste = m.textes!.liste
    expect(liste.filter((t) => t.canal === "Mail")).toHaveLength(3)
    expect(liste.filter((t) => t.canal !== "Mail")).toHaveLength(1)
    const tout = JSON.stringify(m.textes)
    const taux = TAUX_PENALITES_DEFAUT.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    expect(tout).toContain(`${taux} %`)
    expect(tout).toContain(SEMESTRE_REFERENCE.libelle)
    // L'indemnité de 40 € et les pénalités de plein droit ne visent que les clients professionnels
    for (const t of liste) {
      for (const p of t.corps) {
        if (/40 €|pénalités de retard/.test(p)) expect(p, t.id).toMatch(/^\[Client professionnel\]/)
      }
    }
    expect(tout).toContain("Code civil, article 1231-6")
  })
})

describe("attestation TVA 10 % : mention du client", () => {
  it("les mentions reprennent les modèles du BOFiP (BOI-LETTRE-000280, 09/09/2026)", async () => {
    const c = await import("@/lib/legal/certification-tva")
    for (const texte of [c.CERTIFICATION_DEVIS_10, c.CERTIFICATION_DEVIS_5_5, c.CERTIFICATION_FACTURE_10, c.CERTIFICATION_FACTURE_5_5]) {
      expect(texte).toContain("locaux à usage d'habitation achevés depuis plus de deux ans")
      expect(texte).toContain("de concourir à la production d'un immeuble neuf au sens du 2° du 2 du I de l'article 257 du CGI")
      expect(texte).toContain("augmentation de la surface de plancher des locaux existants supérieure à 10 %")
    }
    expect(c.CERTIFICATION_DEVIS_5_5).toMatch(/rénovation énergétique\.$/)
    expect(c.CERTIFICATION_FACTURE_10).toMatch(/^Par le règlement de la présente facture/)
  })

  it("le guide TVA des travaux répond à « attestation tva 10 travaux » et plus aucune page ne garde l'ancienne mention", async () => {
    const { getGuideBySlug, GUIDES } = await import("@/lib/pseo/guides")
    const { MODELES } = await import("@/lib/pseo/modeles")
    const { INSTALLATIONS } = await import("@/lib/pseo/installation")
    const { MENTIONS } = await import("@/lib/modeles/devis")
    const { CERTIFICATION_DEVIS_10 } = await import("@/lib/legal/certification-tva")
    const g = getGuideBySlug("tva-travaux")!
    const section = g.sections.find((s) => s.titre.startsWith("Attestation TVA 10 % (attestation simplifiée)"))
    expect(section?.liste?.join(" ")).toContain(CERTIFICATION_DEVIS_10)
    expect(g.faq.some((f) => /attestation simplifiée/.test(f.question))).toBe(true)
    // La mention simplifiée faisait certifier au client des exclusions qu'il ne connaît pas
    const tout = JSON.stringify([GUIDES, MODELES, INSTALLATIONS, MENTIONS])
    expect(tout).not.toMatch(/pas exclus d(u|es) taux réduits?/)
    expect(tout).not.toMatch(/1er mars 2025, le client certifie/)
  })
})

describe("layout racine et démo", () => {
  it("aucun hreflang ni canonical hérité de l'accueil", () => {
    const layout = lire("app/layout.tsx")
    expect(layout).not.toMatch(/hrefLang=/)
    expect(layout).not.toMatch(/canonical:\s*"\/"/)
    expect(lire("app/page.tsx")).toMatch(/alternates:\s*\{\s*canonical:\s*"\/"\s*\}/)
  })

  it("sous-pages de la démo en noindex, follow ; page d'entrée indexable", () => {
    expect(lire("app/demo/layout.tsx")).toMatch(/robots:\s*\{\s*index:\s*false,\s*follow:\s*true\s*\}/)
    expect(lire("app/demo/page.tsx")).toMatch(/robots:\s*\{\s*index:\s*true,\s*follow:\s*true\s*\}/)
  })

  it("accueil et blog parlent des artisans du bâtiment", () => {
    expect(lire("components/home/HomeHero.tsx")).toContain("Le logiciel des artisans du bâtiment")
    const blog = lire("app/blog/page.tsx")
    expect(blog).toContain('title: "Blog : devis, factures et TVA pour artisans du bâtiment"')
    expect(blog).not.toMatch(/artisans et TPE/)
  })
})
