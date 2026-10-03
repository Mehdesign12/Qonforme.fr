/**
 * Paramètres › Facturation électronique (planche « Paramètres — Plateforme
 * agréée »), version honnête : où en est Qonforme, et ce que l'artisan doit
 * faire d'ici le raccordement. Qonforme n'est pas une plateforme agréée et n'y
 * est pas encore raccordé (DECISIONS § 7.3 et § 10) ; aucune date n'est promise.
 *
 * Sources :
 * - CGI, art. 289 bis : « l'émission, la transmission et la réception des
 *   factures électroniques s'effectuent en recourant à une plateforme agréée » ;
 * - DGFiP, « Facturation électronique : guide pratique de démarrage au
 *   1er septembre 2026 » (juillet 2026) : réception généralisée au 1er septembre
 *   2026 ; l'entreprise sans plateforme « doit engager cette démarche sans
 *   attendre, directement auprès d'une plateforme agréée ou par l'intermédiaire
 *   de sa solution habituelle » et « conserver les échanges » (question 1) ; une
 *   facture reçue par mail, PDF ou papier « ne doit pas être écartée » pour ce
 *   seul motif (question 3) ; une même facture reçue plusieurs fois ne se traite
 *   qu'une fois (question 5) ; mise en demeure de trois mois avant amende pour
 *   la réception (CGI, art. 1737, IV bis) ;
 * - DGFiP, spécifications externes v3.2, dossier général § 2.3.5 (calendrier :
 *   émission au 1er septembre 2026 pour les grandes entreprises et les ETI, au
 *   1er septembre 2027 pour les PME et microentreprises).
 *
 * Aucun nom d'éditeur ou de plateforme privée (DECISIONS § 2) : seuls le portail
 * public Chorus Pro et les pages officielles sont cités. Partagé par
 * l'application et la démo.
 */
import Link from "next/link"
import {
  ArrowRight, CheckCircle2, Clock, Download, ExternalLink, FileCheck2, Inbox, ListChecks, Send, ShieldCheck, Upload,
} from "lucide-react"
import { PageHeader, StatusPill, type Tone } from "@/components/app/kit"
import type { ShellMode } from "@/components/layout/nav"
import { settingsHref } from "@/components/settings/sections"
import { SettingsCard } from "@/components/settings/ui"

const OFFICIAL = {
  platforms: "https://www.impots.gouv.fr/facturation-electronique-et-plateformes-agreees",
  guide: "https://www.impots.gouv.fr/sites/default/files/media/1_metier/2_professionnel/EV/2_gestion/290_facturation_electronique/guide_pratique_facturation_electronique.pdf",
  chorus: "https://chorus-pro.gouv.fr",
}

const STEPS = [
  {
    icon: Send,
    title: "Émettez la facture dans Qonforme",
    text: "Elle sort du brouillon quand vous l'envoyez à votre client ou la marquez envoyée. Un brouillon n'a pas de Factur-X.",
  },
  {
    icon: Download,
    title: "Téléchargez son Factur-X",
    text: "Bouton « XML Factur-X » sur la fiche de la facture. Le PDF envoyé à votre client contient aussi ces données.",
  },
  {
    icon: Upload,
    title: "Déposez-le si votre client le demande",
    text: "Chorus Pro pour un client public (État, collectivité, hôpital) ; pour un client professionnel, votre plateforme agréée.",
  },
]

const LINKS = [
  {
    name: "Liste officielle des plateformes agréées",
    text: "Publiée par l'administration fiscale, pour choisir la plateforme qui recevra vos factures.",
    url: OFFICIAL.platforms,
    tag: "impots.gouv.fr",
  },
  {
    name: "Guide pratique de démarrage",
    text: "La conduite à tenir depuis le 1er septembre 2026 : réception, factures reçues par email, doublons, sanctions.",
    url: OFFICIAL.guide,
    tag: "DGFiP · PDF",
  },
  {
    name: "Chorus Pro",
    text: "Portail public, obligatoire pour facturer l'État, les collectivités et les établissements publics.",
    url: OFFICIAL.chorus,
    tag: "Clients publics",
  },
]

function StatusRow({ icon: Icon, title, text, tone, pill, action }: {
  icon: React.ElementType
  title: string
  text: React.ReactNode
  tone: Tone
  pill: string
  action?: React.ReactNode
}) {
  return (
    <li className="flex gap-3 border-t border-[var(--q-line-soft)] py-3.5 first:border-t-0 first:pt-1">
      <span className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-[var(--q-wash)] text-[var(--q-accent-strong)]">
        <Icon className="size-[18px]" strokeWidth={1.75} aria-hidden />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[15px] font-semibold text-[var(--q-ink)]">{title}</span>
          <StatusPill
            tone={tone}
            icon={tone === "ok" ? <CheckCircle2 strokeWidth={2.25} aria-hidden /> : <Clock strokeWidth={2.25} aria-hidden />}
          >
            {pill}
          </StatusPill>
        </span>
        <span className="text-[13px] leading-relaxed text-[var(--q-text-3)]">{text}</span>
        {action}
      </span>
    </li>
  )
}

export function EInvoicingView({ mode }: { mode: ShellMode }) {
  const invoicesHref = mode === "demo" ? "/demo/invoices" : "/invoices"
  const receivedHref = mode === "demo" ? "/demo/received-invoices" : "/received-invoices"
  const importHref = `${receivedHref}/import`

  return (
    <>
      <PageHeader
        title="Facturation électronique"
        subtitle="Où en est Qonforme, et ce que vous devez faire d'ici le raccordement"
        backHref={settingsHref("/settings", mode)}
        backLabel="Paramètres"
      />

      {/* ── Où en est Qonforme ── */}
      <SettingsCard
        id="etat"
        title="Où en est Qonforme"
        description="Qonforme n'est pas une plateforme agréée : il s'y raccorde. Ce raccordement est en préparation, sans date annoncée."
      >
        <ul className="flex flex-col">
          <StatusRow
            icon={Inbox}
            title="Réception par import"
            tone="ok"
            pill="Disponible"
            text="Importez les factures de vos fournisseurs (Factur-X, XML CII ou UBL, PDF) : Qonforme les lit, contrôle les totaux, la TVA, le destinataire et les doublons, puis suit leur traitement."
            action={<Link href={receivedHref} className="q-link mt-0.5 inline-flex w-fit items-center gap-1 text-[13px]">Factures reçues<ArrowRight className="size-3.5" aria-hidden /></Link>}
          />
          <StatusRow
            icon={ListChecks}
            title="Statuts du cycle de vie"
            tone="info"
            pill="Dans Qonforme"
            text="Prise en charge, approuvée, en litige, refusée avec motif, payée : horodatés dans Qonforme. Ils seront transmis à votre plateforme agréée une fois Qonforme raccordé ; d'ici là, prévenez vous-même vos fournisseurs."
          />
          <StatusRow
            icon={ShieldCheck}
            title="Raccordement à une plateforme agréée"
            tone="warn"
            pill="En préparation"
            text="Réception automatique de vos factures, transmission des statuts, consultation de l'annuaire. Rien de tout cela ne fonctionne encore dans Qonforme."
          />
          <StatusRow
            icon={FileCheck2}
            title="Factures émises"
            tone="ok"
            pill="Factur-X"
            text="Chaque facture émise embarque son XML Factur-X (profil EN 16931). Leur transmission par une plateforme agréée, obligatoire pour les TPE et PME au 1er septembre 2027, est en préparation."
          />
        </ul>
      </SettingsCard>

      {/* ── À faire ── */}
      <SettingsCard
        id="a-faire"
        title="Ce que vous devez faire d'ici là"
        description="D'après le guide pratique de démarrage de la DGFiP (juillet 2026)."
      >
        <ol className="flex flex-col">
          <li className="flex gap-3.5 border-t border-[var(--q-line-soft)] py-3.5 first:border-t-0 first:pt-1">
            <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-[var(--q-accent)] text-[13px] font-semibold text-white">1</span>
            <span className="flex min-w-0 flex-col gap-1">
              <span className="text-[15px] font-semibold text-[var(--q-ink)]">Désignez une plateforme agréée pour recevoir vos factures</span>
              <span className="text-[13px] leading-relaxed text-[var(--q-text-3)]">
                C&apos;est obligatoire pour toutes les entreprises depuis le 1er septembre 2026. Choisissez-la dans la
                liste officielle, directement ou par votre banque, votre expert-comptable ou un autre prestataire, et
                gardez une trace de la démarche.
              </span>
              <a href={OFFICIAL.platforms} target="_blank" rel="noopener noreferrer" className="q-link inline-flex w-fit items-center gap-1 text-[13px]">
                Liste officielle des plateformes agréées
                <ExternalLink className="size-3.5" aria-hidden />
              </a>
            </span>
          </li>
          <li className="flex gap-3.5 border-t border-[var(--q-line-soft)] py-3.5">
            <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-[var(--q-accent)] text-[13px] font-semibold text-white">2</span>
            <span className="flex min-w-0 flex-col gap-1">
              <span className="text-[15px] font-semibold text-[var(--q-ink)]">Traitez normalement les factures reçues par email, PDF ou papier</span>
              <span className="text-[13px] leading-relaxed text-[var(--q-text-3)]">
                Elles ne doivent pas être écartées pour ce seul motif. Importez-les dans Qonforme pour les contrôler,
                les approuver ou les refuser, et suivre leur paiement.
              </span>
              <Link href={importHref} className="q-link inline-flex w-fit items-center gap-1 text-[13px]">
                Importer une facture
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </span>
          </li>
          <li className="flex gap-3.5 border-t border-[var(--q-line-soft)] py-3.5">
            <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-[var(--q-accent)] text-[13px] font-semibold text-white">3</span>
            <span className="flex min-w-0 flex-col gap-1">
              <span className="text-[15px] font-semibold text-[var(--q-ink)]">Ne payez une même facture qu&apos;une fois</span>
              <span className="text-[13px] leading-relaxed text-[var(--q-text-3)]">
                Reçue par plusieurs canaux, elle reste une seule facture : Qonforme refuse l&apos;import d&apos;un doublon
                (même fournisseur, même numéro, même année).
              </span>
            </span>
          </li>
        </ol>
      </SettingsCard>

      <div className="grid items-start gap-4 lg:grid-cols-2">
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

        {/* ── Factures émises : dépôt manuel ── */}
        <SettingsCard
          id="guide"
          title="Vos factures émises"
          description="Si un client vous demande de déposer une facture sur une plateforme."
          action={
            <Link href={invoicesHref} className="q-btn q-btn-secondary q-btn-sm hidden shrink-0 sm:inline-flex">
              Mes factures
              <ArrowRight aria-hidden />
            </Link>
          }
        >
          <ol className="flex flex-col">
            {STEPS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-3 border-t border-[var(--q-line-soft)] py-3 first:border-t-0 first:pt-1">
                <span className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-[var(--q-wash)] text-[var(--q-accent-strong)]">
                  <Icon className="size-4" strokeWidth={1.75} aria-hidden />
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm font-semibold text-[var(--q-ink)]">{title}</span>
                  <span className="text-[13px] leading-relaxed text-[var(--q-text-3)]">{text}</span>
                </span>
              </li>
            ))}
          </ol>
        </SettingsCard>
      </div>

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
