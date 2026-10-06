/**
 * POST /api/onboarding/trial-quote
 *
 * Devis d'essai envoyé à soi-même (DECISIONS-STRATEGIQUES.md § 8, choix 2) : un
 * devis d'exemple au nom de l'entreprise, envoyé sur l'adresse du compte, avec
 * le PDF (filigrane « EXEMPLE », sans numéro) généré en mémoire.
 *
 * Rien n'est écrit dans `quotes` : le devis d'essai reste hors des listes, des
 * compteurs, de la recherche et des chiffres. Gratuit, 3 envois par 24 heures
 * (table trial_quote_sends). Toujours vers l'adresse du compte, jamais vers une
 * adresse fournie par la requête : la route ne peut pas servir à écrire à un
 * tiers.
 *
 * 503 tant que la migration 20261003_onboarding_emails.sql n'est pas appliquée
 * (l'écran de démarrage masque alors ce choix).
 */
import { NextResponse } from "next/server"
import { createAdminClient, createClient } from "@/lib/supabase/server"
import { sendEmail } from "@/lib/email/resend"
import { buildTrialQuoteEmail } from "@/lib/email/templates/onboarding"
import { generateQuotePdf } from "@/lib/pdf/quote"
import { claimTrialQuoteSend, releaseTrialQuoteSend, TRIAL_QUOTE_DAILY_LIMIT } from "@/lib/onboarding/store"
import { buildTrialQuote, TRIAL_QUOTE_FILENAME, type TrialProduct } from "@/lib/onboarding/trial-quote"
import { todayInParis } from "@/lib/utils/paris-date"
import { selectCompanyWithProfile } from "@/lib/legal/db"

export const runtime = "nodejs"
export const maxDuration = 30

const COMPANY_FIELDS = "name,siren,siret,vat_number,address,zip_code,city,iban,legal_notice,accent_color,logo_url"

const LONG_DATE = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "long", year: "numeric" })

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

    const to = user.email?.trim()
    if (!to) return NextResponse.json({ error: "Votre compte n'a pas d'adresse e-mail." }, { status: 422 })

    // Profil légal compris, s'il existe : le régime de TVA déclaré fixe la TVA du
    // devis et les mentions du PDF (franchise : « TVA non applicable, art. 293 B du CGI »)
    const { data: company, error: companyError } = await selectCompanyWithProfile(supabase, COMPANY_FIELDS, user.id)
    if (companyError) return NextResponse.json({ error: "Lecture de votre entreprise impossible. Réessayez." }, { status: 503 })
    if (!company) return NextResponse.json({ error: "Renseignez d'abord votre entreprise." }, { status: 409 })

    const admin = createAdminClient()
    const claim = await claimTrialQuoteSend(admin, user.id, to)
    if ("unavailable" in claim) {
      return NextResponse.json({ error: "Le devis d'essai n'est pas encore disponible." }, { status: 503 })
    }
    if ("limited" in claim) {
      return NextResponse.json(
        { error: `Vous avez déjà reçu ${TRIAL_QUOTE_DAILY_LIMIT} devis d'essai ces dernières 24 heures. Faites un vrai devis, ou réessayez demain.` },
        { status: 429 },
      )
    }
    if ("error" in claim) return NextResponse.json({ error: "Envoi impossible pour le moment. Réessayez." }, { status: 503 })

    try {
      // Quelques prestations du catalogue, s'il y en a (sinon des lignes génériques)
      const { data: products } = await supabase
        .from("products")
        .select("name,unit_price_ht,vat_rate")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: true })
        .limit(3)

      const quote = buildTrialQuote({ company, products: (products ?? []) as TrialProduct[], today: todayInParis() })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pdf = await generateQuotePdf({ quote, company: company as any, watermark: "EXEMPLE" })

      const meta = (user.user_metadata ?? {}) as { first_name?: unknown }
      const { subject, html } = buildTrialQuoteEmail({
        firstName: typeof meta.first_name === "string" ? meta.first_name : null,
        companyName: company.name?.trim() || "Votre entreprise",
        accentColor: company.accent_color,
        totalTtc: quote.total_ttc,
        validUntil: LONG_DATE.format(new Date(`${quote.valid_until}T12:00:00Z`)),
      })

      await sendEmail({
        to,
        subject,
        html,
        fromName: "Qonforme",
        attachments: [{ filename: TRIAL_QUOTE_FILENAME, content: pdf }],
      })
      return NextResponse.json({ ok: true, sentTo: to, remaining: claim.remaining })
    } catch (err) {
      await releaseTrialQuoteSend(admin, claim.id)
      console.error("[onboarding/trial-quote] envoi en échec :", err)
      return NextResponse.json({ error: "L'e-mail n'est pas parti. Réessayez dans un instant." }, { status: 502 })
    }
  } catch (err) {
    console.error("[onboarding/trial-quote] erreur :", err)
    return NextResponse.json({ error: "Erreur inattendue. Réessayez." }, { status: 500 })
  }
}
