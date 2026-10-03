/**
 * Mentions du bâtiment imprimées d'office (lib/legal/mentions.ts) depuis le
 * profil légal de l'entreprise (lib/legal/profile.ts) : génération selon le
 * statut, le régime de TVA et l'assurance ; aucun doublon avec les mentions
 * libres ; mentions figées à l'émission ; régime de TVA lu par le Factur-X.
 */
import { describe, it, expect } from "vitest"
import {
  FRANCHISE_MENTION, composeMentions, formatCapital, generateMentions, parseLegalSnapshot,
  resolveDocumentMentions, snapshotOf, withDocumentMentions,
} from "@/lib/legal/mentions"
import { EMPTY_LEGAL_PROFILE, legalProfileErrors, parseCapital, parseLegalProfile, type LegalProfile } from "@/lib/legal/profile"
import { buildFacturX, computeFacturXTotals, documentMentions } from "@/lib/facturx/xml"
import { invoiceToFacturX } from "@/lib/facturx/records"
import { legalPdfLines, wrapText } from "@/lib/pdf/legal-lines"
import { generateQuotePdf } from "@/lib/pdf/quote"
import { generatePurchaseOrderPdf } from "@/lib/pdf/purchase-order"

const decennale = {
  insurer: "Assureur Exemple",
  address: "1 rue de l'Exemple, 49000 Angers",
  policy_number: "DEC-001",
  coverage: "France métropolitaine",
}

const profile = (p: Partial<LegalProfile>): LegalProfile => ({ ...EMPTY_LEGAL_PROFILE, ...p })

const DECENNALE_TEXT = "Assurance décennale : Assureur Exemple, 1 rue de l'Exemple, 49000 Angers — contrat n° DEC-001 — couverture géographique : France métropolitaine"

// ── Génération selon le profil ───────────────────────────────────────────────

describe("mentions générées", () => {
  it("micro-entreprise en franchise : EI après le nom, puis la mention 293 B", () => {
    const m = generateMentions(profile({ legal_form: "micro", vat_regime: "franchise" }), "Jean Dupont")
    expect(m.map((x) => x.text)).toEqual(["Jean Dupont, entrepreneur individuel (EI)", FRANCHISE_MENTION])
  })

  it("entrepreneur individuel dont le nom porte déjà « EI » : pas de répétition", () => {
    expect(generateMentions(profile({ legal_form: "ei" }), "Jean Dupont EI")).toEqual([])
    const withRcs = generateMentions(profile({ legal_form: "ei", rcs_city: "Lyon" }), "Jean Dupont EI")
    expect(withRcs.map((x) => x.text)).toEqual(["RCS Lyon"])
  })

  it("société : forme, capital et RCS ; la forme n'est pas répétée si le nom la porte", () => {
    const sarl = profile({ legal_form: "societe", company_type: "SARL", share_capital: 5000, rcs_city: "Angers" })
    expect(generateMentions(sarl, "Garnier Plâtrerie")[0].text).toBe("Garnier Plâtrerie, SARL au capital de 5 000 € — RCS Angers")
    expect(generateMentions(sarl, "Garnier SARL")[0].text).toBe("Garnier SARL au capital de 5 000 € — RCS Angers")
    // « SA » ne se confond pas avec « SAS » dans le nom
    const sa = profile({ legal_form: "societe", company_type: "SA", share_capital: 37000 })
    expect(generateMentions(sa, "Bâti SAS")[0].text).toBe("Bâti SAS, SA au capital de 37 000 €")
  })

  it("assujetti : aucune mention de TVA", () => {
    expect(generateMentions(profile({ vat_regime: "assujetti" }), "X")).toEqual([])
  })

  it("assurance : imprimée seulement complète (assureur, coordonnées, contrat, couverture)", () => {
    expect(generateMentions(profile({ decennale }), "X").map((x) => x.text)).toEqual([DECENNALE_TEXT])
    expect(generateMentions(profile({ decennale: { ...decennale, coverage: "" } }), "X")).toEqual([])
    const rc = generateMentions(profile({ rc_pro: decennale }), "X")
    expect(rc[0].text.startsWith("Responsabilité civile professionnelle : Assureur Exemple")).toBe(true)
  })

  it("ordre : identité, assurances, TVA", () => {
    const keys = generateMentions(profile({ legal_form: "micro", vat_regime: "franchise", decennale, rc_pro: decennale }), "Jean Dupont")
      .map((m) => m.key)
    expect(keys).toEqual(["identity", "decennale", "rc_pro", "vat"])
  })

  it("capital à la française", () => {
    expect(formatCapital(1500.5)).toBe("1 500,50")
    expect(parseCapital("5 000,50 €")).toBe(5000.5)
    expect(parseCapital("abc")).toBeNull()
    expect(parseCapital(-3)).toBeNull()
  })
})

// ── Mentions libres : jamais de doublon ──────────────────────────────────────

describe("mentions libres et réglages dédiés", () => {
  it("sans profil : les mentions libres seules, comme avant", () => {
    const c = composeMentions(null, "Ligne A\n\n  Ligne B  ", "X")
    expect(c.lines).toEqual(["Ligne A", "Ligne B"])
    expect(c.superseded).toEqual([])
    expect(c.vatRegime).toBeNull()
  })

  it("franchise : la ligne 293 B des mentions libres n'est pas répétée", () => {
    const c = composeMentions(profile({ vat_regime: "franchise" }), "TVA non applicable, art. 293 B du CGI.\nPénalités de retard : 3 fois le taux légal.", "X")
    expect(c.lines).toEqual([FRANCHISE_MENTION, "Pénalités de retard : 3 fois le taux légal."])
    expect(c.lines.filter((l) => /293\s*B/.test(l))).toHaveLength(1)
    expect(c.superseded[0]).toMatchObject({ by: "vat", contradiction: false })
  })

  it("TVA facturée : une mention de franchise restée dans le texte libre n'est plus imprimée (contradiction)", () => {
    const c = composeMentions(profile({ vat_regime: "assujetti" }), "TVA non applicable, art. 293 B du CGI", "X")
    expect(c.lines).toEqual([])
    expect(c.superseded[0]).toMatchObject({ by: "vat", contradiction: true })
  })

  it("décennale saisie dans les champs dédiés : l'ancienne ligne libre est remplacée", () => {
    const c = composeMentions(profile({ decennale }), "Assurance décennale : [Nom assureur], police n° [XXXXXXXX]\nAutre mention", "X")
    expect(c.lines).toEqual([DECENNALE_TEXT, "Autre mention"])
  })

  it("assurance incomplète : la ligne libre reste (rien ne la remplace)", () => {
    const c = composeMentions(profile({ decennale: { ...decennale, policy_number: "" } }), "Décennale : Assureur Exemple, contrat 42", "X")
    expect(c.lines).toEqual(["Décennale : Assureur Exemple, contrat 42"])
  })

  it("une ligne n'est retirée que si chacun de ses sujets est couvert", () => {
    // RCS couvert, capital non (pas de capital saisi) : la ligne reste
    const partial = composeMentions(profile({ legal_form: "societe", company_type: "SARL", rcs_city: "Lyon" }), "SARL au capital de 10 000 € — RCS Lyon", "Martin")
    expect(partial.kept).toEqual(["SARL au capital de 10 000 € — RCS Lyon"])
    const full = composeMentions(profile({ legal_form: "societe", company_type: "SARL", share_capital: 10000, rcs_city: "Lyon" }), "SARL au capital de 10 000 € — RCS Lyon", "Martin")
    expect(full.kept).toEqual([])
    expect(full.lines).toEqual(["Martin, SARL au capital de 10 000 € — RCS Lyon"])
  })

  it("une ligne identique à une mention générée n'apparaît qu'une fois", () => {
    const c = composeMentions(profile({ decennale }), DECENNALE_TEXT, "X")
    expect(c.lines).toEqual([DECENNALE_TEXT])
  })

  it("mentions de règlement entre professionnels : toujours gardées", () => {
    const notice = "Indemnité forfaitaire pour frais de recouvrement : 40 €"
    const c = composeMentions(profile({ legal_form: "micro", vat_regime: "franchise", decennale }), notice, "Jean Dupont")
    expect(c.kept).toEqual([notice])
  })
})

// ── Profil lu en base ────────────────────────────────────────────────────────

describe("profil légal", () => {
  it("ne garde que les champs connus, bornés", () => {
    const p = parseLegalProfile({
      trade: "plaquiste", vat_regime: "franchise", legal_form: "micro", company_type: "SARL", share_capital: 5000,
      decennale: { ...decennale, insurer: "x".repeat(500) }, hacker: "<script>",
    })!
    expect(p.trade).toBe("plaquiste")
    expect(p.company_type).toBeNull() // pas une société
    expect(p.share_capital).toBeNull()
    expect(p.decennale!.insurer).toHaveLength(80)
    expect("hacker" in p).toBe(false)
  })

  it("valeurs inconnues ignorées, profil vide → null", () => {
    expect(parseLegalProfile({ trade: "astronaute", vat_regime: "autre" })).toBeNull()
    expect(parseLegalProfile(null)).toBeNull()
    expect(parseLegalProfile("texte")).toBeNull()
    expect(parseLegalProfile([1, 2])).toBeNull()
  })

  it("erreurs : forme de société et assurance à moitié remplie", () => {
    const e = legalProfileErrors(profile({ legal_form: "societe", decennale: { ...decennale, address: "", coverage: "" } }))
    expect(Object.keys(e).sort()).toEqual(["company_type", "decennale.address", "decennale.coverage"])
    expect(legalProfileErrors(profile({ decennale }))).toEqual({})
  })
})

// ── Documents : mentions figées à l'émission ─────────────────────────────────

describe("mentions d'un document", () => {
  const company = {
    name: "Garnier Plâtrerie",
    legal_notice: "Mention libre",
    legal_profile: profile({ legal_form: "societe", company_type: "SARL", share_capital: 5000, vat_regime: "assujetti", decennale }),
  }
  const snapshot = {
    v: 1, name: "Garnier Plâtrerie", legal_notice: "Mention libre d'alors",
    profile: { legal_form: "micro", vat_regime: "franchise" }, frozen_at: "2026-09-01T08:00:00Z",
  }

  it("brouillon ou aperçu : réglages actuels", () => {
    const r = resolveDocumentMentions(company, { status: "draft" }, "quote")
    expect(r.source).toBe("live")
    expect(r.lines[0]).toBe("Garnier Plâtrerie, SARL au capital de 5 000 €")
    expect(resolveDocumentMentions(company, null, "invoice").source).toBe("live")
  })

  it("document émis : les mentions de l'émission, pas les réglages du jour", () => {
    const r = resolveDocumentMentions(company, { status: "sent", legal_snapshot: snapshot }, "invoice")
    expect(r.source).toBe("snapshot")
    expect(r.lines).toEqual(["Garnier Plâtrerie, entrepreneur individuel (EI)", FRANCHISE_MENTION, "Mention libre d'alors"])
    expect(r.vatRegime).toBe("franchise")
  })

  it("document émis avant l'instantané : ses mentions libres seules, sans le profil saisi ensuite", () => {
    const r = resolveDocumentMentions(company, { status: "paid" }, "invoice")
    expect(r.source).toBe("legacy")
    expect(r.lines).toEqual(["Mention libre"])
    expect(r.vatRegime).toBeNull()
    // Texte repris au caractère près (PDF et XML d'avant inchangés)
    const raw = resolveDocumentMentions({ ...company, legal_notice: "  A\n\nB  " }, { status: "sent" }, "quote")
    expect(raw.legalNotice).toBe("  A\n\nB  ")
  })

  it("avoir : toujours émis", () => {
    expect(resolveDocumentMentions(company, {}, "credit_note").source).toBe("legacy")
    expect(resolveDocumentMentions(company, { legal_snapshot: snapshot }, "credit_note").source).toBe("snapshot")
  })

  it("instantané illisible : ignoré", () => {
    expect(parseLegalSnapshot("x")).toBeNull()
    expect(parseLegalSnapshot([])).toBeNull()
    expect(resolveDocumentMentions(company, { status: "sent", legal_snapshot: 42 }, "invoice").source).toBe("legacy")
  })

  it("instantané reconstitué après un envoi = celui que pose le déclencheur", () => {
    const local = resolveDocumentMentions(company, { status: "sent", legal_snapshot: snapshotOf(company) }, "quote")
    const live = resolveDocumentMentions(company, { status: "draft" }, "quote")
    expect(local.lines).toEqual(live.lines)
  })
})

// ── Factur-X : le régime de TVA déclaré prime ───────────────────────────────

describe("Factur-X et régime de TVA", () => {
  const seller = {
    name: "Jean Dupont", siren: "732829320", address: "4 impasse du Moulin", zip_code: "33000", city: "Bordeaux",
    legal_notice: "", legal_profile: profile({ legal_form: "micro", vat_regime: "franchise" }),
  }
  const line = { description: "Pose de placo", quantity: 10, unit_price_ht: 30, vat_rate: 0, total_ht: 300, total_vat: 0 }
  const inv = { invoice_number: "F-2026-001", issue_date: "2026-10-03", due_date: "2026-11-02", lines: [line], client: { name: "Mme Martin" } }

  it("franchise choisie dans les réglages, sans texte « 293 B » : catégorie E et motif VATEX-FR-FRANCHISE", () => {
    const effective = withDocumentMentions(seller, { status: "draft" }, "invoice")
    const fx = buildFacturX(invoiceToFacturX(inv, effective))
    expect(fx.totals.treatment).toBe("franchise")
    expect(fx.xml).toContain("<ram:CategoryCode>E</ram:CategoryCode>")
    expect(fx.xml).toContain("VATEX-FR-FRANCHISE")
    // Mention imprimée une seule fois : celle du profil, pas une seconde fois par le XML
    const doc = invoiceToFacturX(inv, effective)
    expect(documentMentions(doc, computeFacturXTotals(doc))).toEqual([])
    expect(effective!.legal_notice.split("\n").filter((l) => /293\s*B/.test(l))).toHaveLength(1)
  })

  it("TVA facturée déclarée : une vieille mention « 293 B » ne fait plus basculer en franchise", () => {
    const fx = buildFacturX(invoiceToFacturX(
      { ...inv, notes: "TVA non applicable, art. 293 B du CGI" },
      { ...seller, vat_regime: "assujetti" },
    ))
    expect(fx.totals.treatment).toBe("standard")
  })

  it("régime non renseigné : la détection par le texte reste le repli", () => {
    const fx = buildFacturX(invoiceToFacturX(inv, { name: seller.name, siren: seller.siren, legal_notice: "TVA non applicable, art. 293 B du CGI" }))
    expect(fx.totals.treatment).toBe("franchise")
  })
})

// ── PDF : mentions coupées, jamais tronquées ────────────────────────────────

describe("mentions en pied de PDF", () => {
  const measure = (s: string) => s.length * 3.5

  it("une mention longue est coupée aux espaces, sans rien perdre", () => {
    const lines = wrapText(DECENNALE_TEXT, measure, 200)
    expect(lines.length).toBeGreaterThan(1)
    expect(lines.join(" ")).toBe(DECENNALE_TEXT)
    for (const l of lines) expect(measure(l) <= 200 || !l.includes(" ")).toBe(true)
  })

  it("sans doublon ni ligne vide, au plus 16 lignes", () => {
    expect(legalPdfLines(["A", "", "a", "B"], measure, 500)).toEqual(["A", "B"])
    expect(legalPdfLines(Array.from({ length: 30 }, (_, i) => `L${i}`), measure, 500)).toHaveLength(16)
  })

  it("devis et bon de commande se génèrent avec les mentions du profil", async () => {
    const company = {
      name: "Garnier Plâtrerie", siren: "948211375", address: "14 rue des Lices", zip_code: "49100", city: "Angers",
      legal_notice: "Mention libre",
      legal_profile: profile({ legal_form: "societe", company_type: "SARL", share_capital: 5000, rcs_city: "Angers", decennale, rc_pro: decennale }),
    }
    const lines = [{ description: "Cloison BA13", quantity: 12, unit_price_ht: 48, vat_rate: 10, total_ht: 576 }]
    const quote = await generateQuotePdf({
      quote: { quote_number: "D-2026-001", issue_date: "2026-10-03", valid_until: "2026-11-02", subtotal_ht: 576, total_vat: 57.6, total_ttc: 633.6, lines, status: "draft" },
      company,
    })
    expect(quote.byteLength).toBeGreaterThan(1000)
    const po = await generatePurchaseOrderPdf({
      po: { po_number: "BC-2026-001", issue_date: "2026-10-03", subtotal_ht: 576, total_vat: 57.6, total_ttc: 633.6, lines },
      company,
    })
    expect(po.byteLength).toBeGreaterThan(1000)
  })
})
