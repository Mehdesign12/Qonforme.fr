'use client'

export const dynamic = "force-dynamic"

import { useCallback, useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ChantierDetailView, type ActionResult, type AttachableDoc } from "@/components/chantiers/ChantierDetailView"
import type { Chantier, ChantierStatus } from "@/lib/chantiers/metrics"

const EMPTY = { quotes: [] as AttachableDoc[], invoices: [] as AttachableDoc[] }

async function call(url: string, init: RequestInit): Promise<ActionResult> {
  try {
    const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } })
    const json = await res.json().catch(() => ({}))
    return res.ok ? { ok: true } : { ok: false, message: json.error || "L’action a échoué" }
  } catch {
    return { ok: false, message: "Connexion impossible, réessayez dans un instant" }
  }
}

export default function ChantierPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [chantier, setChantier]     = useState<Chantier | null>(null)
  const [attachable, setAttachable] = useState(EMPTY)
  const [error, setError]           = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/chantiers/${id}`)
      const json = await res.json()
      if (!res.ok) { setError(json.error || "Chantier introuvable"); return }
      setChantier(json.chantier)
      setAttachable(json.attachable ?? EMPTY)
    } catch {
      setError("Connexion impossible, réessayez dans un instant")
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const after = async (r: ActionResult) => { if (r.ok) await load(); return r }

  return (
    <ChantierDetailView
      chantier={chantier}
      attachable={attachable}
      error={error}
      hrefs={{
        list: "/chantiers",
        quote: (q) => `/quotes/${q}`,
        invoice: (i) => `/invoices/${i}`,
        newQuote: "/quotes/new",
        newInvoice: "/invoices/new",
      }}
      onStatus={async (status: ChantierStatus) => after(await call(`/api/chantiers/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }))}
      onAttach={async (type, documentId, attach) => after(await call(`/api/chantiers/${id}/documents`, { method: "POST", body: JSON.stringify({ type, documentId, attach }) }))}
      onDelete={async () => {
        const r = await call(`/api/chantiers/${id}`, { method: "DELETE" })
        if (r.ok) router.push("/chantiers")
        return r
      }}
    />
  )
}
