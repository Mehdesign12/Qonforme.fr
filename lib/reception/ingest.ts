/**
 * Réception depuis une plateforme agréée : facture reçue et statuts venus de
 * la plateforme. Appelé par la route POST /api/pa/webhook, inactive (404) tant
 * qu'aucune plateforme n'est raccordée (lib/pa).
 *
 * Client service_role (pas de session dans un webhook) : chaque requête porte
 * explicitement le user_id du destinataire, retrouvé par le SIREN de son
 * entreprise.
 *
 * Une facture déjà importée à la main puis reçue par la plateforme n'est pas
 * dédoublée : la ligne existante est rattachée à la plateforme (guide pratique
 * DGFiP de démarrage, juillet 2026, question 5 : « désigner une facture de
 * référence » quand une même facture arrive par plusieurs canaux).
 */
import { createHash } from "crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { STATUS_DEFS, type ReceivedStatus } from "@/lib/reception/lifecycle"
import { prepareUpload } from "@/lib/reception/prepare"
import {
  EVENTS_TABLE, RECEIVED_TABLE, findDuplicate, persistReceivedInvoice, safeFileName,
} from "@/lib/reception/server"
import type { PaInboundInvoice } from "@/lib/pa/types"

export type IngestResult =
  | { ok: true; id: string; linked?: boolean }
  | { ok: false; reason: "unknown_recipient" | "ambiguous_recipient" | "unreadable" | "unavailable" | "error"; message?: string }

export async function ingestInboundInvoice(admin: SupabaseClient, inbound: PaInboundInvoice): Promise<IngestResult> {
  const siren = inbound.recipientSiren.replace(/\s+/g, "")
  if (!/^\d{9}$/.test(siren)) return { ok: false, reason: "unknown_recipient" }

  const { data: companies, error } = await admin.from("companies").select("user_id").eq("siren", siren).limit(2)
  if (error) return { ok: false, reason: "error", message: error.message }
  if (!companies?.length) return { ok: false, reason: "unknown_recipient" }
  if (companies.length > 1) return { ok: false, reason: "ambiguous_recipient" }
  const userId = String(companies[0].user_id)

  // Déjà reçue (webhook rejoué) : rien à faire
  const known = await admin.from(RECEIVED_TABLE).select("id").eq("user_id", userId).eq("platform_id", inbound.platformId).limit(1).maybeSingle()
  if (known.data) return { ok: true, id: String((known.data as { id: unknown }).id) }

  const prepared = await prepareUpload(inbound.file.bytes, {
    companySiren: siren,
    findDuplicate: async () => null, // rapprochement ci-dessous
  })
  if (!prepared.ok || prepared.kind !== "structured" || !prepared.record) {
    return { ok: false, reason: "unreadable", message: prepared.ok ? "Facture sans données indispensables." : prepared.error }
  }

  // Même facture importée à la main auparavant : on la rattache à la plateforme
  const dup = await findDuplicate(admin, userId, prepared.record)
  if (dup.unavailable) return { ok: false, reason: "unavailable" }
  if (dup.duplicate) {
    const link = await admin
      .from(RECEIVED_TABLE)
      .update({ source: "platform", platform_id: inbound.platformId, updated_at: new Date().toISOString() })
      .eq("id", dup.duplicate.id)
      .eq("user_id", userId)
      .is("platform_id", null)
    if (link.error) return { ok: false, reason: "error", message: link.error.message }
    await admin.from(EVENTS_TABLE).insert({
      invoice_id: dup.duplicate.id,
      user_id: userId,
      status: "received",
      code: STATUS_DEFS.received.code,
      actor: "platform",
      reason: "Reçue par la plateforme agréée : rattachée à la facture déjà importée.",
      created_at: inbound.receivedAt,
    })
    return { ok: true, id: dup.duplicate.id, linked: true }
  }

  const kind = prepared.fileKind
  const saved = await persistReceivedInvoice(admin, {
    userId,
    record: prepared.record,
    checks: prepared.checks,
    file: {
      bytes: inbound.file.bytes,
      kind,
      name: safeFileName(inbound.file.filename, kind),
      sha256: createHash("sha256").update(inbound.file.bytes).digest("hex"),
    },
    hasPdf: prepared.hasPdf,
    source: "platform",
    platformId: inbound.platformId,
    receivedAt: inbound.receivedAt,
    initialStatus: inbound.status ?? null,
  })
  if (!saved.ok) return { ok: false, reason: saved.reason === "unavailable" ? "unavailable" : "error", message: saved.message }
  return { ok: true, id: saved.id }
}

/** Statut posé côté plateforme (par elle ou par le fournisseur : Encaissée, Complétée, Rejetée…). */
export async function applyPlatformStatus(
  admin: SupabaseClient,
  ev: { platformId: string; status: ReceivedStatus; reasonCode: string | null; reason: string | null; at: string },
): Promise<{ ok: boolean }> {
  const { data, error } = await admin.from(RECEIVED_TABLE).select("id, user_id").eq("platform_id", ev.platformId).limit(2)
  if (error || !data || data.length !== 1) return { ok: false }
  const row = data[0] as { id: string; user_id: string }
  const upd = await admin
    .from(RECEIVED_TABLE)
    .update({
      status: ev.status,
      status_reason_code: ev.reasonCode,
      status_reason: ev.reason,
      status_changed_at: ev.at,
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id)
    .eq("user_id", row.user_id)
  if (upd.error) return { ok: false }
  await admin.from(EVENTS_TABLE).insert({
    invoice_id: row.id,
    user_id: row.user_id,
    status: ev.status,
    code: STATUS_DEFS[ev.status].code,
    reason_code: ev.reasonCode,
    reason: ev.reason,
    actor: "platform",
    transmitted_at: ev.at,
    created_at: ev.at,
  })
  return { ok: true }
}
