"use client"

/**
 * Panneau latéral droit de l'onglet SEO (détail d'un constat, d'un mot-clé,
 * « Gérer le suivi ») : 520 px sur ordinateur (560 avec `wide`), pleine largeur
 * sur téléphone. Ouvert par l'adresse (`?constat=…`) : fermer revient à
 * `closeHref` sans recharger la page.
 *
 * Voile sans flou sur téléphone (règle backdrop-filter de CLAUDE.md : le flou
 * de SheetOverlay est réservé à md et plus).
 */
import { useRouter } from "next/navigation"
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

export function SidePanel({
  title,
  description,
  closeHref,
  onClose,
  wide,
  footer,
  children,
  titleClassName,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  /** Adresse de la page sans le panneau (fermeture par la navigation). */
  closeHref?: string
  /** Fermeture gérée par l'appelant (panneau ouvert par un état local). */
  onClose?: () => void
  /** 560 px au lieu de 520. */
  wide?: boolean
  /** Pied collant (boutons « Annuler » / action primaire). */
  footer?: React.ReactNode
  children: React.ReactNode
  titleClassName?: string
}) {
  const router = useRouter()
  const close = () => {
    if (onClose) onClose()
    else if (closeHref) router.push(closeHref, { scroll: false })
  }

  return (
    <Sheet open onOpenChange={(open) => !open && close()}>
      <SheetContent
        side="right"
        className={cn(
          "!w-full gap-0 overflow-hidden p-0 sm:!max-w-none",
          wide ? "md:!w-[560px]" : "md:!w-[520px]",
        )}
      >
        <div className="flex shrink-0 flex-col gap-1 border-b border-[var(--q-line-soft)] px-5 pb-4 pr-14 pt-5">
          <SheetTitle className={cn("q-h2 !text-lg", titleClassName)}>{title}</SheetTitle>
          {description && <SheetDescription className="text-sm text-[var(--q-text-4)]">{description}</SheetDescription>}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">{children}</div>
        {footer && (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-[var(--q-line-soft)] px-5 py-4 pb-[max(16px,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

/** Titre de section dans un panneau (« Pourquoi », « Action recommandée »…). */
export function PanelSection({ title, children, className }: { title: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("flex flex-col gap-2 border-t border-[var(--q-line-soft)] pt-5 first:border-t-0 first:pt-0", className)}>
      <h3 className="text-[13px] font-semibold uppercase tracking-wide text-[var(--q-text-4)]">{title}</h3>
      {children}
    </section>
  )
}
