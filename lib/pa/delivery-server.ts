/**
 * Canal d'envoi d'une facture, côté serveur : lit le mode du compte, la
 * formule, le raccordement et, seulement quand tout le reste permet la
 * plateforme, l'annuaire de la facturation électronique (public, sans jeton).
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { deliveryOptions, needsDirectory, type DeliveryInput, type DeliveryOptions } from "@/lib/pa/delivery"
import { canResend, loadActiveOutbound, OUTBOUND_TABLE, type OutboundDocType } from "@/lib/pa/outbound"
import { hasPlan, paModeFor } from "@/lib/pa/server"
import { isMissingTable, loadConnection } from "@/lib/pa/store"
import { createSuperPdpApi, type SpFrenchEntry } from "@/lib/pa/superpdp/api"
import type { Fetch } from "@/lib/pa/superpdp/oauth"

const DIRECTORY_TIMEOUT_MS = 5_000

async function outboundInstalled(admin: SupabaseClient): Promise<boolean> {
  const { error } = await admin.from(OUTBOUND_TABLE).select("id").limit(1)
  return !error || !isMissingTable(error)
}

/** Entrées de l'annuaire pour ce SIREN ; null si l'annuaire ne répond pas à temps. */
export async function lookupDirectory(siren: string, f: Fetch = fetch): Promise<SpFrenchEntry[] | null> {
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), DIRECTORY_TIMEOUT_MS))
  const call = createSuperPdpApi("", f).frenchDirectory(siren).catch(() => null)
  return Promise.race([call, timeout])
}

export type DeliveryLoad =
  | { ok: true; options: DeliveryOptions; mode: DeliveryInput["mode"] }
  | { ok: false; status: number; error: string }

export async function loadDeliveryOptions(
  admin: SupabaseClient,
  userId: string,
  client: DeliveryInput["client"],
  opts: { fetch?: Fetch; mode?: DeliveryInput["mode"]; document?: { type: OutboundDocType; id: string } } = {},
): Promise<DeliveryLoad> {
  const [mode, plan, conn, installed, active, company] = await Promise.all([
    opts.mode !== undefined ? Promise.resolve(opts.mode) : paModeFor(userId),
    hasPlan(admin, userId),
    loadConnection(admin, userId),
    outboundInstalled(admin),
    opts.document ? loadActiveOutbound(admin, userId, opts.document.type, opts.document.id) : Promise.resolve(null),
    admin.from("companies").select("siren").eq("user_id", userId).maybeSingle(),
  ])
  // Déjà déposée, ou envoi en cours : pas de second envoi par la plateforme
  const alreadySent = !!(active?.ok && active.row && !canResend(active.row))
  const connection = conn.ok && conn.row ? { status: conn.row.status, address: conn.row.electronic_address, siren: conn.row.siren } : null
  // Lecture de la formule en échec : ne rien conclure pour un artisan raccordé
  if (plan === null && connection?.status === "active") {
    return { ok: false, status: 503, error: "Lecture impossible pour le moment. Réessayez dans un instant." }
  }
  const issuerSiren = (company?.data as { siren?: string | null } | null)?.siren ?? null
  const base = { mode, outboundInstalled: installed, connection, hasPlan: plan === true, client, alreadySent, issuerSiren }
  const siren = needsDirectory(base)
  const directory = siren ? await lookupDirectory(siren, opts.fetch) : undefined
  return { ok: true, options: deliveryOptions({ ...base, directory }), mode }
}
