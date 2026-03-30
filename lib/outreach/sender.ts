/**
 * Système d'envoi d'emails outreach B2B
 *
 * - Utilise Resend (déjà configuré)
 * - Rate limit configurable (via app_settings ou défaut)
 * - Warm-up progressif : jour 1=20, jour 2=50, jour 3=100, puis 200/jour max
 * - Gestion des désabonnements (JAMAIS réenvoyer à un désabonné)
 * - Tracking : pixel ouverture + liens cliqués
 */

import { createAdminClient } from "@/lib/supabase/server"
import { sendEmail } from "@/lib/email/resend"
import { buildAlerteReglementaire } from "@/lib/email/templates/outreach/alerte-reglementaire"
import { buildInvitationDemo } from "@/lib/email/templates/outreach/invitation-demo"
import { buildOffreLancement } from "@/lib/email/templates/outreach/offre-lancement"
import type { OutreachTemplateData } from "@/lib/email/templates/outreach/base-outreach"

// ── Types ──────────────────────────────────────────────────────────────────────

interface ProspectForSend {
  id: string
  nom_entreprise: string
  metier_qonforme: string
  ville: string
  email: string
}

interface SendResult {
  prospectId: string
  sendId: string | null
  success: boolean
  error?: string
}

// ── Warm-up progressif ─────────────────────────────────────────────────────────

async function getDailyLimit(supabase: ReturnType<typeof createAdminClient>): Promise<number> {
  // Vérifier si un override existe dans app_settings
  const { data: setting } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "outreach_daily_limit")
    .single()

  if (setting?.value) {
    const limit = parseInt(setting.value, 10)
    if (!isNaN(limit) && limit > 0) return limit
  }

  // Warm-up basé sur le nombre de jours depuis le premier envoi
  const { data: firstSend } = await supabase
    .from("campaign_sends")
    .select("date_envoi")
    .order("date_envoi", { ascending: true })
    .limit(1)
    .single()

  if (!firstSend?.date_envoi) return 20 // Premier jour

  const daysSinceFirst = Math.floor(
    (Date.now() - new Date(firstSend.date_envoi).getTime()) / (24 * 60 * 60 * 1000)
  )

  if (daysSinceFirst <= 0) return 20
  if (daysSinceFirst <= 1) return 50
  if (daysSinceFirst <= 2) return 100
  return 200 // Max 200/jour
}

async function getTodaySentCount(supabase: ReturnType<typeof createAdminClient>): Promise<number> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const { count } = await supabase
    .from("campaign_sends")
    .select("*", { head: true, count: "exact" })
    .gte("date_envoi", today.toISOString())

  return count ?? 0
}

// ── Sélection du template ──────────────────────────────────────────────────────

function buildTemplate(
  step: number,
  data: OutreachTemplateData,
): { subject: string; html: string } {
  switch (step) {
    case 1: return buildAlerteReglementaire(data)
    case 2: return buildInvitationDemo(data)
    case 3: return buildOffreLancement(data)
    default: return buildAlerteReglementaire(data)
  }
}

// ── Envoi d'un email ───────────────────────────────────────────────────────────

async function sendOneOutreach(
  supabase: ReturnType<typeof createAdminClient>,
  campaignId: string,
  prospect: ProspectForSend,
  step: number,
  baseUrl: string,
): Promise<SendResult> {
  // Créer le campaign_send d'abord
  const { data: send, error: insertError } = await supabase
    .from("campaign_sends")
    .insert({
      campaign_id: campaignId,
      prospect_id: prospect.id,
      email: prospect.email,
      template_step: step,
      statut: "envoye",
    })
    .select("id")
    .single()

  if (insertError || !send) {
    // Probablement un doublon (contrainte unique)
    return { prospectId: prospect.id, sendId: null, success: false, error: insertError?.message ?? "Insert échoué" }
  }

  const templateData: OutreachTemplateData = {
    nom_entreprise: prospect.nom_entreprise,
    metier: prospect.metier_qonforme,
    ville: prospect.ville ?? "",
    sendId: send.id,
    baseUrl,
  }

  const { subject, html } = buildTemplate(step, templateData)

  try {
    await sendEmail({
      to: prospect.email,
      subject,
      html,
      fromName: "Qonforme",
    })

    return { prospectId: prospect.id, sendId: send.id, success: true }
  } catch (err) {
    // Marquer comme erreur
    await supabase
      .from("campaign_sends")
      .update({ statut: "erreur" })
      .eq("id", send.id)

    return {
      prospectId: prospect.id,
      sendId: send.id,
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

// ── Envoi batch pour une campagne ──────────────────────────────────────────────

export interface CampaignSendBatchResult {
  campaignId: string
  step: number
  sent: number
  errors: number
  skipped: number
  dailyLimitReached: boolean
  durationMs: number
}

export async function sendCampaignBatch(
  campaignId: string,
  step: number,
  baseUrl: string = "https://qonforme.fr",
): Promise<CampaignSendBatchResult> {
  const supabase = createAdminClient()
  const startTime = Date.now()

  // Vérifier la limite quotidienne
  const dailyLimit = await getDailyLimit(supabase)
  const todaySent = await getTodaySentCount(supabase)
  const remaining = Math.max(0, dailyLimit - todaySent)

  if (remaining === 0) {
    return {
      campaignId, step, sent: 0, errors: 0, skipped: 0,
      dailyLimitReached: true, durationMs: Date.now() - startTime,
    }
  }

  // Récupérer la campagne
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", campaignId)
    .single()

  if (!campaign || campaign.statut !== "en_cours") {
    return {
      campaignId, step, sent: 0, errors: 0, skipped: 0,
      dailyLimitReached: false, durationMs: Date.now() - startTime,
    }
  }

  // Construire la requête de prospects éligibles
  let query = supabase
    .from("prospects")
    .select("id, nom_entreprise, metier_qonforme, ville, email")
    .not("email", "is", null)
    .eq("email_verified", true)
    .neq("statut", "desabonne")
    .neq("statut", "converti")

  // Filtres de la campagne
  if (campaign.metier_cible) {
    query = query.eq("metier_qonforme", campaign.metier_cible)
  }
  // Note : filtrage par departements se fait en post-query car Supabase
  // ne supporte pas facilement les array overlaps via le client JS

  query = query.limit(remaining)

  const { data: allProspects } = await query

  if (!allProspects || allProspects.length === 0) {
    return {
      campaignId, step, sent: 0, errors: 0, skipped: 0,
      dailyLimitReached: false, durationMs: Date.now() - startTime,
    }
  }

  // Filtrer ceux qui ont déjà reçu cette étape
  const { data: alreadySent } = await supabase
    .from("campaign_sends")
    .select("prospect_id")
    .eq("campaign_id", campaignId)
    .eq("template_step", step)

  const alreadySentIds = new Set((alreadySent ?? []).map((s) => (s as { prospect_id: string }).prospect_id))

  // Pour step 2 et 3, filtrer ceux qui ont cliqué/converti au step précédent
  let excludeClicked = new Set<string>()
  if (step > 1) {
    const { data: clicked } = await supabase
      .from("campaign_sends")
      .select("prospect_id")
      .eq("campaign_id", campaignId)
      .eq("template_step", step - 1)
      .eq("statut", "clique")

    excludeClicked = new Set((clicked ?? []).map((s) => (s as { prospect_id: string }).prospect_id))
  }

  const prospects = (allProspects as ProspectForSend[]).filter(
    (p) => !alreadySentIds.has(p.id) && !excludeClicked.has(p.id)
  )

  // Envoyer
  let sent = 0
  let errors = 0
  let skipped = 0

  for (const prospect of prospects.slice(0, remaining)) {
    const result = await sendOneOutreach(supabase, campaignId, prospect, step, baseUrl)

    if (result.success) {
      sent++
    } else if (result.error?.includes("unique") || result.error?.includes("duplicate")) {
      skipped++
    } else {
      errors++
    }

    // Pause entre chaque envoi (éviter le rate limit Resend)
    await new Promise((r) => setTimeout(r, 1200))
  }

  // Mettre à jour les compteurs de la campagne
  await supabase
    .from("campaigns")
    .update({
      total_envois: (campaign.total_envois ?? 0) + sent,
    })
    .eq("id", campaignId)

  return {
    campaignId,
    step,
    sent,
    errors,
    skipped,
    dailyLimitReached: sent + errors >= remaining,
    durationMs: Date.now() - startTime,
  }
}
