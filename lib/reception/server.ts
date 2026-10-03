/**
 * Accès aux factures reçues côté serveur : lecture, doublons, enregistrement
 * (fichier d'origine + ligne + premier événement), passage au format de
 * l'interface. Utilisé par les routes /api/received-invoices et par la
 * réception depuis une plateforme agréée (lib/reception/ingest.ts).
 *
 * Avec le client de session (RLS : propriétaire seulement) ou, pour la
 * plateforme, le client service_role avec un user_id explicite.
 *
 * Migration pas encore appliquée (table, colonne ou bucket absents) :
 * « unavailable », jamais une erreur 500 (lib/supabase/schema-guard.ts).
 */
import { randomUUID } from "crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { isMissingSchemaError } from "@/lib/supabase/schema-guard"
import { isReceivedStatus, STATUS_DEFS, type ReceivedStatus } from "@/lib/reception/lifecycle"
import { sameSupplier, type ReceivedRecord } from "@/lib/reception/record"
import type { FileKind } from "@/lib/reception/bytes"
import type { ReceptionCheck } from "@/lib/reception/types"
import type { ReceivedDetail, ReceivedEvent, ReceivedListItem } from "@/lib/reception/view"

export const RECEIVED_TABLE = "received_invoices"
export const EVENTS_TABLE = "received_invoice_events"
export const RECEIVED_BUCKET = "received-invoices"

type DbError = { code?: string | null; message?: string | null } | null | undefined

/** Table, colonne ou bucket absents : la migration 20261003_received_invoices.sql n'est pas appliquée. */
export function isReceptionUnavailable(error: DbError): boolean {
  if (isMissingSchemaError(error)) return true
  return /bucket not found/i.test(error?.message ?? "")
}

export const LIST_COLUMNS =
  "id, supplier_name, supplier_siren, invoice_number, document_type, issue_date, due_date, total_ttc, amount_due, currency, status, format, source, created_at"

export const DETAIL_COLUMNS =
  `${LIST_COLUMNS}, total_ht, total_vat, supplier_vat_number, buyer_name, buyer_siren, data, checks, status_reason_code, status_reason, status_changed_at, file_name, file_mime, file_size, has_pdf, received_at, platform_id, file_path`

const n = (v: unknown) => {
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}
const s = (v: unknown) => (typeof v === "string" ? v : null)

export function toListItem(row: Record<string, unknown>): ReceivedListItem {
  const status = isReceivedStatus(row.status) ? row.status : "received"
  return {
    id: String(row.id),
    supplier_name: s(row.supplier_name) ?? "—",
    supplier_siren: s(row.supplier_siren),
    invoice_number: s(row.invoice_number) ?? "—",
    document_type: s(row.document_type) ?? "380",
    issue_date: s(row.issue_date) ?? "",
    due_date: s(row.due_date),
    total_ttc: n(row.total_ttc),
    amount_due: n(row.amount_due),
    currency: s(row.currency) ?? "EUR",
    status,
    format: (["facturx", "cii", "ubl", "pdf"].includes(String(row.format)) ? row.format : "pdf") as ReceivedListItem["format"],
    source: row.source === "platform" ? "platform" : "import",
    created_at: s(row.created_at) ?? "",
  }
}

export function toEvent(row: Record<string, unknown>): ReceivedEvent {
  return {
    id: String(row.id),
    status: isReceivedStatus(row.status) ? row.status : "received",
    code: s(row.code),
    reason_code: s(row.reason_code),
    reason: s(row.reason),
    actor: row.actor === "platform" ? "platform" : row.actor === "import" ? "import" : "user",
    transmitted_at: s(row.transmitted_at),
    created_at: s(row.created_at) ?? "",
  }
}

export function toDetail(row: Record<string, unknown>, events: Record<string, unknown>[]): ReceivedDetail {
  return {
    ...toListItem(row),
    total_ht: n(row.total_ht),
    total_vat: n(row.total_vat),
    supplier_vat_number: s(row.supplier_vat_number),
    buyer_name: s(row.buyer_name),
    buyer_siren: s(row.buyer_siren),
    data: (row.data && typeof row.data === "object" ? row.data : null) as ReceivedDetail["data"],
    checks: Array.isArray(row.checks) ? (row.checks as ReceptionCheck[]) : [],
    status_reason_code: s(row.status_reason_code),
    status_reason: s(row.status_reason),
    status_changed_at: s(row.status_changed_at) ?? s(row.created_at) ?? "",
    file_name: s(row.file_name),
    file_mime: s(row.file_mime),
    file_size: row.file_size == null ? null : n(row.file_size),
    has_pdf: row.has_pdf === true,
    received_at: s(row.received_at) ?? s(row.created_at) ?? "",
    events: events.map(toEvent),
  }
}

/** SIREN de l'entreprise de l'utilisateur ; null s'il n'est pas renseigné ou illisible. */
export async function companySirenOf(db: SupabaseClient, userId: string): Promise<string | null> {
  const { data, error } = await db.from("companies").select("siren").eq("user_id", userId).limit(1).maybeSingle()
  if (error || !data) return null
  const v = String((data as { siren?: unknown }).siren ?? "").replace(/\s+/g, "")
  return /^\d{9}$/.test(v) ? v : null
}

/**
 * Facture déjà enregistrée : même numéro, même année, même fournisseur
 * (par SIREN, ou par nom quand l'un des deux n'a pas de SIREN).
 */
export async function findDuplicate(
  db: SupabaseClient,
  userId: string,
  record: Pick<ReceivedRecord, "number_key" | "issue_date" | "supplier_siren" | "supplier_name">,
): Promise<{ duplicate: { id: string; created_at: string | null } | null; unavailable: boolean }> {
  const year = record.issue_date.slice(0, 4)
  const { data, error } = await db
    .from(RECEIVED_TABLE)
    .select("id, supplier_name, supplier_siren, created_at")
    .eq("user_id", userId)
    .eq("number_key", record.number_key)
    .gte("issue_date", `${year}-01-01`)
    .lte("issue_date", `${year}-12-31`)
    .limit(50)
  if (error) return { duplicate: null, unavailable: isReceptionUnavailable(error) }
  const match = (data ?? []).find((r) =>
    sameSupplier(
      { siren: r.supplier_siren as string | null, name: r.supplier_name as string | null },
      { siren: record.supplier_siren, name: record.supplier_name },
    ),
  )
  return { duplicate: match ? { id: String(match.id), created_at: (match.created_at as string) ?? null } : null, unavailable: false }
}

/** Nom de fichier sûr pour l'affichage et le téléchargement. */
export function safeFileName(name: string | null | undefined, kind: FileKind): string {
  const base = (name ?? "").split(/[\\/]/).pop() ?? ""
  // eslint-disable-next-line no-control-regex
  const cleaned = base.replace(/[\u0000-\u001f\u007f"<>|*?:]/g, "").replace(/\s+/g, " ").trim().slice(0, 150)
  const ext = kind === "pdf" ? ".pdf" : ".xml"
  if (!cleaned) return `facture${ext}`
  return cleaned.toLowerCase().endsWith(ext) ? cleaned : `${cleaned}${ext}`
}

export interface PersistInput {
  userId: string
  record: ReceivedRecord
  checks: ReceptionCheck[]
  file: { bytes: Uint8Array; kind: FileKind; name: string; sha256: string }
  hasPdf: boolean
  source: "import" | "platform"
  platformId?: string | null
  /** Horodatage de réception par la plateforme. */
  receivedAt?: string | null
  /** Statut déjà atteint côté plateforme (sinon « Reçue »). */
  initialStatus?: ReceivedStatus | null
}

export type PersistResult =
  | { ok: true; id: string }
  | { ok: false; reason: "unavailable" | "duplicate" | "error"; message: string }

/**
 * Enregistre une facture reçue : fichier d'origine d'abord (bucket privé,
 * dossier de l'utilisateur), puis la ligne, puis l'historique. Si la ligne
 * échoue, le fichier est retiré.
 */
export async function persistReceivedInvoice(db: SupabaseClient, input: PersistInput): Promise<PersistResult> {
  const id = randomUUID()
  const ext = input.file.kind === "pdf" ? "pdf" : "xml"
  const mime = input.file.kind === "pdf" ? "application/pdf" : "application/xml"
  const path = `${input.userId}/${id}.${ext}`

  const upload = await db.storage.from(RECEIVED_BUCKET).upload(path, input.file.bytes, { contentType: mime, upsert: false })
  if (upload.error) {
    if (isReceptionUnavailable(upload.error)) return { ok: false, reason: "unavailable", message: "Réception pas encore activée." }
    console.error("[reception] upload:", upload.error.message)
    return { ok: false, reason: "error", message: "Le fichier n'a pas pu être enregistré. Réessayez." }
  }

  const r = input.record
  const now = new Date().toISOString()
  const status: ReceivedStatus = input.initialStatus ?? "received"
  const { error } = await db.from(RECEIVED_TABLE).insert({
    id,
    user_id: input.userId,
    source: input.source,
    format: r.format,
    document_type: r.document_type,
    invoice_number: r.invoice_number,
    number_key: r.number_key,
    dedup_key: r.dedup_key,
    issue_date: r.issue_date,
    due_date: r.due_date,
    currency: r.currency,
    supplier_name: r.supplier_name,
    supplier_siren: r.supplier_siren,
    supplier_vat_number: r.supplier_vat_number,
    buyer_name: r.buyer_name,
    buyer_siren: r.buyer_siren,
    total_ht: r.total_ht,
    total_vat: r.total_vat,
    total_ttc: r.total_ttc,
    amount_due: r.amount_due,
    data: r.data,
    checks: input.checks,
    status,
    status_changed_at: now,
    file_path: path,
    file_name: input.file.name,
    file_mime: mime,
    file_size: input.file.bytes.byteLength,
    file_sha256: input.file.sha256,
    has_pdf: input.hasPdf,
    platform_id: input.platformId ?? null,
    received_at: input.receivedAt ?? now,
    updated_at: now,
  })
  if (error) {
    await db.storage.from(RECEIVED_BUCKET).remove([path]).catch(() => undefined)
    if (isReceptionUnavailable(error)) return { ok: false, reason: "unavailable", message: "Réception pas encore activée." }
    if (error.code === "23505") return { ok: false, reason: "duplicate", message: "Cette facture est déjà enregistrée." }
    console.error("[reception] insert:", error.message)
    return { ok: false, reason: "error", message: "La facture n'a pas pu être enregistrée. Réessayez." }
  }

  // Historique : réception (import ou plateforme), puis statut déjà atteint côté plateforme
  const events: Record<string, unknown>[] = [{
    invoice_id: id,
    user_id: input.userId,
    status: "received",
    code: input.source === "platform" ? STATUS_DEFS.received.code : null,
    actor: input.source === "platform" ? "platform" : "import",
    created_at: input.receivedAt ?? now,
  }]
  if (status !== "received") {
    events.push({ invoice_id: id, user_id: input.userId, status, code: STATUS_DEFS[status].code, actor: "platform", created_at: now })
  }
  const ev = await db.from(EVENTS_TABLE).insert(events)
  if (ev.error) console.error("[reception] events:", ev.error.message)

  return { ok: true, id }
}
