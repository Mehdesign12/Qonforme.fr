/**
 * Paramètres › Facturation électronique (planche « Paramètres — Plateforme
 * agréée »), version honnête : Qonforme n'est pas encore raccordé à une
 * plateforme agréée (DECISIONS § 10). La page dit où en est la transmission
 * (« en préparation »), rappelle le calendrier de la réforme et guide le
 * dépôt manuel du Factur-X de chaque facture émise.
 *
 * Aucun nom d'éditeur ou de plateforme privée (DECISIONS § 2) : seuls le
 * portail public Chorus Pro et l'annuaire officiel sont cités.
 * Partagé par l'application et la démo.
 */
import Link from "next/link"
import { ArrowRight, Clock, Download, ExternalLink, FileCheck2, Send, ShieldCheck, Upload } from "lucide-react"
import { PageHeader, StatusPill } from "@/components/app/kit"
import type { ShellMode } from "@/components/layout/nav"
import { settingsHref } from "@/components/settings/sections"
import { SettingsCard } from "@/components/settings/ui"

const STEPS = [
  {
    icon: Send,
    title: "Émettez la facture dans Qonforme",
    text: "Elle sort du brouillon quand vous l'envoyez à votre client ou la marquez envoyée. Un brouillon n'a pas de Factur-X.",
  },
  {
    icon: Download,
    title: "Téléchargez son Factur-X",
    text: "Bouton « Factur-X » sur la fiche de la facture : le fichier XML qui décrit la facture. Le PDF envoyé à votre client contient aussi ces données.",
  },
  {
    icon: Upload,
    title: "Déposez-le sur votre plateforme",
    text: "Chorus Pro pour un client public (État, collectivité, hôpital), votre plateforme agréée pour un client professionnel. Elle vérifie le fichier au dépôt et signale toute anomalie.",
  },
  {
    icon: FileCheck2,
    title: "Suivez la facture",
    text: "La plateforme vous confirme sa réception. Dans Qonforme, marquez la facture payée à l'arrivée du virement.",
  },
]

const LINKS = [
  {
    name: "Chorus Pro",
    text: "Portail public, obligatoire pour facturer l'État, les collectivités et les établissements publics.",
    url: "https://chorus-pro.gouv.fr",
    tag: "Clients publics",
  },
  {
    name: "Liste officielle des plateformes agréées",
    text: "Publiée par l'administration fiscale, pour choisir la plateforme qui recevra et émettra vos factures.",
    url: "https://www.impots.gouv.fr/facturation-electronique-et-plateformes-agreees",
    tag: "impots.gouv.fr",
  },
]

export function EInvoicingView({ mode }: { mode: ShellMode }) {
  const invoicesHref = mode === "demo" ? "/demo/invoices" : "/invoices"

  return (
    <>
      <PageHeader
        title="Facturation électronique"
        subtitle="Où en est la transmission de vos factures, et comment les déposer d'ici là"
        backHref={settingsHref("/settings", mode)}
        backLabel="Paramètres"
      />

      {/* ── Transmission ── */}
      <SettingsCard id="transmission" title="Transmission">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--q-warn-bg)] text-[var(--q-warn)]">
            <ShieldCheck className="size-5" strokeWidth={1.75} aria-hidden />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-base font-semibold text-[var(--q-ink)]">Plateforme agréée : en préparation</span>
            <span className="text-[13px] leading-relaxed text-[var(--q-text-4)]">
              Qonforme ne transmet pas encore vos factures à une plateforme agréée et ne reçoit pas celles de vos
              fournisseurs. D&apos;ici là, déposez vous-même le Factur-X de chaque facture émise.
            </span>
          </span>
          <StatusPill tone="warn" icon={<Clock strokeWidth={2.25} aria-hidden />} className="self-start sm:self-center">
            En préparation
          </StatusPill>
        </div>
      </SettingsCard>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        {/* ── Réception ── */}
        <SettingsCard
          id="reception"
          title="Réception"
          description="Depuis le 1er septembre 2026, toute entreprise doit pouvoir recevoir ses factures fournisseurs sous forme électronique, par une plateforme agréée."
        >
          <a
            href={LINKS[1].url}
            target="_blank"
            rel="noopener noreferrer"
            className="q-link inline-flex items-center gap-1.5 text-sm"
          >
            Choisir une plateforme agréée
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        </SettingsCard>

        {/* ── Calendrier ── */}
        <SettingsCard id="calendrier" title="Calendrier de la réforme">
          <ol className="flex flex-col gap-3">
            <li className="flex gap-3">
              <span className="mt-1 size-2.5 shrink-0 rounded-full bg-[var(--q-accent)]" aria-hidden />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold text-[var(--q-ink)]">1er septembre 2026 · réception pour toutes les entreprises</span>
                <span className="text-[13px] leading-relaxed text-[var(--q-text-4)]">En vigueur. Les grandes entreprises et les ETI émettent aussi leurs factures par voie électronique.</span>
              </span>
            </li>
            <li className="flex gap-3">
              <span className="mt-1 size-2.5 shrink-0 rounded-full border-2 border-dashed border-[var(--q-text-4)]" aria-hidden />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold text-[var(--q-ink)]">1er septembre 2027 · émission pour les TPE et PME</span>
                <span className="text-[13px] leading-relaxed text-[var(--q-text-4)]">
                  Vos factures partiront par une plateforme agréée. Le e-reporting (ventes aux particuliers,
                  données de paiement) suit le même calendrier.
                </span>
              </span>
            </li>
          </ol>
        </SettingsCard>
      </div>

      {/* ── Guide de dépôt ── */}
      <SettingsCard
        id="guide"
        title="Déposer une facture vous-même"
        description="En attendant la transmission par Qonforme : quatre étapes, pour chaque facture émise."
        action={
          <Link href={invoicesHref} className="q-btn q-btn-secondary q-btn-sm hidden shrink-0 sm:inline-flex">
            Mes factures
            <ArrowRight aria-hidden />
          </Link>
        }
      >
        <ol className="flex flex-col">
          {STEPS.map(({ icon: Icon, title, text }, i) => (
            <li key={title} className="flex gap-3.5 border-t border-[var(--q-line-soft)] py-3.5 first:border-t-0 first:pt-1">
              <span className="relative grid size-9 shrink-0 place-items-center rounded-[11px] bg-[var(--q-wash)] text-[var(--q-accent-strong)]">
                <Icon className="size-[18px]" strokeWidth={1.75} aria-hidden />
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-xs font-semibold uppercase tracking-[0.06em] text-[var(--q-text-4)]">Étape {i + 1}</span>
                <span className="text-[15px] font-semibold text-[var(--q-ink)]">{title}</span>
                <span className="text-[13px] leading-relaxed text-[var(--q-text-3)]">{text}</span>
              </span>
            </li>
          ))}
        </ol>
        <Link href={invoicesHref} className="q-btn q-btn-primary q-btn-lg w-full sm:hidden">
          Mes factures
          <ArrowRight aria-hidden />
        </Link>
      </SettingsCard>

      {/* ── Liens officiels ── */}
      <SettingsCard id="liens" title="Sites officiels">
        <div className="q-list -mx-5 -mb-5 border-t border-[var(--q-line-soft)]">
          {LINKS.map((l) => (
            <a key={l.name} href={l.url} target="_blank" rel="noopener noreferrer" className="q-list-row !px-5">
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-[15px] font-semibold">{l.name}</span>
                  <span className="q-tag">{l.tag}</span>
                </span>
                <span className="text-[13px] leading-relaxed text-[var(--q-text-4)]">{l.text}</span>
              </span>
              <ExternalLink className="size-4 shrink-0 text-[var(--q-text-4)]" aria-hidden />
            </a>
          ))}
        </div>
      </SettingsCard>
    </>
  )
}
