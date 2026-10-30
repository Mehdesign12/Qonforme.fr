/**
 * Client de l'API Super PDP (référence OpenAPI v1.38.0.beta, lue le
 * 30/10/2026 : https://api.superpdp.tech/openapi/superpdp.json). Seules les
 * routes utiles à la réception sont appelées.
 *
 * - Les appels sont cloisonnés par entreprise : le jeton porte le company_id.
 * - Tant que `company_verification_status` n'est pas `verified`, les autres
 *   routes répondent 403 (route « Sessions »).
 * - Relève par curseur : les identifiants des factures et des événements sont
 *   strictement croissants ; `starting_after_id` + `has_after` garantissent de
 *   ne rien manquer (documentation « Synchronisation »).
 */
import { SUPERPDP_API } from "@/lib/pa/superpdp/config"
import type { Fetch } from "@/lib/pa/superpdp/oauth"

export type VerificationStatus = "verified" | "needs_review" | "failed" | "not_verified"

export interface SpSession {
  company_verification_status: Exclude<VerificationStatus, "not_verified">
  user_identity_verification_status?: VerificationStatus
}

export interface SpCompany {
  id: number
  env?: "sandbox" | "production"
  number: string
  number_scheme?: string
  formal_name?: string
}

export interface SpDirectoryEntry {
  id: number
  identifier: string
  status: "pending" | "created" | "error"
  status_message?: string
  is_replyto?: boolean
  directory?: string
}

export interface SpFrenchEntry {
  identifier: string
  is_active: boolean
}

export interface SpEvent {
  id: number
  invoice_id: number
  status_code: string
  status_text?: string
  created_at: string
  details?: { reason?: string; notes?: { contents?: { content: string }[] }[] }[]
}

export interface SpInvoiceOverview {
  id: number
  company_id: number
  created_at: string
  direction: "in" | "out"
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = "ApiError"
  }
}

export interface SuperPdpApi {
  session(): Promise<SpSession>
  company(): Promise<SpCompany>
  directoryEntries(): Promise<SpDirectoryEntry[]>
  frenchDirectory(siren: string): Promise<SpFrenchEntry[]>
  listInboundInvoices(afterId: number | null, limit?: number): Promise<{ data: SpInvoiceOverview[]; hasAfter: boolean }>
  invoiceOriginal(id: number): Promise<{ bytes: Uint8Array; mime: string | null }>
  listEvents(afterId: number | null, limit?: number): Promise<{ data: SpEvent[]; hasAfter: boolean }>
  createEvent(input: { invoiceId: number; statusCode: string; reasonCode?: string | null; note?: string | null }): Promise<SpEvent>
}

export function createSuperPdpApi(accessToken: string, f: Fetch = fetch): SuperPdpApi {
  async function call(path: string, init: RequestInit = {}, opts: { auth?: boolean } = {}): Promise<Response> {
    let res: Response
    try {
      res = await f(`${SUPERPDP_API}${path}`, {
        ...init,
        headers: {
          Accept: "application/json",
          ...(opts.auth === false ? {} : { Authorization: `Bearer ${accessToken}` }),
          ...(init.headers ?? {}),
        },
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      })
    } catch {
      throw new ApiError(0, "Super PDP ne répond pas.")
    }
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { message?: unknown }
      const msg = typeof body.message === "string" ? body.message.slice(0, 200) : ""
      throw new ApiError(res.status, `Super PDP ${res.status}${msg ? ` : ${msg}` : ""}`)
    }
    return res
  }
  const json = async <T>(path: string, init?: RequestInit, opts?: { auth?: boolean }) => (await (await call(path, init, opts)).json()) as T
  const after = (id: number | null) => (id && id > 0 ? `&starting_after_id=${id}` : "")

  return {
    session: () => json<SpSession>("/v1.beta/oauth2_sessions/me"),
    company: () => json<SpCompany>("/v1.beta/companies/me"),
    async directoryEntries() {
      const r = await json<{ data?: SpDirectoryEntry[] }>("/v1.beta/directory_entries")
      return Array.isArray(r.data) ? r.data : []
    },
    async frenchDirectory(siren) {
      const r = await json<{ data?: SpFrenchEntry[] }>(`/v1.beta/french_directory/entries?number=${encodeURIComponent(siren)}`, {}, { auth: false })
      return Array.isArray(r.data) ? r.data : []
    },
    async listInboundInvoices(afterId, limit = 100) {
      const r = await json<{ data?: SpInvoiceOverview[]; has_after?: boolean }>(`/v1.beta/invoices?direction=in&order=asc&limit=${limit}${after(afterId)}`)
      return { data: Array.isArray(r.data) ? r.data : [], hasAfter: r.has_after === true }
    },
    async invoiceOriginal(id) {
      const res = await call(`/v1.beta/invoices/${id}?format=original`, { headers: { Accept: "application/pdf, application/xml" } })
      return { bytes: new Uint8Array(await res.arrayBuffer()), mime: res.headers.get("content-type") }
    },
    async listEvents(afterId, limit = 200) {
      const r = await json<{ data?: SpEvent[]; has_after?: boolean }>(`/v1.beta/invoice_events?limit=${limit}${after(afterId)}`)
      return { data: Array.isArray(r.data) ? r.data : [], hasAfter: r.has_after === true }
    },
    createEvent({ invoiceId, statusCode, reasonCode, note }) {
      const detail: Record<string, unknown> = {}
      if (reasonCode) detail.reason = reasonCode
      if (note) detail.notes = [{ contents: [{ content: note.slice(0, 1000) }] }]
      return json<SpEvent>("/v1.beta/invoice_events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoice_id: invoiceId, status_code: statusCode, ...(Object.keys(detail).length ? { details: [detail] } : {}) }),
      })
    },
  }
}
