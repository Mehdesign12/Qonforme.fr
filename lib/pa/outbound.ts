/**
 * Émission par la plateforme agréée : enregistrement de chaque envoi (table
 * `pa_outbound`, migration 20261103_pa_outbound.sql, serveur seul).
 *
 * Une ligne par tentative d'envoi d'une facture ou d'un avoir. Une facture sans
 * ligne est partie par email. Avant l'appel à la plateforme, l'envoi est
 * réservé (phase « sending ») : l'index unique partiel refuse un second envoi
 * simultané du même document. Une tentative refusée au dépôt (« failed ») ou
 * rejetée ensuite (« rejected ») peut être suivie d'une nouvelle, la première
 * restant dans l'historique (`superseded_at`).
 *
 * Statuts : Super PDP ne les rend pas dans l'ordre (essai du 03/11/2026) ; ils
 * sont dédoublonnés par identifiant et triés par date. Seuls les statuts
 * officiels « fr:* » font le dernier statut affiché ; « api:* » et « ppf:* »
 * restent dans l'historique.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import type { PaMode } from "@/lib/pa/superpdp/config"
import type { SpEvent } from "@/lib/pa/superpdp/api"
import { isMissingTable } from "@/lib/pa/store"

export const OUTBOUND_TABLE = "pa_outbound"

export type OutboundDocType = "invoice" | "credit_note"
export type OutboundPhase = "sending" | "failed" | "sent" | "rejected"

export interface OutboundEvent {
  /** Identifiant de l'événement chez la plateforme (null pour un événement local). */
  id: number | null
  code: string
  at: string
  text?: string | null
  reason?: string | null
}

export interface OutboundRow {
  id: string
  user_id: string
  provider: string
  mode: PaMode
  document_type: OutboundDocType
  document_id: string
  document_number: string
  attempt: number
  phase: OutboundPhase
  platform_invoice_id: number | null
  recipient_address: string | null
  sender_address: string | null
  last_status_code: string | null
  last_status_at: string | null
  events: OutboundEvent[]
  error: string | null
  deposited_at: string | null
  payment_reported_at: string | null
  payment_event_id: number | null
  superseded_at: string | null
  created_at: string
  updated_at: string
}

/* ------------------------------------------------------------------ */
/* Statuts (pur)                                                        */
/* ------------------------------------------------------------------ */

/** Libellés des statuts officiels, vus du côté de l'émetteur. */
export const OUTBOUND_STATUS_LABEL: Record<string, string> = {
  "fr:200": "Déposée",
  "fr:201": "Émise par la plateforme",
  "fr:202": "Reçue par la plateforme du client",
  "fr:203": "Mise à disposition du client",
  "fr:204": "Prise en charge par le client",
  "fr:205": "Approuvée",
  "fr:206": "Approuvée partiellement",
  "fr:207": "En litige",
  "fr:208": "Suspendue",
  "fr:209": "Complétée",
  "fr:210": "Refusée",
  "fr:211": "Paiement transmis",
  "fr:212": "Encaissée",
  "fr:213": "Rejetée",
  "fr:501": "Irrecevable",
}

/**
 * Événements qui font d'un envoi déposé un envoi rejeté : la facture n'a pas
 * atteint le client (contrôle de la plateforme, plateforme du client) et peut
 * être renvoyée après correction. « Refusée » (fr:210) n'en est pas : le client
 * a reçu la facture et la refuse, elle se corrige par un avoir.
 */
const REJECTION_CODES = new Set(["fr:213", "fr:501", "api:invalid", "api:rejected"])

export const isOfficialCode = (code: string): boolean => /^fr:\d{3}$/.test(code)

/** Événement de la plateforme → événement enregistré. */
export function toOutboundEvent(e: SpEvent): OutboundEvent {
  const detail = e.details?.[0]
  const note = detail?.notes?.[0]?.contents?.[0]?.content
  return {
    id: e.id,
    code: e.status_code,
    at: e.created_at,
    text: e.status_text ?? null,
    reason: (detail?.reason ?? note ?? null) || null,
  }
}

function eventKey(e: OutboundEvent): string {
  return e.id != null ? `#${e.id}` : `${e.code}@${e.at}`
}

/** Fusionne deux historiques : sans doublon, trié par date puis par identifiant. */
export function mergeEvents(existing: readonly OutboundEvent[] | null | undefined, incoming: readonly OutboundEvent[]): OutboundEvent[] {
  const byKey = new Map<string, OutboundEvent>()
  for (const e of [...(Array.isArray(existing) ? existing : []), ...incoming]) {
    if (!e || typeof e.code !== "string" || typeof e.at !== "string") continue
    byKey.set(eventKey(e), e)
  }
  return Array.from(byKey.values()).sort((a, b) => {
    const t = Date.parse(a.at) - Date.parse(b.at)
    if (t !== 0 && Number.isFinite(t)) return t
    return (a.id ?? 0) - (b.id ?? 0)
  })
}

/** Dernier statut officiel (fr:*) de l'historique, ou null. */
export function latestOfficial(events: readonly OutboundEvent[]): OutboundEvent | null {
  for (let i = events.length - 1; i >= 0; i--) if (isOfficialCode(events[i].code)) return events[i]
  return null
}

/** Phase d'un envoi déposé après de nouveaux événements. */
export function phaseAfter(phase: OutboundPhase, events: readonly OutboundEvent[]): OutboundPhase {
  if (phase !== "sent") return phase
  return events.some((e) => REJECTION_CODES.has(e.code)) ? "rejected" : "sent"
}

/** Une réservation restée « sending » plus longtemps a échoué sans le dire (arrêt pendant l'appel). */
export const STALE_SENDING_MS = 10 * 60 * 1000

/** Une nouvelle tentative est-elle permise après celle-ci ? */
export function canResend(row: Pick<OutboundRow, "phase" | "created_at">, now = Date.now()): boolean {
  if (row.phase === "failed" || row.phase === "rejected") return true
  return row.phase === "sending" && now - Date.parse(row.created_at) > STALE_SENDING_MS
}

/** Le paiement peut-il être déclaré (fr:212) ? Déposé, pas rejeté, pas déjà déclaré. */
export function canReportPayment(row: Pick<OutboundRow, "phase" | "platform_invoice_id" | "payment_reported_at">): boolean {
  return row.phase === "sent" && row.platform_invoice_id != null && !row.payment_reported_at
}

const MAX_ERROR = 500
const trimError = (s: string): string => (s.length > MAX_ERROR ? `${s.slice(0, MAX_ERROR - 1)}…` : s)

/* ------------------------------------------------------------------ */
/* Base                                                                 */
/* ------------------------------------------------------------------ */

interface DbError { code?: string; message?: string }
const isUniqueViolation = (e: DbError | null | undefined): boolean => e?.code === "23505"

export type OutboundLoad = { ok: true; row: OutboundRow | null } | { ok: false; reason: "missing" | "error"; message?: string }

/** Tentative active d'un document (la dernière), ou null s'il est parti par email. */
export async function loadActiveOutbound(admin: SupabaseClient, userId: string, type: OutboundDocType, documentId: string): Promise<OutboundLoad> {
  const { data, error } = await admin
    .from(OUTBOUND_TABLE)
    .select("*")
    .eq("user_id", userId)
    .eq("document_type", type)
    .eq("document_id", documentId)
    .is("superseded_at", null)
    .maybeSingle()
  if (error) return isMissingTable(error) ? { ok: false, reason: "missing" } : { ok: false, reason: "error", message: error.message }
  return { ok: true, row: (data as OutboundRow | null) ?? null }
}

/** Toutes les tentatives d'un document, de la plus ancienne à la plus récente. */
export async function loadOutboundHistory(admin: SupabaseClient, userId: string, type: OutboundDocType, documentId: string): Promise<OutboundRow[] | null> {
  const { data, error } = await admin
    .from(OUTBOUND_TABLE)
    .select("*")
    .eq("user_id", userId)
    .eq("document_type", type)
    .eq("document_id", documentId)
    .order("attempt", { ascending: true })
  if (error) return null
  return (data as OutboundRow[] | null) ?? []
}

export type ReserveResult =
  | { ok: true; row: OutboundRow }
  | { ok: false; reason: "missing" | "error" | "in_progress" | "already_sent"; row?: OutboundRow }

/**
 * Réserve un envoi avant l'appel à la plateforme. Refusé si un envoi du même
 * document est en cours ou déjà déposé ; après un échec ou un rejet, ouvre la
 * tentative suivante et range la précédente dans l'historique.
 */
export async function reserveOutbound(
  admin: SupabaseClient,
  input: { userId: string; mode: PaMode; type: OutboundDocType; documentId: string; documentNumber: string; recipientAddress?: string | null; senderAddress?: string | null },
  now = Date.now(),
): Promise<ReserveResult> {
  const active = await loadActiveOutbound(admin, input.userId, input.type, input.documentId)
  if (!active.ok) return { ok: false, reason: active.reason }
  let attempt = 1
  if (active.row) {
    const prev = active.row
    if (!canResend(prev, now)) return { ok: false, reason: prev.phase === "sending" ? "in_progress" : "already_sent", row: prev }
    const stamp = new Date(now).toISOString()
    const { data: closed, error } = await admin
      .from(OUTBOUND_TABLE)
      .update({
        superseded_at: stamp,
        updated_at: stamp,
        ...(prev.phase === "sending" ? { phase: "failed", error: "Envoi interrompu avant la réponse de la plateforme." } : {}),
      })
      .eq("id", prev.id)
      .eq("phase", prev.phase)
      .is("superseded_at", null)
      .select("id")
    if (error) return { ok: false, reason: "error" }
    // Une autre requête a pris la main entre la lecture et l'écriture
    if (!Array.isArray(closed) || closed.length !== 1) return { ok: false, reason: "in_progress" }
    attempt = prev.attempt + 1
  }
  const { data, error } = await admin
    .from(OUTBOUND_TABLE)
    .insert({
      user_id: input.userId,
      mode: input.mode,
      document_type: input.type,
      document_id: input.documentId,
      document_number: input.documentNumber,
      attempt,
      phase: "sending",
      recipient_address: input.recipientAddress ?? null,
      sender_address: input.senderAddress ?? null,
    })
    .select("*")
    .single()
  if (error) {
    if (isUniqueViolation(error)) return { ok: false, reason: "in_progress" }
    return { ok: false, reason: isMissingTable(error) ? "missing" : "error" }
  }
  return { ok: true, row: data as OutboundRow }
}

async function updateRow(admin: SupabaseClient, id: string, patch: Partial<OutboundRow>, onlyPhase?: OutboundPhase): Promise<boolean> {
  let q = admin.from(OUTBOUND_TABLE).update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id)
  if (onlyPhase) q = q.eq("phase", onlyPhase)
  const { data, error } = await q.select("id")
  if (error) console.error("[pa] écriture d'un envoi:", error.message)
  return !error && Array.isArray(data) && data.length === 1
}

/** Dépôt accepté par la plateforme : identifiant et premiers statuts. */
export async function markDeposited(
  admin: SupabaseClient,
  row: Pick<OutboundRow, "id" | "events">,
  input: { platformInvoiceId: number; events?: OutboundEvent[] },
): Promise<boolean> {
  const events = mergeEvents(row.events, input.events ?? [])
  const last = latestOfficial(events)
  return updateRow(admin, row.id, {
    phase: phaseAfter("sent", events),
    platform_invoice_id: input.platformInvoiceId,
    deposited_at: new Date().toISOString(),
    events,
    last_status_code: last?.code ?? null,
    last_status_at: last?.at ?? null,
    error: null,
  }, "sending")
}

/** Dépôt refusé (contrôle, annuaire, doublon, panne) : la raison, pour l'afficher. */
export async function markFailed(admin: SupabaseClient, id: string, error: string): Promise<boolean> {
  return updateRow(admin, id, { phase: "failed", error: trimError(error.trim() || "Envoi refusé par la plateforme.") }, "sending")
}

/**
 * Statuts relevés sur la plateforme (tâche des 15 minutes) : chaque événement
 * rejoint l'envoi de sa facture. Les événements d'une facture inconnue (une
 * facture reçue, ou envoyée hors de Qonforme) sont ignorés. Rend le nombre
 * d'envois mis à jour et ceux qui changent de statut, pour prévenir l'artisan.
 */
export async function applyOutboundEvents(
  admin: SupabaseClient,
  mode: PaMode,
  events: readonly SpEvent[],
): Promise<{ updated: number; changed: OutboundRow[] } | null> {
  const byInvoice = new Map<number, OutboundEvent[]>()
  for (const e of events) {
    if (!Number.isFinite(e?.invoice_id)) continue
    const list = byInvoice.get(e.invoice_id) ?? []
    list.push(toOutboundEvent(e))
    byInvoice.set(e.invoice_id, list)
  }
  if (byInvoice.size === 0) return { updated: 0, changed: [] }
  const { data, error } = await admin
    .from(OUTBOUND_TABLE)
    .select("*")
    .eq("mode", mode)
    .in("platform_invoice_id", Array.from(byInvoice.keys()))
  if (error) return isMissingTable(error) ? { updated: 0, changed: [] } : null
  let updated = 0
  const changed: OutboundRow[] = []
  for (const row of (data as OutboundRow[] | null) ?? []) {
    const incoming = byInvoice.get(Number(row.platform_invoice_id)) ?? []
    const events = mergeEvents(row.events, incoming)
    if (events.length === (row.events?.length ?? 0)) continue
    const last = latestOfficial(events)
    const patch: Partial<OutboundRow> = {
      events,
      phase: phaseAfter(row.phase, events),
      last_status_code: last?.code ?? null,
      last_status_at: last?.at ?? null,
    }
    if (await updateRow(admin, row.id, patch)) {
      updated++
      if (patch.last_status_code !== row.last_status_code || patch.phase !== row.phase) changed.push({ ...row, ...patch })
    }
  }
  return { updated, changed }
}

/**
 * Réserve la déclaration de l'encaissement (une seule fois, même si deux
 * requêtes arrivent ensemble) : à appeler avant l'appel à la plateforme, puis
 * `confirmPaymentReported` avec l'identifiant de l'événement, ou
 * `releasePaymentReport` si l'appel échoue.
 */
export async function claimPaymentReport(admin: SupabaseClient, id: string): Promise<boolean> {
  const { data, error } = await admin
    .from(OUTBOUND_TABLE)
    .update({ payment_reported_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("phase", "sent")
    .is("payment_reported_at", null)
    .select("id")
  return !error && Array.isArray(data) && data.length === 1
}

export async function confirmPaymentReported(admin: SupabaseClient, id: string, eventId: number | null): Promise<boolean> {
  return updateRow(admin, id, { payment_event_id: eventId })
}

export async function releasePaymentReport(admin: SupabaseClient, id: string): Promise<boolean> {
  return updateRow(admin, id, { payment_reported_at: null, payment_event_id: null })
}
