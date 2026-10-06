/**
 * Identité de l'émetteur, exigée avant tout envoi d'un devis, d'une facture ou
 * d'un bon de commande : nom ou dénomination, adresse complète et SIREN
 * figurent obligatoirement sur ces documents (code de commerce, art. R123-237 ;
 * CGI, ann. II, art. 242 nonies A ; service-public.gouv.fr, F31808 et F31144).
 *
 * Depuis l'inscription en deux champs (06/10/2026), l'entreprise peut être
 * saisie à la main sans SIREN : les brouillons, aperçus et PDF restent libres,
 * seul l'envoi est refusé (409 `COMPANY_REQUIRED`) tant que l'identité est
 * incomplète. La garde passe AVANT le mur de paiement : un artisan ne paie
 * jamais une formule pour se voir ensuite refuser l'envoi.
 *
 * Routes gardées : POST /api/quotes/[id]/send, POST /api/invoices/[id]/send,
 * PATCH /api/invoices/[id] quand la facture quitte le brouillon,
 * POST /api/purchase-orders/[id]/send, création, envoi et renouvellement d'un
 * lien de signature (POST /api/signature/[type]/[id]). Jamais les relances
 * d'une facture déjà émise ni les avoirs.
 */
import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { CompanyRow } from "@/lib/legal/db"
import { COMPANY_REQUIRED } from "@/lib/onboarding/inscription"

export const COMPANY_REQUIRED_MESSAGE =
  "Ajoutez le SIREN et l'adresse de votre entreprise avant l'envoi : ils figurent obligatoirement sur vos devis et vos factures (Paramètres › Entreprise)."

/** Colonnes lues par la garde. */
export const ISSUER_COLUMNS = "name,siren,siret,address,zip_code,city"

const digits = (value: unknown): string => (typeof value === "string" ? value.replace(/\s/g, "") : "")
const filled = (value: unknown): boolean => typeof value === "string" && value.trim() !== ""

/**
 * SIREN de l'entreprise (9 chiffres), ou null. « » (entreprise saisie sans
 * SIREN, la colonne pouvant être NOT NULL) compte comme absent ; à défaut, les
 * 9 premiers chiffres d'un SIRET. La garde ne contrôle que la présence : la clé
 * de contrôle est vérifiée à la saisie (fenêtre d'inscription, Paramètres ›
 * Entreprise), et l'ancien formulaire d'entreprise n'exigeait que 9 chiffres —
 * un compte existant n'est jamais bloqué d'un coup pour une clé fausse.
 */
export function issuerSiren(company: CompanyRow | null | undefined): string | null {
  const siren = digits(company?.siren)
  if (/^\d{9}$/.test(siren)) return siren
  const siret = digits(company?.siret)
  return /^\d{14}$/.test(siret) ? siret.slice(0, 9) : null
}

/** Message à afficher si l'identité de l'émetteur est incomplète, sinon null. */
export function issuerIdentityError(company: CompanyRow | null): string | null {
  if (!company) return COMPANY_REQUIRED_MESSAGE
  const complete = ["name", "address", "zip_code", "city"].every((k) => filled(company[k]))
  return complete && issuerSiren(company) ? null : COMPANY_REQUIRED_MESSAGE
}

/**
 * Garde d'envoi : 409 `COMPANY_REQUIRED` si l'identité est incomplète, 503 si
 * l'entreprise n'a pas pu être lue (une coupure réseau n'est pas une entreprise
 * incomplète), sinon null.
 */
export async function requireIssuerIdentity(supabase: SupabaseClient, userId: string): Promise<NextResponse | null> {
  const { data, error } = await supabase
    .from("companies")
    .select(ISSUER_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle()

  if (error) {
    console.error("[requireIssuerIdentity] Lecture de l'entreprise impossible :", error)
    return NextResponse.json(
      { error: "Vérification de votre entreprise impossible pour le moment. Réessayez dans un instant." },
      { status: 503 },
    )
  }

  const message = issuerIdentityError((data as CompanyRow | null) ?? null)
  return message ? NextResponse.json({ error: message, code: COMPANY_REQUIRED }, { status: 409 }) : null
}
