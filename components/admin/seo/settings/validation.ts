/**
 * Aides des formulaires de Paramètres (onglet SEO), utilisables dans le
 * navigateur : lib/seo/settings.ts importe l'accès à la base (serveur
 * seulement), on ne peut donc pas y lire les schémas côté client.
 *
 * Les règles reprennent celles des schémas zod de lib/seo/settings.ts ; les
 * tests (__tests__/seo-settings-validation.test.ts) vérifient qu'elles
 * donnent le même verdict. Le serveur revalide toujours.
 */

/** Une ligne par élément : lignes coupées, espaces retirés, lignes vides ignorées. */
export function linesToList(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
}

export function listToLines(list: string[]): string {
  return list.join("\n")
}

/** Même normalisation que le schéma `domain` : sans protocole, sans www, sans chemin, en minuscules. */
export function normalizeDomain(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "")
}

const DOMAIN_RE = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/

/** Message d'erreur d'un concurrent saisi, ou null s'il est valide. */
export function competitorError(input: string, current: string[], max: number): string | null {
  const domain = normalizeDomain(input)
  if (!domain) return "Saisissez le domaine du site, par exemple exemple.fr"
  if (!DOMAIN_RE.test(domain)) return "Domaine attendu, par exemple exemple.fr"
  if (current.includes(domain)) return "Ce domaine est déjà suivi"
  if (current.length >= max) return `${max} concurrents au maximum`
  return null
}

/** Code pays ISO 3166-1 alpha-2 (« fr » → « FR ») ; null si la saisie n'en est pas un. */
export function countryCodeOf(input: string): string | null {
  const code = input.trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(code)) return null
  return code
}

let regionNames: Intl.DisplayNames | null | undefined

/** Nom français d'un pays (« FR » → « France ») ; le code s'il est inconnu. */
export function countryName(code: string): string {
  if (regionNames === undefined) {
    try {
      regionNames = new Intl.DisplayNames(["fr"], { type: "region" })
    } catch {
      regionNames = null
    }
  }
  try {
    return regionNames?.of(code) ?? code
  } catch {
    return code
  }
}

/**
 * Codes de région connus du navigateur qui ne sont pas des pays
 * (Union européenne, zone euro, ONU, pseudo-régions, territoires réservés).
 */
const NOT_COUNTRIES = ["AC", "CP", "DG", "EA", "EU", "EZ", "IC", "QO", "TA", "UN", "XA", "XB", "ZZ"]

/** Vrai si le code désigne un pays connu (le nom diffère du code, hors régions qui ne sont pas des pays). */
export function isKnownCountry(code: string): boolean {
  return /^[A-Z]{2}$/.test(code) && !NOT_COUNTRIES.includes(code) && countryName(code) !== code
}

/** Texte comparable : sans accents ni casse, apostrophes, tirets et points remplacés par une espace. */
export function foldCountryText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’'`´\-‐–—.]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/** Code actuel d'un code retiré (« UK » → « GB », « SU » → « RU », « FX » → « FR ») ; le code lui-même sinon. */
export function canonicalCountry(code: string): string {
  try {
    const region = Intl.getCanonicalLocales(`und-${code}`)[0]?.split("-")[1]
    return region && /^[A-Z]{2}$/.test(region) ? region : code
  } catch {
    return code
  }
}

let countryIndex: Map<string, string> | null = null

/** Variantes d'un nom replié : sans article (« la reunion »), sans espaces (« vietnam »), parties entre parenthèses (« birmanie »). */
function nameVariants(folded: string): string[] {
  const out: string[] = []
  const paren = folded.match(/^(.*?)\s*\((.*)\)$/)
  const bases = paren ? [paren[1].trim(), paren[2].trim()] : [folded]
  bases.forEach((base) => {
    const bare = base.replace(/^(la|le|les|l) /, "")
    out.push(base, bare, bare.replace(/ /g, ""))
  })
  return out.filter(Boolean)
}

/**
 * Index « nom français replié » → code, bâti une fois sur les 676 codes
 * possibles (codes actuels seulement). Les noms complets passent avant les
 * variantes ; à nom égal, le premier code l'emporte.
 */
function countriesByName(): Map<string, string> {
  if (countryIndex) return countryIndex
  const index = new Map<string, string>()
  const entries: { code: string; name: string }[] = []
  for (let a = 65; a <= 90; a++) {
    for (let b = 65; b <= 90; b++) {
      const code = String.fromCharCode(a, b)
      if (isKnownCountry(code) && canonicalCountry(code) === code) entries.push({ code, name: foldCountryText(countryName(code)) })
    }
  }
  entries.forEach(({ code, name }) => {
    if (!index.has(name)) index.set(name, code)
  })
  entries.forEach(({ code, name }) =>
    nameVariants(name).forEach((variant) => {
      if (!index.has(variant)) index.set(variant, code)
    }),
  )
  countryIndex = index
  return index
}

/**
 * Pays saisi → code ISO 3166-1 alpha-2 : un nom en français (« Allemagne »,
 * « etats-unis », « Côte d'Ivoire », sans tenir compte des accents ni de la
 * casse) ou un code à deux lettres (« ch » ; un code retiré donne le code
 * actuel). Correspondance exacte seulement : une saisie inconnue rend null,
 * jamais un autre pays.
 */
export function resolveCountry(input: string): string | null {
  const raw = input.trim()
  if (!raw) return null
  const code = countryCodeOf(raw)
  if (code) {
    const current = canonicalCountry(code)
    return isKnownCountry(current) ? current : null
  }
  const folded = foldCountryText(raw)
  const index = countriesByName()
  return index.get(folded) ?? index.get(folded.replace(/ /g, "")) ?? null
}

/** Adresse d'une source de preuve : vide, ou URL http(s) valide (500 caractères au plus). */
export function proofUrlError(url: string): string | null {
  const v = url.trim()
  if (!v) return null
  if (v.length > 500) return "Adresse trop longue (500 caractères au plus)"
  try {
    const u = new URL(v)
    if (u.protocol !== "https:" && u.protocol !== "http:") return "Adresse de la source invalide"
    return null
  } catch {
    return "Adresse de la source invalide"
  }
}

export interface ProofDraft {
  claim: string
  source: string
  url: string
}

/** Erreurs d'une preuve (mêmes règles que le schéma : affirmation et source obligatoires). */
export function proofErrors(proof: ProofDraft): Partial<Record<keyof ProofDraft, string>> {
  const out: Partial<Record<keyof ProofDraft, string>> = {}
  if (!proof.claim.trim()) out.claim = "L'affirmation est obligatoire"
  else if (proof.claim.trim().length > 300) out.claim = "300 caractères au plus"
  if (!proof.source.trim()) out.source = "La source est obligatoire"
  else if (proof.source.trim().length > 200) out.source = "200 caractères au plus"
  const url = proofUrlError(proof.url)
  if (url) out.url = url
  return out
}

/** Lien sûr à ouvrir depuis une preuve (http ou https seulement). */
export function safeExternalUrl(url: string): string | null {
  return proofUrlError(url) === null && url.trim() ? url.trim() : null
}

/** Comparaison profonde de valeurs JSON (détection des modifications). */
export function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/** Sous-objet limité à `keys`. */
export function pick<T extends object, K extends keyof T>(obj: T, keys: readonly K[]): Pick<T, K> {
  const out = {} as Pick<T, K>
  keys.forEach((k) => {
    out[k] = obj[k]
  })
  return out
}

/**
 * Première erreur d'un champ dans les erreurs du serveur : le champ lui-même
 * ou l'un de ses éléments (« benefits.2 » → « Ligne 3 : … » pour une liste).
 */
export function errorFor(errors: Record<string, string>, field: string, listLabel?: string): string | null {
  if (errors[field]) return errors[field]
  const prefix = `${field}.`
  const hit = Object.keys(errors).find((k) => k.startsWith(prefix))
  if (!hit) return null
  const index = Number(hit.slice(prefix.length).split(".")[0])
  return listLabel && Number.isInteger(index) ? `${listLabel} ${index + 1} : ${errors[hit]}` : errors[hit]
}

/** Erreurs du serveur sans celles des champs donnés (le champ vient d'être modifié). */
export function withoutErrors(errors: Record<string, string>, fields: string[]): Record<string, string> {
  const out: Record<string, string> = {}
  Object.entries(errors).forEach(([k, v]) => {
    if (!fields.some((f) => k === f || k.startsWith(`${f}.`))) out[k] = v
  })
  return out
}

/**
 * Liste saisie « une ligne par élément » : nombre de lignes et longueur de
 * chaque ligne, avec un message en français (le serveur revalide).
 */
export function linesError(lines: string[], opts: { max: number; maxLength: number; noun: string }): string | null {
  if (lines.length > opts.max) return `${opts.max} ${opts.noun} au maximum (une ligne par élément)`
  const tooLong = lines.findIndex((l) => l.length > opts.maxLength)
  if (tooLong >= 0) return `Ligne ${tooLong + 1} : ${opts.maxLength} caractères au plus`
  return null
}
