/**
 * Vérification d'emails via DNS MX lookup
 *
 * Vérifie que le domaine de l'email possède des enregistrements MX valides.
 * C'est une vérification basique mais gratuite qui filtre :
 * - Les domaines inexistants
 * - Les fautes de frappe dans le domaine
 * - Les emails avec des domaines parking/spam
 *
 * Pour une vérification plus poussée (SMTP, catch-all, disposable),
 * intégrer ZeroBounce ou Reacher en complément.
 */

import { createAdminClient } from "@/lib/supabase/server"
import dns from "dns"
import { promisify } from "util"

const resolveMx = promisify(dns.resolveMx)

// ── Domaines connus valides (cache pour éviter les lookups répétés) ─────────

const KNOWN_VALID_DOMAINS = new Set([
  "gmail.com", "yahoo.fr", "yahoo.com", "hotmail.com", "hotmail.fr",
  "outlook.com", "outlook.fr", "live.fr", "live.com", "msn.com",
  "orange.fr", "wanadoo.fr", "free.fr", "sfr.fr", "laposte.net",
  "bbox.fr", "numericable.fr", "neuf.fr", "club-internet.fr",
  "icloud.com", "me.com", "mac.com", "protonmail.com", "proton.me",
])

// ── Domaines jetables connus (à rejeter) ───────────────────────────────────

const DISPOSABLE_DOMAINS = new Set([
  "yopmail.com", "yopmail.fr", "guerrillamail.com", "mailinator.com",
  "tempmail.com", "throwaway.email", "sharklasers.com", "guerrillamailblock.com",
  "grr.la", "tempail.com", "trash-mail.com",
])

// ── Vérification d'un email ────────────────────────────────────────────────

export interface VerifyResult {
  email: string
  valid: boolean
  reason?: string
}

export async function verifyEmail(email: string): Promise<VerifyResult> {
  // Validation format basique
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
  if (!emailRegex.test(email)) {
    return { email, valid: false, reason: "format_invalide" }
  }

  const domain = email.split("@")[1].toLowerCase()

  // Domaine jetable → rejeté
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return { email, valid: false, reason: "domaine_jetable" }
  }

  // Domaine connu valide → accepté sans lookup
  if (KNOWN_VALID_DOMAINS.has(domain)) {
    return { email, valid: true }
  }

  // DNS MX lookup
  try {
    const mxRecords = await resolveMx(domain)
    if (mxRecords && mxRecords.length > 0) {
      return { email, valid: true }
    }
    return { email, valid: false, reason: "pas_de_mx" }
  } catch {
    return { email, valid: false, reason: "dns_erreur" }
  }
}

// ── Vérification batch ─────────────────────────────────────────────────────

export interface VerifyBatchResult {
  total: number
  valid: number
  invalid: number
  durationMs: number
}

export async function verifyEmailsBatch(
  batchSize: number = 200,
): Promise<VerifyBatchResult> {
  const supabase = createAdminClient()
  const startTime = Date.now()

  // Prospects avec email non encore vérifié
  const { data: prospects } = await supabase
    .from("prospects")
    .select("id, email")
    .not("email", "is", null)
    .eq("email_verified", false)
    .limit(batchSize)

  if (!prospects || prospects.length === 0) {
    return { total: 0, valid: 0, invalid: 0, durationMs: Date.now() - startTime }
  }

  let validCount = 0
  let invalidCount = 0

  // Cache par domaine pour éviter les lookups répétés
  const domainCache = new Map<string, boolean>()

  for (const prospect of prospects as { id: string; email: string }[]) {
    const domain = prospect.email.split("@")[1]?.toLowerCase()

    let isValid: boolean
    if (domainCache.has(domain)) {
      isValid = domainCache.get(domain)!
    } else {
      const result = await verifyEmail(prospect.email)
      isValid = result.valid
      if (domain) domainCache.set(domain, isValid)
    }

    if (isValid) {
      await supabase
        .from("prospects")
        .update({ email_verified: true })
        .eq("id", prospect.id)
      validCount++
    } else {
      // On garde l'email mais on le marque comme non vérifié
      // (pas de suppression — l'email peut être valide malgré un problème DNS temporaire)
      invalidCount++
    }
  }

  return {
    total: prospects.length,
    valid: validCount,
    invalid: invalidCount,
    durationMs: Date.now() - startTime,
  }
}
