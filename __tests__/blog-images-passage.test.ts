/**
 * « Ce que montre l'image » détecté d'après le passage (lib/blog-images/passage.ts)
 * et sa route POST /api/admin/blog/images/describe.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const state = vi.hoisted(() => ({
  admin: true,
  settingsRows: [] as { key: string; value: unknown; updated_at: string }[],
  text: null as null | ((input: { model: string; system: string; prompt: string }) => Promise<{ text: string; fallbackFrom?: { model: string; reason: string } }>),
  calls: [] as { model: string; system: string; prompt: string }[],
}))

vi.mock("@/lib/admin-require", () => ({ isAdminAuthenticated: async () => state.admin }))
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => fakeClient(),
  createAdminClient: () => fakeClient(),
}))
vi.mock("@/lib/seo/articles/models", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/seo/articles/models")>()),
  generateText: async (input: { model: string; system: string; prompt: string }) => {
    state.calls.push(input)
    if (!state.text) throw new Error("aucun texte prévu dans ce test")
    return { model: input.model, usage: { inputTokens: null, outputTokens: null }, ...(await state.text(input)) }
  },
}))

function fakeClient() {
  return {
    from: (table: string) => ({
      select: async () => (table === "seo_settings" ? { data: state.settingsRows, error: null } : { data: [], error: null }),
    }),
  }
}

import { IMAGE_STYLE_CHIPS, hasStyleChip } from "@/lib/blog-images/prompt"
import {
  PASSAGE_TEXT_MAX,
  buildPassagePrompt,
  descriptionFromSuggestion,
  heuristicPassage,
  parsePassageOutput,
  passageExcerpt,
  type PassageContext,
} from "@/lib/blog-images/passage"
import { ModelError } from "@/lib/seo/articles/models"
import { SETTINGS_DEFAULTS } from "@/lib/seo/settings-schema"
import { POST as describeRoute } from "@/app/api/admin/blog/images/describe/route"

const env = { ...process.env }

beforeEach(() => {
  state.admin = true
  state.settingsRows = []
  state.text = null
  state.calls = []
  process.env.ANTHROPIC_API_KEY = "test"
  process.env.GEMINI_API_KEY = "test"
})

afterEach(() => {
  process.env = { ...env }
  vi.restoreAllMocks()
})

const passage = (over: Partial<PassageContext> = {}): PassageContext => ({
  text: "Pour poser un grand carreau au sol, étalez la colle avec une spatule crantée puis tapez au maillet.",
  heading: "Poser le carrelage au sol",
  before: "La salle de bains est vidée.",
  after: "Laissez sécuriser 24 heures avant de passer aux joints.",
  selected: true,
  ...over,
})

const GOOD = {
  subject: "pose de carrelage au sol",
  scene: "Un carreleur à genoux pose un grand carreau sur la colle dans une salle de bains en rénovation, spatule crantée et maillet à portée de main.",
  styles: ["artisan", "interieur", "inconnu", "artisan"],
  alt: "Un carreleur pose un grand carreau au sol d'une salle de bains",
}

describe("consigne", () => {
  it("passage, titre de section, titre et mot-clé de l'article, contexte et règles", () => {
    const prompt = buildPassagePrompt({ passage: passage(), title: "Facturer une pose de carrelage", keyword: "devis carreleur" })
    expect(prompt).toContain("PASSAGE SÉLECTIONNÉ À ILLUSTRER :")
    expect(prompt).toContain("Pour poser un grand carreau au sol")
    expect(prompt).toContain("Titre de la section : Poser le carrelage au sol")
    expect(prompt).toContain("Titre de l'article : Facturer une pose de carrelage")
    expect(prompt).toContain("Mot-clé de l'article : devis carreleur")
    expect(prompt).toContain("Texte qui précède")
    expect(prompt).toContain("Texte qui suit")
    expect(prompt).toContain("Aucun texte, chiffre, logo, marque")
    // Les identifiants des puces sont offerts au modèle
    for (const chip of IMAGE_STYLE_CHIPS) expect(prompt).toContain(chip.id)
  })

  it("paragraphe du curseur quand rien n'est sélectionné ; chevrons retirés ; texte borné", () => {
    const prompt = buildPassagePrompt({ passage: passage({ selected: false, text: `<script>${"x".repeat(5000)}` }), title: "", keyword: null })
    expect(prompt).toContain("PARAGRAPHE À ILLUSTRER")
    expect(prompt).not.toContain("<script>")
    const between = prompt.split("<<<\n")[1].split("\n>>>")[0]
    expect(between.length).toBeLessThanOrEqual(PASSAGE_TEXT_MAX)
    expect(prompt).not.toContain("Titre de l'article")
    expect(prompt).not.toContain("Mot-clé de l'article")
  })
})

describe("réponse du modèle", () => {
  it("JSON valide : sujet en capitale, styles connus sans doublon, deux au plus", () => {
    const out = parsePassageOutput(JSON.stringify(GOOD))
    expect(out).not.toBeNull()
    expect(out!.subject).toBe("Pose de carrelage au sol")
    expect(out!.styles).toEqual(["artisan", "interieur"])
    expect(out!.alt).toBe(GOOD.alt)
    expect(out!.scene).toContain("carreleur")
  })

  it("bloc de code toléré ; texte avant et après le JSON ignoré", () => {
    expect(parsePassageOutput("```json\n" + JSON.stringify(GOOD) + "\n```")?.subject).toBe("Pose de carrelage au sol")
    expect(parsePassageOutput(`Voici : ${JSON.stringify(GOOD)} Voilà.`)?.subject).toBe("Pose de carrelage au sol")
  })

  it("illisible ou scène trop courte : null", () => {
    expect(parsePassageOutput("pas du json")).toBeNull()
    expect(parsePassageOutput("{ cassé")).toBeNull()
    expect(parsePassageOutput(JSON.stringify({ ...GOOD, scene: "Un carreleur." }))).toBeNull()
    expect(parsePassageOutput(JSON.stringify({ subject: "x" }))).toBeNull()
  })

  it("texte alternatif trop court : refait d'après la scène ; sujet absent : tiré de la scène", () => {
    const out = parsePassageOutput(JSON.stringify({ ...GOOD, alt: "ok", subject: "" }))
    expect(out!.alt.length).toBeGreaterThanOrEqual(5)
    expect(out!.alt).not.toBe("ok")
    expect(out!.subject.length).toBeGreaterThan(5)
    expect(out!.subject.length).toBeLessThanOrEqual(80)
  })
})

describe("repli sans modèle", () => {
  it("métier reconnu dans le passage : sa scène et la puce « artisan »", () => {
    const out = heuristicPassage({ passage: passage({ text: "Le carreleur pose les carreaux de la salle de bains." }), title: "Facturer un chantier", keyword: null })
    expect(out.scene.toLowerCase()).toContain("carreleur")
    expect(out.styles).toContain("artisan")
    expect(out.subject).toBe("Poser le carrelage au sol")
    expect(out.alt.length).toBeGreaterThanOrEqual(5)
  })

  it("passage sur des papiers : bureau et documents", () => {
    const out = heuristicPassage({
      passage: passage({ text: "Le devis doit mentionner la TVA et le délai de paiement.", heading: "Les mentions du devis" }),
      title: "Mentions obligatoires",
      keyword: null,
    })
    expect(out.styles).toContain("bureau")
  })

  it("toujours une scène, au moins une puce, deux au plus", () => {
    for (const text of ["Un texte sans rien de précis.", "Perceuse et niveau pour la rénovation du sol.", ""]) {
      const out = heuristicPassage({ passage: passage({ text, heading: null }), title: "", keyword: null })
      expect(out.scene.length).toBeGreaterThan(20)
      expect(out.styles.length).toBeGreaterThanOrEqual(1)
      expect(out.styles.length).toBeLessThanOrEqual(2)
      expect(out.subject.length).toBeGreaterThan(0)
    }
  })
})

describe("pour la fenêtre", () => {
  it("la scène et la phrase de chaque puce retenue : les puces s'affichent actives", () => {
    const out = parsePassageOutput(JSON.stringify(GOOD))!
    const description = descriptionFromSuggestion(out)
    expect(description.startsWith(out.scene)).toBe(true)
    const active = IMAGE_STYLE_CHIPS.filter((chip) => hasStyleChip(description, chip)).map((c) => c.id)
    expect(active.sort()).toEqual(["artisan", "interieur"])
    expect(description.length).toBeLessThan(1200)
  })

  it("extrait : une ligne, borné", () => {
    expect(passageExcerpt("## **Un** titre\n\nsuite", 50)).toBe("Un titre suite")
    const long = passageExcerpt("mot ".repeat(100), 40)
    expect(long.length).toBeLessThanOrEqual(40)
  })
})

/* ------------------------------------------------------------------ */
/* Route                                                               */
/* ------------------------------------------------------------------ */

function request(body: unknown) {
  return new NextRequest("http://localhost/api/admin/blog/images/describe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

const body = { passage: passage(), title: "Facturer une pose de carrelage", keyword: "devis carreleur" }

function withCompetitor() {
  state.settingsRows = [{ key: "targeting", value: { ...SETTINGS_DEFAULTS.targeting, competitors: ["batisoft-exemple.fr"] }, updated_at: "2026-10-01T00:00:00Z" }]
}

describe("POST /api/admin/blog/images/describe", () => {
  it("401 hors session admin ; 400 sans passage ni titre", async () => {
    state.admin = false
    expect((await describeRoute(request(body))).status).toBe(401)
    state.admin = true
    expect((await describeRoute(request({}))).status).toBe(400)
    const empty = await describeRoute(request({ passage: passage({ text: "  ", heading: null }) }))
    expect(empty.status).toBe(400)
    expect((await empty.json()).error).toMatch(/curseur/)
    expect(state.calls).toHaveLength(0)
  })

  it("réponse du modèle : sujet, scène, styles, texte alternatif, source « model »", async () => {
    state.text = async () => ({ text: JSON.stringify(GOOD) })
    const res = await describeRoute(request(body))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toMatchObject({ subject: "Pose de carrelage au sol", styles: ["artisan", "interieur"], source: "model", notice: null, alt: GOOD.alt })
    expect(state.calls).toHaveLength(1)
    expect(state.calls[0].prompt).toContain("Pour poser un grand carreau au sol")
    expect(state.calls[0].prompt).toContain("devis carreleur")
  })

  it("modèle de repli utilisé : la source reste « model » et le motif est rendu", async () => {
    state.text = async () => ({ text: JSON.stringify(GOOD), fallbackFrom: { model: "claude-sonnet-5-5", reason: "Claude indisponible (503)" } })
    const json = await (await describeRoute(request(body))).json()
    expect(json.source).toBe("model")
    expect(json.notice).toContain("Claude indisponible (503)")
  })

  it("clé absente, quota, panne ou réponse illisible : toujours 200, proposition d'après les mots du passage", async () => {
    const cases: [() => Promise<never> | Promise<{ text: string }>, RegExp][] = [
      [async () => { throw new ModelError("not_configured", "Clé absente") }, /non configuré/],
      [async () => { throw new ModelError("quota", "Quota épuisé", false) }, /Quota/],
      [async () => { throw new ModelError("timeout", "Trop long", false) }, /trop de temps/],
      [async () => { throw new ModelError("http", "Surchargé (503)", true) }, /n'a pas répondu/],
      [async () => ({ text: "pas du json" }), /illisible/],
    ]
    for (const [text, notice] of cases) {
      state.text = text
      const res = await describeRoute(request(body))
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.source).toBe("heuristic")
      expect(json.notice).toMatch(notice)
      expect(json.scene.length).toBeGreaterThan(20)
      expect(json.styles.length).toBeGreaterThanOrEqual(1)
    }
  })

  it("concurrent : jamais dans la consigne, et une scène qui en nomme un est remplacée par le repli", async () => {
    withCompetitor()
    state.text = async () => ({ text: JSON.stringify({ ...GOOD, scene: "Un carreleur devant un écran affichant batisoft-exemple, dans une salle de bains en travaux." }) })
    const res = await describeRoute(
      request({ ...body, passage: passage({ text: "Avec Batisoft-exemple, la pose du carrelage au sol se facture en quelques clics." }), keyword: "batisoft-exemple devis" }),
    )
    const json = await res.json()
    expect(state.calls[0].prompt.toLowerCase()).not.toContain("batisoft")
    expect(json.source).toBe("heuristic")
    expect(json.notice).toMatch(/concurrent/)
    expect(JSON.stringify(json).toLowerCase()).not.toContain("batisoft")
  })

  it("passage trop long : tronqué avant l'envoi au modèle", async () => {
    state.text = async () => ({ text: JSON.stringify(GOOD) })
    await describeRoute(request({ ...body, passage: passage({ text: "mot ".repeat(2000), before: "avant ".repeat(500), after: "après ".repeat(500) }) }))
    const prompt = state.calls[0].prompt
    expect(prompt.length).toBeLessThan(6000)
  })
})
