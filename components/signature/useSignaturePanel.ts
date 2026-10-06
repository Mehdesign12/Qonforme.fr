"use client"

/**
 * Données et actions du panneau « Signature en ligne » pour une fiche réelle
 * (la démo passe des données fixes au même panneau).
 *
 * - Tant que la migration n'est pas appliquée, `data.available` vaut false :
 *   la fiche garde son accord sur papier.
 * - 402 SUBSCRIPTION_REQUIRED → ouverture du mur de paiement (PaywallDialog).
 * - Lien actif : nouvelle lecture toutes les 30 s quand l'onglet est visible,
 *   pour voir arriver une signature ou un refus sans recharger la page.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { toastCompanyRequired } from "@/components/shared/company-required"
import { isSubscriptionRequired } from "@/components/billing/PaywallDialog"
import type { SignatureDocType, SignaturePanelData } from "@/lib/signature/types"

const UNAVAILABLE: SignaturePanelData = { available: false, access: false, enabled: false, client_kind: "consumer", client_email: null, link: null }

export function useSignaturePanel(type: SignatureDocType, id: string, onDocChanged?: (reason: "sent" | "signed" | "refused") => void) {
  const [data, setData] = useState<SignaturePanelData | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [paywall, setPaywall] = useState(false)
  const changed = useRef(onDocChanged)
  changed.current = onDocChanged
  const lastState = useRef<string | null>(null)

  const apply = useCallback((next: SignaturePanelData) => {
    const prev = lastState.current
    const now = next.link?.state ?? null
    lastState.current = now
    if (prev && prev !== now && (now === "signed" || now === "refused")) changed.current?.(now)
    setData(next)
  }, [])

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/signature/${type}/${id}`, { cache: "no-store" })
      if (!res.ok) { setData((d) => d ?? UNAVAILABLE); return }
      apply(await res.json())
    } catch {
      setData((d) => d ?? UNAVAILABLE)
    }
  }, [apply, id, type])

  useEffect(() => { void load() }, [load])

  // Suivi en direct tant que le lien attend une réponse
  const active = data?.link && ["ready", "sent", "viewed"].includes(data.link.state)
  useEffect(() => {
    if (!active) return
    const t = window.setInterval(() => { if (document.visibilityState === "visible") void load() }, 30_000)
    return () => window.clearInterval(t)
  }, [active, load])

  const post = useCallback(async (action: "link" | "send" | "renew" | "disable"): Promise<(SignaturePanelData & { url?: string; sentTo?: string }) | null> => {
    setBusy(action)
    try {
      const res = await fetch(`/api/signature/${type}/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      const json = await res.json().catch(() => ({}))
      if (isSubscriptionRequired(res.status, json)) { setPaywall(true); return null }
      if (toastCompanyRequired(res.status, json)) return null
      if (!res.ok) { toast.error(json.error ?? "L'action n'a pas abouti. Réessayez."); return null }
      apply(json)
      return json
    } catch {
      toast.error("Erreur réseau")
      return null
    } finally {
      setBusy(null)
    }
  }, [apply, id, type])

  const actions = {
    link: async () => {
      const r = await post("link")
      if (r) changed.current?.("sent")
      return r?.url ?? null
    },
    send: async () => {
      const r = await post("send")
      if (!r) return false
      toast.success(`Envoyé pour signature à ${r.sentTo ?? "votre client"}`)
      changed.current?.("sent")
      return true
    },
    renew: async () => {
      const r = await post("renew")
      if (r) toast.success("Nouveau lien créé : l'ancien ne fonctionne plus")
      return r?.url ?? null
    },
    disable: async () => {
      const r = await post("disable")
      if (r) toast.success("Lien désactivé")
      return !!r
    },
    downloadSigned: async () => {
      setBusy("pdf")
      try {
        const res = await fetch(`/api/signature/${type}/${id}/pdf`)
        if (!res.ok) { toast.error("Le PDF signé n'a pas pu être généré"); return }
        const blob = await res.blob()
        const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? "document-signe.pdf"
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = name
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
      } catch { toast.error("Erreur lors du téléchargement") }
      finally { setBusy(null) }
    },
    upgrade: () => setPaywall(true),
    onSite: (url: string) => { window.location.href = `${url}${url.includes("?") ? "&" : "?"}sur-place=1` },
  }

  return { data, busy, actions, paywall, setPaywall, reload: load }
}
