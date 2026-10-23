// @vitest-environment node
/**
 * L'éditeur du site et vendeur des abonnements est Diez Agency LLC ; « Qonforme »
 * n'est qu'une marque (DECISIONS § 14.1, 19/10/2026). Les pages légales lisent toutes
 * la fiche `lib/legal/publisher.ts`, et n'affichent l'adresse et le directeur de la
 * publication que s'ils sont renseignés : jamais de texte « à compléter » en ligne.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import React, { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"

// Modules compilés en JSX classique : React doit être global avant leur import
;(globalThis as unknown as { React: typeof React }).React = React

const h = vi.hoisted(() => ({ p: {} as Record<string, unknown>, initial: {} as Record<string, unknown> }))

vi.mock("@/lib/legal/publisher", async () => {
  const actual = await vi.importActual<typeof import("@/lib/legal/publisher")>("@/lib/legal/publisher")
  h.initial = { ...actual.PUBLISHER }
  h.p = { ...actual.PUBLISHER }
  return { PUBLISHER: h.p }
})
vi.mock("@/components/legal/LegalLayout", () => ({
  LegalLayout: (props: { children?: React.ReactNode }) => createElement("main", null, props.children),
}))
vi.mock("@/components/consent/CookieSettingsLink", () => ({
  CookieSettingsLink: () => createElement("span", null, "Gérer les cookies"),
}))

beforeEach(() => {
  for (const key of Object.keys(h.p)) delete h.p[key]
  Object.assign(h.p, h.initial)
})

const text = (html: string) =>
  html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").replace(/ ([,.:;])/g, "$1")

async function pages() {
  const [{ default: Mentions }, { default: Cgu }, { default: Confidentialite }] = await Promise.all([
    import("@/app/mentions-legales/page"),
    import("@/app/cgu/page"),
    import("@/app/confidentialite/page"),
  ])
  return { Mentions, Cgu, Confidentialite }
}

describe("fiche de l'éditeur", () => {
  it("nomme la LLC du Wyoming, et aucune « Qonforme SAS »", async () => {
    const { PUBLISHER } = await import("@/lib/legal/publisher")
    expect(PUBLISHER.name).toBe("Diez Agency LLC")
    expect(PUBLISHER.form).toContain("Wyoming")
    expect(PUBLISHER.form).toContain("Limited Liability Company")
  })

  it("aucun fichier du site ne parle encore de « Qonforme SAS »", () => {
    const found: string[] = []
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name)
        if (statSync(path).isDirectory()) walk(path)
        else if (/\.(ts|tsx)$/.test(name) && path !== join("lib", "legal", "publisher.ts")) {
          if (readFileSync(path, "utf8").includes("Qonforme SAS")) found.push(path)
        }
      }
    }
    for (const dir of ["app", "components", "lib"]) walk(dir)
    expect(found).toEqual([])
  })
})

describe("pages légales", () => {
  it("les trois pages désignent Diez Agency LLC, sous la marque Qonforme", async () => {
    const { Mentions, Cgu, Confidentialite } = await pages()
    for (const Page of [Mentions, Cgu, Confidentialite]) {
      const out = text(renderToStaticMarkup(createElement(Page)))
      expect(out).toContain("Diez Agency LLC")
      expect(out).toContain("Wyoming")
      expect(out).not.toContain("SAS")
    }
    expect(text(renderToStaticMarkup(createElement(Mentions)))).toContain("n'est pas une société distincte")
  })

  it("adresse et directeur de la publication absents : aucune ligne vide ni texte à compléter", async () => {
    const { Mentions } = await pages()
    const out = text(renderToStaticMarkup(createElement(Mentions)))
    expect(out).not.toContain("Siège social")
    expect(out).not.toContain("Directeur de la publication")
    expect(out).not.toMatch(/à compléter|TODO|XXX|null|undefined/i)
  })

  it("adresse et directeur de la publication renseignés : ils apparaissent dans les mentions légales", async () => {
    Object.assign(h.p, { address: "1 rue de l'Exemple, Ville exemple, États-Unis", manager: "Prénom Nom" })
    const { Mentions } = await pages()
    const out = text(renderToStaticMarkup(createElement(Mentions)))
    expect(out).toContain("Siège social: 1 rue de l'Exemple, Ville exemple, États-Unis")
    expect(out).toContain("Directeur de la publication: Prénom Nom")
  })

  it("la politique de confidentialité dit que le responsable du traitement est établi aux États-Unis", async () => {
    const { Confidentialite } = await pages()
    expect(text(renderToStaticMarkup(createElement(Confidentialite)))).toContain("est lui-même établi aux États-Unis")
  })
})
