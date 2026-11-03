/**
 * Déclaration de l'encaissement (statut fr:212 « Encaissée ») d'une facture
 * transmise par la plateforme agréée. Le statut est posé par le vendeur : quand
 * l'artisan marque la facture payée, Qonforme le déclare à Super PDP.
 *
 * - Une seule déclaration par envoi : réservée en base avant l'appel
 *   (`claimPaymentReport`), rendue si l'appel échoue (`releasePaymentReport`).
 * - Jamais bloquante : la facture passe « payée » même si la plateforme ne répond
 *   pas ; la relève des 15 minutes rattrape les déclarations manquées
 *   (`reportPendingPayments`).
 * - Essai du 03/11/2026 en bac à sable : fr:212 sans détail accepté, montant
 *   calculé par la plateforme (total TTC par taux).
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  applyOutboundEvents, canReportPayment, claimPaymentReport, confirmPaymentReported,
  loadActiveOutbound, OUTBOUND_TABLE, releasePaymentReport, type OutboundRow,
} from "@/lib/pa/outbound"
import { obtainToken } from "@/lib/pa/deposit"
import { createSuperPdpApi, type SuperPdpApi } from "@/lib/pa/superpdp/api"

export const PAYMENT_STATUS_CODE = "fr:212"

export type PaymentReport =
  | { state: "reported" }
  | { state: "not_platform" }
  | { state: "already" }
  | { state: "failed"; error: string }

/** Déclare l'encaissement d'un envoi déjà chargé. `api` : client Super PDP déjà authentifié (relève). */
export async function reportPaymentFor(
  admin: SupabaseClient,
  row: OutboundRow,
  opts: { api?: SuperPdpApi } = {},
): Promise<PaymentReport> {
  if (!canReportPayment(row)) return row.payment_reported_at ? { state: "already" } : { state: "not_platform" }
  if (!(await claimPaymentReport(admin, row.id))) return { state: "already" }
  let api = opts.api
  if (!api) {
    const token = await obtainToken(admin, row.user_id)
    if (!token.ok) {
      await releasePaymentReport(admin, row.id)
      return { state: "failed", error: token.error }
    }
    api = createSuperPdpApi(token.token)
  }
  try {
    const event = await api.createEvent({ invoiceId: Number(row.platform_invoice_id), statusCode: PAYMENT_STATUS_CODE })
    await confirmPaymentReported(admin, row.id, Number.isFinite(event?.id) ? event.id : null)
    // Le statut apparaît tout de suite dans le parcours (la relève le confirmera)
    if (event && Number.isFinite(event.invoice_id)) await applyOutboundEvents(admin, row.mode, [event], row.user_id)
    return { state: "reported" }
  } catch (err) {
    console.error("[pa-payment] fr:212 refusé:", err instanceof Error ? err.message : err)
    await releasePaymentReport(admin, row.id)
    return { state: "failed", error: "La plateforme n'a pas reçu l'encaissement : il sera déclaré au prochain passage." }
  }
}

/** Après « Marquer comme payée » : déclare l'encaissement si la facture est passée par la plateforme. */
export async function reportInvoicePayment(admin: SupabaseClient, userId: string, invoiceId: string): Promise<PaymentReport> {
  const active = await loadActiveOutbound(admin, userId, "invoice", invoiceId)
  if (!active.ok || !active.row) return { state: "not_platform" }
  return reportPaymentFor(admin, active.row)
}

/**
 * Rattrapage (relève des 15 minutes) : factures payées, transmises par la
 * plateforme, dont l'encaissement n'a pas encore été déclaré.
 */
export async function reportPendingPayments(admin: SupabaseClient, userId: string, api: SuperPdpApi): Promise<number> {
  const { data: rows, error } = await admin
    .from(OUTBOUND_TABLE)
    .select("*")
    .eq("user_id", userId)
    .eq("document_type", "invoice")
    .eq("phase", "sent")
    .is("payment_reported_at", null)
    .is("superseded_at", null)
    .not("platform_invoice_id", "is", null)
    .limit(50)
  if (error || !rows?.length) return 0
  const ids = (rows as OutboundRow[]).map((r) => r.document_id)
  const { data: paid } = await admin.from("invoices").select("id").eq("user_id", userId).eq("status", "paid").in("id", ids)
  const paidIds = new Set(((paid as { id: string }[] | null) ?? []).map((r) => r.id))
  let reported = 0
  for (const row of rows as OutboundRow[]) {
    if (!paidIds.has(row.document_id)) continue
    if ((await reportPaymentFor(admin, row, { api })).state === "reported") reported++
  }
  return reported
}
