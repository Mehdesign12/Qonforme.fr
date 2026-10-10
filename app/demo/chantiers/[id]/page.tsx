'use client'

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ChantierDetailView } from "@/components/chantiers/ChantierDetailView"
import { DEMO_ATTACHABLE, DEMO_CHANTIERS } from "@/lib/demo/chantiers"
import type { Chantier } from "@/lib/chantiers/metrics"

const wait = () => new Promise((r) => setTimeout(r, 300))

export default function DemoChantierPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [chantier, setChantier] = useState<Chantier>(() => DEMO_CHANTIERS.find((c) => c.id === id) ?? DEMO_CHANTIERS[0])
  const [attachable, setAttachable] = useState(DEMO_ATTACHABLE)

  return (
    <ChantierDetailView
      chantier={chantier}
      attachable={attachable}
      hrefs={{
        list: "/demo/chantiers",
        quote: (q) => `/demo/quotes/${q}`,
        invoice: (i) => `/demo/invoices/${i}`,
        newQuote: "/demo/quotes/new",
        newInvoice: "/demo/invoices/new",
      }}
      onStatus={async (status) => { await wait(); setChantier((c) => ({ ...c, status })); return { ok: true } }}
      onAttach={async (type, docId, attach) => {
        await wait()
        const key = type === "quote" ? "quotes" : "invoices"
        if (attach) {
          const d = attachable[key].find((x) => x.id === docId)
          if (d) {
            setChantier((c) => ({ ...c, [key]: [{ ...d, subtotal_ht: Math.round((d.total_ttc / 1.2) * 100) / 100 }, ...c[key]] }))
            setAttachable((a) => ({ ...a, [key]: a[key].filter((x) => x.id !== docId) }))
          }
        } else {
          const d = chantier[key].find((x) => x.id === docId)
          setChantier((c) => ({ ...c, [key]: c[key].filter((x) => x.id !== docId) }))
          if (d) setAttachable((a) => ({ ...a, [key]: [d, ...a[key]] }))
        }
        return { ok: true }
      }}
      onDelete={async () => { await wait(); router.push("/demo/chantiers"); return { ok: true } }}
    />
  )
}
