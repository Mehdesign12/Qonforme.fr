/**
 * Accueil des paramètres (planche « Mobile — Paramètres ») : carte de
 * l'entreprise, puis une liste par rubrique. Sur mobile, c'est le point
 * d'entrée de chaque réglage ; sur ordinateur, la colonne de gauche du cadre
 * reste à côté.
 *
 * Contenu vrai uniquement : la transmission par plateforme agréée est « en
 * préparation », pas de décennale ni d'équipe (non livrées, DECISIONS § 10).
 * Partagé par l'application et la démo.
 */
import Link from "next/link"
import { Bell, ChevronRight, CreditCard, Download, Layers, ShieldCheck, Building2, type LucideIcon } from "lucide-react"
import { formatCurrency } from "@/lib/utils/invoice"
import { initialsOf, PageHeader, StatusPill } from "@/components/app/kit"
import type { ShellMode } from "@/components/layout/nav"
import { settingsHref } from "@/components/settings/sections"
import { LogoutRow } from "@/components/settings/LogoutRow"

export interface OverviewCompany {
  name: string
  siren: string
  city: string
  vat_number: string
  iban: string
}

export interface OverviewPlan {
  name: string
  period: "monthly" | "yearly"
  /** Montant prélevé à chaque échéance, TTC. */
  amountTtc: number
  renewsAt: string | null
  pastDue: boolean
  cancelAtPeriodEnd?: boolean
}

function formatSirenSpaced(siren: string): string {
  const d = siren.replace(/\D/g, "")
  return d.length === 9 ? `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : siren
}

/** « FR76 3000 … 0189 » : début et fin de l'IBAN, le reste masqué. */
function maskIban(iban: string): string {
  const v = iban.replace(/\s/g, "")
  if (v.length < 10) return iban
  return `${v.slice(0, 4)} •••• ${v.slice(-4)}`
}

function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
}

export function SettingsOverview({
  mode,
  company,
  plan,
  email,
}: {
  mode: ShellMode
  company: OverviewCompany | null
  plan: OverviewPlan | null
  email: string
}) {
  const href = (path: string) => settingsHref(path, mode)

  return (
    <div className="flex max-w-[760px] flex-col gap-4">
      <PageHeader title="Paramètres" subtitle="Votre entreprise, vos documents et votre formule" />

      {/* ── Carte de l'entreprise ── */}
      {company ? (
        <Link
          href={href("/settings/company")}
          className="q-card flex flex-col gap-3.5 !rounded-[22px] p-[18px] text-[var(--q-ink)] transition-colors hover:border-[var(--q-field)]"
        >
          <span className="flex items-center gap-3">
            <span className="q-avatar q-avatar-ink !size-12 !rounded-[14px] !text-[15px]" aria-hidden>{initialsOf(company.name)}</span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-[17px] font-semibold">{company.name || "Votre entreprise"}</span>
              <span className="truncate text-[13px] text-[var(--q-text-4)]">
                {company.siren ? `SIREN ${formatSirenSpaced(company.siren)}` : "SIREN à compléter"}
                {company.city ? ` · ${company.city}` : ""}
              </span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-[var(--q-text-4)]" aria-hidden />
          </span>
          <span className="grid grid-cols-2 gap-2.5 border-t border-[var(--q-line)] pt-3">
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-xs text-[var(--q-text-4)]">TVA intracommunautaire</span>
              <span className="truncate font-mono text-[15px] font-medium">{company.vat_number || "—"}</span>
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-xs text-[var(--q-text-4)]">IBAN</span>
              <span className="truncate font-mono text-[15px] font-medium">{company.iban ? maskIban(company.iban) : "À ajouter"}</span>
            </span>
          </span>
        </Link>
      ) : (
        <Link
          href={href("/settings/company")}
          className="q-card flex items-center gap-3 !rounded-[22px] p-[18px] text-[var(--q-ink)]"
        >
          <span className="q-empty-icon !size-12 shrink-0"><Building2 className="size-5" aria-hidden /></span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[17px] font-semibold">Complétez votre entreprise</span>
            <span className="text-[13px] text-[var(--q-text-4)]">Raison sociale, SIREN et adresse figurent sur chaque document.</span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-[var(--q-text-4)]" aria-hidden />
        </Link>
      )}

      {/* ── Facturation électronique ── */}
      <Group title="Facturation électronique">
        <Row
          href={href("/settings/ppf")}
          icon={ShieldCheck}
          tone="warn"
          title="Plateforme agréée"
          sub="Transmission en préparation · guide de dépôt"
          aside={<StatusPill tone="warn" className="hidden sm:inline-flex">En préparation</StatusPill>}
        />
      </Group>

      {/* ── Documents ── */}
      <Group title="Documents">
        <Row href={href("/settings/invoices")} icon={Layers} title="Modèles de devis et factures" sub="Logo, couleur d'accent, numérotation, mentions" />
        <Row href={href("/settings/exports")} icon={Download} title="Exports comptables" sub="Fichier des écritures comptables (FEC)" />
      </Group>

      {/* ── Notifications ── */}
      <Group title="Notifications">
        <Row href={href("/settings/notifications")} icon={Bell} title="E-mails envoyés" sub="Copie de vos envois, relances automatiques" />
      </Group>

      {/* ── Abonnement ── */}
      <Group title="Abonnement">
        {plan ? (
          <Row
            href={href("/settings/billing")}
            icon={CreditCard}
            title={`${plan.name} · ${plan.period === "yearly" ? "12 mois" : "mensuel"}`}
            sub={
              plan.pastDue
                ? "Dernier paiement à régulariser"
                : plan.renewsAt
                  ? `${plan.cancelAtPeriodEnd ? "Active jusqu'au" : "Renouvellement le"} ${longDate(plan.renewsAt)}`
                  : "Formule active"
            }
            aside={<span className="text-[15px] font-semibold tabular-nums text-[var(--q-ink)]">{formatCurrency(plan.amountTtc)}</span>}
          />
        ) : (
          <Row
            href={href("/settings/billing")}
            icon={CreditCard}
            title="Version gratuite"
            sub="Devis illimités · Essentiel pour envoyer vos factures"
            aside={<span className="text-[15px] font-semibold tabular-nums text-[var(--q-ink)]">0 €</span>}
          />
        )}
      </Group>

      <div className="q-card q-list overflow-hidden !rounded-[18px]">
        <LogoutRow mode={mode} email={email} />
      </div>
    </div>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <h2 className="q-h2 px-0.5">{title}</h2>
      <div className="q-card q-list overflow-hidden !rounded-[18px]">{children}</div>
    </section>
  )
}

function Row({
  href,
  icon: Icon,
  title,
  sub,
  aside,
  tone,
}: {
  href: string
  icon: LucideIcon
  title: string
  sub?: string
  aside?: React.ReactNode
  tone?: "warn"
}) {
  return (
    <Link href={href} className="q-list-row !px-3.5 !py-2.5">
      <span
        className={
          tone === "warn"
            ? "grid size-9 shrink-0 place-items-center rounded-[11px] bg-[var(--q-warn-bg)] text-[var(--q-warn)]"
            : "grid size-9 shrink-0 place-items-center rounded-[11px] bg-[var(--q-sunken)] text-[var(--q-text-3)]"
        }
      >
        <Icon className="size-[18px]" strokeWidth={1.75} aria-hidden />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[15px] font-semibold">{title}</span>
        {sub && <span className="truncate text-[13px] text-[var(--q-text-4)]">{sub}</span>}
      </span>
      {aside && <span className="shrink-0">{aside}</span>}
      <ChevronRight className="size-4 shrink-0 text-[var(--q-text-4)]" aria-hidden />
    </Link>
  )
}
