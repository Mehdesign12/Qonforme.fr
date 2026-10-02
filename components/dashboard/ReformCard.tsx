/**
 * « Réforme 2026-2027 » (réel et démo) : remplace la carte « Conformité 2027 »
 * du canevas et l'ancien bandeau « Factur-X certifié », qui affirmaient des
 * choses fausses (plateforme connectée, annuaire, certification).
 *
 * Ne coche que ce qui se vérifie dans les données : SIREN et adresse de
 * l'entreprise, SIREN des clients. La transmission par plateforme agréée est
 * dite « en préparation » (DECISIONS § 10) ; le guide explique la voie manuelle.
 */
import Link from "next/link"
import { Check, CircleAlert, Clock, Info } from "lucide-react"
import { StatusPill } from "@/components/app/kit"
import { cn } from "@/lib/utils"
import { hrefFor, plural, type DashMode, type DashboardView } from "@/components/dashboard/model"

type Tone = "ok" | "warn" | "info" | "pending"

const ICON: Record<Tone, React.ReactNode> = {
  ok: <Check className="size-[18px] text-[var(--q-ok)]" strokeWidth={2.25} aria-hidden />,
  warn: <CircleAlert className="size-[18px] text-[var(--q-warn)]" strokeWidth={2.25} aria-hidden />,
  info: <Info className="size-[18px] text-[var(--q-accent-strong)]" strokeWidth={2.25} aria-hidden />,
  pending: <Clock className="size-[18px] text-[var(--q-text-4)]" strokeWidth={2.25} aria-hidden />,
}

const SR: Record<Tone, string> = { ok: "Fait : ", warn: "À compléter : ", info: "À vérifier : ", pending: "" }

function Item({
  tone,
  title,
  sub,
  fix,
  pill,
}: {
  tone: Tone
  title: string
  sub: string
  fix?: { href: string; label: string }
  pill?: string
}) {
  return (
    <li className="flex gap-2.5 text-sm">
      <span className="mt-px shrink-0">{ICON[tone]}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[var(--q-ink)]">
          <span><span className="sr-only">{SR[tone]}</span>{title}</span>
          {pill && <StatusPill tone="neutral" className="!h-5 !px-2 !text-[11px]">{pill}</StatusPill>}
        </span>
        <span className="text-xs text-[var(--q-text-4)]">{sub}</span>
        {fix && <Link href={fix.href} className="q-link mt-0.5 w-fit text-[13px]">{fix.label}</Link>}
      </span>
    </li>
  )
}

export function ReformCard({ reform, mode }: { reform: DashboardView["reform"]; mode: DashMode }) {
  const companyHref = hrefFor(mode, "/settings/company")
  const missing = reform.clientsWithoutSiren
  return (
    <section aria-labelledby="dash-reform" className={cn("q-card flex flex-col gap-3 p-[18px]")}>
      <div className="flex items-center justify-between gap-3">
        <h2 id="dash-reform" className="q-h2">Réforme 2026-2027</h2>
        <Link href={hrefFor(mode, "/settings/ppf")} className="q-link text-[13px]">Lire le guide</Link>
      </div>
      <ul className="flex flex-col gap-3">
        <Item
          tone={reform.sirenOk ? "ok" : "warn"}
          title="SIREN de l'entreprise"
          sub={reform.sirenOk ? "Renseigné, repris sur vos documents" : "À renseigner, obligatoire sur vos factures"}
          fix={reform.sirenOk ? undefined : { href: companyHref, label: "Compléter" }}
        />
        <Item
          tone={reform.addressOk ? "ok" : "warn"}
          title="Adresse de l'entreprise"
          sub={reform.addressOk ? "Renseignée, reprise sur vos documents" : "À renseigner, obligatoire sur vos factures"}
          fix={reform.addressOk ? undefined : { href: companyHref, label: "Compléter" }}
        />
        {missing !== null && (
          missing > 0 ? (
            <Item
              tone="info"
              title={`${missing}\u00a0${plural(missing, "client sans SIREN", "clients sans SIREN")}`}
              sub="À renseigner pour vos clients professionnels"
              fix={{ href: hrefFor(mode, "/clients"), label: "Voir les clients" }}
            />
          ) : (
            <Item tone="ok" title="SIREN de vos clients" sub="Renseigné pour tous vos clients" />
          )
        )}
        <Item
          tone="pending"
          title="Transmission par plateforme agréée"
          pill="En préparation"
          sub="Réception obligatoire depuis le 1er septembre 2026, émission au 1er septembre 2027 pour les TPE."
        />
      </ul>
    </section>
  )
}
