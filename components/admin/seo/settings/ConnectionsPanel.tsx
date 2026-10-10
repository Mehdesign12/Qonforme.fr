"use client"

/**
 * Paramètres › Connexions (planche Parametres-connexions.dc.html) : une ligne
 * par connexion (nom, usage, variables, état, « Tester » ou « Ajouter ») et
 * « Tout tester » en pied. Seule la présence des variables arrive ici, jamais
 * leur valeur ; le test passe par POST /api/admin/seo/connections/test.
 */
import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { CircleAlert, Clock, KeyRound, LoaderCircle, PlugZap, ShieldCheck, Check, X } from "lucide-react"
import { StatusPill } from "@/components/app/kit"
import { fmtDateTime } from "@/components/admin/ui"
import type { ConnectionState } from "@/lib/seo/types"
import { displayState, pillOf, summaryOf, type ConnectionTestView, type DisplayState } from "./connection-display"
import { cn } from "@/lib/utils"
import { ConnectionHelp } from "./ConnectionHelp"

export interface ConnectionRow {
  key: string
  name: string
  purpose: string
  env: string[]
  note?: string
  /** État de présence des variables (sans appel réseau). */
  state: ConnectionState
}

export type { ConnectionTestView }

const INITIALS: Record<string, string> = {
  search_console: "SC",
  pagespeed: "PS",
  gemini: "GE",
  openai: "OA",
  perplexity: "PX",
  anthropic: "AN",
  dataforseo: "DF",
  resend: "RS",
}

/** Conséquence d'une connexion absente. */
const WITHOUT: Record<string, string> = {
  search_console: "Sans compte de service, les clics, impressions et positions restent vides.",
  openai: "Sans clé, ChatGPT n'est pas relevé.",
  perplexity: "Sans clé, Perplexity n'est pas relevé.",
  anthropic: "Sans clé, Gemini rédige les articles et Claude n'est pas relevé.",
  dataforseo: "Sans identifiants, les volumes restent « — » et l'Aperçu IA de Google n'est pas relevé.",
  resend: "Sans clé, aucun résumé hebdomadaire ne part.",
  gemini: "Sans clé, ni plan d'article ni image de couverture avec les modèles par défaut, ni suivi de Gemini.",
}

const STATE_ICON: Record<DisplayState, React.ReactNode> = {
  connected: <Check strokeWidth={2.75} aria-hidden />,
  present: <Check strokeWidth={2.75} aria-hidden />,
  missing: <KeyRound strokeWidth={2.25} aria-hidden />,
  not_configured: <PlugZap strokeWidth={2.25} aria-hidden />,
  error: <X strokeWidth={2.75} aria-hidden />,
}

/** Variables présentes : testable (une variable illisible aussi, le test dit pourquoi). */
function isTestable(row: ConnectionRow): boolean {
  return row.state === "connected" || row.state === "error"
}

/** Usage sans la propriété Search Console, déjà montrée dans sa puce. */
function purposeOf(row: ConnectionRow): string {
  return row.purpose.replace(/\s*\(propriété[^)]*\)/i, "")
}

export function ConnectionsPanel({
  rows,
  initialTests,
  testsFailure,
  property,
}: {
  rows: ConnectionRow[]
  initialTests: Record<string, ConnectionTestView>
  /** Historique des tests illisible : base pas à jour, ou lecture en échec ; null s'il est lu. */
  testsFailure: "migration_pending" | "read_failed" | null
  property: string
}) {
  const router = useRouter()
  const [tests, setTests] = useState<Record<string, ConnectionTestView>>(initialTests)
  const [running, setRunning] = useState<string[]>([])
  const [help, setHelp] = useState<ConnectionRow | null>(null)

  const counts: Record<DisplayState, number> = { connected: 0, present: 0, missing: 0, not_configured: 0, error: 0 }
  rows.forEach((r) => {
    counts[displayState(r, tests[r.key])] += 1
  })
  const lastTest = Object.values(tests)
    .map((t) => t.checkedAt)
    .sort()
    .pop()
  const testable = rows.filter(isTestable)

  async function runTest(row: ConnectionRow): Promise<ConnectionTestView | null> {
    setRunning((list) => list.concat(row.key))
    try {
      const res = await fetch("/api/admin/seo/connections/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: row.key }),
      })
      const json = (await res.json().catch(() => ({}))) as { result?: ConnectionTestView; stored?: boolean; error?: string }
      if (!res.ok || !json.result) {
        toast.error(json.error ?? `${row.name} : le test n'a pas pu aboutir. Réessayez dans un instant.`)
        return null
      }
      const result = json.result
      setTests((t) => ({ ...t, [row.key]: result }))
      if (json.stored === false) toast.warning("Résultat non conservé : la base de données n'a pas pu l'enregistrer.")
      return result
    } catch {
      toast.error("Connexion impossible. Vérifiez le réseau, puis réessayez.")
      return null
    } finally {
      setRunning((list) => list.filter((k) => k !== row.key))
    }
  }

  async function testOne(row: ConnectionRow) {
    const result = await runTest(row)
    if (!result) return
    if (result.state === "connected") toast.success(`${row.name} : ${result.message}`)
    else if (result.state === "unverified") toast.warning(`${row.name} : ${result.message}`)
    else toast.error(`${row.name} : ${result.message}`)
    router.refresh()
  }

  async function testAll() {
    if (testable.length === 0) return
    const results = await Promise.all(testable.map((row) => runTest(row)))
    const done = results.filter((r): r is ConnectionTestView => r !== null)
    const failed = done.filter((r) => r.state !== "connected" && r.state !== "unverified").length
    const unverified = done.filter((r) => r.state === "unverified").length
    if (done.length === 0) return
    const label = `${done.length} ${done.length > 1 ? "connexions testées" : "connexion testée"}`
    const notes = [
      failed ? `${failed} en erreur` : "",
      unverified ? `${unverified} ${unverified > 1 ? "non vérifiées" : "non vérifiée"}` : "",
    ].filter(Boolean)
    if (notes.length === 0) toast.success(`${label} : toutes répondent.`)
    else if (failed) toast.error(`${label} : ${notes.join(", ")}.`)
    else toast.warning(`${label} : ${notes.join(", ")}.`)
    router.refresh()
  }

  const allRunning = running.length > 0

  return (
    <section aria-labelledby="titre-connexions" className="q-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-3 pt-4">
        <h2 id="titre-connexions" className="q-h2">
          Connexions
        </h2>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-[var(--q-line-soft)] bg-[var(--q-surface-2)] px-5 py-2.5 text-[13px] text-[var(--q-text-4)]">
        <span className="inline-flex items-center gap-1.5">
          <Clock className="size-3.5 shrink-0" aria-hidden />
          Dernier test&nbsp;: {lastTest ? fmtDateTime(lastTest) : "—"}
        </span>
        <span>{summaryOf(counts)}</span>
      </div>

      {testsFailure && (
        <p
          role={testsFailure === "read_failed" ? "alert" : undefined}
          className="flex items-start gap-2 border-t border-[var(--q-line-soft)] px-5 py-2.5 text-[13px] text-[var(--q-warn)]"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {testsFailure === "migration_pending"
              ? "Les résultats des tests ne sont pas conservés tant que la base de données n'est pas à jour."
              : "Historique des tests indisponible pour le moment : la lecture a échoué. Rechargez la page dans un instant."}
          </span>
        </p>
      )}

      <ul className="m-0 list-none p-0">
        {rows.map((row) => {
          const test = tests[row.key]
          const state = displayState(row, test)
          const def = pillOf(state)
          const isRunning = running.includes(row.key)
          const present = row.state === "connected"
          const unreadable = row.state === "error"
          const canTest = isTestable(row)
          return (
            <li key={row.key} className="flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-[var(--q-line-soft)] px-5 py-4">
              <span
                aria-hidden
                className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-[var(--q-sunken)] text-xs font-semibold text-[var(--q-text-2)]"
              >
                {INITIALS[row.key] ?? row.name.slice(0, 2).toUpperCase()}
              </span>
              <div className="flex min-w-0 flex-[1_1_0%] flex-col gap-0.5 sm:flex-[1_1_280px]">
                <h3 className="text-sm font-semibold leading-snug text-[var(--q-ink)]">{row.name}</h3>
                <p className="text-[13px] text-[var(--q-text-4)]">
                  {purposeOf(row)}.
                  {!canTest && WITHOUT[row.key] ? ` ${WITHOUT[row.key]}` : ""}
                  {unreadable
                    ? ` La variable est présente mais illisible : collez le fichier JSON tel quel ou encodé en base64.`
                    : ""}
                  {row.note && !(present && row.key === "pagespeed") ? ` ${row.note}` : ""}
                </p>
                {present && row.key === "pagespeed" && (
                  <p className="text-[13px] text-[var(--q-text-4)]">
                    Le test lance une vraie mesure de l&apos;accueil sur mobile&nbsp;: comptez jusqu&apos;à 1&nbsp;min&nbsp;30.
                  </p>
                )}
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-[var(--q-text-4)]">
                  {row.key === "search_console" && (
                    <>
                      <span>Propriété</span>
                      <code className="rounded-md border border-[var(--q-line)] bg-[var(--q-sunken)] px-1.5 py-0.5 font-mono text-xs text-[var(--q-text-2)]">
                        {property}
                      </code>
                    </>
                  )}
                  <span className={cn(row.key === "search_console" && "ml-2")}>{row.env.length > 1 ? "Variables" : "Variable"}</span>
                  {row.env.map((v, i) => (
                    <span key={v} className="inline-flex items-center gap-1.5">
                      {i > 0 && <span>et</span>}
                      <code className="break-all rounded-md border border-[var(--q-line)] bg-[var(--q-sunken)] px-1.5 py-0.5 font-mono text-xs text-[var(--q-text-2)]">
                        {v}
                      </code>
                    </span>
                  ))}
                </div>
                {test && canTest && (
                  <p
                    role="status"
                    className={cn("mt-1 text-[13px]", test.state === "error" ? "text-[var(--q-danger)]" : "text-[var(--q-text-3)]")}
                  >
                    Testé le {fmtDateTime(test.checkedAt)}&nbsp;: {test.message}
                  </p>
                )}
              </div>
              <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
                <span className="sm:w-[132px]">
                  <StatusPill tone={def.tone} icon={STATE_ICON[state]}>
                    {def.label}
                  </StatusPill>
                </span>
                {canTest ? (
                  <button
                    type="button"
                    onClick={() => testOne(row)}
                    disabled={isRunning}
                    aria-label={`Tester ${row.name}`}
                    className="q-btn q-btn-secondary q-btn-sm h-11 min-w-[84px] sm:h-[34px]"
                  >
                    {isRunning ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
                    {isRunning ? (row.key === "pagespeed" ? "Mesure…" : "Test…") : "Tester"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setHelp(row)}
                    aria-label={`Ajouter ${row.name}`}
                    className="q-btn q-btn-secondary q-btn-sm h-11 min-w-[84px] sm:h-[34px]"
                  >
                    Ajouter
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      <div className="flex flex-col gap-3 border-t border-[var(--q-line-soft)] bg-[var(--q-surface-2)] px-5 py-4 md:flex-row md:flex-wrap md:items-center md:justify-between">
        <p className="flex min-w-0 flex-[1_1_320px] items-start gap-2 text-[13px] text-[var(--q-text-3)]">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>Les clés se règlent dans les variables d&apos;environnement de l&apos;hébergeur&nbsp;; cette page ne les affiche jamais.</span>
        </p>
        <button
          type="button"
          onClick={testAll}
          disabled={testable.length === 0 || allRunning}
          className="q-btn q-btn-primary h-12 w-full rounded-[14px] text-[15px] md:h-10 md:w-auto md:rounded-[10px] md:text-sm"
        >
          {allRunning ? <LoaderCircle className="animate-spin" aria-hidden /> : <PlugZap aria-hidden />}
          {allRunning ? "Tests en cours…" : "Tout tester"}
        </button>
      </div>

      {help && (
        <ConnectionHelp
          open
          onOpenChange={(open) => {
            if (!open) setHelp(null)
          }}
          connectionKey={help.key}
          name={help.name}
          env={help.env}
          property={property}
        />
      )}
    </section>
  )
}
