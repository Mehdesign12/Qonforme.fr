import { SireneResult } from '@/types'

/**
 * Recherche d'entreprise au répertoire Sirene.
 *
 * Source principale : API Sirene 3.11 de l'INSEE (clé INSEE_API_KEY, côté serveur
 * uniquement). Repli : API Recherche d'entreprises de l'État
 * (https://recherche-entreprises.api.gouv.fr, sans clé) quand l'INSEE est
 * injoignable, refuse la clé ou n'est pas configurée. Un « introuvable » de
 * l'INSEE (404) reste un introuvable : pas de repli.
 *
 * Formes des réponses INSEE :
 * - /siren/{siren} : `uniteLegale` porte les champs non historisés (prénoms) à la
 *   racine et les champs historisés (nom, dénomination, état, NIC du siège) dans
 *   `periodesUniteLegale`, la période en cours en premier ;
 * - /siret/{siret} : `etablissement.uniteLegale` est à plat (valeurs courantes),
 *   sans `periodesUniteLegale`.
 */

const INSEE = 'https://api.insee.fr/api-sirene/3.11'
const RECHERCHE = 'https://recherche-entreprises.api.gouv.fr/search'
const TIMEOUT_MS = 8000

type Json = Record<string, unknown>

/** Résultat d'une source : trouvé, introuvable, ou source indisponible (on essaie la suivante). */
type Lookup = { found: SireneResult } | { notFound: true } | { unavailable: true }

const str = (v: unknown): string => {
  if (typeof v !== 'string') return ''
  const s = v.trim()
  // « [ND] » : donnée non diffusible (l'entrepreneur s'est opposé à la diffusion)
  return s === '[ND]' ? '' : s
}

/** Nom d'une unité légale : dénomination d'une société, prénom et nom d'un entrepreneur individuel. */
export function nomUniteLegale(u: Json): string {
  const denomination = str(u.denominationUniteLegale)
  if (denomination) return denomination
  const prenom = str(u.prenomUsuelUniteLegale) || str(u.prenom1UniteLegale)
  const nom = str(u.nomUsageUniteLegale) || str(u.nomUniteLegale)
  return [prenom, nom].filter(Boolean).join(' ')
}

/** Adresse postale (sans code postal ni commune) d'un établissement INSEE. */
function adresseInsee(a: Json | undefined): Pick<SireneResult, 'address' | 'zip_code' | 'city'> {
  if (!a) return { address: '', zip_code: '', city: '' }
  const voie = [
    str(a.numeroVoieEtablissement),
    str(a.indiceRepetitionEtablissement),
    str(a.typeVoieEtablissement),
    str(a.libelleVoieEtablissement),
  ].filter(Boolean).join(' ')
  return {
    address: voie || str(a.complementAdresseEtablissement),
    zip_code: str(a.codePostalEtablissement),
    city: str(a.libelleCommuneEtablissement),
  }
}

async function getJson(url: string, headers: Record<string, string> = {}): Promise<{ status: number; body: Json | null }> {
  const res = await fetch(url, {
    headers: { Accept: 'application/json', ...headers },
    cache: 'no-store',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  const body = res.ok ? ((await res.json()) as Json) : null
  return { status: res.status, body }
}

/* ------------------------------------------------------------------ */
/* INSEE                                                               */
/* ------------------------------------------------------------------ */

function inseeHeaders(): Record<string, string> | null {
  const key = process.env.INSEE_API_KEY
  return key ? { 'X-INSEE-Api-Key-Integration': key } : null
}

/** 404 : introuvable ; 403 : non diffusible, traité comme introuvable ; le reste : source indisponible. */
function inseeEchec(status: number): Lookup {
  return status === 404 || status === 403 ? { notFound: true } : { unavailable: true }
}

async function inseeSiret(siret: string, headers: Record<string, string>): Promise<Lookup> {
  const { status, body } = await getJson(`${INSEE}/siret/${siret}`, headers)
  const etab = body?.etablissement as Json | undefined
  if (!etab) return inseeEchec(status)
  const ul = (etab.uniteLegale ?? {}) as Json
  return {
    found: {
      siren: siret.slice(0, 9),
      siret,
      name: nomUniteLegale(ul),
      ...adresseInsee(etab.adresseEtablissement as Json | undefined),
      activity_code: str(ul.activitePrincipaleUniteLegale) || undefined,
      closed: str(ul.etatAdministratifUniteLegale) === 'C',
    },
  }
}

async function inseeSiren(siren: string, headers: Record<string, string>): Promise<Lookup> {
  const { status, body } = await getJson(`${INSEE}/siren/${siren}`, headers)
  const ul = body?.uniteLegale as Json | undefined
  if (!ul) return inseeEchec(status)
  const periode = ((ul.periodesUniteLegale as Json[] | undefined)?.[0] ?? {}) as Json
  // Champs non historisés à la racine (prénoms), historisés dans la période en cours
  const result: SireneResult = {
    siren,
    name: nomUniteLegale({ ...ul, ...periode }),
    address: '',
    zip_code: '',
    city: '',
    activity_code: str(periode.activitePrincipaleUniteLegale) || undefined,
    closed: str(periode.etatAdministratifUniteLegale) === 'C',
  }
  // L'adresse est celle du siège : un second appel sur son SIRET
  const nic = str(periode.nicSiegeUniteLegale)
  if (nic) {
    try {
      const siege = await inseeSiret(`${siren}${nic}`, headers)
      if ('found' in siege) {
        const { address, zip_code, city } = siege.found
        Object.assign(result, { siret: `${siren}${nic}`, address, zip_code, city })
      }
    } catch {
      // Sans adresse, la raison sociale reste utile
    }
  }
  return { found: result }
}

/* ------------------------------------------------------------------ */
/* Recherche d'entreprises (api.gouv.fr)                               */
/* ------------------------------------------------------------------ */

function adresseRecherche(e: Json | undefined): Pick<SireneResult, 'address' | 'zip_code' | 'city'> {
  if (!e) return { address: '', zip_code: '', city: '' }
  const zip_code = str(e.code_postal)
  const city = str(e.libelle_commune)
  const voie = [str(e.numero_voie), str(e.indice_repetition), str(e.type_voie), str(e.libelle_voie)].filter(Boolean).join(' ')
  // Les établissements trouvés par SIRET n'ont que l'adresse complète : « 21 AVENUE X 69330 MEYZIEU »
  const complete = str(e.adresse)
  const suffixe = ` ${zip_code} ${city}`
  const deduite = zip_code && complete.endsWith(suffixe) ? complete.slice(0, -suffixe.length) : ''
  return { address: voie || deduite || str(e.complement_adresse), zip_code, city }
}

/** Nom d'une entreprise : `nom_complet` sans le sigle ou l'enseigne ajoutés entre parenthèses. */
function nomRecherche(r: Json): string {
  return str(r.nom_raison_sociale) || str(r.nom_complet).replace(/\s*\([^)]*\)\s*$/, '')
}

async function recherche(numero: string): Promise<Lookup> {
  const { status, body } = await getJson(`${RECHERCHE}?q=${numero}&per_page=1`)
  if (!body) return { unavailable: true }
  const r = (body.results as Json[] | undefined)?.find((x) => str(x.siren) === numero.slice(0, 9))
  if (!r) return status === 200 ? { notFound: true } : { unavailable: true }

  let etab = r.siege as Json | undefined
  if (numero.length === 14) {
    const match = (r.matching_etablissements as Json[] | undefined)?.find((x) => str(x.siret) === numero)
    if (!match && str(etab?.siret) !== numero) return { notFound: true }
    etab = match ?? etab
  }
  return {
    found: {
      siren: str(r.siren),
      siret: str(etab?.siret) || undefined,
      name: nomRecherche(r),
      ...adresseRecherche(etab),
      activity_code: str(r.activite_principale) || undefined,
      closed: str(r.etat_administratif) === 'C',
    },
  }
}

/* ------------------------------------------------------------------ */
/* API publique du module                                              */
/* ------------------------------------------------------------------ */

async function chercher(numero: string, viaInsee: (h: Record<string, string>) => Promise<Lookup>): Promise<SireneResult | null> {
  const headers = inseeHeaders()
  if (headers) {
    try {
      const r = await viaInsee(headers)
      if ('found' in r) return r.found
      if ('notFound' in r) return null
    } catch {
      // Réseau, délai dépassé : on passe au repli
    }
  }
  try {
    const r = await recherche(numero)
    return 'found' in r ? r.found : null
  } catch {
    return null
  }
}

/** Entreprise par SIREN (9 chiffres), avec l'adresse de son siège. */
export function searchBySiren(siren: string): Promise<SireneResult | null> {
  return chercher(siren, (h) => inseeSiren(siren, h))
}

/** Établissement par SIRET (14 chiffres). */
export function searchBySiret(siret: string): Promise<SireneResult | null> {
  return chercher(siret, (h) => inseeSiret(siret, h))
}
