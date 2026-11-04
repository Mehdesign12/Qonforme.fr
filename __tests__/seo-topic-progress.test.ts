// @vitest-environment happy-dom
/**
 * Sujet « Rédaction en cours » (Articles › Sujets, 04/11/2026) : ouvrir le sujet montre
 * l'avancement de sa rédaction (même écran que « Générer un article ») et l'écran fait
 * avancer les passes ; une erreur du serveur (passe interrompue) n'arrête pas le suivi.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import * as React from "react"
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }) }))
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), message: vi.fn() } }))

let TopicDialog: typeof import("@/components/admin/seo/articles/TopicDialogs").TopicDialog
let runJob: typeof import("@/components/admin/seo/articles/job-runner").runJob

beforeAll(async () => {
  ;(globalThis as { React?: typeof React }).React = React
  ;({ TopicDialog } = await import("@/components/admin/seo/articles/TopicDialogs"))
  ;({ runJob } = await import("@/components/admin/seo/articles/job-runner"))
})

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })
const stepBody = (over: Record<string, unknown>) => ({ jobId: "job-1", status: "queued", step: "check", ran: "write", label: "", postId: null, error: null, notices: [], ...over })

let root: Root | null = null
let host: HTMLElement

beforeEach(() => {
  host = document.createElement("div")
  document.body.appendChild(host)
})
afterEach(() => {
  act(() => root?.unmount())
  root = null
  host.remove()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

const topic = {
  id: "t-1",
  title: "Autoliquidation en sous-traitance",
  keyword: "autoliquidation sous-traitance",
  articleType: "guide" as const,
  angle: null,
  status: "generating" as const,
  scheduledAt: null,
  publishMode: "draft" as const,
  lastError: null,
  postId: null,
  jobId: "job-1",
}

describe("fiche d'un sujet en cours de rédaction", () => {
  it("reprend la rédaction là où elle en est et la fait avancer jusqu'à l'article prêt", async () => {
    const calls: string[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push(`${init?.method ?? "GET"} ${url}`)
        if (init?.method === "GET") return json(200, { jobId: "job-1", status: "running", step: "write", postId: null, error: null, notices: [] })
        return json(200, stepBody({ status: "done", step: "done", ran: "save", postId: "post-9" }))
      }),
    )
    await act(async () => {
      root = createRoot(host)
      root.render(createElement(TopicDialog, { topic, onClose: () => {}, slots: [], coverImage: false, inlineImages: 0 }))
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(calls).toEqual(["GET /api/admin/seo/articles/jobs/job-1", "POST /api/admin/seo/articles/jobs/job-1/step"])
    const text = document.body.textContent ?? ""
    expect(text).toContain("Article prêt")
    expect(text).toContain("Relire l'article")
    expect(text).not.toContain("La rédaction est en cours ; l'article apparaîtra")
  })
})

describe("suivi de la rédaction", () => {
  it("une passe interrompue (504) n'arrête pas le suivi : nouvel appel, puis la suite", async () => {
    vi.useFakeTimers()
    const answers = [json(504, {}), json(200, stepBody({ status: "done", step: "done", ran: "save", postId: "p" }))]
    vi.stubGlobal("fetch", vi.fn(async () => answers.shift()))
    const states: string[] = []
    const done = runJob("job-1", (s) => states.push(`${s.status}:${s.error ?? ""}`), () => false)
    await vi.advanceTimersByTimeAsync(20_000)
    const final = await done
    expect(final.status).toBe("done")
    expect(states.some((s) => s.includes("n'a pas répondu à temps"))).toBe(true)
  })

  it("une erreur définitive (404) arrête le suivi avec son message", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(404, { error: "Rédaction introuvable." })))
    const final = await runJob("job-1", () => {}, () => false)
    expect(final).toMatchObject({ status: "stopped", error: "Rédaction introuvable." })
  })
})
