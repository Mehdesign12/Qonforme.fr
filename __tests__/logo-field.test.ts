// @vitest-environment node
/**
 * Aperçu du logo dans Paramètres › Entreprise (19/10/2026) : un logo carré de 480 px
 * passait par-dessus le texte « Logo affiché… » et les boutons « Remplacer » / « Retirer ».
 * Cause : l'image (`max-h-full`) vivait dans un `grid` à ligne automatique, où la hauteur
 * maximale en pourcentage ne borne rien. L'image remplit désormais une boîte de taille
 * fixe qui coupe ce qui dépasse. Ce test garde ce contrat de classes (la mise en page
 * elle-même a été mesurée au navigateur, à 360, 390 et 768 px).
 */
import { beforeAll, describe, expect, it, vi } from "vitest"
import React, { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

// Modules compilés en JSX classique : React doit être global avant leur import
;(globalThis as unknown as { React: typeof React }).React = React

vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }))
vi.mock("sonner", () => ({ toast: Object.assign(() => {}, { success: () => {}, error: () => {} }) }))

let LogoDropzone: typeof import("@/components/settings/LogoField").LogoDropzone
beforeAll(async () => {
  ;({ LogoDropzone } = await import("@/components/settings/LogoField"))
})

const logo = (preview: string | null) => ({
  preview,
  uploading: false,
  openPicker: () => {},
  upload: async () => {},
  remove: async () => {},
  input: null,
})

describe("aperçu du logo (LogoDropzone)", () => {
  const parts = () => {
    const html = renderToStaticMarkup(createElement(LogoDropzone, { logo: logo("data:image/png;base64,AAAA") }))
    return {
      box: html.match(/<span class="([^"]*)"><img /)?.[1] ?? "",
      img: html.match(/<img [^>]*class="([^"]*)"/)?.[1] ?? "",
    }
  }

  it("l'image remplit sa boîte et ne choisit pas sa taille", () => {
    const { img } = parts()
    expect(img.split(" ")).toContain("size-full")
    expect(img.split(" ")).toContain("object-contain")
    expect(img).not.toMatch(/max-h-full|max-w-full/)
  })

  it("la boîte a une taille fixe, coupe ce qui dépasse et n'est pas un grid", () => {
    const classes = parts().box.split(" ")
    expect(classes).toContain("h-20")
    expect(classes).toContain("overflow-hidden")
    expect(classes).toContain("block")
    expect(classes).not.toContain("grid")
  })

  it("sans logo : la zone d'import, pas d'aperçu", () => {
    const empty = renderToStaticMarkup(createElement(LogoDropzone, { logo: logo(null) }))
    expect(empty).toContain("Glissez votre logo ici")
    expect(empty).not.toContain("<img")
  })
})
