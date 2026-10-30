/**
 * Mentions de la réception, selon le raccordement du compte à Super PDP
 * (lib/pa) : réception active, raccordement en cours, ou pas de raccordement.
 * Rien ici ne doit laisser croire à une réception automatique qui n'existe pas
 * (DECISIONS-STRATEGIQUES.md § 2 et § 7.3).
 */
import Link from "next/link"
import { ArrowRight, BadgeCheck, Clock, Info } from "lucide-react"
import { EmptyState, StatusPill } from "@/components/app/kit"
import { SUPERPDP_LABEL } from "@/lib/pa/superpdp/config"
import { PA_STATUS_LABEL, PA_STATUS_TONE, type PaStatus } from "@/lib/pa/status"

/** Raccordement du compte, pour le bandeau de la boîte de réception. */
export interface ReceptionInfo {
  /** Raccordement proposé à ce compte. */
  available: boolean
  status: PaStatus | null
  /** Le compte a une formule (la relève tourne). */
  hasPlan: boolean
  address: string | null
  lastSyncAt: string | null
  hubHref: string
}

const DATE_TIME = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })

/** Bandeau en tête de la boîte de réception. */
export function PlatformNotice({ settingsHref, reception }: { settingsHref: string; reception?: ReceptionInfo | null }) {
  if (reception?.status) {
    const active = reception.status === "active" && reception.hasPlan
    return (
      <div className="q-card flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-sm">
        <StatusPill
          tone={reception.hasPlan ? PA_STATUS_TONE[reception.status] : "warn"}
          icon={active ? <BadgeCheck strokeWidth={2.25} aria-hidden /> : undefined}
        >
          {reception.hasPlan ? PA_STATUS_LABEL[reception.status] : "Réception suspendue"}
        </StatusPill>
        <span className="font-semibold text-[var(--q-ink)]">{SUPERPDP_LABEL}</span>
        {reception.address && <span className="q-mono text-[var(--q-text-3)]">{reception.address}</span>}
        {reception.lastSyncAt && (
          <span className="text-[13px] text-[var(--q-text-4)]">Dernière relève : {DATE_TIME.format(new Date(reception.lastSyncAt)).replace(":", " h ")}</span>
        )}
        <Link href={reception.hubHref} className="q-link ml-auto text-[13px]">Facturation électronique</Link>
      </div>
    )
  }
  if (reception?.available) {
    return (
      <div className="q-banner items-start">
        <Info className="mt-0.5 size-[18px] shrink-0" aria-hidden />
        <div className="flex min-w-0 flex-1 flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-4">
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Réception par la plateforme agréée : pas encore activée</p>
            <p className="text-[13px] opacity-90">
              Raccordez Qonforme à {SUPERPDP_LABEL} : vos factures fournisseurs arriveront seules ici. En attendant,
              importez celles que vous recevez.
            </p>
          </div>
          <Link href={reception.hubHref} className="q-btn q-btn-secondary q-btn-sm shrink-0 self-start sm:self-center">
            Activer
            <ArrowRight aria-hidden />
          </Link>
        </div>
      </div>
    )
  }
  return (
    <div className="q-banner items-start">
      <Info className="mt-0.5 size-[18px] shrink-0" aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-4">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Plateforme agréée : raccordement en préparation</p>
          <p className="text-[13px] opacity-90">
            Qonforme ne reçoit pas encore vos factures automatiquement. Importez celles que vos fournisseurs vous
            envoient : elles sont lues, contrôlées et suivies jusqu&apos;au paiement.
          </p>
        </div>
        <Link href={settingsHref} className="q-btn q-btn-secondary q-btn-sm shrink-0 self-start sm:self-center">
          Ce que vous devez faire
          <ArrowRight aria-hidden />
        </Link>
      </div>
    </div>
  )
}

/** Migration pas encore appliquée : la fonction n'est pas active sur ce compte. */
export function ReceptionUnavailable({ settingsHref }: { settingsHref: string }) {
  return (
    <section className="q-card">
      <EmptyState
        className="py-14"
        icon={<Clock className="size-5" aria-hidden />}
        title="Factures reçues : en cours de mise en service"
        text="L’import et le suivi des factures de vos fournisseurs s’afficheront ici dès que la fonction sera active. Rien à faire de votre côté."
        action={
          <Link href={settingsHref} className="q-btn q-btn-secondary">
            Où en est la facturation électronique
            <ArrowRight aria-hidden />
          </Link>
        }
      />
    </section>
  )
}

/**
 * Note sous le cycle de vie. `transmits` : le compte est raccordé à Super PDP
 * avec une formule, les décisions sur une facture arrivée par la plateforme lui
 * sont transmises.
 */
export function StatusLocalNote({ source, transmits }: { source: "import" | "platform"; transmits?: boolean }) {
  if (transmits && source === "platform") {
    return (
      <p className="q-field-hint mt-3 border-t border-[var(--q-line-soft)] pt-3 leading-relaxed">
        Votre réponse est transmise au fournisseur par la plateforme agréée.
      </p>
    )
  }
  if (transmits) {
    return (
      <p className="q-field-hint mt-3 border-t border-[var(--q-line-soft)] pt-3 leading-relaxed">
        Facture importée à la main : la plateforme ne la connaît pas. Vos statuts restent dans Qonforme ; prévenez
        vous-même votre fournisseur de votre décision.
      </p>
    )
  }
  return (
    <p className="q-field-hint mt-3 border-t border-[var(--q-line-soft)] pt-3 leading-relaxed">
      {source === "import"
        ? "Statuts enregistrés dans Qonforme et transmis à personne : Qonforme n’est pas encore raccordé à une plateforme agréée. Prévenez vous-même votre fournisseur de votre décision. Une fois le raccordement fait, les statuts des factures reçues par la plateforme lui seront transmis."
        : "Statuts enregistrés dans Qonforme. Ils seront transmis à votre plateforme agréée une fois Qonforme raccordé."}
    </p>
  )
}
