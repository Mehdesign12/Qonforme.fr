// @vitest-environment happy-dom
/**
 * Fenêtre d'un article et « + » du calendrier, dans un vrai DOM : chargement,
 * erreur puis « Réessayer », « Publier maintenant » refusé par le contrôle
 * (bannière des passages), « Replanifier », menu d'un jour et fenêtre
 * « Planifier un sujet » préremplie, parcours de la courbe au clavier.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import * as React from "react"
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const nav = vi.hoisted(() => ({ pushed: [] as string[], refreshed: 0 }))
const toasts = vi.hoisted(() => ({ calls: [] as string[] }))
vi.mock("sonner", () => {
  const toast = Object.assign((m: string) => void toasts.calls.push(m), {
    success: (m: string) => void toasts.calls.push(m),
    error: (m: string) => void toasts.calls.push(m),
  })
  return { toast }
})
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: (h: string) => void nav.pushed.push(h), replace: () => {}, refresh: () => void nav.refreshed++ }),
  usePathname: () => "/admin/seo/articles",
  useSearchParams: () => new URLSearchParams(""),
}))

import type { ArticleDetailsPayload } from "@/lib/seo/articles/details"
import type { CalendarData } from "@/lib/seo/articles/data"
import { monthGrid } from "@/lib/seo/articles/schedule"
import { todayInParis, addDays } from "@/lib/utils/paris-date"

// Le JSX du dépôt est compilé en React.createElement : React global avant le chargement des composants
let Dialog: typeof import("@/components/admin/seo/articles/ArticleDetailsDialog")
let Calendar: typeof import("@/components/admin/seo/articles/CalendarView")

beforeAll(async () => {
  ;(globalThis as { React?: typeof React }).React = React
  Dialog = await import("@/components/admin/seo/articles/ArticleDetailsDialog")
  Calendar = await import("@/components/admin/seo/articles/CalendarView")
})

const ID = "33333333-3333-4333-8333-333333333333"

function payload(over: Partial<ArticleDetailsPayload["post"]> = {}): ArticleDetailsPayload {
  return {
    post: {
      id: ID,
      slug: "exemple-devis-maconnerie",
      title: "Exemple de devis de maçonnerie",
      excerpt: null,
      coverUrl: null,
      coverAlt: null,
      status: "draft",
      type: "howto",
      source: "ai",
      publishedAt: null,
      scheduledAt: null,
      createdAt: "2026-10-01T08:00:00Z",
      updatedAt: null,
      targetKeyword: null,
      seoTitle: null,
      seoDescription: null,
      keywords: [],
      heldReason: null,
      ...over,
    },
    performance: {
      connected: true,
      lastDate: "2026-10-13",
      last28: { clicks: 3, impressions: 90, ctr: 3 / 90, position: 12.4 },
      sincePublished: null,
      series: [
        { day: "2026-10-11", clicks: 0, impressions: 20 },
        { day: "2026-10-12", clicks: 1, impressions: 30 },
        { day: "2026-10-13", clicks: 2, impressions: 40 },
      ],
      queries: [],
      error: null,
    },
    keyword: null,
    quality: { score: 64, words: 900, readingMinutes: 4, h2: 3, internalLinks: 1, images: 0, issues: [] },
  }
}

type Handler = (url: string, init: RequestInit | undefined) => { status: number; body: unknown }
let calls: { url: string; method: string; body: unknown }[] = []

function stubFetch(handler: Handler) {
  calls = []
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    calls.push({ url, method: init?.method ?? "GET", body: init?.body ? JSON.parse(String(init.body)) : undefined })
    const { status, body } = handler(url, init)
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })
  })
}

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  nav.pushed = []
  nav.refreshed = 0
  toasts.calls = []
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
const text = () => document.body.textContent?.replace(/[  ]/g, " ") ?? ""

function button(label: string | RegExp): HTMLButtonElement {
  const list = Array.from(document.querySelectorAll("button")) as HTMLButtonElement[]
  const found = list.find((b) => (typeof label === "string" ? b.textContent?.trim() === label || b.getAttribute("aria-label") === label : label.test(b.textContent ?? "")))
  if (!found) throw new Error(`Bouton introuvable : ${label}`)
  return found
}

async function click(el: HTMLElement) {
  await act(async () => {
    el.click()
  })
  await flush()
}

async function openDialog(onChanged?: () => void, onClose: () => void = () => {}) {
  await act(async () => root.render(createElement(Dialog.ArticleDetailsDialog, { postId: ID, onClose, onChanged })))
  await flush()
  await flush()
}

/** Échap sur l'élément qui a le focus (comme au clavier). */
async function escape() {
  const target = (document.activeElement as HTMLElement | null) ?? document.body
  await act(async () => {
    target.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
  })
  await flush()
  await flush()
}

/** Saisie dans un champ contrôlé par React (setter natif + évènement input). */
async function type(input: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value)
    input.dispatchEvent(new Event("input", { bubbles: true }))
  })
}

describe("fenêtre d'un article", () => {
  it("charge la fiche, puis « Publier maintenant » refusé : bannière des passages, rien n'est publié", async () => {
    stubFetch((url, init) => {
      if ((init?.method ?? "GET") === "GET") return { status: 200, body: payload() }
      return {
        status: 409,
        body: { error: "Publication refusée", code: "check_failed", issues: [{ label: "Anciens seuils de franchise de TVA", excerpt: "36 800 €", detail: "37 500 € depuis 2025" }] },
      }
    })
    await openDialog()
    expect(calls[0]).toMatchObject({ url: `/api/admin/seo/articles/posts/${ID}`, method: "GET" })
    expect(text()).toContain("Exemple de devis de maçonnerie")
    expect(text()).toContain("Créé le jeudi 1er octobre 2026 à 10:00")

    await click(button("Publier maintenant"))
    expect(text()).toContain("Publier cet article maintenant ?")
    await click(button("Publier"))
    expect(calls[1]).toMatchObject({ method: "PATCH", body: { action: "publish" } })
    expect(text()).toContain("Publication refusée : le contrôle repère un passage à corriger.")
    expect(text()).toContain("Anciens seuils de franchise de TVA : « 36 800 € »")
    expect(nav.refreshed).toBe(0)
  })

  it("« Publier maintenant » accepté : notification, page rafraîchie, fiche relue", async () => {
    let published = false
    stubFetch((_url, init) => {
      if ((init?.method ?? "GET") === "PATCH") {
        published = true
        return { status: 200, body: { ok: true } }
      }
      return { status: 200, body: payload(published ? { status: "published", publishedAt: "2026-10-16T08:00:00Z" } : {}) }
    })
    const changed = vi.fn()
    await openDialog(changed)
    await click(button("Publier maintenant"))
    await click(button("Publier"))
    await flush()
    expect(toasts.calls).toContain("Article publié")
    expect(nav.refreshed).toBe(1)
    expect(changed).toHaveBeenCalledTimes(1)
    expect(calls.filter((c) => c.method === "GET")).toHaveLength(2)
    expect(text()).toContain("Repasser en brouillon")
  })

  it("lecture en échec : message, puis « Réessayer » recharge la fiche", async () => {
    let fail = true
    stubFetch(() => (fail ? { status: 503, body: { error: "Lecture impossible pour le moment. Réessayez dans un instant." } } : { status: 200, body: payload() }))
    await openDialog()
    expect(text()).toContain("Fiche indisponible")
    expect(text()).toContain("Lecture impossible pour le moment.")
    fail = false
    await click(button(/Réessayer/))
    await flush()
    expect(text()).toContain("Exemple de devis de maçonnerie")
  })

  it("article supprimé : « Article introuvable », sans « Réessayer »", async () => {
    stubFetch(() => ({ status: 404, body: { error: "Article introuvable : il a peut-être été supprimé." } }))
    await openDialog()
    expect(text()).toContain("Article introuvable")
    expect(() => button(/Réessayer/)).toThrow()
  })

  it("article programmé : « Replanifier » envoie l'instant de Paris à la route de l'éditeur", async () => {
    const day = addDays(todayInParis(), 10)
    stubFetch((_url, init) => ((init?.method ?? "GET") === "PATCH" ? { status: 200, body: { success: true } } : { status: 200, body: payload({ status: "scheduled", scheduledAt: `${day}T06:00:00Z` }) }))
    await openDialog()
    await click(button(/Replanifier/))
    expect(text()).toContain("Replanifier la publication")
    expect(text()).toMatch(/Sera publié le .+ à 0[78]:00 \(heure de Paris\)\./)
    await click(button("Enregistrer"))
    const patch = calls.find((c) => c.method === "PATCH")
    expect(patch?.url).toBe(`/api/admin/blog/${ID}`)
    expect(String((patch?.body as { scheduled_at: string }).scheduled_at)).toMatch(new RegExp(`^${day}T0[67]:00:00.000Z$`))
    expect(toasts.calls.some((t) => t.startsWith("Publication replanifiée le "))).toBe(true)
  })

  it("Échap dans la confirmation ne ferme que la confirmation : la fiche reste ouverte", async () => {
    stubFetch(() => ({ status: 200, body: payload() }))
    const onClose = vi.fn()
    await openDialog(undefined, onClose)
    await click(button("Publier maintenant"))
    expect(text()).toContain("Publier cet article maintenant ?")
    await escape()
    expect(text()).not.toContain("Publier cet article maintenant ?")
    expect(onClose).not.toHaveBeenCalled()
    expect(text()).toContain("Performances dans Google")
    expect(calls.filter((c) => c.method === "PATCH")).toHaveLength(0)
  })

  it("Échap dans « Replanifier » ne ferme que le choix de la date", async () => {
    const day = addDays(todayInParis(), 10)
    stubFetch(() => ({ status: 200, body: payload({ status: "scheduled", scheduledAt: `${day}T06:00:00Z` }) }))
    const onClose = vi.fn()
    await openDialog(undefined, onClose)
    await click(button(/Replanifier/))
    expect(text()).toContain("Replanifier la publication")
    await escape()
    expect(text()).not.toContain("Replanifier la publication")
    expect(onClose).not.toHaveBeenCalled()
  })

  it("« Replanifier » d'une date dépassée : repart d'aujourd'hui, heure passée signalée en direct, rien n'est envoyé", async () => {
    const today = todayInParis()
    stubFetch(() => ({ status: 200, body: payload({ status: "scheduled", scheduledAt: `${addDays(today, -2)}T06:00:00Z` }) }))
    await openDialog()
    await click(button(/Replanifier/))
    const dayInput = document.querySelector('input[type="date"]') as HTMLInputElement
    const timeInput = document.querySelector('input[type="time"]') as HTMLInputElement
    expect(dayInput.value).toBe(today)
    await type(timeInput, "00:00")
    expect(text()).toContain("Choisissez une date et une heure à venir.")
    expect(timeInput.getAttribute("aria-invalid")).toBe("true")
    const save = button("Enregistrer")
    expect(save.disabled).toBe(true)
    await act(async () => {
      save.closest("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
    })
    await flush()
    expect(calls.filter((c) => c.method === "PATCH")).toHaveLength(0)
  })

  it("courbe : parcours des jours au clavier, annoncé aux lecteurs d'écran", async () => {
    await act(async () => root.render(createElement(Dialog.ArticleTrendChart, { series: payload().performance.series })))
    const chart = document.querySelector('[role="group"]') as HTMLElement
    await act(async () => chart.focus())
    expect(text()).toContain("Mar. 13 oct. : 40 impressions, 2 clics")
    await act(async () => {
      chart.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }))
    })
    expect(text()).toContain("Lun. 12 oct. : 30 impressions, 1 clic")
    await act(async () => {
      chart.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }))
    })
    expect(text()).toContain("Dim. 11 oct. : 20 impressions, 0 clic")
  })
})

function calendar(today: string): CalendarData {
  const month = today.slice(0, 7)
  return {
    month,
    label: "Mois",
    prev: month,
    next: month,
    today,
    weeks: monthGrid(month).map((days) => ({
      monday: days[0],
      days: days.map((day) => ({
        day,
        inMonth: day.startsWith(month),
        isToday: day === today,
        events:
          day === today
            ? [{ key: "post-1", kind: "post" as const, id: ID, title: "Article du jour", type: "guide" as const, status: "published" as const, day, time: "08:00", keyword: null, sourceTag: null, href: `/admin/blog/${ID}`, topic: null }]
            : [],
      })),
    })),
    unplanned: [],
    slots: [],
    defaultMode: "draft",
    coverImage: true,
    publishTime: "08:00",
  }
}

describe("calendrier : « + » d'un jour", () => {
  it("le menu du jour propose d'écrire, de planifier et de générer ; « Planifier un sujet » s'ouvre sur ce jour", async () => {
    const today = todayInParis()
    // Un jour à venir du même mois quand il existe, sinon aujourd'hui
    const target = addDays(today, 1).slice(0, 7) === today.slice(0, 7) ? addDays(today, 1) : today
    const generate = { topics: [], keywords: [], angles: [], lengthMin: 1500, lengthMax: 2500, coverImage: true, summary: "Plan", fallbacks: [], blocked: null, slot: null }
    await act(async () => root.render(createElement(Calendar.CalendarView, { data: calendar(today), filter: null, generate })))
    const plus = document.getElementById(`ajout-${target}`) as HTMLElement
    expect(plus).toBeTruthy()
    await click(plus)
    const menu = document.querySelector('[role="menu"]') as HTMLElement
    expect(menu).toBeTruthy()
    const label = Dialog.longDay(target, { capitalize: true }).replace(/ /g, " ")
    expect(menu.textContent?.replace(/ /g, " ")).toContain(label)
    expect(menu.textContent).toContain("Écrire un article")
    expect(menu.textContent).toContain("Planifier un sujet")
    expect(menu.textContent).toContain("Générer avec l'IA")
    if (target === today) expect(menu.textContent).toContain("1 article déjà prévu ce jour")

    const plan = Array.from(menu.querySelectorAll('[role="menuitem"]')).find((el) => el.textContent?.includes("Planifier un sujet")) as HTMLElement
    await click(plan)
    await flush()
    const dayInput = document.getElementById("plan-quand-day") as HTMLInputElement
    expect(dayInput?.value).toBe(target === today ? Calendar.plannedSlot(today, today, "08:00", new Date()).day : target)
  })

  it("« Écrire un article » ouvre l'éditeur programmé ce jour-là ; sans données de génération, pas de « Générer avec l'IA »", async () => {
    const today = todayInParis()
    const target = addDays(today, 1).slice(0, 7) === today.slice(0, 7) ? addDays(today, 1) : today
    await act(async () => root.render(createElement(Calendar.CalendarView, { data: calendar(today), filter: null, generate: null })))
    await click(document.getElementById(`ajout-${target}`) as HTMLElement)
    const menu = document.querySelector('[role="menu"]') as HTMLElement
    expect(menu.textContent).not.toContain("Générer avec l'IA")
    const write = Array.from(menu.querySelectorAll('[role="menuitem"]')).find((el) => el.textContent?.includes("Écrire un article")) as HTMLElement
    await click(write)
    expect(nav.pushed[0]).toMatch(new RegExp(`^/admin/blog/new\\?programmer=\\d{4}-\\d{2}-\\d{2}$`))
    if (target !== today) expect(nav.pushed[0]).toBe(`/admin/blog/new?programmer=${target}`)
  })

  it("jour déjà occupé selon les comptes non filtrés ; aujourd'hui, le sujet est rédigé avant la parution", async () => {
    const today = todayInParis()
    const data = calendar(today)
    // Filtre de statut actif : le jour n'affiche aucun événement mais en compte deux
    data.weeks.forEach((w) => w.days.forEach((d) => (d.events = [])))
    data.dayCounts = { [today]: 2 }
    await act(async () => root.render(createElement(Calendar.CalendarView, { data, filter: "published", generate: null })))
    await click(document.getElementById(`ajout-${today}`) as HTMLElement)
    const menu = document.querySelector('[role="menu"]') as HTMLElement
    expect(menu.textContent).toContain("2 articles déjà prévus ce jour")
    const slot = Calendar.plannedSlot(today, today, "08:00", new Date())
    if (slot.day === today) expect(menu.textContent).toContain("rédigé avant la parution")
    else expect(menu.textContent).toContain("Parution demain à 08:00, rédigé la veille")
  })

  it("page restée ouverte depuis la veille : le « + » d'un jour devenu passé n'ajoute plus rien", async () => {
    const yesterday = addDays(todayInParis(), -1)
    await act(async () => root.render(createElement(Calendar.CalendarView, { data: calendar(yesterday), filter: null, generate: null })))
    await click(document.getElementById(`ajout-${yesterday}`) as HTMLElement)
    const menu = document.querySelector('[role="menu"]') as HTMLElement
    expect(menu.textContent).toContain("Ce jour est passé. Actualisez la page")
    expect(menu.querySelectorAll('[role="menuitem"]')).toHaveLength(0)
  })

  it("aucun « + » dans le passé", async () => {
    const today = todayInParis()
    await act(async () => root.render(createElement(Calendar.CalendarView, { data: calendar(today), filter: null })))
    const days = Array.from(document.querySelectorAll("[id^='ajout-']")).map((el) => el.id.slice(6))
    expect(days.length).toBeGreaterThan(0)
    expect(days.every((d) => d >= today)).toBe(true)
    expect(days).toContain(today)
  })

  it("un article du calendrier ouvre sa fenêtre (et plus l'éditeur)", async () => {
    stubFetch(() => ({ status: 200, body: payload() }))
    const today = todayInParis()
    await act(async () => root.render(createElement(Calendar.CalendarView, { data: calendar(today), filter: null })))
    const card = Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.includes("Article du jour")) as HTMLElement
    await click(card)
    await flush()
    expect(nav.pushed).toEqual([])
    expect(calls[0]?.url).toBe(`/api/admin/seo/articles/posts/${ID}`)
    expect(text()).toContain("Performances dans Google")
  })
})
