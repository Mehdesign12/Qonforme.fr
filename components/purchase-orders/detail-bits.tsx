"use client"

/**
 * Briques des fiches « bon de commande » et « avoir » (canevas
 * « Bon-de-commande-detail » et « Avoir-AV-2026-001 ») : aperçu papier,
 * suivi, boutons d'action, barre d'actions mobile, fenêtres.
 *
 * Partagées par les pages réelles et leurs miroirs de démo (règle « Mode
 * démo » de CLAUDE.md). Même vocabulaire visuel que la fiche devis
 * (components/quotes/QuoteDetailView.tsx).
 */
import { useEffect, useState } from "react"
import Link from "next/link"
import { Check, ChevronRight, Info, Loader2, X, type LucideIcon } from "lucide-react"
import { initialsOf } from "@/components/app/kit"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/utils/invoice"
import { fmtAmount, fmtQty, fmtRate, fmtSiren, fmtUnit, vatBreakdown } from "@/components/quotes/QuoteListHelpers"

/** Montant d'avoir : « − 2 400,00 € » (signe moins typographique, espace insécable). */
export function negCurrency(n: number): string {
  const v = Math.abs(Number(n) || 0)
  return v === 0 ? formatCurrency(0) : `− ${formatCurrency(v)}`
}

/* ------------------------------------------------------------------ */
/* Aperçu papier (reprend le contenu du PDF, reste blanc en thème sombre) */
/* ------------------------------------------------------------------ */

export interface PaperParty {
  name: string
  address?: string | null
  zip_code?: string | null
  city?: string | null
  siren?: string | null
  siret?: string | null
  vat_number?: string | null
  email?: string | null
}

export interface PaperLine {
  description: string
  quantity: number
  unit?: string | null
  unit_price_ht: number
  vat_rate: number
  total_ht: number
  total_vat?: number | null
}

export function DocPaper({
  title,
  meta,
  company,
  companySettingsHref,
  clientLabel = "CLIENT",
  client,
  intro,
  lines,
  subtotal_ht,
  total_ttc,
  negative,
  totalLabel = "Total TTC",
  notes,
  notesLabel = "NOTES / CONDITIONS",
}: {
  title: string
  /** Lignes sous le titre (la première en DM Mono : numéro et date). */
  meta: React.ReactNode[]
  company: PaperParty | null
  companySettingsHref?: string
  clientLabel?: string
  client: PaperParty | null
  /** Bloc affiché avant les lignes (motif de l'avoir). */
  intro?: React.ReactNode
  lines: PaperLine[]
  subtotal_ht: number
  total_ttc: number
  /** Avoir : totaux affichés en négatif, comme sur le PDF. */
  negative?: boolean
  totalLabel?: string
  notes?: string | null
  notesLabel?: string
}) {
  const label = "block text-[11px] font-semibold tracking-[.04em] text-[#64748B]"
  const cols = "grid grid-cols-[minmax(0,1fr)_64px_72px_48px_84px] gap-2"
  const money = (n: number) => (negative ? negCurrency(n) : formatCurrency(n))
  const amount = (n: number) => (negative && n ? `− ${fmtAmount(Math.abs(n))}` : fmtAmount(n))

  return (
    <div className="q-paper flex w-full max-w-[640px] flex-col gap-[22px] p-9 text-[12px] leading-normal">
      <div className="flex items-start justify-between gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-[10px] bg-[#0F172A] text-[13px] font-semibold text-white">
          {initialsOf(company?.name ?? "Q")}
        </span>
        <span className="flex flex-col items-end gap-[3px] text-right">
          <span className="text-lg font-semibold tracking-[-0.01em]">{title}</span>
          {meta.map((m, i) => (
            <span key={i} className={i === 0 ? "font-mono text-[#475569]" : "text-[#64748B]"}>{m}</span>
          ))}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 leading-[1.55]">
        <span>
          <strong className={label}>ÉMETTEUR</strong>
          {company ? (
            <PartyLines party={company} />
          ) : (
            <>
              Votre entreprise
              <br />
              <span className="text-[#64748B]">
                À compléter dans{" "}
                {companySettingsHref
                  ? <Link href={companySettingsHref} className="text-[#1D4ED8] underline">Paramètres › Entreprise</Link>
                  : "Paramètres › Entreprise"}
              </span>
            </>
          )}
        </span>
        <span>
          <strong className={label}>{clientLabel}</strong>
          {client ? <PartyLines party={client} withEmail /> : "—"}
        </span>
      </div>

      {intro}

      <div className="flex flex-col">
        <div className={cn(cols, "border-b border-[#E6E9F0] py-2 font-semibold text-[#64748B]")}>
          <span>Désignation</span>
          <span className="text-right">Qté</span>
          <span className="text-right">Prix HT</span>
          <span className="text-right">TVA</span>
          <span className="text-right">Total HT</span>
        </div>
        {lines.map((l, i) => (
          <div key={i} className={cn(cols, "border-b border-[#F1F4F8] py-2 tabular-nums")}>
            <span className="min-w-0 break-words">{l.description}</span>
            <span className="text-right">{fmtQty(l.quantity)}{l.unit ? ` ${fmtUnit(l.quantity, l.unit)}` : ""}</span>
            <span className="text-right">{fmtAmount(l.unit_price_ht)}</span>
            <span className="text-right">{fmtRate(l.vat_rate)} %</span>
            <span className="text-right">{amount(l.total_ht)}</span>
          </div>
        ))}
      </div>

      <div className="ml-auto flex w-[58%] flex-col gap-1.5 tabular-nums">
        <div className="flex justify-between"><span className="text-[#475569]">Total HT</span><span>{money(subtotal_ht)}</span></div>
        {vatBreakdown(lines).map((v) => (
          <div key={v.rate} className="flex justify-between"><span className="text-[#475569]">TVA {fmtRate(v.rate)} %</span><span>{money(v.amount)}</span></div>
        ))}
        <div className="flex justify-between border-t border-[#E6E9F0] pt-1.5 text-sm font-semibold"><span>{totalLabel}</span><span>{money(total_ttc)}</span></div>
      </div>

      {notes && (
        <div className="border-t border-[#F1F4F8] pt-3 text-[11px] leading-[1.55] text-[#475569]">
          <strong className={cn(label, "mb-1")}>{notesLabel}</strong>
          <span className="whitespace-pre-line">{notes}</span>
        </div>
      )}
    </div>
  )
}

function PartyLines({ party, withEmail }: { party: PaperParty; withEmail?: boolean }) {
  const city = [party.zip_code, party.city].filter(Boolean).join(" ")
  return (
    <>
      {party.name}
      {party.address && <><br />{party.address}{city && `, ${city}`}</>}
      {!party.address && city && <><br />{city}</>}
      {withEmail && party.email && <><br />{party.email}</>}
      {(party.siret || party.siren) && <><br />{party.siret ? `SIRET ${fmtSiren(party.siret)}` : `SIREN ${fmtSiren(party.siren!)}`}</>}
      {party.vat_number && <><br />TVA {party.vat_number}</>}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Suivi                                                               */
/* ------------------------------------------------------------------ */

export type TimelineEvent = { title: string; sub?: string; state: "done" | "todo" | "refused" }

export function Timeline({ events }: { events: TimelineEvent[] }) {
  return (
    <ol className="m-0 flex list-none flex-col p-0">
      {events.map((e, i) => {
        const last = i === events.length - 1
        return (
          <li key={i} className="flex gap-3">
            <span className="flex flex-col items-center">
              {e.state === "done" && (
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[var(--q-accent)] text-white">
                  <Check className="size-3" strokeWidth={3} aria-hidden />
                </span>
              )}
              {e.state === "refused" && (
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[var(--q-danger)] text-white">
                  <X className="size-3" strokeWidth={3} aria-hidden />
                </span>
              )}
              {e.state === "todo" && <span className="size-5 shrink-0 rounded-full border-2 border-dashed border-[var(--q-placeholder)] bg-[var(--q-surface)]" />}
              {!last && <span className={cn("min-h-[18px] w-0.5 flex-1", e.state === "done" ? "bg-[var(--q-accent)]" : "bg-[var(--q-line)]")} />}
            </span>
            <span className={cn("flex min-w-0 flex-col gap-0.5", !last && "pb-3.5")}>
              <span className="text-sm font-semibold text-[var(--q-ink)]">
                <span className="sr-only">{e.state === "todo" ? "À venir : " : "Fait : "}</span>
                {e.title}
              </span>
              {e.sub && <span className="break-words text-xs tabular-nums text-[var(--q-text-4)]">{e.sub}</span>}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

/* ------------------------------------------------------------------ */
/* Boutons                                                             */
/* ------------------------------------------------------------------ */

/** Bouton d'action (classes q-btn) : lien ou bouton, avec état de chargement. */
export function Act({
  label, icon: Icon, onClick, href, variant = "secondary", size, loading, disabled, iconOnly,
}: {
  label: string
  icon?: LucideIcon
  onClick?: () => void
  href?: string
  variant?: "primary" | "secondary" | "danger" | "ghost"
  size?: "sm"
  loading?: boolean
  disabled?: boolean
  /** Icône seule (le libellé reste lu par les lecteurs d'écran et en infobulle). */
  iconOnly?: boolean
}) {
  const cls = cn(
    "q-btn",
    variant === "primary" ? "q-btn-primary" : variant === "danger" ? "q-btn-danger" : variant === "ghost" ? "q-btn-ghost" : "q-btn-secondary",
    size === "sm" && "q-btn-sm",
    iconOnly && "q-btn-icon",
  )
  const content = (
    <>
      {loading ? <Loader2 className="animate-spin" aria-hidden /> : Icon && <Icon aria-hidden />}
      {iconOnly ? <span className="sr-only">{label}</span> : label}
    </>
  )
  const title = iconOnly ? label : undefined
  if (href) return <Link href={href} className={cls} title={title}>{content}</Link>
  return <button type="button" className={cls} onClick={onClick} disabled={loading || disabled} title={title}>{content}</button>
}

/** Bouton de la barre d'actions mobile : 52 px pour l'action principale, 48 px sinon. */
export function BarBtn({
  label, icon: Icon, onClick, href, primary, loading,
}: {
  label: string
  icon: LucideIcon
  onClick?: () => void
  href?: string
  primary?: boolean
  loading?: boolean
}) {
  const cls = cn("q-btn w-full", primary ? "q-btn-primary q-btn-xl" : "q-btn-secondary q-btn-lg !px-3 !whitespace-normal")
  const content = (
    <>
      {loading ? <Loader2 className="animate-spin" aria-hidden /> : <Icon aria-hidden />}
      <span className={primary ? "truncate" : "text-center leading-tight"}>{label}</span>
    </>
  )
  if (href) return <Link href={href} className={cls}>{content}</Link>
  return <button type="button" className={cls} onClick={onClick} disabled={loading}>{content}</button>
}

/** Barre d'actions collée en bas (mobile), au-dessus de la barre de navigation flottante. */
export function MobileActionBar({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Réserve sous la barre, pour que la fin de page reste lisible */}
      <div aria-hidden className="h-[132px] lg:hidden print:hidden" />
      <div
        className="fixed inset-x-3 z-30 flex flex-col gap-2.5 rounded-3xl border border-[var(--q-line)] bg-[var(--q-surface)] p-3 shadow-[var(--q-shadow-float)] lg:hidden print:hidden"
        style={{ bottom: "calc(96px + env(safe-area-inset-bottom))" }}
      >
        {children}
      </div>
    </>
  )
}

/** Ligne de la feuille « Plus d'actions » (mobile). */
export function MoreRow({
  icon: Icon, label, hint, onClick, href, danger,
}: {
  icon: LucideIcon
  label: string
  hint?: string
  onClick?: () => void
  href?: string
  danger?: boolean
}) {
  const cls = "flex min-h-[60px] w-full items-center gap-3 border-b border-[var(--q-line-soft)] px-1 py-2 text-left last:border-b-0"
  const content = (
    <>
      <span className={cn(
        "grid size-10 shrink-0 place-items-center rounded-[11px]",
        danger ? "bg-[var(--q-danger-bg)] text-[var(--q-danger)]" : "bg-[var(--q-wash)] text-[var(--q-accent-strong)]",
      )}>
        <Icon className="size-[18px]" aria-hidden />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={cn("text-base font-semibold", danger ? "text-[var(--q-danger)]" : "text-[var(--q-ink)]")}>{label}</span>
        {hint && <span className="truncate text-[13px] text-[var(--q-text-4)]">{hint}</span>}
      </span>
      <ChevronRight className="size-4 shrink-0 text-[var(--q-text-4)]" aria-hidden />
    </>
  )
  if (href) return <Link href={href} className={cls} onClick={onClick}>{content}</Link>
  return <button type="button" className={cls} onClick={onClick}>{content}</button>
}

/** Ligne de la carte « Liés à ce document ». */
export function LinkedRow({ href, icon, title, sub, mono }: { href?: string; icon: React.ReactNode; title: string; sub: string; mono?: boolean }) {
  const content = (
    <>
      {icon}
      <span className="flex min-w-0 flex-1 flex-col gap-px">
        <span className={cn("truncate text-sm font-semibold text-[var(--q-ink)]", mono && "font-mono font-medium")}>{title}</span>
        <span className="truncate text-xs text-[var(--q-text-4)]">{sub}</span>
      </span>
      {href && <ChevronRight className="size-4 shrink-0 text-[var(--q-text-4)]" aria-hidden />}
    </>
  )
  const cls = "flex items-center gap-3 border-t border-[var(--q-line-soft)] px-[18px] py-3"
  if (href) return <Link href={href} className={cn(cls, "hover:bg-[var(--q-row-hover)]")}>{content}</Link>
  return <div className={cls}>{content}</div>
}

/** Pictogramme carré en lavis bleu (cartes « Liés à ce document »). */
export function WashIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="grid size-8 shrink-0 place-items-center rounded-[9px] bg-[var(--q-wash)] text-[var(--q-accent-strong)]">
      <Icon className="size-4" aria-hidden />
    </span>
  )
}

export function TotalRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <span className={cn("flex justify-between gap-3", strong && "font-semibold")}>
      <span className={strong ? "text-[var(--q-ink)]" : "text-[var(--q-text-3)]"}>{label}</span>
      <span>{value}</span>
    </span>
  )
}

/** Note d'information en lavis bleu (planches mobiles). */
export function InfoNote({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start gap-2.5 rounded-[14px] border border-[var(--q-wash-line)] bg-[var(--q-wash)] px-3.5 py-3 text-sm leading-normal text-[var(--q-accent-ink)]", className)}>
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Fenêtre : feuille du bas sur mobile, fenêtre centrée sur ordinateur  */
/* ------------------------------------------------------------------ */

export type ModalAction = {
  label: string
  icon?: React.ReactNode
  onClick: () => void
  variant?: "primary" | "secondary" | "danger"
  disabled?: boolean
}

export function DocModal({
  open, onOpenChange, compact, title, description, children, actions,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  compact: boolean
  title: string
  description?: string
  children?: React.ReactNode
  actions: ModalAction[]
}) {
  const btn = (a: ModalAction, big: boolean) => (
    <button
      key={a.label}
      type="button"
      onClick={a.onClick}
      disabled={a.disabled}
      className={cn(
        "q-btn",
        a.variant === "primary" ? "q-btn-primary" : a.variant === "danger" ? "q-btn-danger" : "q-btn-secondary",
        big && (a.variant === "primary" ? "q-btn-xl w-full" : "q-btn-lg w-full"),
      )}
    >
      {a.icon}
      {a.label}
    </button>
  )

  if (compact) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" showCloseButton={false} className="max-h-[85dvh] gap-3 overflow-y-auto px-4 pb-[max(24px,env(safe-area-inset-bottom))] pt-2">
          <div className="q-sheet-grip" aria-hidden />
          <div className="flex flex-col gap-1 pt-1">
            <SheetTitle className="font-display text-[22px] font-semibold tracking-[-0.02em] text-[var(--q-ink)]">{title}</SheetTitle>
            {description && <SheetDescription className="text-sm leading-snug text-[var(--q-text-4)]">{description}</SheetDescription>}
          </div>
          {children && <div className="flex flex-col gap-3">{children}</div>}
          <div className="flex flex-col gap-2.5 pt-1">
            {actions.map((a) => btn(a, true))}
            <SheetClose render={<button type="button" className="q-btn q-btn-ghost h-11 w-full text-[15px]" />}>
              {actions.length ? "Annuler" : "Fermer"}
            </SheetClose>
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[520px]">
        <div className="flex flex-col gap-1 px-[22px] pr-12 pt-5">
          <DialogTitle className="font-display text-[22px] font-semibold leading-tight tracking-[-0.02em] text-[var(--q-ink)]">{title}</DialogTitle>
          {description && <DialogDescription className="text-sm text-[var(--q-text-4)]">{description}</DialogDescription>}
        </div>
        <div className="flex flex-col gap-3.5 px-[22px] py-[18px]">{children}</div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--q-line-soft)] bg-[var(--q-surface-2)] px-[22px] py-4">
          <DialogClose render={<button type="button" className="q-btn q-btn-ghost q-btn-sm" />}>
            {actions.length ? "Annuler" : "Fermer"}
          </DialogClose>
          {[...actions].reverse().map((a) => btn(a, false))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Vrai sous 1024 px (mise en page mobile de la coque) : feuilles du bas au lieu de fenêtres. */
export function useIsCompact(): boolean {
  const [compact, setCompact] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)")
    const update = () => setCompact(mq.matches)
    update()
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [])
  return compact
}

/** Bloc « Destinataire » des fenêtres d'envoi par email. */
export function RecipientBox({
  name, email, clientHref,
}: { name: string | null | undefined; email: string | null | undefined; clientHref?: string | null }) {
  return (
    <div className="q-inset flex flex-col gap-0.5 p-3.5">
      <span className="text-xs text-[var(--q-text-4)]">Destinataire</span>
      <span className="text-sm font-semibold">{name ?? "Aucun client"}</span>
      {email
        ? <span className="truncate font-mono text-[13px] text-[var(--q-text-3)]">{email}</span>
        : (
          <span className="text-[13px] text-[var(--q-danger)]">
            Aucune adresse email : ajoutez-en une dans la{" "}
            {clientHref ? <Link href={clientHref} className="underline">fiche client</Link> : "fiche client"}.
          </span>
        )}
    </div>
  )
}
