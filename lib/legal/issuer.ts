/**
 * Identité de l'émetteur avant l'envoi d'un devis, d'une facture ou d'un bon de
 * commande.
 *
 * Depuis le 10/11/2026 (décision du fondateur : un inscrit est parti après
 * l'alerte « SIREN manquant »), **seul le nom de l'entreprise est exigé** :
 * sans SIREN ni adresse, le document part quand même. Ces mentions restent
 * obligatoires sur une facture (C. com. R123-237 ; CGI ann. II art. 242 nonies A) :
 * l'artisan les complète quand il veut (Paramètres › Entreprise, barre latérale
 * « SIREN à compléter »), le Factur-X le signale en avertissement, et l'envoi par
 * la plateforme agréée garde sa propre exigence de SIREN (lib/pa/delivery.ts).
 *
 * Refus (409 `COMPANY_REQUIRED`) seulement sans entreprise ou sans nom : un
 * document sans émetteur n'a pas de sens. La garde passe AVANT le mur de
 * paiement.
 *
 * Routes gardées : POST /api/quotes/[id]/send, POST /api/invoices/[id]/send,
 * PATCH /api/invoices/[id] quand la facture quitte le brouillon,
 * POST /api/purchase-orders/[id]/send, création, envoi et renouvellement d'un
 * lien de signature (POST /api/signature/[type]/[id]).
 */
import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { CompanyRow } from "@/lib/legal/db"
import { COMPANY_REQUIRED } from "@/lib/onboarding/inscription"

export const COMPANY_REQUIRED_MESSAGE =
  "Ajoutez le nom de votre entreprise avant l'envoi : il figure sur vos devis et vos factures (Paramètres › Entreprise)."

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

/** Message à afficher s'il n'y a ni entreprise ni nom, sinon null (SIREN et adresse facultatifs à l'envoi). */
export function issuerIdentityError(company: CompanyRow | null): string | null {
  if (!company || !filled(company.name)) return COMPANY_REQUIRED_MESSAGE
  return null
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
