"use client"

/**
 * Fiche d'une facture reçue, application réelle : chargement, décisions et
 * retrait par l'API (/api/received-invoices/[id]). L'affichage est celui de
 * la démo (ReceivedInvoiceDetailView).
 */
import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Inbox, RefreshCw } from "lucide-react"
import { EmptyState } from "@/components/app/kit"
import { todayISO } from "@/components/invoices/invoice-view"
import { STATUS_DEFS, type ReceivedStatus } from "@/lib/reception/lifecycle"
import type { ReceivedDetail } from "@/lib/reception/view"
import { ReceivedInvoiceDetailView } from "@/components/reception/ReceivedInvoiceDetailView"

export function ReceivedInvoiceDetail({ invoiceId }: { invoiceId: string }) {
  const router = useRouter()
  const [invoice, setInvoice] = useState<ReceivedDetail | null>(null)
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading")
  const [statusLoading, setStatusLoading] = useState(false)
  const [removeLoading, setRemoveLoading] = useState(false)
  const [today, setToday] = useState<string | null>(null)

  const base = `/api/received-invoices/${encodeURIComponent(invoiceId)}`

  const load = useCallback(async () => {
    setState("loading")
    try {
      const res = await fetch(base)
      const json = await res.json().catch(() => ({}))
      if (res.status === 404) { setState("missing"); return }
      if (!res.ok || !json.invoice) throw new Error(json.error)
      setInvoice(json.invoice)
      setState("ready")
    } catch {
      setState("error")
    }
  }, [base])

  useEffect(() => {
    setToday(todayISO())
    void load()
  }, [load])

  const changeStatus = async (to: ReceivedStatus, reasonCode?: string | null, reason?: string | null) => {
    setStatusLoading(true)
    try {
      const res = await fetch(base, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: to, reason_code: reasonCode ?? null, reason: reason ?? null }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(json.error ?? "Le statut n'a pas pu être enregistré.")
        if (res.status === 409) void load()
        return false
      }
      if (json.invoice) setInvoice(json.invoice)
      toast.success(`Statut enregistré : ${STATUS_DEFS[to].label}`)
      return true
    } catch {
      toast.error("Vérifiez votre connexion, puis réessayez.")
      return false
    } finally {
      setStatusLoading(false)
    }
  }

  const remove = async () => {
    if (!window.confirm("Retirer cette facture importée par erreur ? Le fichier sera supprimé.")) return
    setRemoveLoading(true)
    try {
      const res = await fetch(base, { method: "DELETE" })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(json.error ?? "La facture n'a pas pu être retirée."); return }
      toast.success("Facture retirée")
      router.push("/received-invoices")
    } finally {
      setRemoveLoading(false)
    }
  }

  if (state === "missing") {
    return (
      <section className="q-card">
        <EmptyState
          icon={<Inbox className="size-5" aria-hidden />}
          title="Facture introuvable"
          text="Elle a peut-être été retirée."
          action={<Link href="/received-invoices" className="q-btn q-btn-secondary">Retour aux factures reçues</Link>}
        />
      </section>
    )
  }
  if (state === "error") {
    return (
      <section className="q-card">
        <EmptyState
          icon={<Inbox className="size-5" aria-hidden />}
          title="Impossible de charger la facture"
          text="Vérifiez votre connexion, puis réessayez."
          action={<button type="button" className="q-btn q-btn-secondary" onClick={() => void load()}><RefreshCw aria-hidden />Réessayer</button>}
        />
      </section>
    )
  }
  if (state === "loading" || !invoice || !today) {
    return (
      <section className="q-card flex flex-col gap-3 p-6" aria-busy="true" aria-label="Chargement de la facture">
        <span className="h-4 w-48 rounded bg-[var(--q-sunken)]" />
        <span className="h-8 w-72 max-w-full rounded bg-[var(--q-sunken)]" />
        <span className="h-3 w-56 max-w-full rounded bg-[var(--q-line-soft)]" />
        <span className="sr-only">Chargement…</span>
      </section>
    )
  }

  const canRemove = invoice.source === "import" && invoice.status === "received"
  return (
    <ReceivedInvoiceDetailView
      invoice={invoice}
      today={today}
      backHref="/received-invoices"
      pdfUrl={invoice.has_pdf ? `${base}/file?inline=1` : null}
      hrefFor={(id) => `/received-invoices/${id}`}
      handlers={{
        changeStatus,
        statusLoading,
        download: () => { window.location.href = `${base}/file` },
        remove: canRemove ? remove : undefined,
        removeLoading,
      }}
    />
  )
}
