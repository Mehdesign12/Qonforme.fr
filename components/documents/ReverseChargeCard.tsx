"use client"

/**
 * Carte « Sous-traitance du BTP » de l'éditeur (facture, devis) : la case
 * autoliquidation (formule Artisan), ses conditions et un contrôle du client.
 * CGI, art. 283, 2 nonies ; BOFiP, BOI-TVA-DECLA-10-10-20, §§ 531 à 538.
 */
import { AlertTriangle } from "lucide-react"
import { Switch } from "@/components/app/kit"
import { ArtisanTag } from "@/components/artisan/ui"
import { REVERSE_CHARGE_CONDITIONS, reverseChargeClientIssue } from "@/lib/artisan/reverse-charge"
import type { DocClient } from "./model"
import type { DocumentFormApi } from "./useDocumentForm"

export function ReverseChargeCard({
  doc, client, locked, onLocked,
}: {
  doc: DocumentFormApi
  client: (DocClient & { vat_number?: string | null }) | null
  /** Sans la formule Artisan : la case ouvre le mur de paiement. */
  locked: boolean
  onLocked: () => void
}) {
  const on = Boolean(doc.form.autoliquidation)
  const issue = on ? reverseChargeClientIssue(client) : null
  return (
    <section className="flex flex-col gap-2.5 md:q-card md:gap-3 md:p-5" aria-labelledby="doc-rc-title">
      <div className="q-card flex flex-col gap-3 p-4 md:contents">
        <div className="flex items-start justify-between gap-4">
          <span className="flex min-w-0 flex-col gap-1">
            <span className="flex flex-wrap items-center gap-2">
              <h2 id="doc-rc-title" className="q-h2">Sous-traitance, autoliquidation</h2>
              <ArtisanTag />
            </span>
            <span className="text-[13px] text-[var(--q-text-3)]">
              Facture sans TVA, mention « Autoliquidation » : la TVA est due par votre client.
            </span>
          </span>
          <Switch
            checked={on}
            label="Sous-traitance du BTP, autoliquidation"
            onCheckedChange={(checked) => { if (locked) onLocked(); else doc.setAutoliquidation(checked) }}
          />
        </div>
        {on && (
          <ul className="flex list-disc flex-col gap-1 pl-5 text-[13px] text-[var(--q-text-3)]">
            {REVERSE_CHARGE_CONDITIONS.map((c) => <li key={c}>{c}</li>)}
          </ul>
        )}
        {issue && (
          <p className="flex items-start gap-1.5 text-[13px] text-[var(--q-warn)]">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {issue}
          </p>
        )}
      </div>
    </section>
  )
}
