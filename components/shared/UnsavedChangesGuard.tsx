'use client'

/**
 * Garde « modifications non enregistrées » des formulaires (devis, factures,
 * bons de commande, clients, paramètres…).
 *
 * Tant que `dirty` est vrai :
 * - un clic sur un lien interne (barre latérale, barre du bas, « < Devis »,
 *   liens du formulaire) est retenu et ouvre la fenêtre « … n'est pas
 *   enregistré » : Enregistrer, Quitter sans enregistrer, Rester ;
 * - fermer ou recharger l'onglet déclenche l'avertissement du navigateur
 *   (texte imposé par le navigateur).
 * Les navigations faites par le code (après un enregistrement réussi) ne sont
 * jamais retenues. Le bouton « Retour » du navigateur n'est couvert que par
 * l'avertissement de fermeture quand il quitte le site.
 *
 * Fenêtre centrée au-dessus de 768 px, feuille du bas en dessous ; ni flou
 * sur mobile ni `will-change` (CLAUDE.md).
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { SheetGrip } from "@/components/ui/sheet-grip"
import { NAVIGATION_HELD_EVENT, leavingTarget } from "@/lib/ui/unsaved-guard"

export interface UnsavedChangesOptions {
  /** Vrai quand le formulaire a des modifications non enregistrées. */
  dirty: boolean
  /** Titre de la fenêtre, ex. « Ce devis n'est pas enregistré ». */
  title?: string
  /** Libellé du bouton d'enregistrement, ex. « Enregistrer le brouillon ». */
  saveLabel?: string
  /**
   * Enregistre puis emmène vers `next` (l'adresse que la personne voulait
   * ouvrir). Absent : la fenêtre ne propose que « Quitter » et « Rester ».
   * En cas d'erreur (formulaire incomplet), le formulaire reste affiché avec
   * ses erreurs.
   */
  onSave?: (next: string) => void | Promise<unknown>
}

const DESCRIPTION = "Si vous quittez cette page maintenant, ce que vous avez saisi sera perdu."

function useDesktop(): boolean {
  const [desktop, setDesktop] = useState(true)
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)")
    const update = () => setDesktop(mq.matches)
    update()
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [])
  return desktop
}

/**
 * Rend la fenêtre à placer dans le formulaire. `allowLeave()` coupe la garde
 * (à appeler juste avant une navigation voulue, si besoin).
 */
export function useUnsavedChanges({ dirty, title = "Vos modifications ne sont pas enregistrées", saveLabel = "Enregistrer", onSave }: UnsavedChangesOptions) {
  const router = useRouter()
  const [target, setTarget] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const dirtyRef = useRef(dirty)
  dirtyRef.current = dirty
  const bypass = useRef(false)

  // Liens internes : retenus avant que Next.js ne change de page
  useEffect(() => {
    if (!dirty) return
    const onClick = (event: MouseEvent) => {
      if (!dirtyRef.current || bypass.current || event.defaultPrevented) return
      const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null
      if (!anchor || anchor.closest("[data-unsaved-guard]")) return
      const next = leavingTarget(
        {
          href: anchor.getAttribute("href") ?? "",
          target: anchor.getAttribute("target"),
          download: anchor.hasAttribute("download"),
          modified: event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey,
        },
        window.location,
      )
      if (!next) return
      event.preventDefault()
      event.stopPropagation()
      window.dispatchEvent(new Event(NAVIGATION_HELD_EVENT))
      setTarget(next)
    }
    document.addEventListener("click", onClick, true)
    return () => document.removeEventListener("click", onClick, true)
  }, [dirty])

  // Fermeture ou rechargement de l'onglet : avertissement du navigateur
  useEffect(() => {
    if (!dirty) return
    const onUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current || bypass.current) return
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", onUnload)
    return () => window.removeEventListener("beforeunload", onUnload)
  }, [dirty])

  const allowLeave = useCallback(() => { bypass.current = true }, [])

  const leave = () => {
    if (!target) return
    bypass.current = true
    const next = target
    setTarget(null)
    router.push(next)
  }

  const save = async () => {
    if (!target || !onSave) return
    const next = target
    setSaving(true)
    try {
      await onSave(next)
    } finally {
      setSaving(false)
      setTarget(null)
    }
  }

  const desktop = useDesktop()
  const open = target !== null
  const close = (o: boolean) => { if (!o && !saving) setTarget(null) }

  const buttons = (
    <div className="mt-2 flex min-w-0 flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end [&>.q-btn]:max-md:h-12">
      <button type="button" onClick={() => setTarget(null)} disabled={saving} className="q-btn q-btn-ghost">
        Rester sur la page
      </button>
      <button type="button" onClick={leave} disabled={saving} className="q-btn q-btn-secondary !text-[var(--q-danger)]">
        Quitter sans enregistrer
      </button>
      {onSave && (
        <button type="button" onClick={save} disabled={saving} className="q-btn q-btn-primary">
          {saving && <Loader2 className="animate-spin" aria-hidden />}
          {saveLabel}
        </button>
      )}
    </div>
  )

  const guard = desktop ? (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent data-unsaved-guard showCloseButton={false} className="w-full gap-3 sm:max-w-[600px]">
        <DialogTitle className="q-display text-[22px] font-semibold leading-tight">{title}</DialogTitle>
        <DialogDescription className="text-sm leading-relaxed !text-[var(--q-text-3)]">{DESCRIPTION}</DialogDescription>
        {buttons}
      </DialogContent>
    </Dialog>
  ) : (
    <Sheet open={open} onOpenChange={close}>
      <SheetContent side="bottom" showCloseButton={false} data-unsaved-guard className="gap-3 px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-2">
        <SheetGrip />
        <SheetTitle className="q-display pt-3 text-[22px] font-semibold leading-tight">{title}</SheetTitle>
        <SheetDescription className="text-[15px] leading-relaxed !text-[var(--q-text-3)]">{DESCRIPTION}</SheetDescription>
        {buttons}
      </SheetContent>
    </Sheet>
  )

  return { guard, allowLeave, pendingTarget: target }
}

/**
 * Même garde sous forme de composant, pour un écran qui calcule `dirty` après
 * ses retours anticipés (chargement, erreur) et ne peut donc pas appeler le hook.
 */
export function UnsavedChangesPrompt(props: UnsavedChangesOptions) {
  return useUnsavedChanges(props).guard
}
