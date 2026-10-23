// @vitest-environment node
/** Routes /api/scan : création, quota, envoi des pages, modification, suppression, PDF, et comportement sans la migration. */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

type Result = { data?: unknown; error?: { code?: string; message?: string } | null; count?: number | null }
type Rec = { table: string; op: string; payload?: unknown; filters: [string, ...unknown[]][]; cols?: string; opts?: { head?: boolean } }

const h = vi.hoisted(() => ({
  user: { id: "11111111-1111-4111-8111-111111111111" } as { id: string } | null,
  calls: [] as Rec[],
  on: (() => ({ data: null, error: null })) as (rec: Rec) => Result,
  uploads: [] as { path: string; size: number; contentType?: string }[],
  removed: [] as string[][],
  uploadError: null as { message: string } | null,
  signed: [] as string[][],
  downloads: new Map<string, Buffer>(),
  ownsClient: true,
}))

vi.mock("@/lib/artisan/server", () => ({ ownsClient: async () => h.ownsClient }))
vi.mock("@/lib/blog-images/server", async (orig) => {
  const real = await orig<typeof import("@/lib/blog-images/server")>()
  return { ...real, prepareImage: async (buf: Buffer) => ({ data: Buffer.alloc(Math.min(buf.length, 5000), 1), mimeType: "image/webp", width: 800, height: 1100 }) }
})
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: h.user } }) },
    from(table: string) {
      const rec: Rec = { table, op: "select", filters: [] }
      h.calls.push(rec)
      const c: Record<string, unknown> = {}
      for (const m of ["eq", "is", "in", "or", "order", "limit", "gt", "lt", "not"]) c[m] = (...a: unknown[]) => { rec.filters.push([m, ...a]); return c }
      c.select = (cols?: string, opts?: { head?: boolean }) => { rec.cols = cols; rec.opts = opts; return c }
      c.insert = (p: unknown) => { rec.op = "insert"; rec.payload = p; return c }
      c.update = (p: unknown) => { rec.op = "update"; rec.payload = p; return c }
      c.delete = () => { rec.op = "delete"; return c }
      c.single = async () => h.on(rec)
      c.maybeSingle = async () => h.on(rec)
      c.then = (ok: (r: Result) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(h.on(rec)).then(ok, ko)
      return c
    },
    storage: {
      from: () => ({
        upload: async (path: string, body: Buffer, o: { contentType?: string }) => { h.uploads.push({ path, size: body.length, contentType: o.contentType }); return { error: h.uploadError } },
        remove: async (paths: string[]) => { h.removed.push(paths); return { error: null } },
        createSignedUrls: async (paths: string[]) => { h.signed.push(paths); return { data: paths.map((p) => ({ path: p, signedUrl: `https://signed/${p}`, error: null })) } },
        download: async (path: string) => ({ data: h.downloads.has(path) ? new Blob([new Uint8Array(h.downloads.get(path) as Buffer)]) : null, error: h.downloads.has(path) ? null : { message: "x" } }),
      }),
    },
  }),
}))

const UID = "11111111-1111-4111-8111-111111111111"
const DOC = "22222222-2222-4222-8222-222222222222"
const MISSING = { code: "42P01", message: 'relation "public.scanned_documents" does not exist' }
const docRow = (over: Record<string, unknown> = {}) => ({
  id: DOC, kind: "delivery_note", status: "classified", title: null, supplier: "Point P", doc_number: "BL-1", doc_date: "2026-10-20", amount_cents: null,
  client_id: null, chantier_id: null, created_at: "2026-10-20T10:00:00Z", client: null,
  pages: [{ id: "p2", position: 2, storage_path: `${UID}/${DOC}/2.webp`, bytes: 100, width: 1, height: 1 }, { id: "p1", position: 1, storage_path: `${UID}/${DOC}/1.webp`, bytes: 100, width: 1, height: 1 }],
  ...over,
})

/** Réponses par défaut d'un compte gratuit avec `docs` documents et `bytes` octets utilisés. */
function account(opts: { docs?: number; bytes?: number; plan?: { plan: string; status: string } | null; planError?: boolean; missing?: boolean } = {}) {
  const { docs = 3, bytes = 1000, plan = null, planError = false, missing = false } = opts
  return (rec: Rec): Result => {
    if (rec.table === "subscriptions") return planError ? { data: null, error: { message: "timeout" } } : { data: plan, error: null }
    if (missing && rec.table.startsWith("scanned_")) return { data: null, error: MISSING }
    if (rec.table === "scanned_documents" && rec.opts?.head) return { data: null, error: null, count: docs }
    if (rec.table === "scanned_document_pages" && rec.op === "select" && rec.cols === "bytes") return { data: [{ bytes }], error: null }
    if (rec.table === "scanned_documents" && rec.op === "insert") return { data: docRow({ pages: [], status: "to_classify" }), error: null }
    if (rec.table === "scanned_documents") return { data: rec.op === "select" ? docRow() : [{ id: DOC }], error: null }
    if (rec.table === "scanned_document_pages" && rec.op === "insert") return { data: { id: "p", position: 1, bytes: 5000, width: 800, height: 1100 }, error: null }
    return { data: [], error: null }
  }
}

const req = (url: string, method = "GET", body?: unknown) =>
  new NextRequest(`https://qonforme.test${url}`, { method, ...(body ? { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } } : {}) })
const ctx = (id: string) => ({ params: Promise.resolve({ id }) })

/** PNG minimal : signature, IHDR 10 × 10. Suffit à la reconnaissance par les octets. */
function png(extra = 0): Buffer {
  const b = Buffer.alloc(33 + extra)
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0)
  b.writeUInt32BE(13, 8); b.write("IHDR", 12); b.writeUInt32BE(10, 16); b.writeUInt32BE(10, 20)
  return b
}
function pageRequest(file: Buffer | null, position: string | number = 1, name = "page.jpg") {
  const form = new FormData()
  if (file) form.set("file", new File([new Uint8Array(file)], name, { type: "image/jpeg" }))
  form.set("position", String(position))
  return new NextRequest(`https://qonforme.test/api/scan/documents/${DOC}/pages`, { method: "POST", body: form })
}

beforeEach(() => {
  h.user = { id: UID }; h.calls = []; h.uploads = []; h.removed = []; h.signed = []; h.uploadError = null; h.ownsClient = true; h.downloads = new Map()
  h.on = account()
})

describe("GET /api/scan/documents", () => {
  it("401 sans connexion", async () => {
    const { GET } = await import("@/app/api/scan/documents/route")
    h.user = null
    expect((await GET(req("/api/scan/documents"))).status).toBe(401)
  })
  it("liste, miniature de la première page seulement, espace utilisé, formule gratuite", async () => {
    const { GET } = await import("@/app/api/scan/documents/route")
    h.on = (rec) => (rec.table === "scanned_documents" && rec.op === "select" && !rec.opts?.head ? { data: [docRow()], error: null } : account({ docs: 4, bytes: 2048 })(rec))
    const json = await (await GET(req("/api/scan/documents?tab=to_classify&q=Point%20P"))).json()
    expect(json.available).toBe(true)
    expect(json.documents[0]).toMatchObject({ id: DOC, thumb_url: `https://signed/${UID}/${DOC}/1.webp`, page_count: 2 })
    expect(json.documents[0].pages).toBeUndefined()
    expect(h.signed[0]).toEqual([`${UID}/${DOC}/1.webp`])
    expect(json.usage).toMatchObject({ documents: 4, bytes: 2048, plan: "free", quota: { documents: 50, megabytes: 200 } })
    const list = h.calls.find((c) => c.table === "scanned_documents" && !c.opts?.head)!
    expect(list.filters).toContainEqual(["eq", "user_id", UID])
    expect(list.filters).toContainEqual(["eq", "status", "to_classify"])
  })
  it("la recherche n'ouvre pas le filtre : aucune virgule ni parenthèse injectée", async () => {
    const { GET } = await import("@/app/api/scan/documents/route")
    h.on = (rec) => (rec.table === "scanned_documents" && !rec.opts?.head ? { data: [], error: null } : account()(rec))
    await GET(req(`/api/scan/documents?q=${encodeURIComponent("x),user_id.neq.0,(y")}`))
    const or = h.calls.flatMap((c) => c.filters).find((f) => f[0] === "or")?.[1] as string
    expect(or).toBe("supplier.ilike.%x user_id.neq.0 y%,doc_number.ilike.%x user_id.neq.0 y%,title.ilike.%x user_id.neq.0 y%")
  })
  it("sans la migration : « indisponible »", async () => {
    const { GET } = await import("@/app/api/scan/documents/route")
    h.on = account({ missing: true })
    expect(await (await GET(req("/api/scan/documents"))).json()).toMatchObject({ available: false, documents: [] })
  })
  it("une formule illisible n'empêche pas de voir ses documents", async () => {
    const { GET } = await import("@/app/api/scan/documents/route")
    h.on = (rec) => (rec.table === "scanned_documents" && !rec.opts?.head ? { data: [docRow()], error: null } : account({ planError: true })(rec))
    const res = await GET(req("/api/scan/documents"))
    expect(res.status).toBe(200)
    expect((await res.json()).usage).toBeNull()
  })
})

describe("POST /api/scan/documents", () => {
  it("crée un document pour le compte connecté, jamais pour un autre", async () => {
    const { POST } = await import("@/app/api/scan/documents/route")
    const res = await POST(req("/api/scan/documents", "POST", { kind: "delivery_note", supplier: "Point P", user_id: "pirate" }))
    expect(res.status).toBe(201)
    const ins = h.calls.find((c) => c.op === "insert")!.payload as Record<string, unknown>
    expect(ins).toMatchObject({ user_id: UID, kind: "delivery_note", supplier: "Point P" })
    expect(ins.status).toBeUndefined()
  })
  it("409 SCAN_QUOTA quand les 50 documents du gratuit sont atteints, avec la formule dans le message", async () => {
    const { POST } = await import("@/app/api/scan/documents/route")
    h.on = account({ docs: 50 })
    const res = await POST(req("/api/scan/documents", "POST", {}))
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.code).toBe("SCAN_QUOTA")
    expect(json.message ?? json.error).toContain("Essentiel")
    expect(h.calls.some((c) => c.op === "insert")).toBe(false)
  })
  it("un compte Essentiel actif a 2 000 documents", async () => {
    const { POST } = await import("@/app/api/scan/documents/route")
    h.on = account({ docs: 50, plan: { plan: "starter", status: "active" } })
    expect((await POST(req("/api/scan/documents", "POST", {}))).status).toBe(201)
  })
  it("une formule résiliée retombe au quota gratuit", async () => {
    const { POST } = await import("@/app/api/scan/documents/route")
    h.on = account({ docs: 50, plan: { plan: "starter", status: "canceled" } })
    expect((await POST(req("/api/scan/documents", "POST", {}))).status).toBe(409)
  })
  it("une lecture de formule en échec n'est jamais prise pour « gratuit » : 503", async () => {
    const { POST } = await import("@/app/api/scan/documents/route")
    h.on = account({ planError: true })
    expect((await POST(req("/api/scan/documents", "POST", {}))).status).toBe(503)
  })
  it("400 sur une saisie invalide, 404 pour le client d'un autre, 503 sans migration", async () => {
    const { POST } = await import("@/app/api/scan/documents/route")
    expect((await POST(req("/api/scan/documents", "POST", { amount: "abc" }))).status).toBe(400)
    h.ownsClient = false
    expect((await POST(req("/api/scan/documents", "POST", { client_id: "33333333-3333-4333-8333-333333333333" }))).status).toBe(404)
    h.ownsClient = true
    h.on = account({ missing: true })
    expect((await POST(req("/api/scan/documents", "POST", {}))).status).toBe(503)
  })
})

describe("POST /api/scan/documents/[id]/pages", () => {
  it("enregistre la page en WebP sous le dossier du compte", async () => {
    const { POST } = await import("@/app/api/scan/documents/[id]/pages/route")
    const res = await POST(pageRequest(png(2000), 2), ctx(DOC))
    expect(res.status).toBe(201)
    expect(h.uploads).toEqual([{ path: `${UID}/${DOC}/2.webp`, size: 2033 > 5000 ? 5000 : 2033, contentType: "image/webp" }])
    const ins = h.calls.find((c) => c.table === "scanned_document_pages" && c.op === "insert")!.payload as Record<string, unknown>
    expect(ins).toMatchObject({ document_id: DOC, user_id: UID, position: 2, storage_path: `${UID}/${DOC}/2.webp`, mime: "image/webp" })
  })
  it("refuse un fichier absent, un numéro de page invalide, un format inconnu et un fichier trop lourd", async () => {
    const { POST } = await import("@/app/api/scan/documents/[id]/pages/route")
    expect((await POST(pageRequest(null), ctx(DOC))).status).toBe(400)
    expect((await POST(pageRequest(png(), 0), ctx(DOC))).status).toBe(400)
    expect((await POST(pageRequest(png(), 31), ctx(DOC))).status).toBe(400)
    expect((await POST(pageRequest(Buffer.from("<svg onload=alert(1)></svg>")), ctx(DOC))).status).toBe(415)
    expect((await POST(pageRequest(png(4 * 1024 * 1024)), ctx(DOC))).status).toBe(413)
    expect(h.uploads).toHaveLength(0)
  })
  it("ne se fie ni à l'extension ni au type annoncé : un .jpg qui contient du texte est refusé", async () => {
    const { POST } = await import("@/app/api/scan/documents/[id]/pages/route")
    expect((await POST(pageRequest(Buffer.from("GIF89a....."), 1, "photo.jpg"), ctx(DOC))).status).toBe(415)
  })
  it("404 pour le document d'un autre compte", async () => {
    const { POST } = await import("@/app/api/scan/documents/[id]/pages/route")
    h.on = (rec) => (rec.table === "scanned_documents" && rec.op === "select" && !rec.opts?.head ? { data: null, error: null } : account()(rec))
    expect((await POST(pageRequest(png()), ctx(DOC))).status).toBe(404)
  })
  it("409 SCAN_QUOTA quand le poids dépasse l'espace, sans rien enregistrer", async () => {
    const { POST } = await import("@/app/api/scan/documents/[id]/pages/route")
    h.on = account({ bytes: 200 * 1024 * 1024 })
    const res = await POST(pageRequest(png(2000)), ctx(DOC))
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe("SCAN_QUOTA")
    expect(h.uploads).toHaveLength(0)
  })
  it("une page envoyée deux fois : 409, jamais de doublon ; une ligne refusée retire le fichier", async () => {
    const { POST } = await import("@/app/api/scan/documents/[id]/pages/route")
    h.uploadError = { message: "The resource already exists" }
    expect((await POST(pageRequest(png()), ctx(DOC))).status).toBe(409)
    h.uploadError = null
    h.on = (rec) => (rec.table === "scanned_document_pages" && rec.op === "insert" ? { data: null, error: { code: "23505", message: "dup" } } : account()(rec))
    expect((await POST(pageRequest(png()), ctx(DOC))).status).toBe(409)
    expect(h.removed).toContainEqual([`${UID}/${DOC}/1.webp`])
  })
})

describe("GET / PATCH / DELETE /api/scan/documents/[id]", () => {
  it("lit un document avec les adresses signées de toutes ses pages", async () => {
    const { GET } = await import("@/app/api/scan/documents/[id]/route")
    const json = await (await GET(req("/x"), ctx(DOC))).json()
    expect(json.document.pages.map((p: { url: string }) => p.url)).toEqual([`https://signed/${UID}/${DOC}/1.webp`, `https://signed/${UID}/${DOC}/2.webp`])
    expect((await GET(req("/x"), ctx("pas-un-uuid"))).status).toBe(404)
  })
  it("modifie seulement les champs envoyés, pour le compte connecté", async () => {
    const { PATCH } = await import("@/app/api/scan/documents/[id]/route")
    expect((await PATCH(req("/x", "PATCH", {}), ctx(DOC))).status).toBe(400)
    const res = await PATCH(req("/x", "PATCH", { supplier: "Cedeo", status: "classified", amount: "10,5" }), ctx(DOC))
    expect(res.status).toBe(200)
    const upd = h.calls.find((c) => c.op === "update")!
    expect(upd.payload).toEqual({ supplier: "Cedeo", status: "classified", amount_cents: 1050 })
    expect(upd.filters).toContainEqual(["eq", "user_id", UID])
    h.ownsClient = false
    expect((await PATCH(req("/x", "PATCH", { client_id: "33333333-3333-4333-8333-333333333333" }), ctx(DOC))).status).toBe(404)
  })
  it("supprime la ligne puis les fichiers, limité au compte ; 404 si rien n'est supprimé", async () => {
    const { DELETE } = await import("@/app/api/scan/documents/[id]/route")
    h.on = (rec) => {
      if (rec.table === "scanned_document_pages") return { data: [{ storage_path: `${UID}/${DOC}/1.webp` }, { storage_path: `${UID}/${DOC}/2.webp` }], error: null }
      if (rec.op === "delete") return { data: [{ id: DOC }], error: null }
      return account()(rec)
    }
    expect((await DELETE(req("/x", "DELETE"), ctx(DOC))).status).toBe(200)
    expect(h.removed).toEqual([[`${UID}/${DOC}/1.webp`, `${UID}/${DOC}/2.webp`]])
    expect(h.calls.find((c) => c.op === "delete")!.filters).toContainEqual(["eq", "user_id", UID])
    h.removed = []
    h.on = (rec) => (rec.op === "delete" ? { data: [], error: null } : rec.table === "scanned_document_pages" ? { data: [], error: null } : account()(rec))
    expect((await DELETE(req("/x", "DELETE"), ctx(DOC))).status).toBe(404)
    expect(h.removed).toHaveLength(0)
  })
})

describe("GET /api/scan/documents/[id]/pdf", () => {
  it("assemble un vrai PDF à partir des pages du stockage", async () => {
    const { GET } = await import("@/app/api/scan/documents/[id]/pdf/route")
    const sharp = (await import("sharp")).default
    const webp = await sharp({ create: { width: 300, height: 400, channels: 3, background: "#ffffff" } }).webp().toBuffer()
    h.downloads.set(`${UID}/${DOC}/1.webp`, webp)
    h.downloads.set(`${UID}/${DOC}/2.webp`, webp)
    h.on = (rec) => (rec.table === "scanned_documents" ? { data: docRow(), error: null } : account()(rec))
    const res = await GET(req("/x"), ctx(DOC))
    expect(res.status).toBe(200)
    expect(res.headers.get("Content-Type")).toBe("application/pdf")
    const bytes = Buffer.from(await res.arrayBuffer())
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-")
    const { PDFDocument } = await import("pdf-lib")
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(2)
    expect(res.headers.get("Content-Disposition")).toContain("Bon%20de%20livraison")
  })
  it("409 sans page, 404 pour un autre compte, 401 sans connexion", async () => {
    const { GET } = await import("@/app/api/scan/documents/[id]/pdf/route")
    h.on = (rec) => (rec.table === "scanned_documents" ? { data: docRow({ pages: [] }), error: null } : account()(rec))
    expect((await GET(req("/x"), ctx(DOC))).status).toBe(409)
    h.on = (rec) => (rec.table === "scanned_documents" ? { data: null, error: null } : account()(rec))
    expect((await GET(req("/x"), ctx(DOC))).status).toBe(404)
    h.user = null
    expect((await GET(req("/x"), ctx(DOC))).status).toBe(401)
  })
})
