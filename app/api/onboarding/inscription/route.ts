/**
 * PATCH /api/onboarding/inscription
 *
 * Étapes de la fenêtre « Bienvenue » du tableau de bord (inscription en deux
 * champs, 06/10/2026), une requête par étape (lib/onboarding/inscription.ts) :
 * - `company` : crée l'entreprise si elle n'existe pas, sinon met à jour son
 *   identité seulement (nom, SIREN, SIRET, adresse) — jamais la numérotation
 *   ni les réglages, à la différence de POST /api/company qui repart de zéro ;
 * - `trade` : métier et régime de TVA dans le profil légal, n° de TVA calculé
 *   depuis le SIREN, et, si demandé, les prestations courantes du métier au
 *   catalogue (prix à compléter, sans doublon) ;
 * - `name` : prénom dans le compte (`user_metadata.first_name`) ;
 * - `close` : fenêtre fermée (`user_metadata.signup_window_closed`) et premiers
 *   pas vus, pour que l'ancienne fenêtre de bienvenue ne s'ouvre pas en plus.
 *
 * Le SIREN reste facultatif ici ; l'envoi le demande (lib/legal/issuer.ts).
 * Sans la colonne `companies.legal_profile` (migration non appliquée),
 * l'entreprise s'enregistre sans profil, comme POST /api/company.
 */
import { NextRequest, NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createAdminClient, createClient } from "@/lib/supabase/server"
import { selectCompanyWithProfile } from "@/lib/legal/db"
import { isMissingSchemaError } from "@/lib/supabase/schema-guard"
import { buildImportRows, tradeItems } from "@/lib/catalogue/trades"
import {
  INVALID_REQUEST, mergeCompanyProfile, mergeTradeProfile, parseInscriptionPatch, vatNumberAfterSirenChange,
  vatNumberAfterTrade, type CompanyInput, type TradeInput,
} from "@/lib/onboarding/inscription"

export const dynamic = "force-dynamic"

const READ_ERROR = "Lecture de votre entreprise impossible. Réessayez dans un instant."
const COMPANY_WRITE_ERROR = "Votre entreprise n'a pas pu être enregistrée. Réessayez."
const CATALOGUE_ERROR = "Votre métier est enregistré, mais les prestations n'ont pas pu être ajoutées au catalogue. Réessayez."

const json = (body: unknown, status = 200) => NextResponse.json(body, { status })

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return json({ error: "Non authentifié" }, 401)

    const body = await request.json().catch(() => null)
    const parsed = parseInscriptionPatch(body)
    if (!parsed.ok) return json({ error: parsed.error }, 400)

    const patch = parsed.value
    switch (patch.step) {
      case "company":
        return await saveCompany(supabase, user.id, patch.company)
      case "trade":
        return await saveTrade(supabase, user.id, patch.trade)
      case "name": {
        const { error } = await supabase.auth.updateUser({ data: { first_name: patch.first_name } })
        if (error) {
          console.error("[onboarding/inscription] prénom :", error)
          return json({ error: "Votre prénom n'a pas pu être enregistré. Réessayez." }, 500)
        }
        return json({ ok: true })
      }
      case "close":
        return await closeWindow(supabase, user.id)
      default:
        return json({ error: INVALID_REQUEST }, 400)
    }
  } catch (err) {
    console.error("[onboarding/inscription] erreur :", err)
    return json({ error: "Erreur inattendue. Réessayez." }, 500)
  }
}

const digitsOnly = (v: unknown): string => (typeof v === "string" ? v.replace(/\D/g, "") : "")

/** Étape 1 : création de l'entreprise, ou mise à jour de son identité seulement. */
async function saveCompany(supabase: SupabaseClient, userId: string, input: CompanyInput, retried = false): Promise<NextResponse> {
  const read = await selectCompanyWithProfile(supabase, "id,siren,vat_number", userId)
  if (read.error) return json({ error: READ_ERROR }, 503)
  let profileAvailable = read.profileAvailable

  // `siren` peut être NOT NULL en base : « » tant que l'artisan n'en a pas
  const identity = {
    name: input.name,
    siren: input.siren ?? "",
    siret: input.siret ?? null,
    address: input.address,
    zip_code: input.zip_code,
    city: input.city,
  }

  if (!read.data) {
    const row: Record<string, unknown> = {
      user_id: userId,
      ...identity,
      country: "FR",
      invoice_prefix: "F",
      invoice_sequence: 1,
      // La fenêtre « Bienvenue » remplace l'ancienne fenêtre de premiers pas (WelcomeModal)
      onboarding_seen_at: new Date().toISOString(),
    }
    const profile = profileAvailable ? mergeCompanyProfile(null, input) : null
    let { error } = await supabase.from("companies").insert(profile ? { ...row, legal_profile: profile } : row)
    if (error && profile && isMissingSchemaError(error)) {
      profileAvailable = false
      ;({ error } = await supabase.from("companies").insert(row))
    }
    // Deux envois simultanés (double clic) : l'entreprise vient d'être créée, on la met à jour
    if (error?.code === "23505" && !retried) return saveCompany(supabase, userId, input, true)
    if (error) {
      console.error("[onboarding/inscription] création de l'entreprise :", error)
      return json({ error: COMPANY_WRITE_ERROR }, 500)
    }
  } else {
    const update: Record<string, unknown> = { ...identity }
    // Un n° de TVA calculé depuis l'ancien SIREN suit le nouveau
    const vat = vatNumberAfterSirenChange(read.data.siren, input.siren, read.data.vat_number)
    if (vat !== undefined) update.vat_number = vat
    // Autre entreprise que celle enregistrée : son profil ne reprend rien de l'ancienne
    const sirenChanged = digitsOnly(read.data.siren) !== digitsOnly(input.siren)
    if (profileAvailable && (input.legal_form || sirenChanged)) {
      update.legal_profile = mergeCompanyProfile(read.data.legal_profile, input, { sirenChanged })
    }

    let { error } = await supabase.from("companies").update(update).eq("user_id", userId)
    if (error && "legal_profile" in update && isMissingSchemaError(error)) {
      profileAvailable = false
      delete update.legal_profile
      ;({ error } = await supabase.from("companies").update(update).eq("user_id", userId))
    }
    if (error) {
      console.error("[onboarding/inscription] mise à jour de l'entreprise :", error)
      return json({ error: COMPANY_WRITE_ERROR }, 500)
    }
  }

  return json({
    company: {
      name: identity.name,
      siren: input.siren ?? null,
      address: identity.address,
      zip_code: identity.zip_code,
      city: identity.city,
    },
    profileAvailable,
  })
}

/** Étape 2 : métier, régime de TVA, n° de TVA et prestations courantes du métier. */
async function saveTrade(supabase: SupabaseClient, userId: string, input: TradeInput): Promise<NextResponse> {
  const read = await selectCompanyWithProfile(supabase, "id,siren,vat_number", userId)
  if (read.error) return json({ error: READ_ERROR }, 503)
  if (!read.data) return json({ error: "Renseignez d'abord votre entreprise." }, 409)

  const update: Record<string, unknown> = {}
  const vat = vatNumberAfterTrade(input.vat_regime, read.data.siren, read.data.vat_number)
  if (vat !== (read.data.vat_number ?? null)) update.vat_number = vat
  if (read.profileAvailable) update.legal_profile = mergeTradeProfile(read.data.legal_profile, input)

  if (Object.keys(update).length > 0) {
    let { error } = await supabase.from("companies").update(update).eq("user_id", userId)
    if (error && "legal_profile" in update && isMissingSchemaError(error)) {
      delete update.legal_profile
      ;({ error } = Object.keys(update).length > 0
        ? await supabase.from("companies").update(update).eq("user_id", userId)
        : { error: null })
    }
    if (error) {
      console.error("[onboarding/inscription] métier et TVA :", error)
      return json({ error: "Votre métier n'a pas pu être enregistré. Réessayez." }, 500)
    }
  }

  let imported = 0
  if (input.catalogue) {
    // Toutes les prestations du métier, au taux du chantier type, à 0 € (« Prix à
    // compléter ») ; celles déjà au catalogue (même désignation) ne sont pas recréées
    const { data: existing, error: readErr } = await supabase.from("products").select("name").eq("user_id", userId)
    if (readErr) return json({ error: CATALOGUE_ERROR }, 503)

    const { rows } = buildImportRows({
      trade: input.trade,
      context: input.catalogue.context,
      items: tradeItems(input.trade).map((item) => ({ id: item.id })),
      existingNames: ((existing ?? []) as { name: string }[]).map((p) => p.name),
    })
    if (rows.length > 0) {
      const { error } = await supabase.from("products").insert(rows.map((r) => ({
        user_id: userId,
        name: r.name,
        description: null,
        unit_price_ht: r.unit_price_ht,
        vat_rate: r.vat_rate,
        unit: r.unit,
        reference: null,
        is_active: true,
      })))
      if (error) {
        console.error("[onboarding/inscription] catalogue :", error)
        return json({ error: CATALOGUE_ERROR }, 500)
      }
    }
    imported = rows.length
  }

  return json({ ok: true, imported })
}

/** « Passer au tableau de bord » ou fin de la fenêtre : elle ne s'ouvrira plus d'elle-même. */
async function closeWindow(supabase: SupabaseClient, userId: string): Promise<NextResponse> {
  const { error } = await supabase.auth.updateUser({ data: { signup_window_closed: true } })
  if (error) {
    console.error("[onboarding/inscription] fermeture :", error)
    return json({ error: "La fenêtre n'a pas pu être fermée. Réessayez." }, 500)
  }

  // Premiers pas vus (comme app/demarrer/page.tsx) : l'ancienne fenêtre de
  // bienvenue ne s'ouvre pas en plus. Sans entreprise, rien n'est modifié.
  const { error: seenErr } = await createAdminClient()
    .from("companies")
    .update({ onboarding_seen_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("onboarding_seen_at", null)
  if (seenErr) console.error("[onboarding/inscription] premiers pas :", seenErr)

  return json({ ok: true })
}
