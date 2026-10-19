"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { attachSheetDrag, pressEscape } from "@/lib/ui/sheet-drag"

/** Feuille la plus proche : popup d'une `Sheet` ou d'une `Dialog`, ou fenêtre posée à la main. */
const PANEL = '[data-slot="sheet-content"], [data-slot="dialog-content"], [role="dialog"]'

/**
 * Barre grise en haut d'une feuille du bas. Elle sert vraiment : tirer la
 * feuille vers le bas (par la barre ou le haut de la feuille) la ferme, comme
 * dans une app (lib/ui/sheet-drag.ts). `onDismiss` : la fermeture de l'écran ;
 * sans lui, la touche Échap, que la fenêtre traite déjà.
 */
export function SheetGrip({ className, onDismiss }: { className?: string; onDismiss?: () => void }) {
  const ref = React.useRef<HTMLDivElement>(null)
  const dismiss = React.useRef(onDismiss)
  dismiss.current = onDismiss

  React.useEffect(() => {
    const panel = ref.current?.closest<HTMLElement>(PANEL)
    if (!panel) return
    return attachSheetDrag(panel, () => (dismiss.current ? dismiss.current() : pressEscape()))
  }, [])

  return <div ref={ref} data-sheet-grip className={cn("q-sheet-grip", className)} aria-hidden />
}
