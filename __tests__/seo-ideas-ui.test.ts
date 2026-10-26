// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import * as React from "react"
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"

const toasts = vi.hoisted(() => ({ calls: [] as string[] }))
vi.mock("sonner", () => {
  const push = (m: string) => void toasts.calls.push(m)
  return { toast: Object.assign(push, { success: push, error: push, info: push }) }
})
const nav = vi.hoisted(() => ({ refreshed: 0 }))
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => void nav.refreshed++ }),
  usePathname: () => "/admin/seo/articles",
  useSearchParams: () => new URLSearchParams(""),
}))
vi.mock("next/link", () => ({
  default: (props: Record<string, unknown>) => createElement("a", { ...props, href: String(props.href) }),
}))

import type { IdeasDialogProps } from "@/components/admin/seo/ideas/IdeasDialog"
import type { AdoptResult, Idea, IdeasResponse } from "@/lib/seo/ideas/types"

// Le JSX du dépôt est compilé en React.createElement : React global avant le chargement du composant
let IdeasDialog: typeof import("@/components/admin/seo/ideas/IdeasDialog").IdeasDialog
let GenerateDialog: typeof import("@/components/admin/seo/articles/GenerateDialog").GenerateDialog
let KeywordPicker: typeof import("@/components/admin/blog/seo/KeywordPicker").KeywordPicker

beforeAll(async () => {
  ;(globalThis as { React?: typeof React }).React = React
  ;({ IdeasDialog } = await import("@/components/admin/seo/ideas/IdeasDialog"))
  ;({ GenerateDialog } = await import("@/components/admin/seo/articles/GenerateDialog"))
  ;({ KeywordPicker } = await import("@/components/admin/blog/seo/KeywordPicker"))
})

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  toasts.calls = []
  nav.refreshed = 0
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  document.body.innerHTML = ""
  vi.unstubAllGlobals()
})

const flush = () => act(async () => new Promise((r) => setTimeout(r, 0)))

function buttonByText(text: string | RegExp): HTMLButtonElement {
  const list = Array.from(document.querySelectorAll("button")) as HTMLButtonElement[]
  const found = list.find((b) => (typeof text === "string" ? b.textContent?.includes(text) : text.test(b.textContent ?? "")))
  if (!found) throw new Error(`Bouton introuvable : ${text}`)
  return found
}

async function click(el: HTMLElement) {
  await act(async () => {
    el.click()
  })
  await flush()
}

const idea = (over: Partial<Idea> = {}): Idea => ({
  keyword: "exemple devis maçonnerie",
  title: "Exemple de devis de maçonnerie à copier",
  articleType: "guide",
  stage: "do",
  why: "Veut un modèle chiffré",
  verified: true,
  googleAlso: ["exemple devis maçonnerie pdf"],
  volume: 170,
  difficulty: 12,
  cpc: 1.2,
  intent: "informational",
  ranking: null,
  overlaps: [],
  warnings: [],
  tracked: false,
  score: 80,
  ...over,
})

const response = (ideas: Idea[], over: Partial<IdeasResponse> = {}): IdeasResponse => ({
  ideas,
  notes: [],
  model: "Claude Sonnet 5.5",
  autocomplete: "ok",
  metrics: "ok",
  ...over,
})

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })

interface Call {
  url: string
  body: Record<string, unknown>
}

/** fetch simulé : une réponse pour les idées, une pour l'adoption. */
function stubFetch(handlers: { ideas?: () => Response; adopt?: () => Response }) {
  const calls: Call[] = []
  const mock = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init?.body ?? "{}")) })
    if (url === "/api/admin/seo/ideas") return handlers.ideas?.() ?? json(response([]))
    if (url === "/api/admin/seo/ideas/adopt") return handlers.adopt?.() ?? json({ error: "non simulé" }, 500)
    throw new Error(`appel inattendu : ${url}`)
  })
  vi.stubGlobal("fetch", mock)
  return calls
}

async function render(props: Partial<IdeasDialogProps> = {}) {
  const onClose = vi.fn()
  await act(async () => root.render(createElement(IdeasDialog, { open: true, onClose, mode: "topics", ...props })))
  await flush()
  return { onClose }
}

const adoptResult = (over: Partial<AdoptResult> = {}): AdoptResult => ({ keywordId: "k1", keyword: "exemple devis maçonnerie", keywordAdded: true, topicId: "t1", topicExisting: false, ...over })

describe("IdeasDialog · sujets", () => {
  it("rien n'est lancé à l'ouverture ; une situation remplit l'angle, le bouton lance la recherche", async () => {
    const calls = stubFetch({ ideas: () => json(response([idea()])) })
    await render()
    expect(calls).toHaveLength(0)
    expect(document.body.textContent).toContain("Proposition IA")
    await click(buttonByText("Je me fais payer"))
    const angle = document.getElementById("idees-angle") as HTMLInputElement
    expect(angle.value).toMatch(/Facture impayée/)
    expect(buttonByText("Je me fais payer").getAttribute("aria-pressed")).toBe("true")

    const select = document.getElementById("idees-metier") as HTMLSelectElement
    await act(async () => {
      select.value = "plombier"
      select.dispatchEvent(new Event("change", { bubbles: true }))
    })
    await click(buttonByText("Proposer des idées"))
    expect(calls).toHaveLength(1)
    expect(calls[0].body).toMatchObject({ mode: "topics", trade: "plombier" })
    expect(String(calls[0].body.focus)).toMatch(/pénalités de retard/)
  })

  it("montre pour chaque idée la preuve Google, le volume, la difficulté, le titre et l'explication", async () => {
    stubFetch({ ideas: () => json(response([idea(), idea({ keyword: "devis vierge pdf", verified: false, volume: null, difficulty: null, googleAlso: [] })], { notes: ["DataForSEO n'est pas configuré (Paramètres › Connexions) : les volumes ne sont pas mesurés."] })) })
    await render()
    await click(buttonByText("Proposer des idées"))
    const text = document.body.textContent ?? ""
    expect(text).toContain("exemple devis maçonnerie")
    expect(text).toContain("Vu dans Google")
    expect(text).toContain("170/mois")
    expect(text).toContain("Facile")
    expect(text).toContain("Titre de l'article : Exemple de devis de maçonnerie à copier")
    expect(text).toContain("Veut un modèle chiffré")
    expect(text).toContain("Google propose aussi : « exemple devis maçonnerie pdf »")
    expect(text).toContain("Non vérifié")
    expect(text).toContain("Volume inconnu")
    expect(text).toContain("DataForSEO n'est pas configuré")
    expect(text).toContain("Idées par Claude Sonnet 5.5")
    // Le formulaire se replie en une ligne qui rappelle la demande
    expect(document.getElementById("idees-angle")).toBeNull()
    expect(text).toContain("Toutes les situations · tous les métiers")
    expect(buttonByText("Modifier")).toBeTruthy()
    expect(buttonByText("Relancer")).toBeTruthy()
  })

  it("la ligne de résumé rappelle la situation et le métier ; « Modifier » rouvre le formulaire tel qu'il était ; « Relancer » refait la même demande", async () => {
    const calls = stubFetch({ ideas: () => json(response([idea()])) })
    await render()
    await click(buttonByText("Je me fais payer"))
    const select = document.getElementById("idees-metier") as HTMLSelectElement
    await act(async () => {
      select.value = "electricien"
      select.dispatchEvent(new Event("change", { bubbles: true }))
    })
    await click(buttonByText("Proposer des idées"))
    expect(document.body.textContent).toContain("Je me fais payer · électricien")

    await click(buttonByText("Relancer"))
    expect(calls).toHaveLength(2)
    expect(calls[1].body).toEqual(calls[0].body)

    await click(buttonByText("Modifier"))
    expect((document.getElementById("idees-metier") as HTMLSelectElement).value).toBe("electricien")
    expect((document.getElementById("idees-angle") as HTMLInputElement).value).toMatch(/Facture impayée/)
    expect(buttonByText("Je me fais payer").getAttribute("aria-pressed")).toBe("true")
    // Un angle libre remplace la situation dans le résumé
    const angle = document.getElementById("idees-angle") as HTMLInputElement
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!
      setter.call(angle, "relancer un client")
      angle.dispatchEvent(new Event("input", { bubbles: true }))
    })
    await click(buttonByText("Relancer la recherche"))
    expect(calls).toHaveLength(3)
    expect(calls[2].body).toMatchObject({ focus: "relancer un client", trade: "electricien" })
    expect(document.body.textContent).toContain("« relancer un client » · électricien")
  })

  it("signale ce qui existe déjà et rend le bouton moins pressant", async () => {
    stubFetch({
      ideas: () =>
        json(
          response([
            idea({
              overlaps: [{ kind: "article", label: "Mentions d'un devis", detail: "Un article vise déjà cette requête", path: "/blog/mentions-devis" }],
              warnings: ["« Gratuit » : seuls les devis, le générateur et les modèles le sont."],
              tracked: true,
            }),
          ]),
        ),
    })
    await render()
    await click(buttonByText("Proposer des idées"))
    const text = document.body.textContent ?? ""
    expect(text).toContain("Un article vise déjà cette requête")
    expect(text).toContain("seuls les devis")
    expect(text).toContain("Déjà suivi")
    expect(buttonByText("Créer le sujet quand même")).toBeTruthy()
    // Déjà suivi : pas de « Suivre seulement »
    expect(() => buttonByText("Suivre seulement")).toThrow()
    const link = Array.from(document.querySelectorAll("a")).find((a) => a.textContent?.includes("Voir"))!
    expect(link.getAttribute("href")).toBe("/blog/mentions-devis")
    expect(link.getAttribute("target")).toBe("_blank")
  })

  it("« Créer le sujet » adopte l'idée avec ses mesures, confirme et prévient le parent", async () => {
    const onAdopted = vi.fn()
    const calls = stubFetch({ ideas: () => json(response([idea()])), adopt: () => json(adoptResult(), 201) })
    await render({ onAdopted })
    await click(buttonByText("Proposer des idées"))
    await click(buttonByText("Créer le sujet"))
    const adopt = calls.find((c) => c.url.endsWith("/adopt"))!
    expect(adopt.body).toEqual({
      keyword: "exemple devis maçonnerie",
      title: "Exemple de devis de maçonnerie à copier",
      articleType: "guide",
      intent: "informational",
      volume: 170,
      difficulty: 12,
      cpc: 1.2,
      note: "Veut un modèle chiffré",
      createTopic: true,
      targeted: false,
    })
    expect(toasts.calls).toContain("Sujet créé")
    expect(document.body.textContent).toContain("Sujet créé")
    const link = Array.from(document.querySelectorAll("a")).find((a) => a.textContent === "Voir les sujets")!
    expect(link.getAttribute("href")).toBe("/admin/seo/articles/sujets")
    expect(onAdopted).toHaveBeenCalledTimes(1)
    expect(onAdopted.mock.calls[0][0]).toMatchObject({ topicId: "t1" })
    expect(onAdopted.mock.calls[0][1].keyword).toBe("exemple devis maçonnerie")
    expect(() => buttonByText("Créer le sujet")).toThrow()
  })

  it("« Suivre seulement » ajoute le mot-clé sans sujet ; un sujet déjà en place est annoncé", async () => {
    const calls = stubFetch({
      ideas: () => json(response([idea(), idea({ keyword: "devis vierge pdf", title: "Devis vierge en PDF à imprimer" })])),
      adopt: () => json(adoptResult({ topicId: null }), 201),
    })
    await render()
    await click(buttonByText("Proposer des idées"))
    await click(buttonByText("Suivre seulement"))
    expect(calls.find((c) => c.url.endsWith("/adopt"))!.body).toMatchObject({ createTopic: false, targeted: false })
    expect(toasts.calls).toContain("Mot-clé ajouté au suivi")
    expect(document.body.textContent).toContain("Ajouté au suivi")
    expect(Array.from(document.querySelectorAll("a")).some((a) => a.getAttribute("href") === "/admin/seo/mots-cles")).toBe(true)

    stubFetch({ adopt: () => json(adoptResult({ topicExisting: true }), 200) })
    await click(buttonByText("Créer le sujet"))
    expect(toasts.calls).toContain("Un sujet existait déjà pour ce mot-clé")
  })

  it("refus de l'adoption : le message du serveur s'affiche, l'idée reste adoptable", async () => {
    stubFetch({ ideas: () => json(response([idea()])), adopt: () => json({ error: "Ce mot-clé est ignoré dans l'onglet Mots-clés." }, 409) })
    const onAdopted = vi.fn()
    await render({ onAdopted })
    await click(buttonByText("Proposer des idées"))
    await click(buttonByText("Créer le sujet"))
    expect(toasts.calls).toContain("Ce mot-clé est ignoré dans l'onglet Mots-clés.")
    expect(onAdopted).not.toHaveBeenCalled()
    expect(buttonByText("Créer le sujet")).toBeTruthy()
  })

  it("une erreur du serveur est affichée avec « Réessayer »", async () => {
    let attempt = 0
    stubFetch({ ideas: () => (++attempt === 1 ? json({ error: "Le modèle n'a pas répondu à temps. Réessayez dans un instant." }, 502) : json(response([idea()]))) })
    await render()
    await click(buttonByText("Proposer des idées"))
    expect(document.querySelector("[role=alert]")?.textContent).toContain("Le modèle n'a pas répondu à temps")
    // Le formulaire revient pour ajuster la demande
    expect(document.getElementById("idees-angle")).toBeTruthy()
    await click(buttonByText("Réessayer"))
    expect(document.querySelector("[role=alert]")).toBeNull()
    expect(document.body.textContent).toContain("exemple devis maçonnerie")
  })

  it("aucune idée : explication et nouvel essai", async () => {
    stubFetch({ ideas: () => json(response([])) })
    await render()
    await click(buttonByText("Proposer des idées"))
    expect(document.body.textContent).toContain("Aucune idée ne ressort de cette recherche.")
    expect(buttonByText("Relancer")).toBeTruthy()
  })

  it("pendant qu'une recherche tourne, « Relancer » est bloqué (pas de seconde demande)", async () => {
    let release: (r: Response) => void = () => {}
    const calls: string[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calls.push(url)
        return new Promise<Response>((r) => (release = r))
      }),
    )
    await render()
    await click(buttonByText("Proposer des idées"))
    const busy = buttonByText("Recherche en cours")
    expect(busy.disabled).toBe(true)
    expect(buttonByText("Modifier").disabled).toBe(true)
    expect(document.querySelector("[role=status]")?.textContent).toMatch(/20 à 40 secondes/)
    await click(busy)
    expect(calls).toHaveLength(1)
    await act(async () => release(json(response([idea()]))))
    await flush()
    expect(document.body.textContent).toContain("exemple devis maçonnerie")
  })
})

describe("IdeasDialog · article", () => {
  const article = { title: "Comment faire un devis de peinture", content: "x".repeat(9_000), keyword: "devis peinture", articleType: "howto" as const }

  it("part tout de suite du titre et du début du texte de l'article", async () => {
    const calls = stubFetch({ ideas: () => json(response([idea({ keyword: "comment faire un devis de peinture", articleType: "howto" })])) })
    await render({ mode: "article", article })
    expect(calls).toHaveLength(1)
    const sent = calls[0].body as { mode: string; article: { title: string; content: string; keyword: string; articleType: string } }
    expect(sent.mode).toBe("article")
    expect(sent.article.title).toBe("Comment faire un devis de peinture")
    expect(sent.article.content).toHaveLength(6_000)
    expect(sent.article).toMatchObject({ keyword: "devis peinture", articleType: "howto" })
    // Pas de formulaire de sujets
    expect(document.getElementById("idees-angle")).toBeNull()
    expect(document.body.textContent).toContain("comment faire un devis de peinture")
    expect(() => buttonByText("Créer le sujet")).toThrow()
  })

  it("« Mettre en mot-clé principal » cible le mot-clé, prévient l'éditeur et se ferme", async () => {
    const onUse = vi.fn()
    const calls = stubFetch({ ideas: () => json(response([idea({ keyword: "comment faire un devis de peinture", articleType: "howto" })])), adopt: () => json(adoptResult({ topicId: null }), 201) })
    const { onClose } = await render({ mode: "article", article, onUse })
    await click(buttonByText("Mettre en mot-clé principal"))
    expect(calls.find((c) => c.url.endsWith("/adopt"))!.body).toMatchObject({ createTopic: false, targeted: true, keyword: "comment faire un devis de peinture" })
    expect(onUse).toHaveBeenCalledTimes(1)
    expect(onUse.mock.calls[0][0].keyword).toBe("comment faire un devis de peinture")
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("si le suivi échoue, le mot-clé est quand même posé sur l'article", async () => {
    const onUse = vi.fn()
    stubFetch({ ideas: () => json(response([idea()])), adopt: () => json({ error: "Ce mot-clé est ignoré dans l'onglet Mots-clés." }, 409) })
    const { onClose } = await render({ mode: "article", article, onUse })
    await click(buttonByText("Mettre en mot-clé principal"))
    expect(onUse).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(toasts.calls.join(" ")).toMatch(/Mot-clé utilisé, mais pas ajouté au suivi : Ce mot-clé est ignoré/)
  })

  it("« Ajouter aux secondaires » : suivi comme simple candidat (pas « ciblé »), prévient l'éditeur, la fenêtre reste ouverte et marque l'idée", async () => {
    const onUse = vi.fn()
    const onUseSecondary = vi.fn()
    const calls = stubFetch({ ideas: () => json(response([idea({ keyword: "devis peinture exterieure", articleType: "howto" })])), adopt: () => json(adoptResult({ topicId: null }), 201) })
    const { onClose } = await render({ mode: "article", article, onUse, onUseSecondary })
    await click(buttonByText("Ajouter aux secondaires"))
    expect(calls.find((c) => c.url.endsWith("/adopt"))!.body).toMatchObject({ createTopic: false, targeted: false, keyword: "devis peinture exterieure" })
    expect(onUseSecondary).toHaveBeenCalledTimes(1)
    expect(onUseSecondary.mock.calls[0][0].keyword).toBe("devis peinture exterieure")
    expect(onUse).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain("Dans les secondaires")
    expect(() => buttonByText("Ajouter aux secondaires")).toThrow()
    // Le mot-clé principal reste proposable pour cette idée
    expect(buttonByText("Mettre en mot-clé principal")).toBeTruthy()
  })

  it("une idée déjà secondaire ou déjà principale est marquée, sans bouton inutile", async () => {
    stubFetch({ ideas: () => json(response([idea({ keyword: "devis peinture exterieure" }), idea({ keyword: "devis peinture" })])) })
    await render({ mode: "article", article, currentKeyword: "Devis peinture", currentSecondary: ["devis peinture extérieure"] })
    const text = document.body.textContent ?? ""
    expect(text).toContain("Mot-clé principal de l'article")
    expect(text).toContain("Dans les secondaires")
    expect(Array.from(document.querySelectorAll("button")).filter((b) => b.textContent?.includes("Mettre en mot-clé principal"))).toHaveLength(1)
    expect(Array.from(document.querySelectorAll("button")).filter((b) => b.textContent?.includes("Ajouter aux secondaires"))).toHaveLength(0)
  })

  it("« Autres idées » relance la recherche", async () => {
    const calls = stubFetch({ ideas: () => json(response([idea()])) })
    await render({ mode: "article", article })
    await click(buttonByText("Autres idées"))
    expect(calls.filter((c) => c.url === "/api/admin/seo/ideas")).toHaveLength(2)
  })

  it("réponse tardive d'une recherche abandonnée (fenêtre fermée puis rouverte) : ignorée", async () => {
    const pending: ((r: Response) => void)[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Promise<Response>((r) => pending.push(r))),
    )
    const onClose = vi.fn()
    const view = (open: boolean) => createElement(IdeasDialog, { open, onClose, mode: "article", article })
    await act(async () => root.render(view(true)))
    await flush()
    await act(async () => root.render(view(false)))
    await act(async () => root.render(view(true)))
    await flush()
    expect(pending).toHaveLength(2)
    // La seconde recherche répond d'abord, la première (abandonnée) ensuite
    await act(async () => pending[1](json(response([idea({ keyword: "devis vierge pdf", googleAlso: [] })]))))
    await flush()
    await act(async () => pending[0](json(response([idea({ keyword: "exemple devis maçonnerie", googleAlso: [] })]))))
    await flush()
    const text = document.body.textContent ?? ""
    expect(text).toContain("devis vierge pdf")
    expect(text).not.toContain("exemple devis maçonnerie")
  })

  it("fermée puis rouverte : repart de zéro", async () => {
    stubFetch({ ideas: () => json(response([idea()])) })
    const { onClose } = await render({ mode: "article", article })
    expect(document.body.textContent).toContain("exemple devis maçonnerie")
    await act(async () => root.render(createElement(IdeasDialog, { open: false, onClose, mode: "article", article })))
    await flush()
    expect(document.body.textContent).not.toContain("exemple devis maçonnerie")
  })
})

/* ------------------------------------------------------------------ */
/* Branchements                                                        */
/* ------------------------------------------------------------------ */

describe("« Générer un article » · Proposition IA", () => {
  const data = {
    topics: [{ id: "t0", title: "Sujet déjà là", keyword: null, articleType: "guide" as const, angle: null, status: "unplanned" as const, scheduledAt: null, publishMode: "draft" as const, lastError: null, postId: null }],
    keywords: [],
    angles: [],
    lengthMin: 1000,
    lengthMax: 1500,
    coverImage: true,
    inlineImages: 4,
    summary: "Plan par Claude Sonnet 5.5",
    fallbacks: [],
    blocked: null,
    slot: null,
  }

  it("l'idée adoptée devient un sujet aussitôt choisi, avec son mot-clé et son type", async () => {
    stubFetch({
      ideas: () => json(response([idea({ keyword: "comment faire un devis de peinture", title: "Comment faire un devis de peinture", articleType: "howto" })])),
      adopt: () => json(adoptResult({ keyword: "comment faire un devis de peinture", topicId: "11111111-1111-4111-8111-111111111111" }), 201),
    })
    await act(async () => root.render(createElement(GenerateDialog, { open: true, onClose: () => {}, data })))
    await flush()
    await click(buttonByText("Proposition IA"))
    expect(document.body.textContent).toContain("Qui cherche ?")
    await click(buttonByText("Proposer des idées"))
    await click(buttonByText("Créer le sujet"))

    const select = document.getElementById("gen-sujet") as HTMLSelectElement
    expect(select.value).toBe("11111111-1111-4111-8111-111111111111")
    expect(Array.from(select.options).map((o) => o.textContent)).toContain("Comment faire un devis de peinture")
    // Le mot-clé suit le sujet (pas encore dans la liste de la page : saisi), le type aussi
    expect((document.getElementById("gen-motcle-libre") as HTMLInputElement).value).toBe("comment faire un devis de peinture")
    expect(buttonByText("How-to").getAttribute("aria-pressed")).toBe("true")
    // La page relit ses sujets, la fenêtre des idées se ferme
    expect(nav.refreshed).toBeGreaterThan(0)
    expect(document.body.textContent).not.toContain("Qui cherche ?")
  })
})

describe("Éditeur · « Proposer un mot-clé exact »", () => {
  const base = { onChange: () => {}, keywords: [], keywordPages: null, slug: "devis" }

  it("le bouton n'existe que si l'éditeur sait ouvrir la Proposition IA", async () => {
    await act(async () => root.render(createElement(KeywordPicker, { ...base, value: null })))
    expect(() => buttonByText("Proposer un mot-clé")).toThrow()
  })

  it("sans mot-clé : « exact » ; avec un mot-clé : « plus exact » ; le clic ouvre la fenêtre", async () => {
    const onPropose = vi.fn()
    await act(async () => root.render(createElement(KeywordPicker, { ...base, value: null, onPropose })))
    await click(buttonByText("Proposer un mot-clé exact"))
    expect(onPropose).toHaveBeenCalledTimes(1)
    await act(async () => root.render(createElement(KeywordPicker, { ...base, value: "devis peinture", onPropose })))
    await click(buttonByText("Proposer un mot-clé plus exact"))
    expect(onPropose).toHaveBeenCalledTimes(2)
  })
})
