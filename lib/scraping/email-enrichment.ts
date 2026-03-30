/**
 * Enrichissement email via APIs tierces (Dropcontact / Hunter.io)
 *
 * Stratégie :
 * 1. Dropcontact (prioritaire, RGPD-compliant, français)
 * 2. Hunter.io (fallback, basé sur le domaine du site web)
 *
 * Env vars :
 * - DROPCONTACT_API_KEY (optionnelle)
 * - HUNTER_API_KEY (optionnelle)
 */

import { createAdminClient } from "@/lib/supabase/server"

// ── Types ──────────────────────────────────────────────────────────────────────

interface EnrichmentResult {
  email: string | null
  phone: string | null
  website: string | null
  source: "dropcontact" | "hunter"
}

interface ProspectToEnrich {
  id: string
  nom_entreprise: string
  siren: string
  site_web: string | null
}

// ── Dropcontact ────────────────────────────────────────────────────────────────

async function enrichViaDropcontact(
  prospect: ProspectToEnrich,
): Promise<EnrichmentResult | null> {
  const apiKey = process.env.DROPCONTACT_API_KEY
  if (!apiKey) return null

  try {
    const response = await fetch("https://api.dropcontact.com/enrichment", {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: [
          {
            company_name: prospect.nom_entreprise,
            siren: prospect.siren,
            website: prospect.site_web ?? undefined,
          },
        ],
        siren: true,
        language: "fr",
      }),
    })

    if (!response.ok) {
      console.warn(`[Dropcontact] Erreur HTTP ${response.status} pour ${prospect.siren}`)
      return null
    }

    const data = await response.json()
    const result = data?.data?.[0]

    if (!result?.email?.[0]?.email) return null

    return {
      email: result.email[0].email,
      phone: result.phone?.[0]?.phone ?? null,
      website: result.website ?? null,
      source: "dropcontact",
    }
  } catch (err) {
    console.error(`[Dropcontact] Erreur pour ${prospect.siren}:`, err)
    return null
  }
}

// ── Hunter.io ──────────────────────────────────────────────────────────────────

async function enrichViaHunter(
  prospect: ProspectToEnrich,
): Promise<EnrichmentResult | null> {
  const apiKey = process.env.HUNTER_API_KEY
  if (!apiKey || !prospect.site_web) return null

  try {
    // Extraire le domaine du site web
    let domain: string
    try {
      domain = new URL(
        prospect.site_web.startsWith("http") ? prospect.site_web : `https://${prospect.site_web}`
      ).hostname
    } catch {
      return null
    }

    const params = new URLSearchParams({
      domain,
      api_key: apiKey,
      type: "generic", // emails génériques (contact@, info@)
    })

    const response = await fetch(`https://api.hunter.io/v2/domain-search?${params}`)

    if (!response.ok) {
      console.warn(`[Hunter] Erreur HTTP ${response.status} pour ${domain}`)
      return null
    }

    const data = await response.json()
    const emails = data?.data?.emails ?? []

    if (emails.length === 0) return null

    // Prioriser les emails génériques (contact@, info@)
    const sorted = [...emails].sort((a: { type: string }, b: { type: string }) => {
      if (a.type === "generic" && b.type !== "generic") return -1
      if (a.type !== "generic" && b.type === "generic") return 1
      return 0
    })

    return {
      email: sorted[0].value,
      phone: null,
      website: prospect.site_web,
      source: "hunter",
    }
  } catch (err) {
    console.error(`[Hunter] Erreur pour ${prospect.siren}:`, err)
    return null
  }
}

// ── Enrichissement d'un prospect ───────────────────────────────────────────────

async function enrichOneProspect(
  prospect: ProspectToEnrich,
): Promise<EnrichmentResult | null> {
  // 1. Essayer Dropcontact d'abord (plus complet, RGPD)
  const dropResult = await enrichViaDropcontact(prospect)
  if (dropResult) return dropResult

  // 2. Fallback Hunter.io (si site web disponible)
  const hunterResult = await enrichViaHunter(prospect)
  if (hunterResult) return hunterResult

  return null
}

// ── Orchestration batch ────────────────────────────────────────────────────────

export interface EnrichmentBatchResult {
  total: number
  enriched: number
  errors: number
  durationMs: number
  source: { dropcontact: number; hunter: number }
}

export async function enrichProspectsBatch(
  batchSize: number = 100,
): Promise<EnrichmentBatchResult> {
  const supabase = createAdminClient()
  const startTime = Date.now()

  // Vérifier qu'au moins une API est configurée
  const hasDropcontact = !!process.env.DROPCONTACT_API_KEY
  const hasHunter = !!process.env.HUNTER_API_KEY

  if (!hasDropcontact && !hasHunter) {
    console.warn("[Enrichment] Aucune API configurée (DROPCONTACT_API_KEY ou HUNTER_API_KEY)")
    return { total: 0, enriched: 0, errors: 0, durationMs: 0, source: { dropcontact: 0, hunter: 0 } }
  }

  // Prospects sans email (qui n'ont pas déjà été enrichis via scraping)
  const { data: prospects } = await supabase
    .from("prospects")
    .select("id, nom_entreprise, siren, site_web")
    .is("email", null)
    .order("created_at", { ascending: true })
    .limit(batchSize)

  if (!prospects || prospects.length === 0) {
    return { total: 0, enriched: 0, errors: 0, durationMs: Date.now() - startTime, source: { dropcontact: 0, hunter: 0 } }
  }

  let enriched = 0
  let errors = 0
  const sourceCounts = { dropcontact: 0, hunter: 0 }

  for (const prospect of prospects as ProspectToEnrich[]) {
    try {
      const result = await enrichOneProspect(prospect)

      if (result?.email) {
        const updateData: Record<string, unknown> = {
          email: result.email,
          email_source: result.source,
          date_enrichment: new Date().toISOString(),
        }

        // Mettre à jour le téléphone et le site web si trouvés
        if (result.phone) updateData.telephone = result.phone
        if (result.website && !prospect.site_web) updateData.site_web = result.website

        const { error } = await supabase
          .from("prospects")
          .update(updateData)
          .eq("id", prospect.id)

        if (error) {
          errors++
        } else {
          enriched++
          sourceCounts[result.source]++
        }
      }
    } catch {
      errors++
    }

    // Pause entre chaque requête (respect rate limits API)
    await new Promise((r) => setTimeout(r, 500))
  }

  // Log dans scraping_runs
  const durationMs = Date.now() - startTime
  await supabase.from("scraping_runs").insert({
    type: "enrichment",
    total_found: enriched,
    total_inserted: enriched,
    total_skipped: prospects.length - enriched,
    duration_ms: durationMs,
    status: errors > 0 && enriched === 0 ? "error" : "completed",
    error_message: errors > 0 ? `${errors} erreurs sur ${prospects.length} prospects` : null,
  })

  return {
    total: prospects.length,
    enriched,
    errors,
    durationMs,
    source: sourceCounts,
  }
}
