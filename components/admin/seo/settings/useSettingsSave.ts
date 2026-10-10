"use client"

/**
 * Enregistrement d'une section de réglages de l'onglet SEO
 * (PUT /api/admin/seo/settings/<section> { value }) et garde contre la perte
 * de modifications non enregistrées (fermeture de l'onglet, lien interne).
 */
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

export type SettingsSection = "brand" | "strategy" | "targeting" | "reports"

const LEAVE_MESSAGE = "Des modifications ne sont pas enregistrées. Quitter cette page sans les enregistrer ?"

/**
 * Tant que `dirty` est vrai : alerte du navigateur avant de fermer ou de
 * recharger (beforeunload) et confirmation avant de suivre un lien interne
 * (la navigation de Next.js ne déclenche pas beforeunload).
 */
export function useUnsavedGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      // Requis par Chrome et Safari pour afficher l'alerte
      event.returnValue = ""
    }
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const target = event.target as Element | null
      const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null
      if (!anchor || (anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) return
      let url: URL
      try {
        url = new URL(anchor.href, window.location.href)
      } catch {
        return
      }
      // Lien externe : l'alerte beforeunload s'en charge ; ancre de la même page : rien à perdre
      if (url.origin !== window.location.origin) return
      if (url.pathname === window.location.pathname && url.search === window.location.search) return
      if (!window.confirm(LEAVE_MESSAGE)) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    document.addEventListener("click", onClick, true)
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload)
      document.removeEventListener("click", onClick, true)
    }
  }, [dirty])
}

/**
 * État d'une section enregistrée : valeur de référence (dernière valeur
 * enregistrée), date d'enregistrement, erreurs par champ du serveur, carte
 * en cours d'enregistrement.
 *
 * Un seul enregistrement à la fois par écran : chaque carte envoie la section
 * entière bâtie sur la valeur de référence ; deux envois simultanés de deux
 * cartes s'écraseraient. `busy` désactive tous les « Enregistrer » de l'écran
 * et `save` refuse un second envoi tant que le premier n'est pas revenu.
 */
export function useSettingsSave<V>(section: SettingsSection, initial: V, initialUpdatedAt: string | null) {
  const router = useRouter()
  const [baseline, setBaseline] = useState<V>(initial)
  const [updatedAt, setUpdatedAt] = useState<string | null>(initialUpdatedAt)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [savingCard, setSavingCard] = useState<string | null>(null)
  const inFlight = useRef(false)

  /** Enregistre `value` ; rend la valeur normalisée par le serveur, ou null en cas d'échec (ou si un envoi est en cours). */
  async function save(card: string, value: V, successMessage = "Réglages enregistrés."): Promise<V | null> {
    if (inFlight.current) return null
    inFlight.current = true
    setSavingCard(card)
    try {
      const res = await fetch(`/api/admin/seo/settings/${section}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      })
      const json = (await res.json().catch(() => ({}))) as {
        value?: V
        updatedAt?: string
        error?: string
        fieldErrors?: Record<string, string>
      }
      if (!res.ok || !json.value) {
        if (res.status === 400 && json.fieldErrors) setErrors(json.fieldErrors)
        toast.error(json.error ?? "Enregistrement impossible. Réessayez dans un instant.")
        return null
      }
      setBaseline(json.value)
      setUpdatedAt(json.updatedAt ?? new Date().toISOString())
      setErrors({})
      toast.success(successMessage)
      router.refresh()
      return json.value
    } catch {
      toast.error("Connexion impossible. Vérifiez le réseau, puis réessayez.")
      return null
    } finally {
      inFlight.current = false
      setSavingCard(null)
    }
  }

  return { baseline, updatedAt, errors, setErrors, savingCard, busy: savingCard !== null, save }
}
