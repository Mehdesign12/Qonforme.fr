/**
 * Espace comptable — liste des dossiers : les entreprises qui ont donné accès
 * au comptable connecté. Partagée par /comptable et sa démo.
 */
import Link from "next/link"
import { Building2, ChevronRight, Inbox } from "lucide-react"
import { EmptyState, PageHeader, initialsOf } from "@/components/app/kit"
import { formatSiren } from "@/components/invoices/invoice-view"
import { dateTime, dayOf } from "@/components/accountant/format"
import type { DossierSummary } from "@/lib/accountant/types"

export function DossierList({
  dossiers,
  hrefFor,
  error,
}: {
  dossiers: DossierSummary[]
  hrefFor: (accessId: string) => string
  /** Lecture impossible (réseau) : message à la place de la liste. */
  error?: string | null
}) {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        eyebrow="Espace comptable"
        title="Vos dossiers"
        subtitle="Les entreprises qui vous ont donné accès à leur facturation, en lecture seule"
      />

      {error ? (
        <section className="q-card">
          <EmptyState icon={<Building2 className="size-5" aria-hidden />} title="Impossible de charger vos dossiers" text={error} />
        </section>
      ) : dossiers.length === 0 ? (
        <section className="q-card">
          <EmptyState
            className="py-14"
            icon={<Inbox className="size-5" aria-hidden />}
            title="Aucun dossier pour l'instant"
            text="Quand une entreprise vous invite depuis Qonforme, vous recevez un email avec un lien. Une fois l'invitation acceptée, son dossier apparaît ici."
          />
        </section>
      ) : (
        <section aria-label="Dossiers" className="q-card q-list overflow-hidden !rounded-[18px]">
          {dossiers.map((d) => (
            <Link key={d.accessId} href={hrefFor(d.accessId)} className="q-list-row !px-4 !py-3.5">
              <span className="q-avatar q-avatar-ink !size-11 shrink-0 !rounded-[13px] !text-[14px]" aria-hidden>
                {initialsOf(d.companyName)}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-[15px] font-semibold">{d.companyName}</span>
                <span className="truncate text-[13px] text-[var(--q-text-4)]">
                  {[d.siren ? `SIREN ${formatSiren(d.siren)}` : null, d.city].filter(Boolean).join(" · ") || "Coordonnées à compléter par l'entreprise"}
                </span>
                <span className="truncate text-xs text-[var(--q-text-4)]">
                  Accès depuis le {dayOf(d.acceptedAt)}
                  {d.lastSeenAt ? ` · dernière consultation le ${dateTime(d.lastSeenAt)}` : ""}
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-[var(--q-text-4)]" aria-hidden />
            </Link>
          ))}
        </section>
      )}
    </div>
  )
}
