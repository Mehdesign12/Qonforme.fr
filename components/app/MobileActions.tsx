"use client"

/**
 * Actions d'une fiche sur téléphone (piste C, choisie par le fondateur le
 * 11/11/2026, canevas https://claude.ai/artifact/YV7XGpHJc8tCx3LX9wVint).
 *
 * - Une ligne dans la page, sous la carte du montant : l'action principale en
 *   grand, une ou deux actions à côté. Rien ne flotte par-dessus le contenu.
 * - Une fois cette ligne sortie de l'écran par le haut, une petite pilule de
 *   l'action principale apparaît au-dessus de la barre du bas.
 *
 * Opacité et translate seulement, ni backdrop-filter ni will-change (iOS).
 */

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Loader2, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export type MobileAction = {
  key: string
  label: string
  icon: LucideIcon
  onClick?: () => void
  href?: string
  loading?: boolean
  disabled?: boolean
  danger?: boolean
  title?: string
}

/** Grille de la ligne : l'action principale prend deux parts quand elle a des voisines. */
export function rowColumns(count: number, even = false): string {
  if (count >= 3) return "grid-cols-[2fr_1fr_1fr]"
  if (count === 2) return even ? "grid-cols-2" : "grid-cols-[2fr_1fr]"
  return "grid-cols-1"
}

function ActionBtn({ a, primary, className }: { a: MobileAction; primary: boolean; className?: string }) {
  const Icon = a.icon
  const cls = cn(
    "q-btn h-11 min-w-0 !rounded-[14px] !px-2 text-[15px]",
    primary ? "q-btn-primary" : a.danger ? "q-btn-danger" : "q-btn-secondary",
    // Les voisines peuvent passer sur deux lignes plutôt que d'être coupées
    !primary && "!whitespace-normal text-center leading-tight",
    className,
  )
  const content = (
    <>
      {a.loading ? <Loader2 className="shrink-0 animate-spin" aria-hidden /> : <Icon className="shrink-0" aria-hidden />}
      <span className={primary ? "truncate" : undefined}>{a.label}</span>
    </>
  )
  if (a.href && !a.onClick) return <Link href={a.href} className={cls} title={a.title}>{content}</Link>
  return (
    <button type="button" className={cls} onClick={a.onClick} disabled={a.loading || a.disabled} title={a.title} aria-busy={a.loading || undefined}>
      {content}
    </button>
  )
}

export function MobileActions({
  actions,
  pill = true,
  even = false,
  primaryIndex = 0,
  className,
}: {
  /** Dans l'ordre d'affichage ; l'action principale est à `primaryIndex`. */
  actions: (MobileAction | null | undefined | false)[]
  /** Pilule de l'action principale après défilement. */
  pill?: boolean
  /** Deux actions de même largeur (facture reçue : Refuser / Approuver). */
  even?: boolean
  primaryIndex?: number
  className?: string
}) {
  const list = actions.filter(Boolean) as MobileAction[]
  const primary = list[primaryIndex] ?? null
  const rowRef = useRef<HTMLDivElement>(null)
  const [passed, setPassed] = useState(false)
  const showPill = pill && !!primary

  useEffect(() => {
    const el = rowRef.current
    if (!showPill || !el || typeof IntersectionObserver === "undefined") return
    const io = new IntersectionObserver(
      ([entry]) => setPassed(!entry.isIntersecting && entry.boundingClientRect.top < 0),
      { threshold: 0 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [showPill])

  if (list.length === 0) return null
  const PillIcon = primary?.icon

  return (
    <>
      <div ref={rowRef} className={cn("grid gap-2 lg:hidden print:hidden", rowColumns(list.length, even), className)}>
        {list.map((a, i) => <ActionBtn key={a.key} a={a} primary={i === primaryIndex} />)}
      </div>

      {showPill && primary && PillIcon && (
        <>
          {/* Réserve en fin de page : la pilule ne cache jamais le dernier bloc */}
          <div aria-hidden className="order-last h-14 lg:hidden print:hidden" />
          {(() => {
            const cls = cn(
              "q-btn q-btn-primary fixed right-4 z-30 h-12 max-w-[calc(100%-2rem)] rounded-full !px-5 text-[15px] shadow-[shadow:var(--q-shadow-pop)] lg:hidden print:hidden",
              "transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none",
              passed ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0",
            )
            const style = { bottom: "calc(104px + env(safe-area-inset-bottom))" }
            const inner = (
              <>
                {primary.loading ? <Loader2 className="shrink-0 animate-spin" aria-hidden /> : <PillIcon className="shrink-0" aria-hidden />}
                <span className="truncate">{primary.label}</span>
              </>
            )
            const hidden = !passed
            if (primary.href && !primary.onClick) {
              return (
                <Link href={primary.href} className={cls} style={style} aria-hidden={hidden || undefined} tabIndex={hidden ? -1 : undefined}>
                  {inner}
                </Link>
              )
            }
            return (
              <button
                type="button"
                className={cls}
                style={style}
                onClick={primary.onClick}
                disabled={primary.loading || primary.disabled}
                aria-hidden={hidden || undefined}
                tabIndex={hidden ? -1 : undefined}
              >
                {inner}
              </button>
            )
          })()}
        </>
      )}
    </>
  )
}
