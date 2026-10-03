/**
 * Factures reçues telles que l'interface les affiche (API réelle ou données de
 * démo lib/demo/reception.ts) : mêmes types des deux côtés.
 */
import type { ReceivedStatus } from "@/lib/reception/lifecycle"
import type { ParsedInvoice, ReceivedFormat, ReceptionCheck } from "@/lib/reception/types"

export interface ReceivedListItem {
  id: string
  supplier_name: string
  supplier_siren: string | null
  invoice_number: string
  /** Type de document (BT-3) : 381 et voisins = avoir. */
  document_type: string
  issue_date: string
  due_date: string | null
  total_ttc: number
  amount_due: number
  currency: string
  status: ReceivedStatus
  format: ReceivedFormat
  source: "import" | "platform"
  created_at: string
}

export interface ReceivedEvent {
  id: string
  status: ReceivedStatus
  /** Code de la norme, null pour l'import manuel. */
  code: string | null
  reason_code: string | null
  reason: string | null
  actor: "user" | "platform" | "import"
  /** Transmis à la plateforme agréée ; null : resté dans Qonforme. */
  transmitted_at: string | null
  created_at: string
}

export interface ReceivedDetail extends ReceivedListItem {
  total_ht: number
  total_vat: number
  supplier_vat_number: string | null
  buyer_name: string | null
  buyer_siren: string | null
  /** Facture lue (null : PDF simple saisi à la main). */
  data: ParsedInvoice | null
  checks: ReceptionCheck[]
  status_reason_code: string | null
  status_reason: string | null
  status_changed_at: string
  file_name: string | null
  file_mime: string | null
  file_size: number | null
  has_pdf: boolean
  received_at: string
  events: ReceivedEvent[]
}

/** Réponse de l'analyse d'un fichier (POST /api/received-invoices/analyze), aussi produite en démo. */
export type AnalyzeResponse =
  | { ok: true; kind: "structured"; format: Exclude<ReceivedFormat, "pdf">; invoice: ParsedInvoice; checks: ReceptionCheck[]; blocking: boolean }
  | { ok: true; kind: "pdf_only"; format: "pdf"; note: string | null }
  | { ok: false; error: string; code?: string }
