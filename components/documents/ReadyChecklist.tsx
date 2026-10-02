/**
 * Contrôles avant envoi : uniquement des vérifications que l'application
 * fait vraiment (client, e-mail, lignes, dates, coordonnées de l'entreprise).
 * Carte détaillée sur ordinateur, bandeau d'une ligne sur mobile.
 */
import { Check, CircleAlert, Info, ShieldCheck } from "lucide-react"
import { cn } from "@/lib/utils"
import type { DocCheck } from "./model"

function summary(checks: DocCheck[]) {
  const required = checks.filter((c) => c.required)
  const ok = required.filter((c) => c.state === "ok").length
  return { ok, total: required.length, ready: ok === required.length }
}

export function ReadyChecklist({ title, checks, className }: { title: string; checks: DocCheck[]; className?: string }) {
  const { ok, total, ready } = summary(checks)
  return (
    <section className={cn("q-card flex flex-col gap-2.5 px-[18px] py-4", className)} aria-label="Contrôles avant envoi">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold text-[var(--q-ink)]">
          {ready && <ShieldCheck className="size-4 text-[var(--q-ok)]" strokeWidth={2} aria-hidden />}
          {title}
        </h2>
        <span className={cn("q-pill tabular-nums", ready ? "q-pill-ok" : "q-pill-info")}>
          {ok} sur {total}
        </span>
      </div>
      <ul className="flex flex-col gap-2">
        {checks.map((c) => (
          <li key={c.key} className="flex items-start gap-2.5 text-sm">
            <CheckIcon state={c.state} />
            <span className={cn(c.state === "info" ? "text-[var(--q-text-3)]" : "text-[var(--q-ink)]")}>
              {c.label}
              {!c.required && <span className="sr-only"> (indicatif)</span>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function CheckIcon({ state }: { state: DocCheck["state"] }) {
  if (state === "ok") return <Check className="mt-0.5 size-4 shrink-0 text-[var(--q-ok)]" strokeWidth={2.5} aria-label="Fait" />
  if (state === "info") return <Info className="mt-0.5 size-4 shrink-0 text-[var(--q-text-4)]" strokeWidth={2} aria-label="À vérifier" />
  return <CircleAlert className="mt-0.5 size-4 shrink-0 text-[var(--q-warn)]" strokeWidth={2} aria-label="À faire" />
}

/** Bandeau mobile (canevas Mobile-creation) : prêt, ou le premier point à régler. */
export function ReadyBanner({ title, checks, className }: { title: string; checks: DocCheck[]; className?: string }) {
  const { ok, total, ready } = summary(checks)
  const todo = checks.filter((c) => c.required && c.state !== "ok")
  return (
    <div className={cn("q-banner", ready ? "q-banner-ok" : "q-banner-warn", className)} role="status">
      {ready
        ? <ShieldCheck className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden />
        : <CircleAlert className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden />}
      <span className="leading-normal">
        <strong className="font-semibold">{ready ? title : "À compléter"}</strong>
        <span className="tabular-nums"> · {ok} contrôle{ok > 1 ? "s" : ""} sur {total}</span>
        {!ready && <span className="block">{todo.map((c) => c.label).join(" · ")}</span>}
      </span>
    </div>
  )
}
