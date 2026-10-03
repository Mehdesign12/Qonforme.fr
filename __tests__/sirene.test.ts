import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { nomUniteLegale, searchBySiren, searchBySiret } from "@/lib/utils/sirene"

/**
 * Réponses calquées sur l'API Sirene 3.11 de l'INSEE : prénoms à la racine de
 * `uniteLegale`, nom et NIC du siège dans la période en cours (/siren) ;
 * `etablissement.uniteLegale` à plat (/siret). Sans ces règles, la production
 * renvoyait « BOUNEZOUR » sans prénom, aucune adresse par SIREN et un nom vide par SIRET.
 */
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
        etatAdministratifUniteLegale: "A",
        nicSiegeUniteLegale: "00031",
        activitePrincipaleUniteLegale: "43.22A",
      },
    ],
  },
}

const SIRET_EI = {
  etablissement: {
    siren: "801339748",
    siret: "80133974800031",
    uniteLegale: {
      etatAdministratifUniteLegale: "A",
      nomUniteLegale: "BOUNEZOUR",
      prenom1UniteLegale: "OUASSIM",
      prenomUsuelUniteLegale: "OUASSIM",
      denominationUniteLegale: null,
      activitePrincipaleUniteLegale: "43.22A",
    },
    adresseEtablissement: {
      numeroVoieEtablissement: "21",
      indiceRepetitionEtablissement: null,
      typeVoieEtablissement: "AVENUE",
      libelleVoieEtablissement: "BENOIT BARLET",
      codePostalEtablissement: "69330",
      libelleCommuneEtablissement: "MEYZIEU",
    },
  },
}

function reply(status: number, body?: unknown) {
  return Promise.resolve(new Response(body === undefined ? null : JSON.stringify(body), { status }))
}

describe("nomUniteLegale", () => {
  it("dénomination d'une société", () => {
    expect(nomUniteLegale({ denominationUniteLegale: "MICHELIN", nomUniteLegale: "X" })).toBe("MICHELIN")
  })
  it("prénom usuel et nom d'usage d'un entrepreneur individuel", () => {
    expect(nomUniteLegale({ prenom1UniteLegale: "MARIE", prenomUsuelUniteLegale: "MARIE", nomUniteLegale: "DURAND", nomUsageUniteLegale: "MARTIN" })).toBe("MARIE MARTIN")
  })
  it("ignore les données non diffusibles", () => {
    expect(nomUniteLegale({ nomUniteLegale: "[ND]", prenom1UniteLegale: "[ND]" })).toBe("")
  })
})

describe("recherche Sirene via l'INSEE", () => {
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

  it("SIREN d'un entrepreneur individuel : prénom, nom et adresse du siège", async () => {
    fetchMock.mockImplementation((url: string) =>
      url.endsWith("/siren/801339748") ? reply(200, SIREN_EI) : url.endsWith("/siret/80133974800031") ? reply(200, SIRET_EI) : reply(404),
    )
    const r = await searchBySiren("801339748")
    expect(r).toEqual({
      siren: "801339748",
      siret: "80133974800031",
      name: "OUASSIM BOUNEZOUR",
      address: "21 AVENUE BENOIT BARLET",
      zip_code: "69330",
      city: "MEYZIEU",
      activity_code: "43.22A",
      closed: false,
    })
    // La clé part dans l'en-tête de l'INSEE, jamais ailleurs
    expect(fetchMock.mock.calls[0][1].headers["X-INSEE-Api-Key-Integration"]).toBe("cle-de-test")
  })

  it("SIRET : nom lu dans l'unité légale à plat", async () => {
    fetchMock.mockImplementation(() => reply(200, SIRET_EI))
    const r = await searchBySiret("80133974800031")
    expect(r?.name).toBe("OUASSIM BOUNEZOUR")
    expect(r?.address).toBe("21 AVENUE BENOIT BARLET")
  })

  it("entreprise cessée signalée", async () => {
    const cessee = structuredClone(SIREN_EI)
    cessee.uniteLegale.periodesUniteLegale[0].etatAdministratifUniteLegale = "C"
    fetchMock.mockImplementation((url: string) => (url.includes("/siren/") ? reply(200, cessee) : reply(200, SIRET_EI)))
    expect((await searchBySiren("801339748"))?.closed).toBe(true)
  })

  it("introuvable à l'INSEE : pas de repli, résultat nul", async () => {
    fetchMock.mockImplementation(() => reply(404))
    expect(await searchBySiren("801339748")).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("adresse du siège indisponible : la raison sociale reste", async () => {
    fetchMock.mockImplementation((url: string) => (url.includes("/siren/") ? reply(200, SIREN_EI) : reply(500)))
    const r = await searchBySiren("801339748")
    expect(r?.name).toBe("OUASSIM BOUNEZOUR")
    expect(r?.address).toBe("")
  })

  it("clé refusée (401) : repli sur l'API Recherche d'entreprises", async () => {
    fetchMock.mockImplementation((url: string) =>
      url.startsWith("https://recherche-entreprises.api.gouv.fr/")
        ? reply(200, {
            results: [
              {
                siren: "801339748",
                nom_complet: "OUASSIM BOUNEZOUR (ACTIVE PLOMBIER)",
                nom_raison_sociale: null,
                etat_administratif: "A",
                activite_principale: "43.22A",
                siege: { siret: "80133974800031", numero_voie: "21", type_voie: "AVENUE", libelle_voie: "BENOIT BARLET", code_postal: "69330", libelle_commune: "MEYZIEU" },
              },
            ],
          })
        : reply(401),
    )
    const r = await searchBySiren("801339748")
    expect(r?.name).toBe("OUASSIM BOUNEZOUR")
    expect(r?.city).toBe("MEYZIEU")
  })
})

describe("recherche Sirene : panne et numéro non attribué", () => {
  const fetchMock = vi.fn()
  beforeEach(() => {
    vi.stubEnv("INSEE_API_KEY", "")
    vi.stubGlobal("fetch", fetchMock)
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    fetchMock.mockReset()
  })

  it("les deux sources indisponibles : « indisponible », pas « introuvable »", async () => {
    const { lookupSiren } = await import("@/lib/utils/sirene")
    fetchMock.mockImplementation(() => reply(503))
    expect(await lookupSiren("801339748")).toEqual({ status: "unavailable" })
  })

  it("fiche vide de l'annuaire : introuvable", async () => {
    const { lookupSiren } = await import("@/lib/utils/sirene")
    fetchMock.mockImplementation(() => reply(200, { results: [{ siren: "123456782", nom_complet: "", siege: {} }] }))
    expect(await lookupSiren("123456782")).toEqual({ status: "notfound" })
  })
})
