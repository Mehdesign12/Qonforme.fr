/**
 * Préparation d'un fichier déposé : lecture, enregistrement prévu et contrôles.
 * Partagé par l'aperçu (rien n'est écrit), l'enregistrement (le serveur relit
 * toujours le fichier : il ne croit jamais une analyse venue du navigateur) et
 * la démo (analyse dans le navigateur, doublons cherchés dans les données de démo).
 */
import { analyzeFile } from "@/lib/reception/analyze"
import { sniffKind, type FileKind } from "@/lib/reception/bytes"
import { checkManualEntry, checkParsedInvoice, hasBlockingCheck } from "@/lib/reception/checks"
import { parseManualEntry, recordFromManual, recordFromParsed, type ReceivedRecord } from "@/lib/reception/record"
import type { ParsedInvoice, ReceivedFormat, ReceptionCheck } from "@/lib/reception/types"

export interface PrepareOptions {
  companySiren: string | null
  /** Recherche d'un doublon déjà enregistré. */
  findDuplicate: (record: ReceivedRecord) => Promise<{ id: string; created_at: string | null } | null>
  /** Saisie manuelle (corps JSON non fiable), pour un PDF sans données structurées. */
  manual?: unknown
}

export type Prepared =
  | { ok: false; status: number; error: string; code: string; field?: string }
  | {
      ok: true
      kind: "structured"
      format: Exclude<ReceivedFormat, "pdf">
      fileKind: FileKind
      invoice: ParsedInvoice
      /** null si une donnée indispensable manque (contrôle bloquant). */
      record: ReceivedRecord | null
      checks: ReceptionCheck[]
      blocking: boolean
      hasPdf: boolean
    }
  | { ok: true; kind: "pdf_only"; note: string | null }
  | {
      ok: true
      kind: "manual"
      fileKind: "pdf"
      record: ReceivedRecord
      checks: ReceptionCheck[]
      blocking: boolean
      hasPdf: true
    }

export async function prepareUpload(bytes: Uint8Array, opts: PrepareOptions): Promise<Prepared> {
  const analysis = await analyzeFile(bytes)
  if (!analysis.ok) {
    const status = analysis.code === "too_large" ? 413 : 422
    return { ok: false, status, error: analysis.message, code: analysis.code }
  }

  if (analysis.kind === "structured") {
    const record = recordFromParsed(analysis.invoice, analysis.format)
    const duplicate = record ? await opts.findDuplicate(record) : null
    const checks = checkParsedInvoice(analysis.invoice, analysis.format, { companySiren: opts.companySiren, duplicate })
    return {
      ok: true,
      kind: "structured",
      format: analysis.format,
      fileKind: sniffKind(bytes) ?? "xml",
      invoice: analysis.invoice,
      record,
      checks,
      blocking: !record || hasBlockingCheck(checks),
      hasPdf: analysis.has_pdf,
    }
  }

  // PDF simple : saisie manuelle demandée
  if (opts.manual === undefined || opts.manual === null) return { ok: true, kind: "pdf_only", note: analysis.note }
  const parsed = parseManualEntry(opts.manual)
  if (!parsed.ok) return { ok: false, status: 422, error: parsed.error, code: "manual_invalid", field: parsed.field }
  const record = recordFromManual(parsed.entry)
  const duplicate = await opts.findDuplicate(record)
  const checks = checkManualEntry(parsed.entry, { companySiren: opts.companySiren, duplicate })
  return { ok: true, kind: "manual", fileKind: "pdf", record, checks, blocking: hasBlockingCheck(checks), hasPdf: true }
}
