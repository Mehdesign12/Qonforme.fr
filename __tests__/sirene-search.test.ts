/**
 * Recherche d'entreprise de la fenêtre d'inscription (`searchCompanies` et
 * GET /api/sirene/search), contre des réponses calquées sur l'API Recherche
 * d'entreprises (recherche-entreprises.api.gouv.fr) et l'API Sirene de l'INSEE.
 * Aucune requête réelle : `fetch` est remplacé.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { searchBySiren, searchCompanies } from "@/lib/utils/sirene"

const mocks = vi.hoisted(() => ({ user: null as { id: string } | null }))
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: mocks.user }, error: null }) } }),
}))

const RECHERCHE = "https://recherche-entreprises.api.gouv.fr/search"

function reply(status: number, body?: unknown) {
  return Promise.resolve(new Response(body === undefined ? null : JSON.stringify(body), { status }))
}

/** Société : dénomination, sigle entre parenthèses dans `nom_complet`. */
const SARL = {
  siren: "948211370",
  nom_complet: "GARNIER PLATRERIE ISOLATION (GPI)",
  nom_raison_sociale: "GARNIER PLATRERIE ISOLATION",
  nature_juridique: "5499",
  activite_principale: "43.31Z",
  etat_administratif: "A",
  siege: {
    siret: "94821137000015",
    numero_voie: "14",
    type_voie: "RUE",
    libelle_voie: "DES LICES",
    code_postal: "49100",
    libelle_commune: "ANGERS",
    adresse: "14 RUE DES LICES 49100 ANGERS",
  },
  dirigeants: [{ nom: "GARNIER", prenoms: "THOMAS", qualite: "Gérant", type_dirigeant: "personne physique" }],
}

/** Entrepreneur individuel : « PRÉNOM NOM », enseigne entre parenthèses, plusieurs prénoms. */
const EI = {
  siren: "951384205",
  nom_complet: "THOMAS GARNIER (TG PLAQUES)",
  nom_raison_sociale: null,
  nature_juridique: "1000",
  activite_principale: "43.31Z",
  etat_administratif: "A",
  siege: { siret: "95138420500012", adresse: "3 RUE DU PORT 49130 LES PONTS-DE-CE", code_postal: "49130", libelle_commune: "LES PONTS-DE-CE" },
  dirigeants: [{ nom: "GARNIER", prenoms: "THOMAS LUC", type_dirigeant: "personne physique" }],
}

/** Société fermée, renvoyée en tête par l'API. */
const FERMEE = {
  siren: "512649088",
  nom_complet: "PLATRERIE GARNIER ET FILS",
  nom_raison_sociale: "PLATRERIE GARNIER ET FILS",
  nature_juridique: "5710",
  activite_principale: "43.31Z",
  etat_administratif: "C",
  siege: { siret: "51264908800021", code_postal: "72000", libelle_commune: "LE MANS", adresse: "72000 LE MANS" },
}

describe("searchCompanies : recherche par nom", () => {
  const fetchMock = vi.fn()
  beforeEach(() => {
    vi.stubEnv("INSEE_API_KEY", "cle-de-test")
    vi.stubGlobal("fetch", fetchMock)
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    fetchMock.mockReset()
  })

  it("société, entrepreneur individuel et entreprise fermée (en fin de liste)", async () => {
    fetchMock.mockImplementation(() => reply(200, { results: [FERMEE, SARL, EI], total_results: 3 }))
    const o = await searchCompanies("  garnier   plâtrerie ")

    // Une seule requête, à l'API Recherche d'entreprises, 6 résultats, texte encodé
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const url = String(fetchMock.mock.calls[0][0])
    expect(url).toBe(`${RECHERCHE}?q=${encodeURIComponent("garnier plâtrerie")}&per_page=6`)
    // La clé de l'INSEE ne part jamais vers une autre source
    expect(JSON.stringify(fetchMock.mock.calls[0][1])).not.toContain("cle-de-test")

    expect(o).toEqual({
      status: "ok",
      results: [
        {
          siren: "948211370",
          siret: "94821137000015",
          name: "GARNIER PLATRERIE ISOLATION",
          legal_form: "societe",
          company_type: "SARL",
          legal_form_label: "SARL",
          address: "14 RUE DES LICES",
          zip_code: "49100",
          city: "ANGERS",
          activity_code: "43.31Z",
          closed: false,
        },
        {
          siren: "951384205",
          siret: "95138420500012",
          name: "THOMAS GARNIER",
          first_name: "Thomas",
          legal_form: "ei",
          company_type: null,
          legal_form_label: "Entrepreneur individuel",
          address: "3 RUE DU PORT",
          zip_code: "49130",
          city: "LES PONTS-DE-CE",
          activity_code: "43.31Z",
          closed: false,
        },
        {
          siren: "512649088",
          siret: "51264908800021",
          name: "PLATRERIE GARNIER ET FILS",
          legal_form: "societe",
          company_type: "SAS",
          legal_form_label: "SAS",
          address: "",
          zip_code: "72000",
          city: "LE MANS",
          activity_code: "43.31Z",
          closed: true,
        },
      ],
    })
  })

  it("le gérant d'une société n'est jamais pris pour un prénom", async () => {
    fetchMock.mockImplementation(() => reply(200, { results: [SARL] }))
    const o = await searchCompanies("garnier")
    if (o.status !== "ok") throw new Error("ok attendu")
    expect(o.results[0].first_name).toBeUndefined()
  })

  it("données non diffusibles : « [ND] » retiré, fiche sans nom écartée", async () => {
    fetchMock.mockImplementation(() =>
      reply(200, {
        results: [
          {
            siren: "801339748",
            nom_complet: "[ND] BOUNEZOUR",
            nature_juridique: "1000",
            etat_administratif: "A",
            siege: { siret: "80133974800031", adresse: "[ND]", libelle_voie: "[ND]", code_postal: "69330", libelle_commune: "MEYZIEU" },
          },
          { siren: "732829320", nom_complet: "[NON-DIFFUSIBLE]", nature_juridique: "1000", etat_administratif: "A", siege: {} },
        ],
      }),
    )
    const o = await searchCompanies("bounezour")
    expect(o.status).toBe("ok")
    if (o.status !== "ok") return
    expect(o.results).toHaveLength(1)
    expect(o.results[0]).toMatchObject({ siren: "801339748", name: "BOUNEZOUR", address: "", zip_code: "69330", city: "MEYZIEU", legal_form: "ei" })
    // Un seul mot : pas de prénom deviné
    expect(o.results[0].first_name).toBeUndefined()
  })

  it("prénom d'un entrepreneur individuel sans dirigeant : seulement s'il est sans ambiguïté", async () => {
    fetchMock.mockImplementation(() =>
      reply(200, {
        results: [
          // Nom d'usage : « PRÉNOM NOM_D'USAGE (NOM) »
          { siren: "801339748", nom_complet: "MARIE MARTIN (DURAND)", nature_juridique: "1000", etat_administratif: "A", siege: {} },
          { siren: "732829320", nom_complet: "JEAN DE LA FONTAINE", nature_juridique: "1000", etat_administratif: "A", siege: {} },
          // Prénom composé, catégorie absente mais compléments explicites
          { siren: "552100554", nom_complet: "JEAN-PIERRE DUPONT", complements: { est_entrepreneur_individuel: true }, etat_administratif: "A", siege: {} },
        ],
      }),
    )
    const o = await searchCompanies("martin")
    if (o.status !== "ok") throw new Error("ok attendu")
    expect(o.results.map((c) => [c.name, c.first_name, c.legal_form_label])).toEqual([
      ["MARIE MARTIN", "Marie", "Entrepreneur individuel"],
      ["JEAN DE LA FONTAINE", undefined, "Entrepreneur individuel"],
      ["JEAN-PIERRE DUPONT", "Jean-Pierre", "Entrepreneur individuel"],
    ])
  })

  it("prénom usuel lu dans les prénoms du dirigeant, même s'il n'est pas le premier", async () => {
    fetchMock.mockImplementation(() =>
      reply(200, {
        results: [
          {
            siren: "801339748",
            nom_complet: "PAUL DE LA TOUR",
            nature_juridique: "1000",
            etat_administratif: "A",
            siege: {},
            dirigeants: [{ nom: "DE LA TOUR", prenoms: "JEAN PAUL", type_dirigeant: "personne physique" }],
          },
        ],
      }),
    )
    const o = await searchCompanies("de la tour")
    expect(o.status === "ok" && o.results[0].first_name).toBe("Paul")
  })

  it("forme juridique inconnue : libellé vide", async () => {
    fetchMock.mockImplementation(() =>
      reply(200, { results: [{ siren: "801339748", nom_complet: "AMICALE DES PLATRIERS", nature_juridique: "9220", etat_administratif: "A", siege: {} }] }),
    )
    const o = await searchCompanies("amicale")
    expect(o.status === "ok" && o.results[0]).toMatchObject({ legal_form: null, company_type: null, legal_form_label: "" })
  })

  it("aucun résultat : liste vide", async () => {
    fetchMock.mockImplementation(() => reply(200, { results: [], total_results: 0 }))
    expect(await searchCompanies("zzzz introuvable")).toEqual({ status: "ok", results: [] })
  })

  it("requête refusée par l'API (400) : liste vide, pas une panne", async () => {
    fetchMock.mockImplementation(() => reply(400, { erreur: "Veuillez indiquer au moins 3 caractères." }))
    expect(await searchCompanies("ab")).toEqual({ status: "ok", results: [] })
  })

  it.each([500, 502, 503, 429])("réponse %s : répertoire indisponible", async (status) => {
    fetchMock.mockImplementation(() => reply(status))
    expect(await searchCompanies("garnier")).toEqual({ status: "unavailable" })
  })

  it("panne réseau ou délai dépassé : répertoire indisponible", async () => {
    fetchMock.mockImplementation(() => Promise.reject(new TypeError("fetch failed")))
    expect(await searchCompanies("garnier")).toEqual({ status: "unavailable" })
  })

  it("réponse illisible : répertoire indisponible", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(new Response("<html>maintenance</html>", { status: 200 })))
    expect(await searchCompanies("garnier")).toEqual({ status: "unavailable" })
  })

  it("au plus 6 résultats, sans doublon", async () => {
    const lignes = Array.from({ length: 8 }, (_, i) => ({ ...SARL, siren: i < 2 ? "948211370" : `80133974${i}`, nom_complet: `ENTREPRISE ${i}` }))
    fetchMock.mockImplementation(() => reply(200, { results: lignes }))
    const o = await searchCompanies("entreprise")
    if (o.status !== "ok") throw new Error("ok attendu")
    expect(o.results.length).toBeLessThanOrEqual(6)
    expect(new Set(o.results.map((c) => c.siren)).size).toBe(o.results.length)
  })
})

describe("searchCompanies : numéro SIREN ou SIRET", () => {
  const fetchMock = vi.fn()
  beforeEach(() => {
    vi.stubEnv("INSEE_API_KEY", "cle-de-test")
    vi.stubGlobal("fetch", fetchMock)
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    fetchMock.mockReset()
  })

  const SIREN_EI = {
    uniteLegale: {
      siren: "801339748",
      prenom1UniteLegale: "OUASSIM",
      prenomUsuelUniteLegale: "OUASSIM",
      periodesUniteLegale: [
        {
          dateFin: null,
          nomUniteLegale: "BOUNEZOUR",
          denominationUniteLegale: null,
          categorieJuridiqueUniteLegale: "1000",
          etatAdministratifUniteLegale: "A",
          nicSiegeUniteLegale: "00031",
          activitePrincipaleUniteLegale: "43.22A",
        },
      ],
    },
  }
  const SIRET_SAS = {
    etablissement: {
      siren: "732829320",
      siret: "73282932000074",
      uniteLegale: {
        etatAdministratifUniteLegale: "A",
        denominationUniteLegale: "ISOLATION DU LITTORAL",
        categorieJuridiqueUniteLegale: "5710",
        activitePrincipaleUniteLegale: "43.29A",
      },
      adresseEtablissement: {
        numeroVoieEtablissement: "8",
        typeVoieEtablissement: "QUAI",
        libelleVoieEtablissement: "DES CHARTRONS",
        codePostalEtablissement: "33000",
        libelleCommuneEtablissement: "BORDEAUX",
      },
    },
  }
  const SIRET_EI = {
    etablissement: {
      siren: "801339748",
      siret: "80133974800031",
      uniteLegale: { nomUniteLegale: "BOUNEZOUR", prenomUsuelUniteLegale: "OUASSIM", categorieJuridiqueUniteLegale: "1000", etatAdministratifUniteLegale: "A" },
      adresseEtablissement: { numeroVoieEtablissement: "21", typeVoieEtablissement: "AVENUE", libelleVoieEtablissement: "BENOIT BARLET", codePostalEtablissement: "69330", libelleCommuneEtablissement: "MEYZIEU" },
    },
  }

  it("9 chiffres (espaces ignorés) : SIREN à l'INSEE, adresse du siège, prénom de l'entrepreneur", async () => {
    fetchMock.mockImplementation((url: string) =>
      url.endsWith("/siren/801339748") ? reply(200, SIREN_EI) : url.endsWith("/siret/80133974800031") ? reply(200, SIRET_EI) : reply(404),
    )
    expect(await searchCompanies("801 339 748")).toEqual({
      status: "ok",
      results: [
        {
          siren: "801339748",
          siret: "80133974800031",
          name: "OUASSIM BOUNEZOUR",
          first_name: "Ouassim",
          legal_form: "ei",
          company_type: null,
          legal_form_label: "Entrepreneur individuel",
          address: "21 AVENUE BENOIT BARLET",
          zip_code: "69330",
          city: "MEYZIEU",
          activity_code: "43.22A",
          closed: false,
        },
      ],
    })
    expect(String(fetchMock.mock.calls[0][0])).toContain("/siren/801339748")
  })

  it("14 chiffres : SIRET à l'INSEE, forme juridique de l'unité légale", async () => {
    fetchMock.mockImplementation((url: string) => (url.endsWith("/siret/73282932000074") ? reply(200, SIRET_SAS) : reply(404)))
    const o = await searchCompanies("732 829 320 00074")
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0][0])).toContain("/siret/73282932000074")
    expect(o).toEqual({
      status: "ok",
      results: [
        {
          siren: "732829320",
          siret: "73282932000074",
          name: "ISOLATION DU LITTORAL",
          legal_form: "societe",
          company_type: "SAS",
          legal_form_label: "SAS",
          address: "8 QUAI DES CHARTRONS",
          zip_code: "33000",
          city: "BORDEAUX",
          activity_code: "43.29A",
          closed: false,
        },
      ],
    })
  })

  it("repli sur l'API Recherche d'entreprises : catégorie et prénom lus aussi", async () => {
    fetchMock.mockImplementation((url: string) =>
      url.startsWith(RECHERCHE)
        ? reply(200, {
            results: [
              {
                siren: "801339748",
                nom_complet: "OUASSIM BOUNEZOUR (ACTIVE PLOMBIER)",
                nature_juridique: "1000",
                etat_administratif: "A",
                activite_principale: "43.22A",
                siege: { siret: "80133974800031", numero_voie: "21", type_voie: "AVENUE", libelle_voie: "BENOIT BARLET", code_postal: "69330", libelle_commune: "MEYZIEU" },
              },
            ],
          })
        : reply(503),
    )
    const o = await searchCompanies("801339748")
    expect(o.status === "ok" && o.results[0]).toMatchObject({ name: "OUASSIM BOUNEZOUR", first_name: "Ouassim", legal_form: "ei", city: "MEYZIEU" })
    // Les recherches par numéro existantes en profitent aussi
    expect(await searchBySiren("801339748")).toMatchObject({ legal_category: "1000", first_name: "Ouassim" })
  })

  it("introuvable : liste vide", async () => {
    fetchMock.mockImplementation(() => reply(404))
    expect(await searchCompanies("801339748")).toEqual({ status: "ok", results: [] })
  })

  it("les deux sources en panne : indisponible", async () => {
    fetchMock.mockImplementation(() => reply(503))
    expect(await searchCompanies("801339748")).toEqual({ status: "unavailable" })
  })

  it("réseau coupé : indisponible", async () => {
    fetchMock.mockImplementation(() => Promise.reject(new TypeError("fetch failed")))
    expect(await searchCompanies("80133974800031")).toEqual({ status: "unavailable" })
  })

  it("clé de contrôle fausse ou numéro incomplet : rien, sans requête", async () => {
    expect(await searchCompanies("801339749")).toEqual({ status: "ok", results: [] })
    expect(await searchCompanies("8013 3974")).toEqual({ status: "ok", results: [] })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe("GET /api/sirene/search", () => {
  const fetchMock = vi.fn()
  beforeEach(() => {
    vi.stubEnv("INSEE_API_KEY", "")
    vi.stubGlobal("fetch", fetchMock)
    mocks.user = { id: "user-1" }
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    fetchMock.mockReset()
  })

  async function get(q: string | null) {
    const { GET } = await import("@/app/api/sirene/search/route")
    const url = new URL("https://qonforme.fr/api/sirene/search")
    if (q !== null) url.searchParams.set("q", q)
    const res = await GET(new NextRequest(url))
    return { status: res.status, body: await res.json(), cache: res.headers.get("Cache-Control") }
  }

  it("compte non connecté : 401 en JSON, sans requête au répertoire", async () => {
    mocks.user = null
    expect(await get("garnier")).toMatchObject({ status: 401, body: { error: "Non authentifié" } })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("moins de 2 caractères : 400", async () => {
    expect(await get(" a ")).toMatchObject({ status: 400, body: { error: "Saisissez au moins 2 caractères." } })
    expect(await get(null)).toMatchObject({ status: 400 })
  })

  it("plus de 80 caractères : 400", async () => {
    expect((await get("a".repeat(81))).status).toBe(400)
  })

  it("SIREN dont la clé est fausse : 400", async () => {
    expect(await get("801 339 749")).toMatchObject({
      status: 400,
      body: { error: "Ce numéro ne correspond à aucun SIREN : vérifiez les 9 chiffres." },
    })
    expect((await get("80133974900031")).status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("recherche par nom : 200 avec la liste, jamais en cache", async () => {
    fetchMock.mockImplementation(() => reply(200, { results: [SARL] }))
    const r = await get("garnier")
    expect(r.status).toBe(200)
    expect(r.cache).toBe("no-store")
    expect(r.body.results).toHaveLength(1)
    expect(r.body.results[0]).toMatchObject({ siren: "948211370", legal_form_label: "SARL" })
  })

  it("rien trouvé : 200 avec une liste vide", async () => {
    fetchMock.mockImplementation(() => reply(200, { results: [], total_results: 0 }))
    expect(await get("801339748")).toMatchObject({ status: 200, body: { results: [] } })
  })

  it("répertoire injoignable : 503 avec le message de la fenêtre", async () => {
    fetchMock.mockImplementation(() => reply(502))
    expect(await get("garnier")).toMatchObject({
      status: 503,
      body: { error: "Le répertoire Sirene ne répond pas. Réessayez dans un instant ou saisissez votre entreprise à la main." },
    })
  })
})
