'use client'

export const dynamic = "force-dynamic"

import Link from "next/link"
import { toast } from "sonner"
import { HardHat } from "lucide-react"
import { EmptyState } from "@/components/app/kit"
import { ChantierDetailView } from "@/components/artisan/ChantierDetailView"
import { DEMO_TODAY } from "@/lib/demo/data"
import { demoChantier, demoChantierDocs, demoChantierSummary } from "@/lib/demo/chantiers"
import type { ChantierDoc } from "@/lib/artisan/chantier"

const ctaToast = (what: string) => toast(`Créez un compte pour ${what}`, {
  action: { label: "S'inscrire", onClick: () => { window.location.href = "/signup" } },
})

const DOC_PATHS: Record<ChantierDoc["type"], string> = {
  quote: "/demo/quotes", invoice: "/demo/invoices", credit_note: "/demo/credit-notes", purchase_order: "/demo/purchase-orders",
}

/** Miroir de /chantiers/[id] : même fiche, chantier fictif, rien n'est enregistré. */
export default function DemoChantierPage({ params }: { params: { id: string } }) {
  const c = demoChantier(params.id)
  if (!c) return (
    <div className="q-card">
      <EmptyState
        icon={<HardHat className="size-5" aria-hidden />}
        title="Chantier introuvable"
        text="Ce chantier n'existe pas dans la démo."
        action={<Link href="/demo/chantiers" className="q-btn q-btn-secondary">Retour aux chantiers</Link>}
      />
    </div>
  )

  return (
    <ChantierDetailView
      chantier={c}
      documents={demoChantierDocs(c.id)}
      summary={demoChantierSummary(c.id)}
      today={DEMO_TODAY}
      artisan
      backHref="/demo/chantiers"
      docHref={(d) => `${DOC_PATHS[d.type]}/${d.id}`}
      clientHref={c.client_id ? `/demo/clients/${c.client_id}` : null}
      newQuoteHref="/demo/quotes/new"
      actions={{
        onEdit: () => ctaToast("modifier vos chantiers"),
        onAttach: () => ctaToast("rattacher vos documents à un chantier"),
        onDetach: () => ctaToast("organiser vos chantiers"),
        onFreeDeposit: () => ctaToast("facturer des acomptes"),
        onSaveReception: () => ctaToast("suivre la réception de vos chantiers"),
        onMarkReleased: () => ctaToast("suivre vos retenues de garantie"),
        onRetentionRequest: () => ctaToast("demander la libération de vos retenues de garantie"),
        onDelete: () => ctaToast("gérer vos chantiers"),
      }}
    />
  )
}
