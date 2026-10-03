/**
 * Mentions honnêtes de la réception : Qonforme n'est pas (encore) raccordé à
 * une plateforme agréée. Rien ici ne doit laisser croire le contraire
 * (DECISIONS-STRATEGIQUES.md § 2 et § 7.3).
 */
import Link from "next/link"
import { ArrowRight, Clock, Info } from "lucide-react"
import { EmptyState } from "@/components/app/kit"

/** Bandeau en tête de la boîte de réception. */
export function PlatformNotice({ settingsHref }: { settingsHref: string }) {
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

/** Note sous le cycle de vie : les statuts restent dans Qonforme. */
export function StatusLocalNote({ source }: { source: "import" | "platform" }) {
  return (
    <p className="q-field-hint mt-3 border-t border-[var(--q-line-soft)] pt-3 leading-relaxed">
      {source === "import"
        ? "Statuts enregistrés dans Qonforme et transmis à personne : Qonforme n’est pas encore raccordé à une plateforme agréée. Prévenez vous-même votre fournisseur de votre décision. Une fois le raccordement fait, les statuts des factures reçues par la plateforme lui seront transmis."
        : "Statuts enregistrés dans Qonforme. Ils seront transmis à votre plateforme agréée une fois Qonforme raccordé."}
    </p>
  )
}
