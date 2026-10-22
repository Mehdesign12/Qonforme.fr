/**
 * Documents scannés fictifs de la démo (miroir de /documents). Gardés en
 * mémoire pour la durée de la visite : on peut « scanner » pour essayer, rien
 * n'est envoyé ni enregistré. Les pages d'exemple sont des feuilles dessinées en
 * SVG (aucune vraie photo, aucun vrai document).
 */
import { DEMO_CLIENTS, DEMO_SUB_CHANTIER_ID, DEMO_TODAY } from "@/lib/demo/data"
import { addDays } from "@/lib/utils/paris-date"
import { ScanApiError, type ScanApi, type ScanFieldsInput } from "@/lib/scan/api"
import {
  SCAN_KIND_LABELS, checkQuota, documentName, parseAmountCents, quotaOf,
  type ScanDocument, type ScanDocumentDetail, type ScanKind, type ScanPage,
} from "@/lib/scan/documents"


function sheet(title: string, number: string, rows: number): string {
  const lines = Array.from({ length: rows }, (_, i) => `<rect x="40" y="${200 + i * 34}" width="${i % 3 === 2 ? 220 : 400}" height="9" rx="3" fill="#D2D8E1"/><rect x="460" y="${200 + i * 34}" width="60" height="9" rx="3" fill="#D2D8E1"/>`).join("")
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="560" height="792" viewBox="0 0 560 792"><rect width="560" height="792" fill="#F7F7F5"/><rect x="40" y="48" width="170" height="22" rx="4" fill="#B8C0CD"/><text x="40" y="128" font-family="Helvetica,Arial,sans-serif" font-size="26" font-weight="700" fill="#334155">${title}</text><text x="40" y="160" font-family="Helvetica,Arial,sans-serif" font-size="15" fill="#64748B">${number} · exemple</text>${lines}<rect x="340" y="${230 + rows * 34}" width="180" height="40" rx="4" fill="#B8C0CD"/></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

const clientName = (id: string | null) => (id ? DEMO_CLIENTS.find((c) => c.id === id)?.name ?? null : null)

function seed(
  id: string, kind: ScanKind, supplier: string | null, number: string | null, offset: number, amountEuros: number | null,
  clientId: string | null, chantierId: string | null, status: "classified" | "to_classify", pageCount = 1,
): ScanDocumentDetail {
  const pages: ScanPage[] = Array.from({ length: pageCount }, (_, i) => ({
    id: `${id}-p${i + 1}`, position: i + 1, width: 560, height: 792, bytes: 180_000 + i * 20_000,
    url: sheet(SCAN_KIND_LABELS[kind].toUpperCase(), number ?? "Sans numéro", 9 + i),
  }))
  const day = addDays(DEMO_TODAY, offset)
  return {
    id, kind, status, title: null, supplier, doc_number: number, doc_date: day, amount_cents: amountEuros === null ? null : Math.round(amountEuros * 100),
    client_id: clientId, client_name: clientName(clientId), chantier_id: chantierId, page_count: pageCount,
    total_bytes: pages.reduce((s, p) => s + p.bytes, 0), created_at: `${day}T09:00:00.000Z`, thumb_url: pages[0].url, pages,
  }
}

let store: ScanDocumentDetail[] = [
  seed("sc-1", "delivery_note", "Point P Lyon", "BL-48213", -1, null, "arvel", DEMO_SUB_CHANTIER_ID, "classified"),
  seed("sc-2", "quote_received", "Cedeo", "D-2209", -2, 1240, null, null, "to_classify", 2),
  seed("sc-3", "purchase_order", "Rexel", "5531", -3, 860.5, "lambert", null, "classified"),
  seed("sc-4", "other", null, null, -4, null, null, null, "to_classify"),
  seed("sc-5", "delivery_note", "Point P Lyon", "BL-47990", -9, null, "arvel", DEMO_SUB_CHANTIER_ID, "classified"),
]
let seq = 100

const asList = (d: ScanDocumentDetail): ScanDocument => {
  const { pages: _pages, ...rest } = d
  void _pages
  return rest
}

function apply(d: ScanDocumentDetail, f: ScanFieldsInput): ScanDocumentDetail {
  const amount = f.amount !== undefined ? parseAmountCents(f.amount) : undefined
  if (amount === undefined && f.amount !== undefined) throw new ScanApiError("Montant invalide (par exemple 1 240,50).")
  return {
    ...d,
    ...(f.kind ? { kind: f.kind } : {}),
    ...(f.status ? { status: f.status } : {}),
    ...(f.supplier !== undefined ? { supplier: f.supplier } : {}),
    ...(f.doc_number !== undefined ? { doc_number: f.doc_number } : {}),
    ...(f.doc_date !== undefined ? { doc_date: f.doc_date } : {}),
    ...(f.amount !== undefined ? { amount_cents: amount ?? null } : {}),
    ...(f.client_id !== undefined ? { client_id: f.client_id, client_name: clientName(f.client_id) } : {}),
    ...(f.chantier_id !== undefined ? { chantier_id: f.chantier_id } : {}),
  }
}

/** API en mémoire de la démo (magasin partagé par toutes les pages de la démo, le temps de la visite). */
export const demoScanApi: ScanApi = {
  async list({ tab, search }) {
    const q = search.trim().toLowerCase()
    let list = store
    if (tab === "to_classify") list = list.filter((d) => d.status === "to_classify")
    else if (tab !== "all") list = list.filter((d) => d.kind === tab)
    if (q) list = list.filter((d) => [documentName(d), d.doc_number ?? ""].join(" ").toLowerCase().includes(q))
    const bytes = store.reduce((s, d) => s + d.total_bytes, 0)
    return {
      available: true,
      documents: list.map(asList).sort((a, b) => b.created_at.localeCompare(a.created_at)),
      toClassify: store.filter((d) => d.status === "to_classify").length,
      usage: { documents: store.length, bytes, plan: "free", quota: quotaOf("free") },
    }
  },
  async get(id) {
    const found = store.find((d) => d.id === id)
    if (!found) throw new ScanApiError("Document introuvable")
    return found
  },
  async create(fields) {
    const check = checkQuota("free", { documents: store.length, bytes: store.reduce((s, d) => s + d.total_bytes, 0) }, { documents: 1 })
    if (!check.ok) throw new ScanApiError(check.message, check.code)
    const base: ScanDocumentDetail = {
      id: `demo-scan-${++seq}`, kind: "other", status: "to_classify", title: null, supplier: null, doc_number: null, doc_date: null, amount_cents: null,
      client_id: null, client_name: null, chantier_id: null, page_count: 0, total_bytes: 0, created_at: new Date().toISOString(), thumb_url: null, pages: [],
    }
    const doc = apply(base, fields)
    store = [doc, ...store]
    return asList(doc)
  },
  async uploadPage(documentId, position, blob) {
    const found = store.find((d) => d.id === documentId)
    if (!found) throw new ScanApiError("Document introuvable")
    const url = URL.createObjectURL(blob)
    const page: ScanPage = { id: `${documentId}-p${position}`, position, width: null, height: null, bytes: blob.size, url }
    const pages = [...found.pages, page].sort((a, b) => a.position - b.position)
    store = store.map((d) => (d.id === documentId ? { ...d, pages, page_count: pages.length, total_bytes: pages.reduce((s, p) => s + p.bytes, 0), thumb_url: pages[0].url } : d))
  },
  async update(id, fields) {
    const found = store.find((d) => d.id === id)
    if (!found) throw new ScanApiError("Document introuvable")
    const next = apply(found, fields)
    store = store.map((d) => (d.id === id ? next : d))
    return asList(next)
  },
  async remove(id) { store = store.filter((d) => d.id !== id) },
  pdfHref: () => null,
}
