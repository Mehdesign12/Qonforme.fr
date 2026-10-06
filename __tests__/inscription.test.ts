/**
 * Fenêtre « Bienvenue » de l'inscription en deux champs : étapes, contrôles
 * des saisies (lib/onboarding/inscription.ts) et route
 * PATCH /api/onboarding/inscription contre une fausse base en mémoire —
 * entreprise créée ou mise à jour sans jamais toucher à la numérotation,
 * SIREN facultatif (« » en base), profil légal fusionné, n° de TVA calculé,
 * prestations du métier importées sans doublon, migration absente tolérée.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { fakeCompanyDb, type FakeCompanyDb } from "./helpers/fake-company-db"

let db: FakeCompanyDb
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => db.client, createAdminClient: () => db.client }))

import {
  COMPANY_REQUIRED, INSCRIPTION_STEPS, SIREN_INVALID, inscriptionStepNumber, inscriptionSteps, isCompanyRequired,
  mergeCompanyProfile, mergeTradeProfile, parseInscriptionPatch, pendingInscriptionStep, validateCompanyInput,
  validateFirstName, validateTradeInput, vatNumberAfterSirenChange, vatNumberAfterTrade, type CompanyInput,
} from "@/lib/onboarding/inscription"
import { tradeItems } from "@/lib/catalogue/trades"
import { PATCH } from "@/app/api/onboarding/inscription/route"

const USER = "user-1"
// SIREN valides (clé de Luhn), voisins de ceux des maquettes
const SIREN_SARL = "948211370"
const SIREN_EI = "951384205"
const VAT_SARL = "FR94948211370"
const VAT_EI = "FR86951384205"

const GARNIER = {
  name: "GARNIER PLÂTRERIE ISOLATION SARL",
  siren: SIREN_SARL,
  siret: `${SIREN_SARL}00017`,
  address: "14 rue des Lices",
  zip_code: "49100",
  city: "Angers",
  legal_form: "societe",
  company_type: "SARL",
}

// ─────────────────────────────────────────────────────────────────────────────
// Étapes
// ─────────────────────────────────────────────────────────────────────────────

describe("étapes de la fenêtre", () => {
  const state = { company: false, trade: false, firstName: false, profileAvailable: true }

  it("ordre : entreprise, métier, prénom ; sans profil légal, pas d'étape métier", () => {
    expect(INSCRIPTION_STEPS).toEqual(["company", "trade", "name"])
    expect(inscriptionSteps(true)).toEqual(["company", "trade", "name"])
    expect(inscriptionSteps(false)).toEqual(["company", "name"])
    expect(inscriptionStepNumber("name", true)).toBe(3)
    expect(inscriptionStepNumber("name", false)).toBe(2)
    expect(inscriptionStepNumber("trade", false)).toBeNull()
  })

  it("première étape à faire, null quand tout est fait", () => {
    expect(pendingInscriptionStep(state)).toBe("company")
    expect(pendingInscriptionStep({ ...state, company: true })).toBe("trade")
    expect(pendingInscriptionStep({ ...state, company: true, trade: true })).toBe("name")
    expect(pendingInscriptionStep({ ...state, company: true, trade: true, firstName: true })).toBeNull()
    // Le prénom déjà connu n'empêche pas de demander l'entreprise
    expect(pendingInscriptionStep({ ...state, firstName: true })).toBe("company")
  })

  it("sans profil légal, le métier ne bloque jamais", () => {
    expect(pendingInscriptionStep({ company: true, trade: false, firstName: false, profileAvailable: false })).toBe("name")
    expect(pendingInscriptionStep({ company: true, trade: false, firstName: true, profileAvailable: false })).toBeNull()
  })

  it("code de la garde d'envoi : 409 COMPANY_REQUIRED seulement", () => {
    expect(isCompanyRequired(409, { code: COMPANY_REQUIRED })).toBe(true)
    expect(isCompanyRequired(409, { code: "AUTRE" })).toBe(false)
    expect(isCompanyRequired(402, { code: COMPANY_REQUIRED })).toBe(false)
    expect(isCompanyRequired(409, null)).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Contrôles des saisies
// ─────────────────────────────────────────────────────────────────────────────

describe("entreprise (étape 1)", () => {
  const value = (x: unknown) => {
    const r = validateCompanyInput(x)
    if (!r.ok) throw new Error(r.error)
    return r.value
  }
  const error = (x: unknown) => {
    const r = validateCompanyInput(x)
    return r.ok ? null : r.error
  }

  it("entreprise du répertoire : tout est gardé, espaces normalisés", () => {
    const v = value({ ...GARNIER, name: "  GARNIER   PLÂTRERIE ISOLATION SARL ", siren: "948 211 370" })
    expect(v).toEqual({ ...GARNIER, siret: `${SIREN_SARL}00017` })
  })

  it("saisie à la main sans SIREN : SIREN et SIRET null, forme inconnue", () => {
    const v = value({ name: "Thomas Garnier", address: "3 rue du Port", zip_code: "49130", city: "Les Ponts-de-Cé", siren: "" })
    expect(v.siren).toBeNull()
    expect(v.siret).toBeNull()
    expect(v.legal_form).toBeNull()
    expect(v.company_type).toBeNull()
  })

  it("SIREN faux : refusé avec le message du répertoire", () => {
    expect(error({ ...GARNIER, siren: "948211375" })).toBe(SIREN_INVALID)
    expect(error({ ...GARNIER, siren: "12345" })).toBe(SIREN_INVALID)
    expect(SIREN_INVALID).toContain(" :")
  })

  it("SIRET ignoré s'il ne prolonge pas le SIREN, ou sans SIREN", () => {
    expect(value({ ...GARNIER, siret: "51264908300015" }).siret).toBeNull()
    expect(value({ ...GARNIER, siren: null }).siret).toBeNull()
    expect(value({ ...GARNIER, siret: SIREN_SARL }).siret).toBeNull()
  })

  it("champs requis et bornes", () => {
    expect(error(null)).toBe("Requête invalide.")
    expect(error({ ...GARNIER, name: "  " })).toBe("Indiquez le nom de votre entreprise.")
    expect(error({ ...GARNIER, address: "" })).toBe("Indiquez l'adresse de votre entreprise.")
    expect(error({ ...GARNIER, zip_code: "4910" })).toBe("Code postal invalide (5 chiffres).")
    expect(error({ ...GARNIER, zip_code: "49 100" })).toBeNull()
    expect(error({ ...GARNIER, city: "" })).toBe("Indiquez la ville.")
    expect(error({ ...GARNIER, name: "x".repeat(121) })).toMatch(/120 caractères/)
    expect(error({ ...GARNIER, address: "x".repeat(201) })).toMatch(/200 caractères/)
  })

  it("forme juridique : ei ou société seulement ; forme de société pour une société", () => {
    expect(value({ ...GARNIER, legal_form: "micro" }).legal_form).toBeNull()
    expect(value({ ...GARNIER, legal_form: "ei", company_type: "SARL" }).company_type).toBeNull()
    expect(value({ ...GARNIER, company_type: "sasu" }).company_type).toBe("SASU")
    expect(value({ ...GARNIER, company_type: "SELARL" }).company_type).toBe("SELARL")
  })

  it("caractères de contrôle retirés", () => {
    expect(value({ ...GARNIER, name: "GARNIER\u0000\nSARL" }).name).toBe("GARNIER SARL")
  })
})

describe("métier et TVA (étape 2)", () => {
  it("assujetti : chantier type requis pour importer les prestations", () => {
    expect(validateTradeInput({ trade: "plaquiste", vat_regime: "assujetti", catalogue: { context: "renovation" } }))
      .toEqual({ ok: true, value: { trade: "plaquiste", vat_regime: "assujetti", catalogue: { context: "renovation" } } })
    expect(validateTradeInput({ trade: "plaquiste", vat_regime: "assujetti", catalogue: { context: "franchise" } }))
      .toEqual({ ok: false, error: "Choisissez le type de vos chantiers." })
    expect(validateTradeInput({ trade: "plaquiste", vat_regime: "assujetti", catalogue: null }))
      .toEqual({ ok: true, value: { trade: "plaquiste", vat_regime: "assujetti", catalogue: null } })
  })

  it("franchise : prestations toujours à 0 % (chantier « franchise »)", () => {
    expect(validateTradeInput({ trade: "peintre", vat_regime: "franchise", catalogue: { context: "standard" } }))
      .toEqual({ ok: true, value: { trade: "peintre", vat_regime: "franchise", catalogue: { context: "franchise" } } })
  })

  it("métier et régime requis", () => {
    expect(validateTradeInput({ trade: "astronaute", vat_regime: "assujetti" })).toEqual({ ok: false, error: "Choisissez votre métier." })
    expect(validateTradeInput({ trade: "macon" })).toEqual({ ok: false, error: "Indiquez si vous facturez la TVA." })
    expect(validateTradeInput({ trade: "macon", vat_regime: "assujetti", catalogue: "oui" })).toEqual({ ok: false, error: "Requête invalide." })
  })
})

describe("prénom (étape 3)", () => {
  it("1 à 60 caractères, espaces normalisés", () => {
    expect(validateFirstName("  Thomas ")).toEqual({ ok: true, value: "Thomas" })
    expect(validateFirstName("Jean  Pierre")).toEqual({ ok: true, value: "Jean Pierre" })
    expect(validateFirstName("")).toEqual({ ok: false, error: "Indiquez votre prénom." })
    expect(validateFirstName(undefined)).toEqual({ ok: false, error: "Indiquez votre prénom." })
    expect(validateFirstName(42)).toEqual({ ok: false, error: "Requête invalide." })
    expect(validateFirstName("x".repeat(61))).toEqual({ ok: false, error: "Le prénom ne peut pas dépasser 60 caractères." })
  })
})

describe("corps de la requête", () => {
  it("une étape connue, sinon 400", () => {
    expect(parseInscriptionPatch({ step: "close" })).toEqual({ ok: true, value: { step: "close" } })
    expect(parseInscriptionPatch({ step: "name", first_name: "Thomas" })).toEqual({ ok: true, value: { step: "name", first_name: "Thomas" } })
    expect(parseInscriptionPatch({ step: "company", company: GARNIER }).ok).toBe(true)
    expect(parseInscriptionPatch({ step: "plan" })).toEqual({ ok: false, error: "Requête invalide." })
    expect(parseInscriptionPatch("close")).toEqual({ ok: false, error: "Requête invalide." })
    expect(parseInscriptionPatch(null)).toEqual({ ok: false, error: "Requête invalide." })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Fusions et n° de TVA
// ─────────────────────────────────────────────────────────────────────────────

describe("profil légal et n° de TVA", () => {
  const sarl = validateCompanyInput(GARNIER)
  const input = (sarl.ok ? sarl.value : null) as CompanyInput

  it("forme du répertoire fusionnée, assurances et métier gardés", () => {
    const existing = {
      trade: "plaquiste", vat_regime: "assujetti", rcs_city: "Angers",
      decennale: { insurer: "Assureur", address: "Paris", policy_number: "D-1", coverage: "France" },
    }
    const p = mergeCompanyProfile(existing, input)
    expect(p?.legal_form).toBe("societe")
    expect(p?.company_type).toBe("SARL")
    expect(p?.trade).toBe("plaquiste")
    expect(p?.rcs_city).toBe("Angers")
    expect(p?.decennale?.policy_number).toBe("D-1")
  })

  it("saisie à la main (forme inconnue) : profil inchangé ; micro-entreprise gardée", () => {
    expect(mergeCompanyProfile({ trade: "peintre" }, { ...input, legal_form: null })).toMatchObject({ trade: "peintre", legal_form: null })
    expect(mergeCompanyProfile(null, { ...input, legal_form: null })).toBeNull()
    expect(mergeCompanyProfile({ legal_form: "micro" }, { ...input, legal_form: "ei", company_type: null })?.legal_form).toBe("micro")
    // Société sans forme précise dans le répertoire : la forme déjà saisie reste
    expect(mergeCompanyProfile({ legal_form: "societe", company_type: "SAS", share_capital: 1000 }, { ...input, company_type: null }))
      .toMatchObject({ legal_form: "societe", company_type: "SAS", share_capital: 1000 })
    // Devenue EI : plus de forme de société ni de capital
    expect(mergeCompanyProfile({ legal_form: "societe", company_type: "SAS", share_capital: 1000 }, { ...input, legal_form: "ei", company_type: null }))
      .toMatchObject({ legal_form: "ei", company_type: null, share_capital: null })
  })

  it("métier et régime fusionnés, le reste gardé", () => {
    const p = mergeTradeProfile({ legal_form: "societe", company_type: "SARL", vat_regime: "franchise" }, { trade: "electricien", vat_regime: "assujetti" })
    expect(p).toMatchObject({ trade: "electricien", vat_regime: "assujetti", legal_form: "societe", company_type: "SARL" })
  })

  it("n° de TVA : calculé depuis le SIREN, aucun en franchise", () => {
    expect(vatNumberAfterTrade("assujetti", SIREN_SARL, null)).toBe(VAT_SARL)
    expect(vatNumberAfterTrade("assujetti", SIREN_SARL, "")).toBe(VAT_SARL)
    expect(vatNumberAfterTrade("franchise", SIREN_SARL, VAT_SARL)).toBeNull()
    // Sans SIREN valide : rien n'est calculé
    expect(vatNumberAfterTrade("assujetti", "", null)).toBeNull()
    expect(vatNumberAfterTrade("assujetti", "", "FR00123")).toBe("FR00123")
    // Numéro saisi pour ce SIREN : gardé tel quel ; calculé sur un autre SIREN : remplacé
    expect(vatNumberAfterTrade("assujetti", SIREN_SARL, "FR 94 948211370")).toBe("FR 94 948211370")
    expect(vatNumberAfterTrade("assujetti", SIREN_SARL, VAT_EI)).toBe(VAT_SARL)
  })

  it("SIREN remplacé : le n° de TVA calculé suit, un n° saisi à la main reste", () => {
    expect(vatNumberAfterSirenChange(SIREN_EI, SIREN_SARL, VAT_EI)).toBe(VAT_SARL)
    expect(vatNumberAfterSirenChange(SIREN_EI, null, VAT_EI)).toBeNull()
    expect(vatNumberAfterSirenChange(SIREN_SARL, SIREN_SARL, VAT_SARL)).toBeUndefined()
    expect(vatNumberAfterSirenChange(SIREN_EI, SIREN_SARL, "BE0123456789")).toBeUndefined()
    expect(vatNumberAfterSirenChange("", SIREN_SARL, null)).toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Route
// ─────────────────────────────────────────────────────────────────────────────

const patch = (body: unknown) =>
  PATCH(new NextRequest("http://localhost/api/onboarding/inscription", { method: "PATCH", body: JSON.stringify(body) }))

const companyOf = () => db.tables.companies?.find((c) => c.user_id === USER)

describe("PATCH /api/onboarding/inscription", () => {
  beforeEach(() => {
    db = fakeCompanyDb({ companies: [], products: [] })
    db.user = { id: USER, email: "thomas@garnier.example.com", user_metadata: { signup_wizard: true } }
  })

  it("non connecté : 401 ; corps invalide : 400", async () => {
    db.user = null
    expect((await patch({ step: "close" })).status).toBe(401)
    db.user = { id: USER, email: "t@example.com", user_metadata: {} }
    const res = await patch({ step: "company", company: { ...GARNIER, zip_code: "1" } })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe("Code postal invalide (5 chiffres).")
    expect(db.tables.companies).toHaveLength(0)
  })

  it("entreprise du répertoire : créée avec la numérotation de départ et sa forme juridique", async () => {
    const res = await patch({ step: "company", company: GARNIER })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      company: { name: GARNIER.name, siren: SIREN_SARL, address: GARNIER.address, zip_code: "49100", city: "Angers" },
      profileAvailable: true,
    })
    expect(companyOf()).toMatchObject({
      user_id: USER, name: GARNIER.name, siren: SIREN_SARL, siret: GARNIER.siret, country: "FR",
      invoice_prefix: "F", invoice_sequence: 1,
      legal_profile: { legal_form: "societe", company_type: "SARL" },
    })
  })

  it("entreprise à la main sans SIREN : « » en base, null dans la réponse, pas de profil", async () => {
    const res = await patch({ step: "company", company: { name: "Thomas Garnier", address: "3 rue du Port", zip_code: "49130", city: "Les Ponts-de-Cé" } })
    expect(res.status).toBe(200)
    expect((await res.json()).company.siren).toBeNull()
    expect(companyOf()?.siren).toBe("")
    expect(companyOf()?.siret).toBeNull()
    expect(companyOf()?.legal_profile).toBeUndefined()
  })

  it("entreprise existante : identité seulement, jamais la numérotation ni les réglages", async () => {
    db.tables.companies.push({
      id: "c-1", user_id: USER, name: "Ancien nom", siren: "", siret: null, address: "1 rue", zip_code: "75001", city: "Paris",
      invoice_prefix: "FA", invoice_sequence: 42, iban: "FR7630006000011234567890189", logo_url: "https://x/logo.png",
      legal_notice: "Mentions", vat_number: null, legal_profile: { trade: "plaquiste", vat_regime: "assujetti" },
    })
    const res = await patch({ step: "company", company: GARNIER })
    expect(res.status).toBe(200)
    expect(db.tables.companies).toHaveLength(1)
    expect(companyOf()).toMatchObject({
      name: GARNIER.name, siren: SIREN_SARL, siret: GARNIER.siret, address: GARNIER.address, zip_code: "49100", city: "Angers",
      invoice_prefix: "FA", invoice_sequence: 42, iban: "FR7630006000011234567890189", logo_url: "https://x/logo.png",
      legal_notice: "Mentions", vat_number: null,
      legal_profile: { trade: "plaquiste", vat_regime: "assujetti", legal_form: "societe", company_type: "SARL" },
    })
    const update = db.ops.find((o) => o.table === "companies" && o.kind === "update")
    expect(Object.keys(update?.values as object).sort()).toEqual(["address", "city", "legal_profile", "name", "siren", "siret", "zip_code"])
  })

  it("entreprise remplacée dans la fenêtre : le n° de TVA calculé suit le nouveau SIREN", async () => {
    db.tables.companies.push({ user_id: USER, name: "THOMAS GARNIER", siren: SIREN_EI, vat_number: VAT_EI, invoice_sequence: 1 })
    await patch({ step: "company", company: GARNIER })
    expect(companyOf()?.vat_number).toBe(VAT_SARL)
  })

  it("double envoi simultané : l'entreprise créée entre-temps est mise à jour, jamais dupliquée", async () => {
    db.beforeInsert = (table) => {
      if (table === "companies" && db.tables.companies.length === 0) {
        db.tables.companies.push({ user_id: USER, name: "Autre onglet", siren: "", invoice_sequence: 7 })
      }
    }
    const res = await patch({ step: "company", company: GARNIER })
    expect(res.status).toBe(200)
    expect(db.tables.companies).toHaveLength(1)
    expect(companyOf()).toMatchObject({ name: GARNIER.name, siren: SIREN_SARL, invoice_sequence: 7 })
  })

  it("migration du profil absente : entreprise créée sans profil, profileAvailable faux", async () => {
    db.missingColumns.add("legal_profile")
    const res = await patch({ step: "company", company: GARNIER })
    expect(res.status).toBe(200)
    expect((await res.json()).profileAvailable).toBe(false)
    expect(companyOf()).toMatchObject({ name: GARNIER.name, invoice_sequence: 1 })
    expect(companyOf()?.legal_profile).toBeUndefined()
  })

  it("lecture en erreur : 503, rien n'est écrit", async () => {
    db.failing.add("companies")
    const res = await patch({ step: "company", company: GARNIER })
    expect(res.status).toBe(503)
    expect(db.ops.some((o) => o.kind !== "select")).toBe(false)
  })

  it("métier assujetti : profil, n° de TVA calculé et prestations du métier à 0 €, sans doublon", async () => {
    db.tables.companies.push({ user_id: USER, name: GARNIER.name, siren: SIREN_SARL, vat_number: null, legal_profile: { legal_form: "societe", company_type: "SARL" } })
    db.tables.products.push({ user_id: USER, name: "Trappe de visite", unit_price_ht: 45, vat_rate: 10 })

    const res = await patch({ step: "trade", trade: { trade: "plaquiste", vat_regime: "assujetti", catalogue: { context: "renovation" } } })
    expect(res.status).toBe(200)
    const items = tradeItems("plaquiste")
    expect(await res.json()).toEqual({ ok: true, imported: items.length - 1 })

    expect(companyOf()).toMatchObject({
      vat_number: VAT_SARL,
      legal_profile: { trade: "plaquiste", vat_regime: "assujetti", legal_form: "societe", company_type: "SARL" },
    })
    const products = db.tables.products.filter((p) => p.user_id === USER)
    expect(products).toHaveLength(items.length)
    expect(products.filter((p) => p.name === "Trappe de visite")).toHaveLength(1)
    const isolation = products.find((p) => p.name === "Isolation des combles perdus")
    expect(isolation).toMatchObject({ unit_price_ht: 0, vat_rate: 5.5, is_active: true, unit: "m²" })
    expect(products.find((p) => p.name === "Cloison sur ossature métallique, plaques de plâtre BA13")?.vat_rate).toBe(10)

    // Renvoyée (retour arrière dans la fenêtre) : aucune prestation en double
    const again = await patch({ step: "trade", trade: { trade: "plaquiste", vat_regime: "assujetti", catalogue: { context: "renovation" } } })
    expect(await again.json()).toEqual({ ok: true, imported: 0 })
    expect(db.tables.products.filter((p) => p.user_id === USER)).toHaveLength(items.length)
  })

  it("franchise : n° de TVA retiré, prestations à 0 %", async () => {
    db.tables.companies.push({ user_id: USER, name: "Thomas Garnier", siren: SIREN_EI, vat_number: VAT_EI })
    const res = await patch({ step: "trade", trade: { trade: "peintre", vat_regime: "franchise", catalogue: { context: "standard" } } })
    expect(res.status).toBe(200)
    expect(companyOf()).toMatchObject({ vat_number: null, legal_profile: { trade: "peintre", vat_regime: "franchise" } })
    expect(db.tables.products.every((p) => p.vat_rate === 0)).toBe(true)
  })

  it("sans prestations demandées : rien au catalogue ; sans SIREN : pas de n° de TVA", async () => {
    db.tables.companies.push({ user_id: USER, name: "Thomas Garnier", siren: "", vat_number: null })
    const res = await patch({ step: "trade", trade: { trade: "macon", vat_regime: "assujetti", catalogue: null } })
    expect(await res.json()).toEqual({ ok: true, imported: 0 })
    expect(db.tables.products).toHaveLength(0)
    expect(companyOf()?.vat_number).toBeNull()
  })

  it("métier sans entreprise : 409", async () => {
    const res = await patch({ step: "trade", trade: { trade: "macon", vat_regime: "assujetti", catalogue: null } })
    expect(res.status).toBe(409)
  })

  it("catalogue illisible : 503, le métier reste enregistré (nouvel essai sans doublon)", async () => {
    db.tables.companies.push({ user_id: USER, name: GARNIER.name, siren: SIREN_SARL, vat_number: null })
    db.failing.add("products")
    const res = await patch({ step: "trade", trade: { trade: "plaquiste", vat_regime: "assujetti", catalogue: { context: "standard" } } })
    expect(res.status).toBe(503)
    expect(companyOf()?.legal_profile).toMatchObject({ trade: "plaquiste" })
  })

  it("prénom : enregistré dans le compte, les autres métadonnées gardées", async () => {
    const res = await patch({ step: "name", first_name: " Thomas " })
    expect(res.status).toBe(200)
    expect(db.user?.user_metadata).toEqual({ signup_wizard: true, first_name: "Thomas" })
    db.authFails = true
    expect((await patch({ step: "name", first_name: "Thomas" })).status).toBe(500)
  })

  it("fermeture : fenêtre fermée et premiers pas vus, sans réécrire une date déjà posée", async () => {
    db.tables.companies.push({ user_id: USER, name: GARNIER.name, onboarding_seen_at: null })
    const res = await patch({ step: "close" })
    expect(res.status).toBe(200)
    expect(db.user?.user_metadata.signup_window_closed).toBe(true)
    const seen = companyOf()?.onboarding_seen_at
    expect(typeof seen).toBe("string")

    companyOf()!.onboarding_seen_at = "2026-10-01T08:00:00.000Z"
    await patch({ step: "close" })
    expect(companyOf()?.onboarding_seen_at).toBe("2026-10-01T08:00:00.000Z")
  })

  it("fermeture sans entreprise : rien d'autre n'est écrit", async () => {
    const res = await patch({ step: "close" })
    expect(res.status).toBe(200)
    expect(db.tables.companies).toHaveLength(0)
  })
})
