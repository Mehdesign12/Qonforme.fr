/**
 * Briques serveur de l'admin › Affiliation : état « pas encore activée » ou
 * « lecture impossible », graphique des visites par semaine.
 */
import { CircleAlert, CloudOff } from "lucide-react"
import type { Failure } from "@/lib/affiliation/data"
import { PLANS, isPlanId } from "@/lib/stripe/plans"

/** « Essentiel mensuel », « Artisan annuel ». */
export function planText(plan: string | null, period: string | null): string {
  const name = plan && isPlanId(plan) ? PLANS[plan].name : "Abonnement"
  return period === "yearly" ? `${name} annuel` : period === "monthly" ? `${name} mensuel` : name
}

export function AffiliationError({ failure }: { failure: Failure }) {
  const unavailable = failure.kind === "unavailable"
  return (
    <div role="alert" className={unavailable ? "q-banner q-banner-warn items-start" : "q-banner q-banner-danger items-start"}>
      {unavailable ? <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> : <CloudOff className="mt-0.5 size-4 shrink-0" aria-hidden />}
      <p>{failure.message}</p>
    </div>
  )
}

const WEEK = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "Europe/Paris" })

/** Barres CSS, sans bibliothèque ; les 4 dernières semaines (30 jours) en bleu plein. */
export function WeeklyBars({ weeks, height = 130 }: { weeks: { start: string; count: number }[]; height?: number }) {
  const max = Math.max(1, ...weeks.map((w) => w.count))
  return (
    <figure className="m-0">
      <div className="flex items-end gap-2 border-b border-[var(--q-line)] sm:gap-3" style={{ height: height + 28 }} role="img" aria-label={`Visites par semaine : ${weeks.map((w) => `${WEEK.format(new Date(w.start))} ${w.count}`).join(", ")}`}>
        {weeks.map((w, i) => (
          <div key={w.start} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
            <span className="text-xs tabular-nums text-[var(--q-text-3)]">{w.count.toLocaleString("fr-FR")}</span>
            <div
              aria-hidden
              className="w-full max-w-11 rounded-t-md"
              style={{ height: Math.max(3, Math.round((w.count / max) * height)), background: i >= weeks.length - 4 ? "var(--q-accent)" : "var(--q-wash-line)" }}
            />
          </div>
        ))}
      </div>
      <figcaption className="mt-1.5 flex gap-2 sm:gap-3">
        {weeks.map((w) => (
          <span key={w.start} className="min-w-0 flex-1 truncate text-center text-[11px] text-[var(--q-text-4)]">{WEEK.format(new Date(w.start))}</span>
        ))}
      </figcaption>
    </figure>
  )
}
