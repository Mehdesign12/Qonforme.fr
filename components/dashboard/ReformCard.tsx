"use client"

/**
 * « Réforme 2026-2027 » (réel et démo) : remplace la carte « Conformité 2027 »
 * du canevas et l'ancien bandeau « Factur-X certifié », qui affirmaient des
 * choses fausses (plateforme connectée, annuaire, certification).
 *
 * Ne coche que ce qui se vérifie dans les données : SIREN et adresse de
 * l'entreprise, SIREN des clients. La réception suit le raccordement du compte à
 * Super PDP (lib/pa) ; l'émission par la plateforme reste prévue pour 2027.
 */
import { useEffect, useState } from "react"
import Link from "next/link"
import { Check, CircleAlert, Clock, Info } from "lucide-react"
import { SUPERPDP_LABEL } from "@/lib/pa/superpdp/config"
import { PA_STATUS_LABEL } from "@/lib/pa/status"
import type { EInvoicingView } from "@/lib/pa/view"
import { fetchEInvoicingView } from "@/components/e-invoicing/reception-info"
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

/** Ligne « réception » : raccordement à Super PDP (planche 12), sinon l'import manuel. */
function ReceptionItem({ view, mode }: { view: EInvoicingView | null; mode: DashMode }) {
  const hub = hrefFor(mode, "/facturation-electronique")
  const c = view?.connection
  if (c && view?.hasPlan && c.status === "active") {
    return (
      <Item
        tone="ok"
        title={`Réception par ${SUPERPDP_LABEL}`}
        sub={`Active${c.address ? `, adresse ${c.address}` : ""} · ${view.received.thisMonth}\u00a0${plural(view.received.thisMonth, "facture reçue", "factures reçues")} ce mois-ci`}
        fix={{ href: hrefFor(mode, "/received-invoices"), label: "Voir les factures reçues" }}
      />
    )
  }
  if (c) {
    return (
      <Item
        tone={view?.hasPlan ? "info" : "warn"}
        title={`Réception par ${SUPERPDP_LABEL}`}
        sub={view?.hasPlan ? PA_STATUS_LABEL[c.status] : "Suspendue sans formule Essentiel"}
        fix={{ href: hub, label: "Voir le raccordement" }}
      />
    )
  }
  if (view?.available) {
    return (
      <Item
        tone="info"
        title="Réception par plateforme agréée"
        sub={`Obligatoire depuis le 1er septembre 2026 : raccordez Qonforme à ${SUPERPDP_LABEL}`}
        fix={{ href: hub, label: view.hasPlan ? "Activer" : "Voir comment" }}
      />
    )
  }
  return (
    <Item
      tone="info"
      title="Factures de vos fournisseurs"
      sub="Importez-les (Factur-X, XML ou PDF) pour les contrôler et suivre leur paiement"
      fix={{ href: hrefFor(mode, "/received-invoices"), label: "Factures reçues" }}
    />
  )
}

export function ReformCard({ reform, mode }: { reform: DashboardView["reform"]; mode: DashMode }) {
  const companyHref = hrefFor(mode, "/settings/company")
  const missing = reform.clientsWithoutSiren
  const [eInvoicing, setEInvoicing] = useState<EInvoicingView | null>(null)
  useEffect(() => {
    let alive = true
    // Démo : vue d'exemple chargée à part, pour ne pas embarquer les données de démo dans l'application
    const load = mode === "demo"
      ? import("@/lib/demo/e-invoicing").then((m) => m.DEMO_E_INVOICING)
      : fetchEInvoicingView()
    void load.then((v) => { if (alive) setEInvoicing(v) })
    return () => { alive = false }
  }, [mode])
  return (
    <section aria-labelledby="dash-reform" className={cn("q-card flex flex-col gap-3 p-[18px]")}>
      <div className="flex items-center justify-between gap-3">
        <h2 id="dash-reform" className="q-h2">Réforme 2026-2027</h2>
        <Link href={hrefFor(mode, "/facturation-electronique")} className="q-link text-[13px]">Facturation électronique</Link>
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
        <ReceptionItem view={eInvoicing} mode={mode} />
        <Item
          tone="pending"
          title="Émission par plateforme agréée"
          pill="Prévue pour 2027"
          sub="Obligatoire au 1er septembre 2027 pour les PME, TPE et micro-entreprises. D'ici là, vos factures partent par email."
        />
      </ul>
    </section>
  )
}
