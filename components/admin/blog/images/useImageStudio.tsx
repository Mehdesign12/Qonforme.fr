"use client"

/**
 * Studio d'images pour les images du texte, sous forme de promesse : l'éditeur
 * visuel (bouton « Image » de la barre d'outils) appelle `requestImage()` et
 * insère l'image rendue, ou rien si la fenêtre est fermée sans choix.
 *
 *   const studio = useImageStudio({ title, keyword })
 *   …
 *   <RichEditor onRequestImage={studio.requestImage} />
 *   {studio.dialog}
 *
 * Le passage que l'on illustre (texte sélectionné ou paragraphe du curseur)
 * part avec la demande : la fenêtre en déduit ce que montre l'image et le
 * style, sans que l'on ait rien à écrire.
 *
 * Une seule demande à la fois : une nouvelle demande règle la précédente à
 * null. Le démontage de la page règle aussi la demande en cours (aucune
 * promesse laissée en suspens).
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { ImageStudioDialog } from "@/components/admin/blog/images/ImageStudioDialog"
import type { PickedImage } from "@/lib/seo/articles/editor-types"
import type { PassageContext } from "@/lib/blog-images/passage"

export function useImageStudio(ctx: { title: string; keyword: string | null }): {
  dialog: React.ReactNode
  /** Ouvre le studio (images du texte) ; résout l'image choisie, ou null si fermé. */
  requestImage: (passage?: PassageContext | null) => Promise<PickedImage | null>
} {
  const [open, setOpen] = useState(false)
  const [passage, setPassage] = useState<PassageContext | null>(null)
  const pending = useRef<((image: PickedImage | null) => void) | null>(null)

  const settle = useCallback((image: PickedImage | null) => {
    const resolve = pending.current
    pending.current = null
    resolve?.(image)
  }, [])

  const requestImage = useCallback(
    (next?: PassageContext | null) =>
      new Promise<PickedImage | null>((resolve) => {
        settle(null)
        pending.current = resolve
        setPassage(next ?? null)
        setOpen(true)
      }),
    [settle],
  )

  useEffect(() => () => settle(null), [settle])

  const dialog = (
    <ImageStudioDialog
      open={open}
      purpose="inline"
      title={ctx.title}
      keyword={ctx.keyword}
      passage={passage}
      // onPick précède onClose : l'image est rendue, puis la fermeture ne règle plus rien
      onPick={(image) => settle(image)}
      onClose={() => {
        setOpen(false)
        settle(null)
      }}
    />
  )

  return { dialog, requestImage }
}
