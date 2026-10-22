// @vitest-environment node
/** Discussion avec Christophe : règles, envoi du visiteur, lecture, réponses de l'équipe, cookie et protection. */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { hashToken, isTokenFormat } from "@/lib/signature/crypto"
import { CHAT_COOKIE, deviceOf, normalizeEmail, parseVisitorInput, safeFileName } from "@/lib/support-chat/rules"

type Result = { data?: unknown; error?: { code?: string; message?: string } | null; count?: number | null }
type Rec = { client: "admin" | "user"; table: string; op: string; payload?: unknown; filters: [string, ...unknown[]][]; cols?: string; opts?: { head?: boolean } }

const h = vi.hoisted(() => ({
  user: null as { id: string; email: string } | null,
  admin: true,
  calls: [] as Rec[],
  on: (() => ({ data: null, error: null })) as (rec: Rec) => Result,
  uploads: [] as string[],
  mails: [] as { to: string; subject: string; html: string; fromName?: string; replyTo?: string }[],
  mailFails: false,
}))

vi.mock("@/lib/admin-require", () => ({ isAdminAuthenticated: async () => h.admin }))
vi.mock("@/lib/email/resend", () => ({
  sendEmail: async (opts: { to: string; subject: string; html: string }) => {
    if (h.mailFails) throw new Error("Resend error: boom")
    h.mails.push(opts)
    return { id: "mail" }
  },
}))
vi.mock("@/lib/blog-images/server", async (orig) => {
  const real = await orig<typeof import("@/lib/blog-images/server")>()
  return { ...real, prepareImage: async (buf: Buffer) => ({ data: Buffer.alloc(Math.min(buf.length, 4000), 1), mimeType: "image/webp", width: 100, height: 100 }) }
})
function fake(client: "admin" | "user") {
  return {
    auth: { getUser: async () => ({ data: { user: h.user } }) },
    from(table: string) {
      const rec: Rec = { client, table, op: "select", filters: [] }
      h.calls.push(rec)
      const c: Record<string, unknown> = {}
      for (const m of ["eq", "in", "gt", "order", "limit"]) c[m] = (...a: unknown[]) => { rec.filters.push([m, ...a]); return c }
      c.select = (cols?: string, opts?: { head?: boolean }) => { rec.cols = cols; rec.opts = opts; return c }
      c.insert = (p: unknown) => { rec.op = "insert"; rec.payload = p; return c }
      c.update = (p: unknown) => { rec.op = "update"; rec.payload = p; return c }
      c.delete = () => { rec.op = "delete"; return c }
      c.single = async () => h.on(rec)
      c.maybeSingle = async () => h.on(rec)
      c.then = (ok: (r: Result) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(h.on(rec)).then(ok, ko)
      return c
    },
    storage: { from: () => ({
      upload: async (path: string) => { h.uploads.push(path); return { error: null } },
      remove: async () => ({ error: null }),
      createSignedUrls: async (paths: string[]) => ({ data: paths.map((path) => ({ path, signedUrl: `https://files.test/${path}` })) }),
    }) },
  }
}
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => fake("user"), createAdminClient: () => fake("admin") }))

import { GET, POST } from "@/app/api/support/chat/route"
import { GET as openLink } from "@/app/contact/c/[token]/route"
import { PATCH as adminPatch, POST as adminPostRoute } from "@/app/api/admin/support/chat/[id]/route"
import { conversationLink, hashIp, tokenFor } from "@/lib/support-chat/server"

const CID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const MID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
const MISSING = { code: "42P01", message: "relation does not exist" }
const conv = (over: Record<string, unknown> = {}) => ({
  id: CID, email: "marie@exemple.fr", name: "Marie Dupont", user_id: null, source: "bubble", subject: null, status: "open", admin_unread: true,
  access_hash: hashToken(tokenFor(CID)), created_at: "2026-10-22T10:00:00Z", ...over,
})

function world(opts: { existing?: Record<string, unknown> | null; recent?: number; perEmail?: number; total?: number; missing?: boolean; messages?: unknown[]; attachments?: unknown[] } = {}) {
  const { existing = null, recent = 0, perEmail = 0, total = 1, missing = false, messages = [], attachments = [] } = opts
  return (rec: Rec): Result => {
    if (missing) return { data: null, error: MISSING }
    if (rec.table === "support_conversations") {
      if (rec.op === "insert") return { data: conv({ ...(rec.payload as object), id: (rec.payload as { id: string }).id }), error: null }
      if (rec.op === "select" && rec.opts?.head) return { data: null, error: null, count: perEmail }
      if (rec.op === "select") return { data: existing, error: null }
      if (rec.op === "update") return { data: [{ id: CID }], error: null }
      return { data: null, error: null }
    }
    if (rec.table === "support_chat_messages") {
      if (rec.op === "insert") return { data: { id: MID }, error: null }
      if (rec.op === "select" && rec.opts?.head) return { data: null, error: null, count: rec.filters.some((f) => f[1] === "ip_hash") ? recent : total }
      if (rec.op === "select") return { data: messages, error: null }
      return { data: null, error: null }
    }
    if (rec.table === "support_chat_attachments") return rec.op === "select" ? { data: attachments, error: null } : { data: null, error: null }
    return { data: [], error: null }
  }
}

function png(extra = 0): Buffer {
  const b = Buffer.alloc(33 + extra)
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0)
  b.writeUInt32BE(13, 8); b.write("IHDR", 12); b.writeUInt32BE(10, 16); b.writeUInt32BE(10, 20)
  return b
}
function postReq(fields: Record<string, string>, files: { name: string; data: Buffer }[] = [], cookie?: string) {
  const form = new FormData()
  for (const [k, v] of Object.entries(fields)) form.set(k, v)
  for (const f of files) form.append("files", new File([new Uint8Array(f.data)], f.name))
  return new NextRequest("https://qonforme.test/api/support/chat", { method: "POST", body: form, headers: { ...(cookie ? { cookie: `${CHAT_COOKIE}=${cookie}` } : {}), "x-forwarded-for": "203.0.113.9", "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/605.1" } })
}
const getReq = (query = "", cookie?: string) => new NextRequest(`https://qonforme.test/api/support/chat${query}`, { headers: cookie ? { cookie: `${CHAT_COOKIE}=${cookie}` } : {} })
const ctx = (id: string) => ({ params: Promise.resolve({ id }) })

beforeEach(() => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key"
  delete process.env.SUPPORT_CHAT_SECRET
  h.user = null; h.admin = true; h.calls = []; h.uploads = []; h.mails = []; h.mailFails = false; h.on = world()
})

describe("règles", () => {
  it("email normalisé, refusé quand il est faux", () => {
    expect(normalizeEmail("  Marie@Exemple.FR ")).toBe("marie@exemple.fr")
    expect(normalizeEmail("pas-un-email")).toBeNull()
    expect(normalizeEmail(42)).toBeNull()
  })
  it("champ piège rempli : refus silencieux ; message vide ou trop long ; email demandé sans conversation", () => {
    expect(parseVisitorInput({ website: "http://spam", message: "x", email: "a@b.fr" }, { knownEmail: null, hasConversation: false })).toMatchObject({ ok: false, honeypot: true })
    expect(parseVisitorInput({ message: "  " }, { knownEmail: null, hasConversation: true })).toMatchObject({ ok: false })
    expect(parseVisitorInput({ message: "x".repeat(5001) }, { knownEmail: null, hasConversation: true })).toMatchObject({ ok: false })
    expect(parseVisitorInput({ message: "Bonjour" }, { knownEmail: null, hasConversation: false })).toMatchObject({ ok: false })
    expect(parseVisitorInput({ message: "Bonjour" }, { knownEmail: null, hasConversation: true })).toMatchObject({ ok: true })
    expect(parseVisitorInput({ message: "Bonjour" }, { knownEmail: "a@b.fr", hasConversation: false })).toMatchObject({ ok: true })
  })
  it("chemin d'origine sans paramètres, source et catégorie en liste blanche", () => {
    const r = parseVisitorInput({ message: "m", email: "a@b.fr", path: "/pricing?token=secret#x", source: "pirate", category: "billing" }, { knownEmail: null, hasConversation: false })
    expect(r.ok && r.value).toMatchObject({ path: "/pricing", source: "bubble", category: "billing" })
  })
  it("appareil et nom de fichier", () => {
    expect(deviceOf("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari/605")).toBe("iPhone · Safari")
    expect(deviceOf(null)).toBeNull()
    expect(safeFileName("../../etc/pass<wd>.png")).toBe("passwd.png")
    expect(safeFileName("...")).toBe("piece-jointe")
  })
  it("jeton stable, de forme valide, empreinte recalculable ; lien sans le secret", () => {
    const t = tokenFor(CID)
    expect(isTokenFormat(t)).toBe(true)
    expect(tokenFor(CID)).toBe(t)
    expect(tokenFor("autre")).not.toBe(t)
    expect(conversationLink(CID)).toBe(`https://qonforme.fr/contact/c/${t}`)
    expect(hashIp("1.2.3.4")).toMatch(/^[0-9a-f]{32}$/)
    expect(hashIp("1.2.3.4")).not.toContain("1.2.3.4")
    expect(hashIp(null)).toBeNull()
  })
})

describe("envoi du visiteur", () => {
  it("nouvelle conversation : enregistrée, cookie HttpOnly, jeton jamais dans le corps, accusé et notification par email", async () => {
    const res = await POST(postReq({ message: "Comment ajouter mon logo ?", email: "Marie@Exemple.fr", name: "Marie Dupont", path: "/pricing?x=1" }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body).toMatchObject({ ok: true, isNew: true })
    expect(JSON.stringify(body)).not.toContain(tokenFor(body.conversationId))
    const cookie = res.headers.get("set-cookie") ?? ""
    expect(cookie).toContain(`${CHAT_COOKIE}=${tokenFor(body.conversationId)}`)
    expect(cookie.toLowerCase()).toContain("httponly")
    expect(cookie.toLowerCase()).toContain("samesite=lax")
    const insert = h.calls.find((c) => c.table === "support_conversations" && c.op === "insert")!
    expect(insert.payload).toMatchObject({ email: "marie@exemple.fr", origin_path: "/pricing", device: "iPhone · Safari", status: "open" })
    expect((insert.payload as { access_hash: string }).access_hash).toBe(hashToken(tokenFor(body.conversationId)))
    expect(h.calls.find((c) => c.table === "support_chat_messages" && c.op === "insert")!.payload).toMatchObject({ sender: "visitor" })
    expect(h.mails.map((m) => m.to).sort()).toEqual(["contact@qonforme.fr", "marie@exemple.fr"].sort())
    const receipt = h.mails.find((m) => m.to === "marie@exemple.fr")!
    expect(receipt.html).toContain(`/contact/c/${tokenFor(body.conversationId)}`)
    expect(receipt.html).not.toMatch(/sous \d+ ?h|24 ?h|rapidement/i)
  })

  it("compte connecté : son email est utilisé, aucun email demandé", async () => {
    h.user = { id: "u1", email: "Artisan@Exemple.fr" }
    const res = await POST(postReq({ message: "Bonjour" }))
    expect(res.status).toBe(201)
    const insert = h.calls.find((c) => c.table === "support_conversations" && c.op === "insert")!
    expect(insert.payload).toMatchObject({ email: "artisan@exemple.fr", user_id: "u1" })
  })

  it("sans email ni conversation : 400, rien n'est écrit", async () => {
    const res = await POST(postReq({ message: "Bonjour" }))
    expect(res.status).toBe(400)
    expect(h.calls.filter((c) => c.op === "insert")).toEqual([])
  })

  it("champ piège rempli : réponse de succès, rien d'écrit ni d'envoyé", async () => {
    const res = await POST(postReq({ message: "Achetez", email: "a@b.fr", website: "http://spam" }))
    expect(res.status).toBe(201)
    expect(h.calls.filter((c) => c.op === "insert")).toEqual([])
    expect(h.mails).toEqual([])
  })

  it("conversation existante (cookie) : le message s'ajoute, même résolue, et rouvre la conversation ; pas de second accusé", async () => {
    h.on = world({ existing: conv({ status: "resolved" }) })
    const res = await POST(postReq({ message: "Merci, une autre question" }, [], tokenFor(CID)))
    expect(res.status).toBe(201)
    expect(await res.json()).toMatchObject({ isNew: false })
    expect(res.headers.get("set-cookie")).toBeNull()
    expect(h.calls.find((c) => c.table === "support_conversations" && c.op === "update")!.payload).toMatchObject({ status: "open", admin_unread: true, resolved_at: null })
    expect(h.mails.map((m) => m.to)).toEqual(["contact@qonforme.fr"])
  })

  it("limites : trop de messages par adresse IP, trop de conversations par email, conversation pleine → 429", async () => {
    h.on = world({ recent: 12 })
    expect((await POST(postReq({ message: "m", email: "a@b.fr" }))).status).toBe(429)
    h.on = world({ perEmail: 5 })
    expect((await POST(postReq({ message: "m", email: "a@b.fr" }))).status).toBe(429)
    h.on = world({ existing: conv(), total: 200 })
    expect((await POST(postReq({ message: "m" }, [], tokenFor(CID)))).status).toBe(429)
  })

  it("migration pas appliquée : 503 NOT_ACTIVE pour que la page retombe sur l'ancien formulaire", async () => {
    h.on = world({ missing: true })
    const res = await POST(postReq({ message: "Bonjour", email: "a@b.fr" }))
    expect(res.status).toBe(503)
    expect(await res.json()).toMatchObject({ code: "NOT_ACTIVE" })
    expect(h.mails).toEqual([])
  })

  it("pièces jointes : image convertie en WebP, PDF reconnu à sa signature, autre format et excès refusés", async () => {
    const ok = await POST(postReq({ message: "Voici", email: "a@b.fr" }, [
      { name: "capture écran.png", data: png() },
      { name: "devis.pdf", data: Buffer.from("%PDF-1.7\n%données") },
    ]))
    expect(ok.status).toBe(201)
    expect(h.uploads).toHaveLength(2)
    expect(h.uploads.every((p) => /\.(webp|pdf)$/.test(p))).toBe(true)
    const rows = h.calls.filter((c) => c.table === "support_chat_attachments" && c.op === "insert").map((c) => c.payload)
    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ mime_type: "image/webp", file_name: "capture écran.webp" }),
      expect.objectContaining({ mime_type: "application/pdf", file_name: "devis.pdf" }),
    ]))

    h.calls = []; h.uploads = []
    const bad = await POST(postReq({ message: "x", email: "a@b.fr" }, [{ name: "virus.exe", data: Buffer.from("MZ....") }]))
    expect(bad.status).toBe(415)
    expect(h.calls.filter((c) => c.op === "insert")).toEqual([])
    const many = await POST(postReq({ message: "x", email: "a@b.fr" }, [1, 2, 3, 4].map((i) => ({ name: `${i}.pdf`, data: Buffer.from("%PDF-1") }))))
    expect(many.status).toBe(400)
    const heavy = await POST(postReq({ message: "x", email: "a@b.fr" }, [{ name: "gros.pdf", data: Buffer.concat([Buffer.from("%PDF-"), Buffer.alloc(4 * 1024 * 1024)]) }]))
    expect(heavy.status).toBe(413)
  })

  it("un email qui échoue ne fait pas échouer l'envoi", async () => {
    h.mailFails = true
    const res = await POST(postReq({ message: "Bonjour", email: "a@b.fr" }))
    expect(res.status).toBe(201)
  })
})

describe("lecture par le visiteur", () => {
  it("sans cookie ni compte : aucune conversation", async () => {
    const body = await (await GET(getReq())).json()
    expect(body).toMatchObject({ available: true, conversation: null, messages: [] })
  })

  it("avec le cookie : messages du visiteur et de Christophe, jamais les notes, liens signés, réponses marquées lues sur demande", async () => {
    h.on = world({
      existing: conv(),
      messages: [
        { id: "m1", sender: "visitor", body: "Question", created_at: "2026-10-22T10:00:00Z", visitor_seen_at: null },
        { id: "m2", sender: "admin", body: "Réponse", created_at: "2026-10-22T11:00:00Z", visitor_seen_at: null },
      ],
      attachments: [{ id: "a1", message_id: "m2", storage_path: `${CID}/x.pdf`, file_name: "devis.pdf", mime_type: "application/pdf", size_bytes: 1200 }],
    })
    const res = await GET(getReq("?seen=1", tokenFor(CID)))
    const body = await res.json()
    expect(body.messages.map((m: { sender: string }) => m.sender)).toEqual(["visitor", "admin"])
    expect(body.messages[1].attachments[0]).toMatchObject({ name: "devis.pdf", url: `https://files.test/${CID}/x.pdf` })
    expect(res.headers.get("cache-control")).toBe("no-store")
    const select = h.calls.find((c) => c.table === "support_chat_messages" && c.op === "select")!
    expect(select.filters).toContainEqual(["in", "sender", ["visitor", "admin"]])
    expect(h.calls.some((c) => c.table === "support_chat_messages" && c.op === "update")).toBe(true)
  })

  it("jeton inconnu ou mal formé : pas de conversation", async () => {
    h.on = world({ existing: null })
    expect((await (await GET(getReq("", tokenFor(CID)))).json()).conversation).toBeNull()
    expect((await (await GET(getReq("", "pas-un-jeton"))).json()).conversation).toBeNull()
  })

  it("migration pas appliquée : available false", async () => {
    h.on = world({ missing: true })
    expect(await (await GET(getReq("", tokenFor(CID)))).json()).toMatchObject({ available: false })
  })
})

describe("lien « Ouvrir la conversation »", () => {
  const open = (token: string) => openLink(new NextRequest(`https://qonforme.test/contact/c/${token}`), { params: Promise.resolve({ token }) })
  it("pose le cookie et renvoie vers /contact sans jeton dans l'adresse", async () => {
    h.on = world({ existing: conv() })
    const res = await open(tokenFor(CID))
    expect(res.status).toBe(303)
    const location = res.headers.get("location") ?? ""
    expect(location).toContain("/contact?conversation=1")
    expect(location).not.toContain(tokenFor(CID))
    expect(res.headers.get("set-cookie")).toContain(`${CHAT_COOKIE}=${tokenFor(CID)}`)
    expect(res.headers.get("referrer-policy")).toBe("no-referrer")
  })
  it("jeton faux ou inconnu : /contact seul, aucun cookie", async () => {
    h.on = world({ existing: null })
    const unknown = await open(tokenFor(CID))
    expect(unknown.headers.get("set-cookie")).toBeNull()
    const bad = await open("n-importe-quoi")
    expect(bad.headers.get("set-cookie")).toBeNull()
    expect(bad.headers.get("location")).toMatch(/\/contact$/)
  })
})

describe("côté équipe", () => {
  const replyReq = (body: string, kind = "reply") => {
    const form = new FormData()
    form.set("body", body); form.set("kind", kind)
    return new NextRequest("https://qonforme.test/api/admin/support/chat/x", { method: "POST", body: form })
  }

  it("refuse sans session admin", async () => {
    h.admin = false
    expect((await adminPostRoute(replyReq("Bonjour"), ctx(CID))).status).toBe(403)
    expect((await adminPatch(new NextRequest("https://qonforme.test/x", { method: "PATCH", body: JSON.stringify({ status: "resolved" }) }), ctx(CID))).status).toBe(403)
    expect(h.calls).toEqual([])
  })

  it("réponse : enregistrée, conversation « en attente », email de Christophe avec le lien, texte échappé", async () => {
    h.on = world({ existing: conv(), messages: [{ body: "Comment ajouter mon logo ?" }] })
    const res = await adminPostRoute(replyReq("Bonjour <b>Marie</b>,\n\nOuvrez Paramètres."), ctx(CID))
    expect(res.status).toBe(201)
    expect(h.calls.find((c) => c.table === "support_chat_messages" && c.op === "insert")!.payload).toMatchObject({ sender: "admin" })
    expect(h.calls.find((c) => c.table === "support_conversations" && c.op === "update")!.payload).toMatchObject({ status: "pending", admin_unread: false })
    expect(h.mails).toHaveLength(1)
    const mail = h.mails[0]
    expect(mail.to).toBe("marie@exemple.fr")
    expect(mail.fromName).toBe("Christophe de Qonforme")
    expect(mail.html).toContain("&lt;b&gt;Marie&lt;/b&gt;")
    expect(mail.html).not.toContain("<b>Marie</b>")
    expect(mail.html).toContain(`/contact/c/${tokenFor(CID)}`)
    expect(mail.html).toContain("Responsable service client")
    expect(mail.html).toContain("Comment ajouter mon logo ?")
  })

  it("note interne : jamais d'email, la conversation ne change pas", async () => {
    h.on = world({ existing: conv() })
    const res = await adminPostRoute(replyReq("Compte créé il y a 2 jours", "note"), ctx(CID))
    expect(res.status).toBe(201)
    expect(h.mails).toEqual([])
    expect(h.calls.find((c) => c.table === "support_chat_messages" && c.op === "insert")!.payload).toMatchObject({ sender: "note" })
    expect(h.calls.some((c) => c.table === "support_conversations" && c.op === "update")).toBe(false)
  })

  it("email en échec : réponse gardée, 502 explicite, erreur notée, renvoi possible", async () => {
    h.on = world({ existing: conv(), messages: [{ body: "Question" }] })
    h.mailFails = true
    const res = await adminPostRoute(replyReq("Voici la réponse"), ctx(CID))
    expect(res.status).toBe(502)
    expect(await res.json()).toMatchObject({ emailFailed: true, messageId: MID })
    expect(h.calls.some((c) => c.table === "support_chat_messages" && c.op === "update" && JSON.stringify(c.payload).includes("email_error"))).toBe(true)

    h.mailFails = false
    h.on = (rec) => rec.table === "support_chat_messages" && rec.op === "select" && rec.cols?.includes("sender") ? { data: { id: MID, body: "Voici la réponse", sender: "admin" }, error: null } : world({ existing: conv(), messages: [{ body: "Question" }] })(rec)
    const again = await adminPostRoute(new NextRequest("https://qonforme.test/x", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "resend", messageId: MID }) }), ctx(CID))
    expect(again.status).toBe(200)
    expect(h.mails).toHaveLength(1)
  })

  it("réponse vide, conversation inconnue, identifiant invalide", async () => {
    expect((await adminPostRoute(replyReq("   "), ctx(CID))).status).toBe(400)
    h.on = world({ existing: null })
    expect((await adminPostRoute(replyReq("Bonjour"), ctx(CID))).status).toBe(404)
    expect((await adminPostRoute(replyReq("Bonjour"), ctx("pas-un-uuid"))).status).toBe(404)
  })

  it("statut : résolu horodaté, statut inconnu refusé", async () => {
    const patch = (body: unknown) => adminPatch(new NextRequest("https://qonforme.test/x", { method: "PATCH", body: JSON.stringify(body) }), ctx(CID))
    expect((await patch({ status: "resolved" })).status).toBe(200)
    const upd = h.calls.find((c) => c.table === "support_conversations" && c.op === "update")!.payload as Record<string, unknown>
    expect(upd).toMatchObject({ status: "resolved", admin_unread: false })
    expect(typeof upd.resolved_at).toBe("string")
    expect((await patch({ status: "supprimé" })).status).toBe(400)
    expect((await patch({})).status).toBe(400)
  })
})

import { chatSurface } from "@/lib/support-chat/surface"
describe("où s'affiche la bulle", () => {
  it("pages publiques d'information et d'accès", () => {
    for (const path of ["/", "/pricing", "/blog", "/blog/un-article", "/guide/tva-travaux", "/modele/devis-electricien", "/outils/calculateur-tva", "/facturation/plombier", "/glossaire/devis", "/login", "/signup", "/cgu"]) {
      expect(chatSurface(path), path).toBe("bubble")
    }
  })
  it("jamais sur la page Contact, les pages du client de l'artisan, le scan, l'admin ni l'application", () => {
    for (const path of ["/contact", "/contact/c/abc", "/regler/abc", "/signer/abc", "/s/abc", "/scan/p/abc", "/scan-telephone", "/admin", "/admin/support", "/invitation-comptable", "/dashboard", "/invoices/1", "/demo", "/api/support/chat"]) {
      expect(chatSurface(path), path).toBeNull()
    }
  })
})

import { adminThread } from "@/lib/support-chat/server"
import { createAdminClient } from "@/lib/supabase/server"
describe("boîte admin : fiche d'une conversation", () => {
  it("rend les notes internes et les pièces jointes avec lien signé", async () => {
    h.on = world({
      existing: conv(),
      messages: [{ id: MID, sender: "note", body: "À suivre", created_at: "2026-10-22T10:00:00Z", visitor_seen_at: null, emailed_at: null, email_error: null }],
      attachments: [{ id: "a1", message_id: MID, storage_path: `${CID}/a.webp`, file_name: "a.webp", mime_type: "image/webp", size_bytes: 10 }],
    })
    const res = await adminThread(createAdminClient() as never, CID)
    expect(res.status).toBe(200)
    const msgs = res.body.messages as { sender: string; attachments: { url: string }[] }[]
    expect(msgs[0].sender).toBe("note")
    expect(msgs[0].attachments[0].url).toContain("https://files.test/")
  })
  it("503 avant la migration, 404 si la conversation n'existe pas", async () => {
    h.on = world({ missing: true })
    expect((await adminThread(createAdminClient() as never, CID)).status).toBe(503)
    h.on = world({ existing: null })
    expect((await adminThread(createAdminClient() as never, CID)).status).toBe(404)
  })
})
