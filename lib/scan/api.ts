/**
 * Accès aux routes /api/scan depuis le navigateur. La démo a son équivalent en
 * mémoire (lib/demo/scan.ts) : les vues parlent à une `ScanApi`, jamais
 * directement au réseau.
 */
import type { ScanDocument, ScanDocumentDetail, ScanKind, ScanUsage } from "@/lib/scan/documents"

export class ScanApiError extends Error {
  readonly code?: string
  constructor(message: string, code?: string) {
    super(message)
    this.name = "ScanApiError"
    this.code = code
  }
}

export type ScanTab = "all" | "to_classify" | ScanKind

/** Champs envoyés à la création ou à la modification (le montant en euros, saisi tel quel). */
export interface ScanFieldsInput {
  kind?: ScanKind
  status?: "to_classify" | "classified"
  supplier?: string | null
  doc_number?: string | null
  doc_date?: string | null
  amount?: string | null
  client_id?: string | null
  chantier_id?: string | null
}

export interface ScanListResult {
  available: boolean
  documents: ScanDocument[]
  toClassify: number
  usage: ScanUsage | null
}

export interface ScanApi {
  list(query: { tab: ScanTab; search: string }): Promise<ScanListResult>
  get(id: string): Promise<ScanDocumentDetail>
  create(fields: ScanFieldsInput): Promise<ScanDocument>
  uploadPage(documentId: string, position: number, blob: Blob): Promise<void>
  update(id: string, fields: ScanFieldsInput): Promise<ScanDocument>
  remove(id: string): Promise<void>
  /** Adresse du PDF ; null en démo (rien à télécharger). */
  pdfHref(id: string): string | null
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, init)
  } catch {
    throw new ScanApiError("Vérifiez votre connexion, puis réessayez.")
  }
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new ScanApiError(json.error ?? "Erreur réseau", json.code)
  return json as T
}

const send = (method: string, body: unknown): RequestInit => ({
  method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
})

export const appScanApi: ScanApi = {
  async list({ tab, search }) {
    const q = new URLSearchParams()
    if (tab !== "all") q.set("tab", tab)
    if (search.trim()) q.set("q", search.trim())
    const res = await call<Partial<ScanListResult>>(`/api/scan/documents?${q}`)
    return { available: res.available !== false, documents: res.documents ?? [], toClassify: res.toClassify ?? 0, usage: res.usage ?? null }
  },
  async get(id) { return (await call<{ document: ScanDocumentDetail }>(`/api/scan/documents/${id}`)).document },
  async create(fields) { return (await call<{ document: ScanDocument }>("/api/scan/documents", send("POST", fields))).document },
  async uploadPage(documentId, position, blob) {
    const form = new FormData()
    form.set("file", blob, `page-${position}.jpg`)
    form.set("position", String(position))
    await call(`/api/scan/documents/${documentId}/pages`, { method: "POST", body: form })
  },
  async update(id, fields) { return (await call<{ document: ScanDocument }>(`/api/scan/documents/${id}`, send("PATCH", fields))).document },
  async remove(id) { await call(`/api/scan/documents/${id}`, { method: "DELETE" }) },
  pdfHref: (id) => `/api/scan/documents/${id}/pdf`,
}
