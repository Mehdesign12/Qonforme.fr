/** Logo envoyé avant l'entreprise, retrouvé à sa création (lib/company/stored-logo.ts). */
import { describe, expect, it } from "vitest"
import { storedLogoUrl } from "@/lib/company/stored-logo"

const admin = (files: { name: string; updated_at?: string }[] | null, fail = false) => ({
  storage: {
    from: (bucket: string) => ({
      list: async (path: string) => {
        expect(bucket).toBe("company-assets")
        expect(path).toBe("logos/u1")
        return fail ? { data: null, error: { message: "panne" } } : { data: files, error: null }
      },
      getPublicUrl: (p: string) => ({ data: { publicUrl: `https://x.supabase.co/storage/v1/object/public/company-assets/${p}` } }),
    }),
  },
}) as never

describe("logo envoyé avant l'entreprise", () => {
  it("le plus récent des fichiers logo.*", async () => {
    const url = await storedLogoUrl(admin([
      { name: "logo.png", updated_at: "2026-11-01T10:00:00Z" },
      { name: "logo.webp", updated_at: "2026-11-03T10:00:00Z" },
      { name: "autre.png", updated_at: "2026-11-04T10:00:00Z" },
    ]), "u1")
    expect(url).toMatch(/logos\/u1\/logo\.webp$/)
  })
  it("aucun logo, ou stockage en panne : null, sans erreur", async () => {
    expect(await storedLogoUrl(admin([]), "u1")).toBeNull()
    expect(await storedLogoUrl(admin(null, true), "u1")).toBeNull()
  })
})
