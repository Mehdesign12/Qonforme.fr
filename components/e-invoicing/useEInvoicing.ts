"use client"

/**
 * État et actions de la facturation électronique côté application (API
 * /api/e-invoicing). Partagé par la page « Facturation électronique » et
 * Paramètres › Facturation électronique.
 */
import { useCallback, useEffect, useState } from "react"
import type { EInvoicingView } from "@/lib/pa/view"
import type { HubNotice } from "@/components/e-invoicing/EInvoicingHub"
import type { NotifyPatch } from "@/components/e-invoicing/EInvoicingSettings"

const NETWORK = "Vérifiez votre connexion, puis réessayez."

export function useEInvoicing() {
  const [view, setView] = useState<EInvoicingView | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<HubNotice | null>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [removing, setRemoving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/e-invoicing", { cache: "no-store" })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : NETWORK)
      setView(json.view as EInvoicingView)
    } catch (e) {
      setError(e instanceof Error ? e.message : NETWORK)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const refresh = useCallback(async (sync?: boolean) => {
    setBusy(true)
    try {
      const res = await fetch("/api/e-invoicing/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sync: sync === true }),
      })
      const json = await res.json().catch(() => ({}))
      if (json.view) setView(json.view as EInvoicingView)
      if (!res.ok) setNotice({ tone: "danger", text: json.error ?? "Actualisation impossible. Réessayez." })
      else if (json.message) setNotice({ tone: "info", text: json.message })
    } catch {
      setNotice({ tone: "danger", text: NETWORK })
    } finally {
      setBusy(false)
    }
  }, [])

  const remove = useCallback(async () => {
    setRemoving(true)
    try {
      const res = await fetch("/api/e-invoicing", { method: "DELETE" })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? "Retrait impossible. Réessayez.")
      if (json.view) setView(json.view as EInvoicingView)
      setNotice({ tone: "info", text: "Raccordement retiré. Vos factures déjà reçues restent dans Qonforme." })
      setConfirmRemove(false)
    } catch (e) {
      setNotice({ tone: "danger", text: e instanceof Error ? e.message : "Retrait impossible. Réessayez." })
    } finally {
      setRemoving(false)
    }
  }, [])

  const notify = useCallback(async (patch: NotifyPatch): Promise<boolean> => {
    try {
      const res = await fetch("/api/e-invoicing/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })
      const json = await res.json().catch(() => ({}))
      if (json.view) setView(json.view as EInvoicingView)
      if (!res.ok) {
        setNotice({ tone: "danger", text: json.error ?? "Enregistrement impossible. Réessayez." })
        return false
      }
      setNotice({ tone: "ok", text: "Notifications enregistrées." })
      return true
    } catch {
      setNotice({ tone: "danger", text: NETWORK })
      return false
    }
  }, [])

  return { view, loading, busy, error, notice, setNotice, load, refresh, remove, notify, confirmRemove, setConfirmRemove, removing }
}
