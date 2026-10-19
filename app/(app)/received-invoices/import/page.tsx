'use client'

export const dynamic = "force-dynamic"

import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ImportView, type ManualInput, type SaveResult } from "@/components/reception/ImportView"
import type { AnalyzeResponse } from "@/lib/reception/view"

async function analyze(file: File): Promise<AnalyzeResponse & { available?: boolean }> {
  const form = new FormData()
  form.append("file", file)
  const res = await fetch("/api/received-invoices/analyze", { method: "POST", body: form })
  const json = await res.json().catch(() => null)
  if (!json) return { ok: false, error: "Le fichier n'a pas pu être lu. Réessayez." }
  return json
}

async function save(file: File, manual: ManualInput | null): Promise<SaveResult> {
  const form = new FormData()
  form.append("file", file)
  if (manual) form.append("manual", JSON.stringify(manual))
  const res = await fetch("/api/received-invoices", { method: "POST", body: form })
  const json = await res.json().catch(() => ({}))
  if (res.ok && typeof json.id === "string") return { ok: true, id: json.id }
  return { ok: false, error: json.error ?? "L'enregistrement n'a pas abouti. Réessayez.", checks: json.checks, field: json.field }
}

/** Import d'une facture reçue : lecture et contrôles par l'API, puis enregistrement. */
export default function ImportReceivedInvoicePage() {
  const router = useRouter()
  return (
    <ImportView
      backHref="/received-invoices"
      analyze={analyze}
      save={save}
      onSaved={(id) => {
        toast.success("Facture enregistrée")
        router.push(`/received-invoices/${id}`)
      }}
      duplicateHref={(id) => `/received-invoices/${id}`}
    />
  )
}
