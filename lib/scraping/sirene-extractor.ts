/**
 * Extracteur massif de prospects via l'API Sirene v3.11 (INSEE)
 *
 * Utilise l'endpoint de RECHERCHE (pas les lookups individuels de lib/utils/sirene.ts)
 * pour extraire en masse les établissements TPE par code NAF.
 *
 * Endpoint : GET https://api.insee.fr/entreprises/sirene/V3.11/siret
 * Auth     : Bearer {INSEE_API_KEY}
 * Rate     : 30 req/min → pause 2s entre chaque requête
 * Max      : 1000 résultats par page (param `nombre`)
 */

import { createAdminClient } from "@/lib/supabase/server"
import { NAF_MAPPING, resolveMetier, type NafEntry } from "./naf-mapping"

// ── Types ──────────────────────────────────────────────────────────────────────

interface SireneEtablissement {
  siren: string
  siret: string
  uniteLegale?: {
    denominationUniteLegale?: string
    prenomUsuelUniteLegale?: string
    nomUniteLegale?: string
    prenom1UniteLegale?: string
    dateCreationUniteLegale?: string
    trancheEffectifsUniteLegale?: string
  }
  adresseEtablissement?: {
    numeroVoieEtablissement?: string
    typeVoieEtablissement?: string
    libelleVoieEtablissement?: string
    codePostalEtablissement?: string
    libelleCommuneEtablissement?: string
    codeCommuneEtablissement?: string
  }
  periodesEtablissement?: Array<{
    activitePrincipaleEtablissement?: string
    etatAdministratifEtablissement?: string
    denominationUsuelleEtablissement?: string
  }>
}

interface SireneSearchResponse {
  header: {
    total: number
    debut: number
    nombre: number
  }
  etablissements?: SireneEtablissement[]
}

export interface ProspectInsert {
  siren: string
  siret: string
  nom_entreprise: string
  nom_dirigeant: string | null
  activite: string | null
  code_naf: string
  metier_qonforme: string
  adresse: string | null
  code_postal: string | null
  ville: string | null
  departement: string | null
  region: string | null
  date_creation: string | null
  tranche_effectif: string | null
}

export interface ScrapingRunResult {
  runId: string
  metier: string
  codeNaf: string
  totalFound: number
  totalInserted: number
  totalSkipped: number
  durationMs: number
  error?: string
}

// ── Mapping département → région ───────────────────────────────────────────────

const DEPT_TO_REGION: Record<string, string> = {
  "01": "Auvergne-Rhône-Alpes", "03": "Auvergne-Rhône-Alpes", "07": "Auvergne-Rhône-Alpes",
  "15": "Auvergne-Rhône-Alpes", "26": "Auvergne-Rhône-Alpes", "38": "Auvergne-Rhône-Alpes",
  "42": "Auvergne-Rhône-Alpes", "43": "Auvergne-Rhône-Alpes", "63": "Auvergne-Rhône-Alpes",
  "69": "Auvergne-Rhône-Alpes", "73": "Auvergne-Rhône-Alpes", "74": "Auvergne-Rhône-Alpes",
  "21": "Bourgogne-Franche-Comté", "25": "Bourgogne-Franche-Comté", "39": "Bourgogne-Franche-Comté",
  "58": "Bourgogne-Franche-Comté", "70": "Bourgogne-Franche-Comté", "71": "Bourgogne-Franche-Comté",
  "89": "Bourgogne-Franche-Comté", "90": "Bourgogne-Franche-Comté",
  "22": "Bretagne", "29": "Bretagne", "35": "Bretagne", "56": "Bretagne",
  "18": "Centre-Val de Loire", "28": "Centre-Val de Loire", "36": "Centre-Val de Loire",
  "37": "Centre-Val de Loire", "41": "Centre-Val de Loire", "45": "Centre-Val de Loire",
  "2A": "Corse", "2B": "Corse",
  "08": "Grand Est", "10": "Grand Est", "51": "Grand Est", "52": "Grand Est",
  "54": "Grand Est", "55": "Grand Est", "57": "Grand Est", "67": "Grand Est", "68": "Grand Est", "88": "Grand Est",
  "02": "Hauts-de-France", "59": "Hauts-de-France", "60": "Hauts-de-France",
  "62": "Hauts-de-France", "80": "Hauts-de-France",
  "75": "Île-de-France", "77": "Île-de-France", "78": "Île-de-France", "91": "Île-de-France",
  "92": "Île-de-France", "93": "Île-de-France", "94": "Île-de-France", "95": "Île-de-France",
  "14": "Normandie", "27": "Normandie", "50": "Normandie", "61": "Normandie", "76": "Normandie",
  "16": "Nouvelle-Aquitaine", "17": "Nouvelle-Aquitaine", "19": "Nouvelle-Aquitaine",
  "23": "Nouvelle-Aquitaine", "24": "Nouvelle-Aquitaine", "33": "Nouvelle-Aquitaine",
  "40": "Nouvelle-Aquitaine", "47": "Nouvelle-Aquitaine", "64": "Nouvelle-Aquitaine",
  "79": "Nouvelle-Aquitaine", "86": "Nouvelle-Aquitaine", "87": "Nouvelle-Aquitaine",
  "09": "Occitanie", "11": "Occitanie", "12": "Occitanie", "30": "Occitanie",
  "31": "Occitanie", "32": "Occitanie", "34": "Occitanie", "46": "Occitanie",
  "48": "Occitanie", "65": "Occitanie", "66": "Occitanie", "81": "Occitanie", "82": "Occitanie",
  "44": "Pays de la Loire", "49": "Pays de la Loire", "53": "Pays de la Loire",
  "72": "Pays de la Loire", "85": "Pays de la Loire",
  "04": "Provence-Alpes-Côte d'Azur", "05": "Provence-Alpes-Côte d'Azur",
  "06": "Provence-Alpes-Côte d'Azur", "13": "Provence-Alpes-Côte d'Azur",
  "83": "Provence-Alpes-Côte d'Azur", "84": "Provence-Alpes-Côte d'Azur",
  "971": "Guadeloupe", "972": "Martinique", "973": "Guyane",
  "974": "La Réunion", "976": "Mayotte",
}

// ── Utilitaires ────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getDepartement(codePostal: string | undefined): string | null {
  if (!codePostal) return null
  // Corse : 20xxx → 2A ou 2B (simplifié → "20")
  // DOM : 97x
  if (codePostal.startsWith("97")) return codePostal.substring(0, 3)
  return codePostal.substring(0, 2)
}

function getRegion(dept: string | null): string | null {
  if (!dept) return null
  return DEPT_TO_REGION[dept] ?? null
}

// ── Transformation Sirene → Prospect ───────────────────────────────────────────

function transformSireneToProspect(
  etab: SireneEtablissement,
  metierSlug: string,
  codeNaf: string,
): ProspectInsert {
  const ul = etab.uniteLegale
  const addr = etab.adresseEtablissement
  const periode = etab.periodesEtablissement?.[0]

  const denomination = ul?.denominationUniteLegale
    || periode?.denominationUsuelleEtablissement
    || ""

  const nomDirigeant = ul?.prenomUsuelUniteLegale || ul?.prenom1UniteLegale
    ? `${ul?.prenomUsuelUniteLegale || ul?.prenom1UniteLegale || ""} ${ul?.nomUniteLegale || ""}`.trim()
    : null

  const nomEntreprise = denomination || nomDirigeant || "Inconnu"

  const adresseParts = [
    addr?.numeroVoieEtablissement,
    addr?.typeVoieEtablissement,
    addr?.libelleVoieEtablissement,
  ].filter(Boolean)

  const cp = addr?.codePostalEtablissement ?? null
  const dept = getDepartement(cp ?? undefined)

  return {
    siren: etab.siren,
    siret: etab.siret,
    nom_entreprise: nomEntreprise,
    nom_dirigeant: nomDirigeant,
    activite: periode?.activitePrincipaleEtablissement
      ? NAF_MAPPING[metierSlug]?.label ?? null
      : null,
    code_naf: codeNaf,
    metier_qonforme: resolveMetier(metierSlug),
    adresse: adresseParts.length > 0 ? adresseParts.join(" ") : null,
    code_postal: cp,
    ville: addr?.libelleCommuneEtablissement ?? null,
    departement: dept,
    region: getRegion(dept),
    date_creation: ul?.dateCreationUniteLegale ?? null,
    tranche_effectif: ul?.trancheEffectifsUniteLegale ?? null,
  }
}

// ── Gestion du token OAuth2 INSEE ──────────────────────────────────────────────

let cachedToken: { token: string; expiresAt: number } | null = null

async function getInseeToken(): Promise<string> {
  // Si INSEE_API_KEY ressemble à un Bearer token (long, pas de tirets groupés), l'utiliser directement
  const apiKey = process.env.INSEE_API_KEY
  if (!apiKey) throw new Error("INSEE_API_KEY manquante dans les variables d'environnement")

  // Si on a aussi un secret, c'est du OAuth2 (consumer_key:consumer_secret)
  const apiSecret = process.env.INSEE_API_SECRET
  if (!apiSecret) {
    // Pas de secret → utiliser la clé directement comme Bearer token
    return apiKey
  }

  // OAuth2 : échanger consumer_key + consumer_secret contre un token
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token
  }

  const credentials = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64")
  const response = await fetch("https://api.insee.fr/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`INSEE OAuth2 error ${response.status}: ${body.slice(0, 200)}`)
  }

  const data = await response.json()
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 600) * 1000,
  }

  console.log("[Sirene] Token OAuth2 obtenu, expire dans", data.expires_in, "s")
  return cachedToken.token
}

// ── Requête Sirene search ──────────────────────────────────────────────────────

async function searchSirene(
  query: string,
  debut: number = 0,
  nombre: number = 1000,
): Promise<SireneSearchResponse> {
  const token = await getInseeToken()

  const params = new URLSearchParams({
    q: query,
    nombre: String(nombre),
    debut: String(debut),
  })

  const url = `https://api.insee.fr/api-sirene/3.11/siret?${params}`
  console.log("[Sirene] URL:", url)
  console.log("[Sirene] Requête:", query)

  const response = await fetch(url, {
    headers: {
      "X-INSEE-Api-Key-Integration": token,
      Accept: "application/json",
    },
  })

  if (response.status === 429) {
    console.warn("[Sirene] Rate limited (429), attente 60s...")
    await sleep(60_000)
    const retry = await fetch(url, {
      headers: {
        "X-INSEE-Api-Key-Integration": token,
        Accept: "application/json",
      },
    })
    if (!retry.ok) throw new Error(`Sirene API error: ${retry.status} ${retry.statusText}`)
    return retry.json()
  }

  if (response.status === 404) {
    const body = await response.text()
    console.log(`[Sirene] 404 — body: ${body.slice(0, 500)}`)
    return { header: { total: 0, debut: 0, nombre: 0 }, etablissements: [] }
  }

  if (response.status === 401 || response.status === 403) {
    const body = await response.text()
    console.error(`[Sirene] Auth error ${response.status}:`, body)
    throw new Error(`Sirene API auth error: ${response.status} — Vérifiez INSEE_API_KEY (et INSEE_API_SECRET si OAuth2). Réponse: ${body.slice(0, 200)}`)
  }

  if (!response.ok) {
    const body = await response.text()
    console.error(`[Sirene] Error ${response.status}:`, body)
    throw new Error(`Sirene API error: ${response.status} ${response.statusText} — ${body.slice(0, 200)}`)
  }

  return response.json()
}

// ── Extraction pour un code NAF ────────────────────────────────────────────────

export async function extractByNaf(
  naf: string,
  metierSlug: string,
  options: {
    maxResults?: number
    departement?: string
  } = {},
): Promise<ProspectInsert[]> {
  const maxResults = options.maxResults ?? 10_000
  const prospects: ProspectInsert[] = []
  let debut = 0
  const nombre = 1000 // max par page Sirene

  // Construire la requête
  // L'API Sirene v3.11 (nouveau portail) utilise les codes NAF AVEC le point et entre guillemets
  let query = `activitePrincipaleEtablissement:"${naf}" AND etatAdministratifEtablissement:"A"`
  if (options.departement) {
    query += ` AND codePostalEtablissement:"${options.departement}*"`
  }

  while (prospects.length < maxResults) {
    const data = await searchSirene(query, debut, nombre)

    if (!data.etablissements || data.etablissements.length === 0) break

    for (const etab of data.etablissements) {
      if (prospects.length >= maxResults) break
      prospects.push(transformSireneToProspect(etab, metierSlug, naf))
    }

    // Plus de pages ?
    if (debut + nombre >= data.header.total) break
    debut += nombre

    // Rate limiting : 2s entre chaque requête
    await sleep(2000)
  }

  return prospects
}

// ── Upsert batch dans Supabase ─────────────────────────────────────────────────

export async function upsertProspects(
  prospects: ProspectInsert[],
): Promise<{ inserted: number; skipped: number }> {
  if (prospects.length === 0) return { inserted: 0, skipped: 0 }

  const supabase = createAdminClient()
  let inserted = 0
  let skipped = 0

  // Upsert par batch de 500 (limite Supabase)
  const BATCH_SIZE = 500
  for (let i = 0; i < prospects.length; i += BATCH_SIZE) {
    const batch = prospects.slice(i, i + BATCH_SIZE)

    const { data, error } = await supabase
      .from("prospects")
      .upsert(batch, {
        onConflict: "siret",
        ignoreDuplicates: true,
      })
      .select("id")

    if (error) {
      console.error(`[Sirene] Erreur upsert batch ${i}:`, error.message)
      skipped += batch.length
      continue
    }

    inserted += data?.length ?? 0
    skipped += batch.length - (data?.length ?? 0)
  }

  return { inserted, skipped }
}

// ── Orchestration complète pour un métier ──────────────────────────────────────

export async function extractMetier(
  metierSlug: string,
  options: {
    maxResults?: number
    departement?: string
  } = {},
): Promise<ScrapingRunResult> {
  const entry: NafEntry | undefined = NAF_MAPPING[metierSlug]
  if (!entry) throw new Error(`Métier inconnu : ${metierSlug}`)

  const supabase = createAdminClient()
  const startTime = Date.now()

  // Créer un run de suivi
  const { data: run } = await supabase
    .from("scraping_runs")
    .insert({
      type: "sirene",
      metier: resolveMetier(metierSlug),
      code_naf: entry.nafs.join(","),
      status: "running",
    })
    .select("id")
    .single()

  const runId = run?.id ?? "unknown"

  try {
    let totalFound = 0
    let totalInserted = 0
    let totalSkipped = 0

    // Extraire pour chaque code NAF du métier
    for (const naf of entry.nafs) {
      console.log(`[Sirene] Extraction ${metierSlug} / NAF ${naf}...`)

      const prospects = await extractByNaf(naf, metierSlug, options)
      totalFound += prospects.length

      const { inserted, skipped } = await upsertProspects(prospects)
      totalInserted += inserted
      totalSkipped += skipped

      console.log(`[Sirene] ${naf}: ${prospects.length} trouvés, ${inserted} insérés, ${skipped} ignorés`)

      // Pause entre les codes NAF d'un même métier
      if (entry.nafs.length > 1) await sleep(2000)
    }

    const durationMs = Date.now() - startTime

    // Mettre à jour le run
    await supabase
      .from("scraping_runs")
      .update({
        total_found: totalFound,
        total_inserted: totalInserted,
        total_skipped: totalSkipped,
        duration_ms: durationMs,
        status: "completed",
      })
      .eq("id", runId)

    return {
      runId,
      metier: resolveMetier(metierSlug),
      codeNaf: entry.nafs.join(","),
      totalFound,
      totalInserted,
      totalSkipped,
      durationMs,
    }
  } catch (err) {
    const durationMs = Date.now() - startTime
    const errorMsg = err instanceof Error ? err.message : String(err)

    await supabase
      .from("scraping_runs")
      .update({
        error_message: errorMsg,
        duration_ms: durationMs,
        status: "error",
      })
      .eq("id", runId)

    return {
      runId,
      metier: resolveMetier(metierSlug),
      codeNaf: entry.nafs.join(","),
      totalFound: 0,
      totalInserted: 0,
      totalSkipped: 0,
      durationMs,
      error: errorMsg,
    }
  }
}

// ── Extraction batch (pour le cron) ────────────────────────────────────────────

export async function extractNextBatch(
  batchSize: number = 5,
  maxResultsPerMetier: number = 5000,
): Promise<ScrapingRunResult[]> {
  const supabase = createAdminClient()

  // Trouver les métiers déjà traités (dernières 24h)
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: recentRuns } = await supabase
    .from("scraping_runs")
    .select("metier")
    .eq("type", "sirene")
    .eq("status", "completed")
    .gte("created_at", yesterday)

  const recentMetiers = new Set((recentRuns ?? []).map((r: { metier: string }) => r.metier))

  // Sélectionner les prochains métiers à traiter (sans alias)
  const allMetiers = Object.entries(NAF_MAPPING)
    .filter(([, entry]) => !entry.metierCanonique) // pas les alias
    .map(([slug]) => slug)
    .filter((slug) => !recentMetiers.has(resolveMetier(slug)))

  const batch = allMetiers.slice(0, batchSize)

  if (batch.length === 0) {
    console.log("[Sirene] Tous les métiers ont été traités dans les dernières 24h")
    return []
  }

  console.log(`[Sirene] Batch de ${batch.length} métiers : ${batch.join(", ")}`)

  const results: ScrapingRunResult[] = []
  for (const metier of batch) {
    const result = await extractMetier(metier, { maxResults: maxResultsPerMetier })
    results.push(result)
  }

  return results
}
