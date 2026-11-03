"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useUnsavedChanges } from "@/components/shared/UnsavedChangesGuard"
import { DirtyHint, SaveButton } from "./ui"

/**
 * Barre d'enregistrement mobile, collée au-dessus de la barre de navigation
 * du bas tant qu'il reste des modifications : le bouton d'en-tête est loin
 * après avoir parcouru un long formulaire. Fond opaque, sans backdrop-filter
 * (règle iOS de CLAUDE.md).
 */
export function MobileSaveBar({
  show,
  form,
  saving,
  onClick,
}: {
  show: boolean
  form?: string
  saving?: boolean
  onClick?: () => void
}) {
  // Modifications non enregistrées : fenêtre avant de quitter la page (ordinateur
  // comme téléphone) et avertissement à la fermeture de l'onglet. « Enregistrer »
  // lance l'enregistrement du formulaire, puis va à la page demandée une fois
  // les modifications enregistrées (rien ne bouge si l'enregistrement échoue).
  const router = useRouter()
  const pendingNext = useRef<string | null>(null)
  const { guard } = useUnsavedChanges({
    dirty: show && !saving,
    onSave: (next) => {
      pendingNext.current = next ?? null
      if (form) (document.getElementById(form) as HTMLFormElement | null)?.requestSubmit()
      else onClick?.()
    },
  })
  useEffect(() => {
    if (show || saving || !pendingNext.current) return
    const next = pendingNext.current
    pendingNext.current = null
    router.push(next)
  }, [show, saving, router])

  if (!show) return guard
  return (
    <>
      {guard}
      <div className="h-16 lg:hidden" aria-hidden />
      <div className="q-card fixed inset-x-3 bottom-[calc(96px+env(safe-area-inset-bottom))] z-30 flex items-center gap-3 rounded-2xl p-2 pl-4 shadow-[shadow:var(--q-shadow-pop)] lg:hidden">
        <DirtyHint className="flex-1" />
        <SaveButton form={form} saving={saving} onClick={onClick} size="lg" />
      </div>
    </>
  )
}
