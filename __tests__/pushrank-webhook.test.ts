import crypto from "node:crypto"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { htmlToMarkdown } from "@/lib/pushrank/html-to-markdown"
import { markdownToHtml } from "@/lib/markdown"
import { blogSlug, parsePushrankEvent, publicationDecision, toBlogPost, verifyPushrankSignature } from "@/lib/pushrank/webhook"

const SECRET = "test-secret-0123456789"
const sign = (body: string, ts: string, secret = SECRET) =>
  "sha256=" + crypto.createHmac("sha256", secret).update(`${ts}.`).update(body).digest("hex")

describe("signature des requêtes PushRank", () => {
  const now = 1_790_000_000
  const ts = String(now)
  const body = '{"version":"2026-07","test":true,"source":"pushrank"}'

  it("accepte une requête signée avec le bon secret", () => {
    expect(verifyPushrankSignature({ rawBody: body, timestamp: ts, signature: sign(body, ts), secret: SECRET, nowSeconds: now })).toBe(true)
  })

  it("refuse un autre secret, un corps modifié, une requête trop ancienne ou incomplète", () => {
    const ok = sign(body, ts)
    expect(verifyPushrankSignature({ rawBody: body, timestamp: ts, signature: sign(body, ts, "autre"), secret: SECRET, nowSeconds: now })).toBe(false)
    expect(verifyPushrankSignature({ rawBody: body.replace("true", "false"), timestamp: ts, signature: ok, secret: SECRET, nowSeconds: now })).toBe(false)
    expect(verifyPushrankSignature({ rawBody: body, timestamp: ts, signature: ok, secret: SECRET, nowSeconds: now + 301 })).toBe(false)
    expect(verifyPushrankSignature({ rawBody: body, timestamp: null, signature: ok, secret: SECRET, nowSeconds: now })).toBe(false)
    expect(verifyPushrankSignature({ rawBody: body, timestamp: ts, signature: "sha256=abc", secret: SECRET, nowSeconds: now })).toBe(false)
  })
})

describe("lecture des événements", () => {
  const article = { version: "2026-07", event_id: "e", timestamp: "1", title: "T", content: "<p>x</p>", slug: "t", status: "publish" }

  it("reconnaît le test, la création, la mise à jour et le retrait", () => {
    expect(parsePushrankEvent({ version: "2026-07", test: true, source: "pushrank" })).toEqual({ ok: true, event: { kind: "test" } })
    expect(parsePushrankEvent({ ...article, action: "create" })).toMatchObject({ ok: true, event: { kind: "create" } })
    expect(parsePushrankEvent({ ...article, action: "update", remote_post_id: "abc" })).toMatchObject({ ok: true, event: { kind: "update", remotePostId: "abc" } })
    expect(parsePushrankEvent({ version: "2026-07", action: "unpublish", remote_post_id: "abc" })).toEqual({ ok: true, event: { kind: "unpublish", remotePostId: "abc" } })
  })

  it("refuse une version inconnue, un champ manquant ou une action inconnue", () => {
    expect(parsePushrankEvent({ ...article, version: "2027-01", action: "create" })).toEqual({ ok: false, error: "unsupported_version" })
    expect(parsePushrankEvent({ ...article, action: "create", title: "" })).toEqual({ ok: false, error: "missing_title" })
    expect(parsePushrankEvent({ ...article, action: "update" })).toEqual({ ok: false, error: "missing_remote_post_id" })
    expect(parsePushrankEvent({ ...article, action: "purge" })).toEqual({ ok: false, error: "unknown_action" })
  })
})

describe("conversion du HTML en Markdown du blog", () => {
  it("garde la structure de l'article", () => {
    const md = htmlToMarkdown(
      "<h1>Titre</h1><p>Un <strong>gras</strong> et un <a href=\"https://qonforme.fr/guide\">lien</a>.</p><h3>Sous-titre ?</h3><ul><li>un</li><li><p>deux</p><ul><li>trois</li></ul></li></ul><ol><li>a</li><li>b</li></ol><table><tr><th>Taux</th></tr><tr><td>10 %</td></tr></table>",
    )
    expect(md).toBe(
      "## Titre\n\nUn **gras** et un [lien](https://qonforme.fr/guide).\n\n### Sous-titre ?\n\n- un\n- deux\n- trois\n\n1. a\n2. b\n\n<table><tbody><tr><th>Taux</th></tr><tr><td>10 %</td></tr></tbody></table>",
    )
  })

  it("ne laisse passer ni script, ni attribut, ni lien javascript, ni HTML caché dans le texte", () => {
    const html = markdownToHtml(
      htmlToMarkdown(
        '<script>alert(1)</script><p onclick="x">Texte <a href="javascript:alert(1)">piège</a><img src=x onerror=alert(2)><iframe src="https://evil"></iframe></p>' +
          '<p>&lt;script&gt;alert(3)&lt;/script&gt; <a href=\'https://a.b/c"onmouseover="x\'>q</a></p><style>p{}</style>',
      ),
    )
    expect(html).not.toMatch(/<script|<iframe|<img|<style|onclick|onerror|javascript:|onmouseover="/i)
    expect(html).toContain("&lt;script&gt;alert(3)&lt;/script&gt;")
    expect(html).toContain('href="https://a.b/c%22onmouseover=%22x"')
  })

  it("un texte ne devient jamais un titre, une liste ou du gras", () => {
    const md = htmlToMarkdown("<p># pas un titre</p><p>- pas une liste</p><p>1. pas une liste</p><p>2 * 3 [x](y) `z`</p>")
    const html = markdownToHtml(md)
    expect(html).not.toMatch(/<h\d|<ul|<ol|<em|<code|<a /)
  })
})

describe("article du blog et décision de publication", () => {
  const base = { title: "TVA &amp; travaux", content: "<h2>Quel taux ?</h2><p>Le taux est de 10 % en rénovation.</p>", slug: "TVA Travaux : Guide 2026 !", status: "publish" }

  it("prépare les colonnes de l'article", () => {
    const post = toBlogPost({ ...base, excerpt: "", meta_description: "Le taux de TVA des travaux.", meta_title: "TVA travaux", focus_keyword: "tva travaux", robots_config: { index: false, follow: true } })
    expect(post.title).toBe("TVA & travaux")
    expect(post.slug).toBe("tva-travaux-guide-2026")
    expect(post.excerpt).toBe("Le taux de TVA des travaux.")
    expect(post.seo_title).toBe("TVA travaux")
    expect(post.robots).toEqual({ index: false, follow: true })
    expect(post.ai_keywords).toEqual(["tva travaux"])
    expect(post.content).toBe("## Quel taux ?\n\nLe taux est de 10 % en rénovation.")
    expect(blogSlug("", "Écrire œuvre")).toBe("ecrire-oeuvre")
  })

  it("publie directement, sauf une valeur périmée ou une affirmation interdite", () => {
    expect(publicationDecision(toBlogPost(base))).toEqual({ publish: true, heldReason: null })
    expect(publicationDecision(toBlogPost({ ...base, content: "<p>Les PDP transmettent la facture.</p>" })).publish).toBe(true)
    const held = publicationDecision(toBlogPost({ ...base, content: "<p>Choisissez un logiciel certifié par l'État.</p>" }))
    expect(held.publish).toBe(false)
    expect(held.heldReason).toMatch(/certifié/)
    expect(publicationDecision(toBlogPost({ ...base, content: "<p>Le seuil est de 36 800 € pour les services.</p>" })).publish).toBe(false)
  })
})

// ── Route complète, sur une base en mémoire ─────────────────────────────────
type Row = Record<string, unknown>
const db: { rows: Row[]; failWith: { code: string; message: string } | null } = { rows: [], failWith: null }

vi.mock("next/cache", () => ({ revalidatePath: () => {} }))
vi.mock("@/lib/pushrank/cover", () => ({ rehostCover: async (url?: string) => (url ? "https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/blog-covers/pushrank/x.png" : null) }))
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => {
        const filters: [string, unknown][] = []
        const q = {
          eq(c: string, v: unknown) {
            filters.push([c, v])
            return q
          },
          async maybeSingle() {
            if (db.failWith) return { data: null, error: db.failWith }
            return { data: db.rows.find((r) => filters.every(([c, v]) => r[c] === v)) ?? null, error: null }
          },
        }
        return q
      },
      insert: (obj: Row) => ({
        select: () => ({
          async single() {
            if (db.failWith) return { data: null, error: db.failWith }
            if (db.rows.some((r) => r.slug === obj.slug || (obj.external_create_key && r.external_create_key === obj.external_create_key))) {
              return { data: null, error: { code: "23505", message: "duplicate" } }
            }
            const row = { id: crypto.randomUUID(), ...obj }
            db.rows.push(row)
            return { data: row, error: null }
          },
        }),
      }),
      update: (obj: Row) => ({
        async eq(c: string, v: unknown) {
          db.rows.filter((r) => r[c] === v).forEach((r) => Object.assign(r, obj))
          return { error: null }
        },
      }),
    }),
  }),
}))

async function send(payload: Record<string, unknown>, opts: { key?: string; secret?: string } = {}) {
  const { POST } = await import("@/app/api/pushrank/webhook/route")
  const { NextRequest } = await import("next/server")
  const raw = JSON.stringify(payload)
  const ts = String(Math.floor(Date.now() / 1000))
  const key = opts.key ?? crypto.randomUUID()
  const res = await POST(
    new NextRequest("https://qonforme.fr/api/pushrank/webhook", {
      method: "POST",
      body: raw,
      headers: {
        "content-type": "application/json",
        "x-pushrank-timestamp": ts,
        "x-pushrank-signature": sign(raw, ts, opts.secret ?? SECRET),
        "x-pushrank-event-id": key,
        "x-pushrank-idempotency-key": key,
      },
    }),
  )
  const text = await res.text()
  return { status: res.status, body: text ? JSON.parse(text) : null }
}

const article = (over: Record<string, unknown> = {}) => ({
  version: "2026-07",
  action: "create",
  event_id: "e",
  timestamp: "1",
  title: "Comment relancer une facture impayée",
  content: "<h2>Pourquoi relancer ?</h2><p>Une relance polie suffit souvent.</p>",
  excerpt: "La méthode pour relancer.",
  slug: "relancer-facture-impayee",
  status: "publish",
  meta_title: "Relancer une facture impayée : la méthode",
  meta_description: "Comment relancer une facture impayée, étape par étape.",
  focus_keyword: "relancer facture impayée",
  featured_image_url: "https://s3.example.com/cover.png",
  featured_image_alt: "Une facture",
  robots_config: { index: true, follow: true },
  ...over,
})

describe("route /api/pushrank/webhook", () => {
  beforeEach(() => {
    db.rows = [{ id: "11111111-1111-4111-8111-111111111111", slug: "article-existant", source: null, is_published: true }]
    db.failWith = null
    process.env.PUSHRANK_WEBHOOK_SECRET = SECRET
  })

  it("répond au test de connexion sans rien enregistrer, refuse une mauvaise signature", async () => {
    expect((await send({ version: "2026-07", test: true, source: "pushrank" })).status).toBe(200)
    expect((await send({ version: "2026-07", test: true, source: "pushrank" }, { secret: "faux" })).status).toBe(401)
    expect(db.rows).toHaveLength(1)
  })

  it("publie un article et rend son id et son adresse ; un renvoi ne crée pas de doublon", async () => {
    const first = await send(article(), { key: "cle-1" })
    expect(first.status).toBe(200)
    expect(first.body.url).toBe("https://qonforme.fr/blog/relancer-facture-impayee")
    const again = await send(article(), { key: "cle-1" })
    expect(again.body).toEqual(first.body)
    const created = db.rows.filter((r) => r.source === "pushrank")
    expect(created).toHaveLength(1)
    expect(created[0]).toMatchObject({ is_published: true, seo_title: "Relancer une facture impayée : la méthode", cover_alt: "Une facture", external_create_key: "cle-1" })
    expect(created[0].content).toBe("## Pourquoi relancer ?\n\nUne relance polie suffit souvent.")
  })

  it("donne une autre adresse si la première est prise, et retient en brouillon un article fautif", async () => {
    const res = await send(article({ slug: "article-existant", content: "<p>Un logiciel certifié par l'État.</p>" }))
    expect(res.body.url).toBe("https://qonforme.fr/blog/article-existant-2")
    const row = db.rows.find((r) => r.slug === "article-existant-2")!
    expect(row.is_published).toBe(false)
    expect(row.held_reason).toMatch(/certifié/)
  })

  it("met à jour à la même adresse, retire sans supprimer, et ignore les articles qui ne viennent pas de PushRank", async () => {
    const { body } = await send(article())
    const upd = await send(article({ action: "update", remote_post_id: body.id, title: "Nouveau titre", slug: "autre-adresse" }))
    expect(upd).toEqual({ status: 200, body: { id: body.id, url: "https://qonforme.fr/blog/relancer-facture-impayee" } })
    expect(db.rows.find((r) => r.id === body.id)!.title).toBe("Nouveau titre")

    expect((await send({ version: "2026-07", action: "unpublish", remote_post_id: body.id })).status).toBe(200)
    expect(db.rows.find((r) => r.id === body.id)!.is_published).toBe(false)

    expect((await send(article({ action: "update", remote_post_id: "11111111-1111-4111-8111-111111111111" }))).status).toBe(404)
    expect((await send({ version: "2026-07", action: "unpublish", remote_post_id: "inconnu" })).status).toBe(404)
  })

  it("répond 503 si le secret manque ou si la migration n'est pas appliquée (PushRank réessaie)", async () => {
    db.failWith = { code: "42703", message: 'column blog_posts.external_create_key does not exist' }
    expect(await send(article())).toEqual({ status: 503, body: { error: "migration_pending" } })
    delete process.env.PUSHRANK_WEBHOOK_SECRET
    expect((await send(article())).status).toBe(503)
  })
})
