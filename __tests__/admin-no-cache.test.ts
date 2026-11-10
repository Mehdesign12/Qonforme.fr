import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
// @vitest-environment node
import { beforeAll, describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import React, { createElement } from "react"

// Modules compilés en JSX classique : React doit être global avant leur import
;(globalThis as unknown as { React: typeof React }).React = React

const created: { opts: Record<string, unknown> }[] = []
vi.mock("@supabase/supabase-js", () => ({
  createClient: (_url: string, _key: string, opts: Record<string, unknown>) => {
    created.push({ opts })
    return { opts }
  },
}))

import { createAdminClient } from "@/lib/supabase/server"
import { shortcutLabel } from "@/lib/email/account-templates"
import type { AccountEmailRow } from "@/lib/admin/account-emails"

describe("client service_role : jamais de cache de données de Next", () => {
  it("passe toutes ses requêtes en no-store, sauf allowCache", async () => {
    const realFetch = globalThis.fetch
    const seen: RequestInit[] = []
    globalThis.fetch = (async (_i: RequestInfo | URL, init?: RequestInit) => {
      seen.push(init ?? {})
      return new Response("[]")
    }) as typeof fetch
    try {
      createAdminClient()
      const opts = created.at(-1)!.opts as { global?: { fetch?: typeof fetch } }
      expect(opts.global?.fetch).toBeTypeOf("function")
      await opts.global!.fetch!("https://x.supabase.co/rest/v1/t", { method: "GET", headers: { a: "b" } })
      expect(seen[0]).toMatchObject({ method: "GET", cache: "no-store" })

      createAdminClient({ allowCache: true })
      expect((created.at(-1)!.opts as { global?: unknown }).global).toBeUndefined()
    } finally {
      globalThis.fetch = realFetch
    }
  })

  it("seules les pages publiques à revalidate ont le droit au cache", () => {
    const files: string[] = []
    const walk = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const p = join(dir, f)
        if (statSync(p).isDirectory()) walk(p)
        else if (/\.(ts|tsx)$/.test(f)) files.push(p)
      }
    }
    walk("app")
    walk("lib")
    walk("components")
    const withCache = files.filter((f) => readFileSync(f, "utf8").includes("allowCache: true")).sort()
    expect(withCache).toEqual(["app/blog/[slug]/page.tsx", "app/blog/page.tsx", "app/plan-du-site/page.tsx", "app/sitemap.ts"])
    for (const f of withCache) expect(readFileSync(f, "utf8")).toMatch(/export const revalidate = \d+/)
  })

  it("l'admin coupe aussi le cache de toutes ses autres requêtes", () => {
    expect(readFileSync("app/admin/(panel)/layout.tsx", "utf8")).toContain("export const fetchCache = 'force-no-store'")
  })
})

describe("Admin › Utilisateurs : dernier email visible", () => {
  let LastEmailCell: typeof import("@/components/admin/emails/LastEmailCell").LastEmailCell
  beforeAll(async () => {
    LastEmailCell = (await import("@/components/admin/emails/LastEmailCell")).LastEmailCell
  })
  const row = (over: Partial<AccountEmailRow> = {}): AccountEmailRow => ({
    id: "e1", category: "manual", template: "manual_first_quote", subject: "Votre premier devis en 3 minutes", sent_to: "a@b.fr",
    status: "sent", error: null, sent_by: "admin", sent_at: "2026-11-10T13:55:00Z", delivered_at: null, bounced_at: null,
    opened_at: null, first_clicked_at: null, click_count: 0, ...over,
  })

  it("un email parti s'affiche en vert avec sa date et son modèle", () => {
    const html = renderToStaticMarkup(createElement(LastEmailCell, { email: row() }))
    expect(html).toContain("Email envoyé")
    expect(html).toContain("--q-ok-bg")
    expect(html).toContain("10 nov.")
    expect(html).toContain("premier devis")
  })

  it("un email refusé s'affiche en rouge", () => {
    const html = renderToStaticMarkup(createElement(LastEmailCell, { email: row({ status: "bounced" }) }))
    expect(html).toContain("Email non remis")
    expect(html).toContain("--q-danger-bg")
  })

  it("aucun email, ou lecture impossible", () => {
    expect(renderToStaticMarkup(createElement(LastEmailCell, { email: null }))).toContain("Aucun email envoyé")
    expect(renderToStaticMarkup(createElement(LastEmailCell, { email: undefined }))).toContain("Indisponible")
  })

  it("le bouton dit « Relancer » quand la même aide est déjà partie", () => {
    expect(shortcutLabel("manual_first_quote", null)).toBe("Aider : premier devis")
    expect(shortcutLabel("manual_first_quote", "manual_first_quote")).toBe("Relancer : premier devis")
    expect(shortcutLabel("manual_company", "manual_first_quote")).toBe("Aider : entreprise")
    expect(shortcutLabel("manual_free", "manual_free")).toBe("Écrire un email")
  })
})
