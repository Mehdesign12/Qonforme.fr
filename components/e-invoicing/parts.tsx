"use client"

/**
 * Briques de la page « Facturation électronique » (canevas du 23/10/2026),
 * partagées par l'application et la démo.
 */
import { useState } from "react"
import { Check, Copy } from "lucide-react"
import { cn } from "@/lib/utils"

const DATE = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "long", year: "numeric" })
const DATE_TIME = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })

export function fmtDay(iso: string | null | undefined): string {
  if (!iso) return "—"
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? "—" : DATE.format(d)
}

export function fmtDayTime(iso: string | null | undefined): string {
  if (!iso) return "—"
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? "—" : DATE_TIME.format(d).replace(":", " h ")
}

/** Titre en deux voix (Bricolage puis Instrument Serif en bleu). */
export function TwoVoice({ first, accent, as: Tag = "h1", className }: { first: string; accent: string; as?: "h1" | "h2"; className?: string }) {
  return (
    <Tag className={cn(Tag === "h1" ? "q-h1" : "q-h2", className)}>
      {first} <span className="q-serif text-[var(--q-accent)]">{accent}</span>
    </Tag>
  )
}

export type StepKey = "choose" | "before" | "platform" | "active"
const STEPS: { key: StepKey; label: string }[] = [
  { key: "choose", label: "Choisir la plateforme" },
  { key: "before", label: "Avant de commencer" },
  { key: "platform", label: "Chez Super PDP" },
  { key: "active", label: "Réception active" },
]

/** Fil des étapes du raccordement (planches 3, 5, 6, 8). */
export function Stepper({ current, done }: { current: StepKey; done?: boolean }) {
  const idx = STEPS.findIndex((s) => s.key === current)
  return (
    <ol className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px]" aria-label="Étapes du raccordement">
      {STEPS.map((s, i) => {
        const isDone = i < idx || (done && i === idx)
        const isNow = i === idx && !done
        return (
          <li key={s.key} className="flex items-center gap-2" aria-current={isNow ? "step" : undefined}>
            <span
              className={cn(
                "grid size-6 place-items-center rounded-full text-[12px] font-semibold",
                isDone && "bg-[var(--q-ok-bg)] text-[var(--q-ok)]",
                isNow && "bg-[var(--q-accent)] text-white",
                !isDone && !isNow && "border-2 border-[var(--q-field)] text-[var(--q-text-4)]",
              )}
            >
              {isDone ? <Check className="size-3.5" strokeWidth={3} aria-hidden /> : i + 1}
            </span>
            <span className={cn(isNow ? "font-semibold text-[var(--q-ink)]" : "text-[var(--q-text-3)]")}>{s.label}</span>
            {i < STEPS.length - 1 && <span aria-hidden className="hidden h-px w-6 bg-[var(--q-line)] sm:block" />}
          </li>
        )
      })}
    </ol>
  )
}

/** Bouton « Copier » (adresse, message type). */
export function CopyButton({ text, label = "Copier", className, onCopied }: { text: string; label?: string; className?: string; onCopied?: () => void }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      className={cn("q-btn q-btn-secondary q-btn-sm", className)}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
          onCopied?.()
          setTimeout(() => setCopied(false), 2000)
        } catch {
          setCopied(false)
        }
      }}
    >
      {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
      {copied ? "Copié" : label}
    </button>
  )
}

/** Liste « libellé : valeur ». */
export function Facts({ rows }: { rows: { label: string; value: React.ReactNode; mono?: boolean }[] }) {
  return (
    <dl className="flex flex-col gap-3 text-sm">
      {rows.map((r) => (
        <div key={r.label} className="flex flex-wrap justify-between gap-x-3 gap-y-0.5">
          <dt className="text-[var(--q-text-4)]">{r.label}</dt>
          <dd className={cn("m-0 min-w-0 break-all text-right font-semibold text-[var(--q-ink)]", r.mono && "q-mono font-medium")}>{r.value}</dd>
        </div>
      ))}
    </dl>
  )
}

export type CheckTone = "done" | "now" | "todo" | "fail"

/** Ligne d'avancement (vérification de l'entreprise, de l'identité, annuaire). */
export function ProgressRow({ tone, title, sub }: { tone: CheckTone; title: string; sub: string }) {
  return (
    <li className="flex items-start gap-3 border-t border-[var(--q-line-soft)] py-3 first:border-t-0 first:pt-0">
      <span
        className={cn(
          "mt-0.5 grid size-7 shrink-0 place-items-center rounded-full text-[12px] font-semibold",
          tone === "done" && "bg-[var(--q-ok-bg)] text-[var(--q-ok)]",
          tone === "now" && "bg-[var(--q-accent)] text-white",
          tone === "todo" && "border-2 border-[var(--q-field)] text-[var(--q-text-4)]",
          tone === "fail" && "bg-[var(--q-danger-bg)] text-[var(--q-danger)]",
        )}
        aria-hidden
      >
        {tone === "done" ? <Check className="size-4" strokeWidth={3} /> : tone === "fail" ? "!" : "•"}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-[15px] font-semibold text-[var(--q-ink)]">{title}</span>
        <span className="text-[13px] text-[var(--q-text-3)]">{sub}</span>
      </span>
    </li>
  )
}

/** Calendrier de la réforme (planches 1 et 2). */
export function ReformTimeline({ today }: { today: string | null }) {
  const items = [
    { date: "1er septembre 2026", text: "Réception obligatoire pour toutes les entreprises assujetties à la TVA. Émission : grandes entreprises et ETI." },
    ...(today ? [{ date: `Aujourd'hui, ${today}`, text: "Vous pouvez déjà recevoir vos factures fournisseurs dans Qonforme.", now: true }] : []),
    { date: "1er septembre 2027", text: "Émission et transmission des données de vente : PME, TPE et micro-entreprises." },
  ]
  return (
    <section className="q-card p-5 md:p-6">
      <h2 className="q-h2">Les étapes clés de la réforme</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-[var(--q-text-3)]">
        Les échanges de factures entre entreprises assujetties à la TVA passent par des plateformes agréées. La
        réception concerne tout le monde dès maintenant ; l&apos;émission suit pour les petites entreprises.
      </p>
      <ol className="mt-5 flex flex-col gap-4">
        {items.map((it) => (
          <li key={it.date} className="flex gap-3">
            <span className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", "now" in it && it.now ? "bg-[var(--q-accent)]" : "bg-[var(--q-field)]")} aria-hidden />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-[var(--q-ink)]">{it.date}</span>
              <span className="text-[13px] leading-relaxed text-[var(--q-text-3)]">{it.text}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}

/** Qui fait quoi (planche 1). */
export function Responsibilities() {
  const cols = [
    {
      title: "Dans Qonforme",
      items: [
        "Votre boîte « Factures reçues », avec l'original à télécharger.",
        "Les statuts : prise en charge, approuvée, refusée avec motif, payée.",
        "Vos factures fournisseurs dans la trésorerie et chez votre comptable.",
      ],
    },
    {
      title: "Chez Super PDP",
      items: [
        "La vérification de votre identité et de votre entreprise.",
        "Votre adresse de réception dans l'annuaire des entreprises.",
        "La transmission des factures et des statuts.",
      ],
    },
  ]
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {cols.map((c) => (
        <section key={c.title} className="q-card p-5">
          <h2 className="q-h2">{c.title}</h2>
          <ul className="mt-3 flex flex-col gap-2.5 text-sm leading-relaxed text-[var(--q-text-2)]">
            {c.items.map((i) => (
              <li key={i} className="flex gap-2.5">
                <Check className="mt-0.5 size-4 shrink-0 text-[var(--q-ok)]" strokeWidth={2.5} aria-hidden />
                <span>{i}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
