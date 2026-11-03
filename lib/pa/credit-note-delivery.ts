/**
 * Avoirs par la plateforme agréée (lot 5). Règle : un avoir suit le chemin de
 * sa facture. Si la facture d'origine a été transmise par la plateforme, l'avoir
 * part par la plateforme, à la même adresse de facturation électronique (le
 * client doit le recevoir dans le même circuit que la facture qu'il corrige) ;
 * sinon il part par email, comme avant. Pas de nouvelle lecture de l'annuaire :
 * l'adresse est celle où la facture est arrivée.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { canResend, loadActiveOutbound, type OutboundRow } from "@/lib/pa/outbound"
import { PLATFORM_SENDING_MODES } from "@/lib/pa/delivery"
import { loadConnection } from "@/lib/pa/store"
import { hasPlan } from "@/lib/pa/server"
import type { PaMode } from "@/lib/pa/superpdp/config"

export type CreditNotePlatformReason =
  | "invoice_by_email" | "already_sent" | "disabled" | "not_connected" | "no_plan" | "unavailable"

export interface CreditNoteDelivery {
  platform:
    | { offered: true; address: string; mode: PaMode }
    | { offered: false; reason: CreditNotePlatformReason; address: string | null }
  /** Tentative d'envoi de l'avoir par la plateforme (la dernière), pour la fiche. */
  active: OutboundRow | null
}

export const CREDIT_NOTE_PLATFORM_TEXT: Record<CreditNotePlatformReason, string> = {
  invoice_by_email: "La facture d'origine est partie par email : l'avoir part aussi par email.",
  already_sent: "Cet avoir a déjà été transmis par la plateforme agréée.",
  disabled: "L'envoi par la plateforme agréée n'est pas encore ouvert.",
  not_connected: "La facture d'origine est passée par la plateforme agréée, mais votre raccordement n'est plus actif : renouvelez-le dans Facturation électronique.",
  no_plan: "La facture d'origine est passée par la plateforme agréée : l'envoi par la plateforme est inclus dans Essentiel.",
  unavailable: "Lecture impossible pour le moment. Réessayez dans un instant.",
}

/** Décision pure : l'avoir peut-il partir par la plateforme ? */
export function creditNotePlatformChoice(input: {
  invoiceRow: Pick<OutboundRow, "phase" | "recipient_address" | "mode"> | null
  creditNoteRow: Pick<OutboundRow, "phase" | "created_at"> | null
  connectionActive: boolean
  hasPlan: boolean | null
  openModes?: readonly PaMode[]
}): CreditNoteDelivery["platform"] {
  const inv = input.invoiceRow
  const address = inv?.recipient_address ?? null
  if (!inv || inv.phase !== "sent" || !address) return { offered: false, reason: "invoice_by_email", address: null }
  if (input.creditNoteRow && !canResend(input.creditNoteRow as OutboundRow)) return { offered: false, reason: "already_sent", address }
  if (!(input.openModes ?? PLATFORM_SENDING_MODES).includes(inv.mode)) return { offered: false, reason: "disabled", address }
  if (!input.connectionActive) return { offered: false, reason: "not_connected", address }
  if (input.hasPlan === null) return { offered: false, reason: "unavailable", address }
  if (!input.hasPlan) return { offered: false, reason: "no_plan", address }
  return { offered: true, address, mode: inv.mode }
}

export async function loadCreditNoteDelivery(
  admin: SupabaseClient,
  userId: string,
  creditNote: { id: string; original_invoice_id?: string | null },
): Promise<CreditNoteDelivery> {
  const [invoiceLoad, cnLoad, conn, plan] = await Promise.all([
    creditNote.original_invoice_id
      ? loadActiveOutbound(admin, userId, "invoice", creditNote.original_invoice_id)
      : Promise.resolve({ ok: true as const, row: null }),
    loadActiveOutbound(admin, userId, "credit_note", creditNote.id),
    loadConnection(admin, userId),
    hasPlan(admin, userId),
  ])
  const active = cnLoad.ok ? cnLoad.row : null
  const platform = creditNotePlatformChoice({
    invoiceRow: invoiceLoad.ok ? invoiceLoad.row : null,
    creditNoteRow: active,
    connectionActive: !!(conn.ok && conn.row?.status === "active"),
    hasPlan: plan,
  })
  return { platform, active }
}
