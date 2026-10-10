'use client'

export const dynamic = "force-dynamic"

import { toast } from "sonner"
import { ChantierListView } from "@/components/artisan/ChantierListView"
import { DEMO_CHANTIERS, demoChantierSummary } from "@/lib/demo/chantiers"

const ctaToast = (what: string) => toast(`Créez un compte pour ${what}`, {
  action: { label: "S'inscrire", onClick: () => { window.location.href = "/signup" } },
})

const CHANTIERS = DEMO_CHANTIERS.map((c) => ({ ...c, summary: demoChantierSummary(c.id) }))

/** Miroir de /chantiers : même liste, chantiers fictifs (formule Artisan). */
export default function DemoChantiersPage() {
  return (
    <ChantierListView
      chantiers={CHANTIERS}
      artisan
      hrefFor={(id) => `/demo/chantiers/${id}`}
      onCreate={() => ctaToast("suivre vos chantiers")}
    />
  )
}
