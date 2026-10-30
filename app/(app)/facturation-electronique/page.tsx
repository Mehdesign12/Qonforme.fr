'use client'

export const dynamic = "force-dynamic"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { EInvoicingHub } from "@/components/e-invoicing/EInvoicingHub"
import { RemoveDialog } from "@/components/e-invoicing/RemoveDialog"
import { noticeFromQuery } from "@/components/e-invoicing/notices"
import { useEInvoicing } from "@/components/e-invoicing/useEInvoicing"

const HREFS = {
  connect: "/api/pa/superpdp/connect",
  pricing: "/pricing",
  received: "/received-invoices",
  importHref: "/received-invoices/import",
  settings: "/settings/ppf",
}

const TODAY = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "long", year: "numeric" })

/** Facturation électronique : réception par Super PDP (lib/pa). */
function EInvoicingPage() {
  const params = useSearchParams()
  const router = useRouter()
  const e = useEInvoicing()
  const { setNotice } = e
  const [todayLabel, setTodayLabel] = useState<string | null>(null)
  const [initialStep] = useState(params.get("etape") === "avant" ? ("avant" as const) : null)

  useEffect(() => {
    setTodayLabel(TODAY.format(new Date()))
    const n = noticeFromQuery(params)
    if (n) {
      setNotice(n)
      router.replace("/facturation-electronique", { scroll: false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <EInvoicingHub
        view={e.view}
        loading={e.loading}
        error={e.error}
        hrefs={HREFS}
        notice={e.notice}
        busy={e.busy}
        todayLabel={todayLabel}
        initialStep={initialStep}
        onRetry={e.load}
        onRefresh={e.refresh}
        onRemove={() => e.setConfirmRemove(true)}
      />
      <RemoveDialog open={e.confirmRemove} loading={e.removing} onClose={() => e.setConfirmRemove(false)} onConfirm={e.remove} />
    </>
  )
}

export default function Page() {
  return (
    <Suspense>
      <EInvoicingPage />
    </Suspense>
  )
}
