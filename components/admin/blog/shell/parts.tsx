"use client"

/**
 * Pièces de la coque de l'éditeur d'articles : carte compacte de la colonne
 * de droite, état d'enregistrement, bannières du document (brouillon local,
 * passages bloquants, heure proposée), fenêtre de confirmation, zone de texte
 * qui suit son contenu, anneau qui signale le champ visé par la liste de
 * contrôle.
 *
 * Kit de l'admin (q-card, q-banner, q-btn, jetons --q-*) : le thème sombre
 * suit tout seul. Aucun flou ni will-change (règle iOS de CLAUDE.md).
 */
import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef } from "react"
import { CalendarClock, History, Loader2, ShieldAlert, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { parisDayTime, shortDay } from "@/lib/seo/articles/schedule"
import { todayInParis } from "@/lib/utils/paris-date"
import type { BlockingIssue } from "@/components/admin/blog/shell/model"
import { IssueItem, type IssueActions } from "@/components/admin/blog/shell/IssueItem"

/* ------------------------------------------------------------------ */
/* Anneau du champ visé                                                */
/* ------------------------------------------------------------------ */

/**
 * Classes du bloc qui reçoit l'anneau (attribut data-flash posé un instant
 * par flashElement). Anneau d'accent séparé du champ par un liseré de la
 * couleur de la surface.
 */
export const FLASH_RING =
  "rounded-xl transition-shadow duration-300 motion-reduce:transition-none data-[flash=true]:shadow-[0_0_0_3px_var(--q-surface),0_0_0_5px_var(--q-accent)]"

const flashTimers = new WeakMap<HTMLElement, number>()

export function flashElement(el: HTMLElement, ms = 1600) {
  const previous = flashTimers.get(el)
  if (previous) window.clearTimeout(previous)
  el.setAttribute("data-flash", "true")
  flashTimers.set(
    el,
    window.setTimeout(() => {
      el.removeAttribute("data-flash")
      flashTimers.delete(el)
    }, ms),
  )
}

/* ------------------------------------------------------------------ */
/* Carte de la colonne de droite                                       */
/* ------------------------------------------------------------------ */

export function SideCard({
  id,
  icon,
  title,
  action,
  children,
  className,
  bodyClassName,
}: {
  id: string
  icon: React.ReactNode
  title: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section aria-labelledby={`${id}-titre`} className={cn("q-card min-w-0 p-4", className)}>
      <div className="flex min-h-8 items-center gap-2">
        <span className="flex shrink-0 text-[var(--q-text-3)] [&>svg]:size-4" aria-hidden>
          {icon}
        </span>
        <h2 id={`${id}-titre`} className="m-0 min-w-0 flex-1 text-[14px] font-semibold leading-tight text-[var(--q-ink)]">
          {title}
        </h2>
        {action && <div className="-my-1 -mr-1.5 flex shrink-0 items-center">{action}</div>}
      </div>
      <div className={cn("mt-3", bodyClassName)}>{children}</div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* État d'enregistrement                                               */
/* ------------------------------------------------------------------ */

export type SaveState =
  | { kind: "saving" }
  | { kind: "blocked" }
  | { kind: "dirty"; restored: boolean }
  | { kind: "saved"; at: string }
  | { kind: "clean"; updatedAt: string | null; isNew: boolean }

/** « à 14:32 » aujourd'hui, « le 9 oct. à 10:00 » sinon (heure de Paris). */
export function whenLabel(iso: string): string {
  const { day, time } = parisDayTime(iso)
  return day === todayInParis() ? `à ${time}` : `le ${shortDay(day)} à ${time}`
}

const DOT: Record<"ok" | "warn" | "danger" | "info" | "neutral", string> = {
  ok: "bg-[var(--q-ok)]",
  warn: "bg-[var(--q-warn)]",
  danger: "bg-[var(--q-danger)]",
  info: "bg-[var(--q-info)]",
  neutral: "bg-[var(--q-text-4)]",
}

const TEXT: Record<keyof typeof DOT, string> = {
  ok: "text-[var(--q-ok)]",
  warn: "text-[var(--q-warn)]",
  danger: "text-[var(--q-danger)]",
  info: "text-[var(--q-info)]",
  neutral: "text-[var(--q-text-4)]",
}

export function SaveIndicator({ state, className }: { state: SaveState; className?: string }) {
  let tone: keyof typeof DOT = "neutral"
  let label = ""
  switch (state.kind) {
    case "saving":
      label = "Enregistrement…"
      break
    case "blocked":
      tone = "danger"
      label = "Publication refusée par le contrôle"
      break
    case "dirty":
      tone = state.restored ? "info" : "warn"
      label = state.restored ? "Brouillon local restauré" : "Modifications non enregistrées"
      break
    case "saved":
      tone = "ok"
      label = `Enregistré ${whenLabel(state.at)}`
      break
    case "clean":
      tone = state.isNew ? "neutral" : "ok"
      label = state.isNew ? "Pas encore enregistré" : state.updatedAt ? `Enregistré ${whenLabel(state.updatedAt)}` : "Enregistré"
      break
  }
  return (
    <span role="status" aria-live="polite" className={cn("inline-flex min-w-0 items-center gap-1.5 text-[13px] font-medium", TEXT[tone], className)}>
      {state.kind === "saving" ? (
        <Loader2 className="size-3.5 shrink-0 animate-spin text-[var(--q-text-3)] motion-reduce:animate-none" aria-hidden />
      ) : (
        <span className={cn("size-2 shrink-0 rounded-full", DOT[tone])} aria-hidden />
      )}
      <span className={cn("truncate", state.kind === "saving" && "text-[var(--q-text-3)]")}>{label}</span>
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* Bannières du document                                               */
/* ------------------------------------------------------------------ */

/** Brouillon local plus récent que l'enregistrement. */
export function DraftOfferBanner({ savedAt, changes, onRestore, onDismiss }: { savedAt: number; changes: string; onRestore: () => void; onDismiss: () => void }) {
  return (
    <div role="status" className="q-banner flex-wrap gap-x-3 gap-y-3 md:flex-nowrap md:items-center">
      <History className="mt-0.5 size-5 shrink-0 text-[var(--q-info)] md:mt-0" aria-hidden />
      <div className="min-w-0 flex-1 basis-[calc(100%-44px)] text-[14px] leading-snug md:basis-auto">
        <p className="m-0 font-semibold text-[var(--q-ink)]">Une version plus récente est restée sur cet appareil</p>
        <p className="m-0 mt-0.5 text-[13px] text-[var(--q-text-2)]">
          Modifiée {whenLabel(new Date(savedAt).toISOString())}, jamais enregistrée{changes ? ` : ${changes}` : ""}.
        </p>
      </div>
      <div className="flex w-full shrink-0 gap-2 md:w-auto">
        <button type="button" onClick={onDismiss} className="q-btn q-btn-ghost q-btn-sm max-md:h-11 max-md:flex-1">
          Ignorer
        </button>
        <button type="button" onClick={onRestore} className="q-btn q-btn-primary q-btn-sm max-md:h-11 max-md:flex-1">
          <History aria-hidden />
          Restaurer
        </button>
      </div>
    </div>
  )
}

/** Passages qui bloquent la publication (409 « check_failed »). */
export function BlockedBanner({
  issues,
  message,
  onDismiss,
  actions,
  isCorrected,
}: {
  issues: BlockingIssue[]
  message: string
  onDismiss: () => void
  /** « Aller au passage » et « Corriger avec l'IA » (sans elles, la liste est en lecture seule). */
  actions?: IssueActions
  /** Le passage n'est plus dans le texte : marqué « Corrigé ». */
  isCorrected?: (issue: BlockingIssue) => boolean
}) {
  return (
    <div role="alert" className="q-banner q-banner-danger relative !pr-12">
      <ShieldAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <div>
          <p className="m-0 text-[14px] font-semibold">Publication refusée par le contrôle</p>
          <p className="m-0 mt-0.5 text-[13px] leading-snug text-[var(--q-text-2)]">{message}</p>
        </div>
        {issues.length > 0 && (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {issues.map((issue, i) => (
              <IssueItem key={`${issue.label}-${i}`} issue={issue} corrected={Boolean(issue.excerpt && isCorrected?.(issue))} actions={actions} />
            ))}
          </ul>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Masquer les passages bloquants"
        className="absolute right-2 top-2 inline-flex size-9 items-center justify-center rounded-lg text-[var(--q-text-3)] hover:bg-[var(--q-surface)] hover:text-[var(--q-ink)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--q-focus)] max-md:size-11"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  )
}

/** Heure de publication proposée à la place de celle des Préférences (déjà passée aujourd'hui). */
export function ScheduleProposalBanner({ text, confirmLabel, onConfirm, onChange }: { text: React.ReactNode; confirmLabel: string; onConfirm: () => void; onChange: () => void }) {
  return (
    <div role="status" className="q-banner flex-wrap gap-x-3 gap-y-3 md:flex-nowrap md:items-center">
      <CalendarClock className="mt-0.5 size-5 shrink-0 text-[var(--q-info)] md:mt-0" aria-hidden />
      <p className="m-0 min-w-0 flex-1 basis-[calc(100%-44px)] text-[14px] leading-snug text-[var(--q-ink)] md:basis-auto">{text}</p>
      <div className="flex w-full shrink-0 gap-2 md:w-auto">
        <button type="button" onClick={onChange} className="q-btn q-btn-ghost q-btn-sm max-md:h-11 max-md:flex-1">
          Changer
        </button>
        <button type="button" onClick={onConfirm} className="q-btn q-btn-primary q-btn-sm max-md:h-11 max-md:flex-1">
          {confirmLabel}
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Fenêtre de confirmation                                             */
/* ------------------------------------------------------------------ */

/** Même style que les autres confirmations de l'éditeur (titre q-display 22 px, boutons à droite). */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  actions,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: React.ReactNode
  description: React.ReactNode
  children?: React.ReactNode
  actions: React.ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="gap-3 pb-[max(20px,env(safe-area-inset-bottom))] sm:max-w-md">
        <DialogTitle className="q-display text-[22px] font-semibold leading-tight">{title}</DialogTitle>
        <DialogDescription className="text-sm leading-relaxed !text-[var(--q-text-3)]">{description}</DialogDescription>
        {children}
        <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end [&>.q-btn]:max-md:h-12">{actions}</div>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ */
/* Zone de texte à hauteur du contenu                                  */
/* ------------------------------------------------------------------ */

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect

/** Zone de texte sans barre de défilement : sa hauteur suit le texte et la largeur disponible. */
export const AutoTextarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function AutoTextarea({ className, value, ...props }, ref) {
  const inner = useRef<HTMLTextAreaElement>(null)
  useImperativeHandle(ref, () => inner.current as HTMLTextAreaElement)

  const fit = useCallback(() => {
    const el = inner.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${el.scrollHeight}px`
  }, [])

  useIsoLayoutEffect(fit, [value, fit])

  useEffect(() => {
    const el = inner.current
    if (!el || typeof ResizeObserver === "undefined") return
    let width = el.clientWidth
    const observer = new ResizeObserver(() => {
      if (el.clientWidth !== width) {
        width = el.clientWidth
        fit()
      }
    })
    observer.observe(el)
    // Polices chargées après le premier rendu : la hauteur change
    void document.fonts?.ready.then(fit)
    return () => observer.disconnect()
  }, [fit])

  return <textarea ref={inner} rows={1} value={value} className={cn("block w-full resize-none overflow-hidden", className)} {...props} />
})

/* ------------------------------------------------------------------ */
/* Onglets (sous 1 280 px)                                             */
/* ------------------------------------------------------------------ */

const SCORE_PILL: Record<"ok" | "warn" | "danger", string> = {
  ok: "bg-[var(--q-ok-bg)] text-[var(--q-ok)]",
  warn: "bg-[var(--q-warn-bg)] text-[var(--q-warn)]",
  danger: "bg-[var(--q-danger-bg)] text-[var(--q-danger)]",
}

/**
 * Onglets collants de l'éditeur sur téléphone et tablette : un seul panneau
 * visible à la fois. Contrôle segmenté (boutons aria-pressed) ; le score du
 * référencement dans une petite pastille colorée (chiffre et libellé lu).
 */
export function EditorTabs<T extends string>({
  tabs,
  value,
  onChange,
  controls,
  className,
}: {
  tabs: { value: T; label: string; icon: React.ReactNode; score?: { value: number; tone: "ok" | "warn" | "danger"; label: string } }[]
  value: T
  onChange: (value: T) => void
  /** Identifiant du panneau commandé (aria-controls). */
  controls: Record<T, string>
  className?: string
}) {
  return (
    <div className={cn("sticky top-2 z-30 lg:top-[80px] xl:hidden", className)}>
      <div
        role="group"
        aria-label="Partie de l'éditeur"
        className="q-seg flex w-full shadow-[0_12px_28px_-18px_rgba(10,17,34,0.5),0_0_0_1px_var(--q-line)]"
      >
        {tabs.map((t) => (
          <button
            key={t.value}
            type="button"
            aria-pressed={value === t.value}
            aria-controls={controls[t.value]}
            onClick={() => onChange(t.value)}
            className="!h-11 min-w-0 flex-auto !gap-1.5 !px-2 !text-[13.5px] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--q-focus)]"
          >
            <span className="hidden shrink-0 sm:inline-flex [&>svg]:size-4" aria-hidden>
              {t.icon}
            </span>
            <span className="truncate">{t.label}</span>
            {t.score && (
              <span className={cn("q-num inline-flex h-5 min-w-[26px] shrink-0 items-center justify-center rounded-full px-1.5 text-[11.5px] font-bold tabular-nums", SCORE_PILL[t.score.tone])}>
                <span aria-hidden>{t.score.value}</span>
                <span className="sr-only">{t.score.label}</span>
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
