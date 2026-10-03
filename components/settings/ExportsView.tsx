/**
 * Exports comptables (planches « Exports » et « Exports — vide ») : carte
 * « Nouvel export » à gauche, contenu du fichier à droite.
 *
 * Version honnête : seul le FEC se télécharge ici. Pas de grand livre,
 * d'historique des exports ni d'envoi automatique (non livrés, DECISIONS § 10).
 * Le comptable invité (Paramètres › Accès comptable) télécharge lui-même le
 * FEC, les ventes en CSV et les PDF de la période.
 * Partagé par l'application et la démo.
 */
import Link from "next/link"
import { Check, ChevronRight, Download, Plus } from "lucide-react"
import { EmptyState, PageHeader } from "@/components/app/kit"
import type { ShellMode } from "@/components/layout/nav"
import { settingsHref } from "@/components/settings/sections"
import { SettingsCard } from "@/components/settings/ui"
import FecExportSection from "@/components/settings/FecExportSection"

const CONTENT = [
  "Toutes les factures émises, hors brouillons et annulées",
  "Tous les avoirs de la période",
  "TVA collectée ventilée par taux",
  "Comptes du plan comptable : 411 clients, 706 ventes, 4457 TVA",
  "18 colonnes au format de l'administration fiscale, UTF-8",
]

export function ExportsView({
  mode,
  siren,
  sirenMissing,
  hasIssued,
}: {
  mode: ShellMode
  siren: string
  sirenMissing: boolean
  /** false : aucune facture émise, rien à exporter (planche « Exports — vide »). null : inconnu. */
  hasIssued: boolean | null
}) {
  const newInvoiceHref = mode === "demo" ? "/demo/invoices/new" : "/invoices/new"

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Exports comptables" subtitle="Le fichier des écritures de vos ventes, pour votre expert-comptable" />

      {hasIssued === false ? (
        <>
          <div className="q-card">
            <EmptyState
              icon={<Download className="size-6" strokeWidth={1.75} aria-hidden />}
              title="Rien à exporter pour l'instant"
              text="Dès votre première facture émise, vous pourrez télécharger le FEC de la période de votre choix et le transmettre à votre comptable."
              action={
                <Link href={newInvoiceHref} className="q-btn q-btn-primary">
                  <Plus aria-hidden />
                  Nouvelle facture
                </Link>
              }
            />
          </div>
          <ContentCard />
        </>
      ) : (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]">
          <FecExportSection mode={mode} siren={siren} sirenMissing={sirenMissing} />
          <div className="flex flex-col gap-4">
            <ContentCard />
            <SettingsCard id="comptable" title="Pour votre comptable">
              <p className="text-[13px] leading-relaxed text-[var(--q-text-3)]">
                Transmettez-lui le fichier téléchargé. Son nom suit la règle officielle : SIREN, « FEC », puis la date
                de clôture{siren ? <> (ex.&nbsp;: <span className="font-mono">{siren}FEC20261231.txt</span>)</> : null}.
              </p>
              <Link href={settingsHref("/settings/comptable", mode)} className="q-link inline-flex items-center gap-1 text-[13px]">
                Ou donnez-lui un accès en lecture seule
                <ChevronRight className="size-3.5" aria-hidden />
              </Link>
            </SettingsCard>
          </div>
        </div>
      )}
    </div>
  )
}

function ContentCard() {
  return (
    <SettingsCard id="contenu-fichier" title="Contenu du fichier">
      <ul className="flex flex-col gap-2.5">
        {CONTENT.map((item) => (
          <li key={item} className="flex items-start gap-2.5 text-sm text-[var(--q-text-2)]">
            <Check className="mt-0.5 size-4 shrink-0 text-[var(--q-ok)]" strokeWidth={2.5} aria-hidden />
            {item}
          </li>
        ))}
      </ul>
    </SettingsCard>
  )
}
