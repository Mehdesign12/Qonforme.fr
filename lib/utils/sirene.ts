import { SireneResult } from '@/types'
import { isValidSiren } from '@/lib/utils/invoice'
import { legalFromCategory } from '@/lib/legal/from-sirene'

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
 *
 * Recherche par nom (fenêtre d'inscription, `searchCompanies`) : API Recherche
 * d'entreprises seule (`/search?q=…&per_page=6`), qui cherche dans la
 * dénomination, le nom et le prénom des entrepreneurs individuels, les sigles et
 * les enseignes. Champs lus : `siren`, `nom_complet`, `nom_raison_sociale`,
 * `nature_juridique`, `activite_principale`, `etat_administratif`, `siege`
 * (adresse), `dirigeants` et `complements.est_entrepreneur_individuel`.
 */

const INSEE = 'https://api.insee.fr/api-sirene/3.11'
const RECHERCHE = 'https://recherche-entreprises.api.gouv.fr/search'
const TIMEOUT_MS = 8000

type Json = Record<string, unknown>

/** Résultat d'une source : trouvé, introuvable, ou source indisponible (on essaie la suivante). */
type Lookup = { found: SireneResult } | { notFound: true } | { unavailable: true }

/**
 * Donnée non diffusible (l'entrepreneur s'est opposé à la diffusion) : « [ND] »
 * à l'INSEE, « [NON-DIFFUSIBLE] » dans l'API Recherche d'entreprises, parfois au
 * milieu d'un nom composé (« [ND] DURAND »).
 */
const NON_DIFFUSIBLE = /\[(?:ND|NON[- ]DIFFUSIBLE)\]/gi

const str = (v: unknown): string => {
  if (typeof v !== 'string') return ''
  return v.replace(NON_DIFFUSIBLE, ' ').replace(/\s+/g, ' ').trim()
}

/** Catégorie juridique Sirene : 4 chiffres (« 1000 », « 5499 »), chaîne ou nombre selon la source. */
function categorie(v: unknown): string | undefined {
  const c = typeof v === 'number' ? String(v) : str(v)
  return /^\d{4}$/.test(c) ? c : undefined
}

/** « JEAN-PIERRE » → « Jean-Pierre » : le répertoire écrit les prénoms en capitales, sans accents. */
function prenomAffiche(v: string): string | undefined {
  const p = str(v)
  if (!p || p.length > 60) return undefined
  return p.toLowerCase().replace(/(^|[\s'’-])([a-zà-ÿ])/g, (_m, sep: string, l: string) => sep + l.toUpperCase())
}

/** Catégorie juridique, et prénom usuel quand c'est un entrepreneur individuel (catégorie 1000). */
function identite(cat: string | undefined, prenom: string | undefined): Pick<SireneResult, 'legal_category' | 'first_name'> {
  const first_name = cat === '1000' && prenom ? prenomAffiche(prenom) : undefined
  return {
    ...(cat ? { legal_category: cat } : {}),
    ...(first_name ? { first_name } : {}),
  }
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
      ...identite(categorie(ul.categorieJuridiqueUniteLegale), str(ul.prenomUsuelUniteLegale) || str(ul.prenom1UniteLegale)),
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
    // Catégorie historisée (période), prénoms à la racine
    ...identite(categorie(periode.categorieJuridiqueUniteLegale), str(ul.prenomUsuelUniteLegale) || str(ul.prenom1UniteLegale)),
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
  return str(r.nom_raison_sociale) || str(str(r.nom_complet).replace(/\s*\([^)]*\)\s*$/, ''))
}

/**
 * Prénom usuel d'un entrepreneur individuel, dont le nom se lit « PRÉNOM NOM ».
 * D'abord par les personnes physiques de `dirigeants` (prénoms ou nom qui
 * encadrent exactement le nom affiché), sinon seulement si le nom tient en deux
 * mots ; dans le doute (« JEAN DE LA FONTAINE »), aucun prénom.
 */
function prenomRecherche(r: Json, nom: string): string | undefined {
  const affiche = nom.toUpperCase()
  const personnes = (Array.isArray(r.dirigeants) ? (r.dirigeants as unknown[]) : [])
    .filter((d): d is Json => !!d && typeof d === 'object' && !str((d as Json).denomination) && !str((d as Json).siren))
  for (const p of personnes) {
    const prenoms = str(p.prenoms).toUpperCase()
    const essais = [prenoms, ...prenoms.split(/[\s,]+/)].filter(Boolean)
    const prenom = essais.find((x) => affiche.startsWith(`${x} `))
    if (prenom) return prenom
    const famille = str(p.nom).toUpperCase()
    if (famille && affiche.endsWith(` ${famille}`)) return affiche.slice(0, -famille.length - 1)
  }
  const mots = affiche.split(' ')
  return mots.length === 2 ? mots[0] : undefined
}

/** Fiche de l'API Recherche d'entreprises, avec l'adresse de l'établissement donné (le siège par défaut). */
function ficheRecherche(r: Json, etab: Json | undefined): SireneResult {
  const name = nomRecherche(r)
  const complements = r.complements as Json | undefined
  const cat = categorie(r.nature_juridique) ?? (complements?.est_entrepreneur_individuel === true ? '1000' : undefined)
  return {
    siren: str(r.siren),
    siret: str(etab?.siret) || undefined,
    name,
    ...adresseRecherche(etab),
    activity_code: str(r.activite_principale) || undefined,
    closed: str(r.etat_administratif) === 'C',
    ...identite(cat, cat === '1000' ? prenomRecherche(r, name) : undefined),
  }
}

async function recherche(numero: string): Promise<Lookup> {
  const { status, body } = await getJson(`${RECHERCHE}?q=${numero}&per_page=1`)
  if (!body) return { unavailable: true }
  const r = (body.results as Json[] | undefined)?.find((x) => str(x.siren) === numero.slice(0, 9))
  if (!r) return status === 200 ? { notFound: true } : { unavailable: true }
  // Fiche sans nom ni siège : numéro non attribué, pas une entreprise
  if (!nomRecherche(r) && !str((r.siege as Json | undefined)?.siret)) return { notFound: true }

  let etab = r.siege as Json | undefined
  if (numero.length === 14) {
    const match = (r.matching_etablissements as Json[] | undefined)?.find((x) => str(x.siret) === numero)
    if (!match && str(etab?.siret) !== numero) return { notFound: true }
    etab = match ?? etab
  }
  return { found: ficheRecherche(r, etab) }
}

/* ------------------------------------------------------------------ */
/* API publique du module                                              */
/* ------------------------------------------------------------------ */

/** Issue d'une recherche : une panne des deux sources n'est pas un « introuvable ». */
export type SireneOutcome =
  | { status: 'found'; result: SireneResult }
  | { status: 'notfound' }
  | { status: 'unavailable' }

async function chercher(numero: string, viaInsee: (h: Record<string, string>) => Promise<Lookup>): Promise<SireneOutcome> {
  const headers = inseeHeaders()
  if (headers) {
    try {
      const r = await viaInsee(headers)
      if ('found' in r) return { status: 'found', result: r.found }
      if ('notFound' in r) return { status: 'notfound' }
    } catch {
      // Réseau, délai dépassé : on passe au repli
    }
  }
  try {
    const r = await recherche(numero)
    if ('found' in r) return { status: 'found', result: r.found }
    return 'notFound' in r ? { status: 'notfound' } : { status: 'unavailable' }
  } catch {
    return { status: 'unavailable' }
  }
}

/** Entreprise par SIREN (9 chiffres), avec l'adresse de son siège. */
export function lookupSiren(siren: string): Promise<SireneOutcome> {
  return chercher(siren, (h) => inseeSiren(siren, h))
}

/** Établissement par SIRET (14 chiffres). */
export function lookupSiret(siret: string): Promise<SireneOutcome> {
  return chercher(siret, (h) => inseeSiret(siret, h))
}

/** Raccourcis : le résultat, ou null si introuvable ou indisponible. */
export async function searchBySiren(siren: string): Promise<SireneResult | null> {
  const o = await lookupSiren(siren)
  return o.status === 'found' ? o.result : null
}

export async function searchBySiret(siret: string): Promise<SireneResult | null> {
  const o = await lookupSiret(siret)
  return o.status === 'found' ? o.result : null
}

/* ------------------------------------------------------------------ */
/* Recherche par nom ou par numéro (fenêtre d'inscription)             */
/* ------------------------------------------------------------------ */

/** Entreprise proposée dans la liste de la fenêtre d'inscription. */
export interface SireneCandidate {
  /** 9 chiffres. */
  siren: string
  /** SIRET du siège. */
  siret?: string
  /** Dénomination, ou « PRÉNOM NOM » d'un entrepreneur individuel (sans « [ND] »). */
  name: string
  /** Entrepreneur individuel seulement : prénom usuel (« Thomas »), pour préremplir l'étape Prénom. */
  first_name?: string
  /** D'après la catégorie juridique (1000 = entrepreneur individuel), voir lib/legal/from-sirene.ts. */
  legal_form: 'ei' | 'societe' | null
  /** « SARL », « EURL », « SAS », « SASU », « SA », « SNC », ou null. */
  company_type: string | null
  /** Libellé court affiché : « Entrepreneur individuel », « SARL », « Société »… */
  legal_form_label: string
  address: string
  zip_code: string
  city: string
  /** Code APE, ex. « 43.31Z ». */
  activity_code?: string
  /** Entreprise fermée : affichée grisée, jamais choisie. */
  closed: boolean
}

/** Issue d'une recherche : liste (vide si rien), ou répertoire indisponible (panne, délai, quota). */
export type SireneSearchOutcome = { status: 'ok'; results: SireneCandidate[] } | { status: 'unavailable' }

/** Nombre de résultats d'une recherche par nom. */
export const SIRENE_SEARCH_LIMIT = 6

/** Saisie nettoyée : forme NFC, sans caractère de contrôle, espaces normalisés. */
export function cleanSireneQuery(query: string): string {
  return Array.from(query.normalize('NFC'))
    .map((ch) => (ch.charCodeAt(0) < 32 || ch.charCodeAt(0) === 127 ? ' ' : ch))
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
}

function versCandidat(r: SireneResult): SireneCandidate | null {
  const name = str(r.name)
  // Sans nom (fiche non diffusible), l'entreprise ne peut pas être choisie
  if (!/^\d{9}$/.test(r.siren) || !name) return null
  const legal = legalFromCategory(r.legal_category)
  return {
    siren: r.siren,
    ...(r.siret && /^\d{14}$/.test(r.siret) ? { siret: r.siret } : {}),
    name,
    ...(legal.legal_form === 'ei' && r.first_name ? { first_name: r.first_name } : {}),
    legal_form: legal.legal_form,
    company_type: legal.company_type,
    legal_form_label: legal.label,
    address: r.address,
    zip_code: r.zip_code,
    city: r.city,
    ...(r.activity_code ? { activity_code: r.activity_code } : {}),
    closed: r.closed === true,
  }
}

async function rechercheParNom(q: string): Promise<SireneSearchOutcome> {
  let reponse: { status: number; body: Json | null }
  try {
    reponse = await getJson(`${RECHERCHE}?q=${encodeURIComponent(q)}&per_page=${SIRENE_SEARCH_LIMIT}`)
  } catch {
    // Réseau, délai dépassé, réponse illisible
    return { status: 'unavailable' }
  }
  const { status, body } = reponse
  if (!body) {
    // Délai, quota dépassé (429) ou panne : indisponible. Requête refusée
    // (texte trop court, caractères non admis) : aucun résultat.
    return status === 408 || status === 429 || status >= 500 ? { status: 'unavailable' } : { status: 'ok', results: [] }
  }
  if (!Array.isArray(body.results)) return { status: 'unavailable' }

  const vus = new Set<string>()
  const results: SireneCandidate[] = []
  for (const r of body.results as unknown[]) {
    if (!r || typeof r !== 'object') continue
    const c = versCandidat(ficheRecherche(r as Json, (r as Json).siege as Json | undefined))
    if (!c || vus.has(c.siren)) continue
    vus.add(c.siren)
    results.push(c)
  }
  // Entreprises fermées en fin de liste (ordre de pertinence conservé sinon)
  const ouvertes = results.filter((c) => !c.closed)
  const fermees = results.filter((c) => c.closed)
  return { status: 'ok', results: [...ouvertes, ...fermees].slice(0, SIRENE_SEARCH_LIMIT) }
}

/**
 * Recherche d'une entreprise pour l'inscription. Chiffres seuls (espaces
 * ignorés) : 9 → SIREN, 14 → SIRET, par les mêmes sources que `lookupSiren` /
 * `lookupSiret` (INSEE puis repli) ; un numéro incomplet ou dont la clé est
 * fausse ne trouve rien. Sinon, recherche par nom (API Recherche d'entreprises).
 */
export async function searchCompanies(query: string): Promise<SireneSearchOutcome> {
  const q = cleanSireneQuery(query)
  const numero = q.replace(/\s/g, '')
  if (/^\d+$/.test(numero)) {
    if ((numero.length !== 9 && numero.length !== 14) || !isValidSiren(numero.slice(0, 9))) {
      return { status: 'ok', results: [] }
    }
    const o = numero.length === 9 ? await lookupSiren(numero) : await lookupSiret(numero)
    if (o.status === 'unavailable') return { status: 'unavailable' }
    const c = o.status === 'found' ? versCandidat(o.result) : null
    return { status: 'ok', results: c ? [c] : [] }
  }
  if (q.length < 2) return { status: 'ok', results: [] }
  return rechercheParNom(q)
}
