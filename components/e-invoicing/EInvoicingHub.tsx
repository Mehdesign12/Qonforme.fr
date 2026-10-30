"use client"

/**
 * Page « Facturation électronique » (canevas « Facturation électronique » du
 * 23/10/2026, planches 1 à 9 et M1 à M12) : activer la réception par Super PDP,
 * suivre le raccordement, et chaque état où ça ne se passe pas comme prévu.
 * Partagée par l'application (vue lue par l'API) et la démo (vue d'exemple).
 *
 * Ne dit que ce qui est vrai : « Inclus dans Essentiel, sans frais en plus »
 * (Super PDP ne facture que l'éditeur), aucun délai promis sauf les 5 jours du
 * transfert d'adresse (documentation Super PDP, « Annuaire »), l'émission par la
 * plateforme reste prévue pour 2027. Les écrans de Super PDP ne sont pas décrits
 * en détail : ils sont les siens et peuvent changer.
 */
import { useState } from "react"
import Link from "next/link"
import {
  AlertTriangle, ArrowRight, BadgeCheck, CircleSlash, ExternalLink, FileUp, Inbox, Pause, RefreshCw,
  ShieldCheck, Undo2,
} from "lucide-react"
import { EmptyState, StatusPill } from "@/components/app/kit"
import { cn } from "@/lib/utils"
import { SUPERPDP_LABEL, SUPERPDP_SITE } from "@/lib/pa/superpdp/config"
import { PA_STATUS_TONE } from "@/lib/pa/status"
import type { EInvoicingView } from "@/lib/pa/view"
import {
  CopyButton, Facts, fmtDay, fmtDayTime, ProgressRow, ReformTimeline, Responsibilities, Stepper, TwoVoice, type CheckTone,
} from "@/components/e-invoicing/parts"

export interface HubHrefs {
  connect: string
  pricing: string
  received: string
  importHref: string
  settings: string
}

export interface HubNotice { tone: "ok" | "warn" | "danger" | "info"; text: string }

export interface EInvoicingHubProps {
  view: EInvoicingView | null
  loading: boolean
  error: string | null
  hrefs: HubHrefs
  notice?: HubNotice | null
  busy?: boolean
  /** Date du jour en toutes lettres (calendrier), lue après le montage. */
  todayLabel: string | null
  initialStep?: "avant" | null
  onRetry: () => void
  onRefresh: (sync?: boolean) => void
  onRemove: () => void
}

const INCLUDED = "Inclus dans Essentiel, sans frais en plus"

function Notice({ notice }: { notice: HubNotice }) {
  const cls = notice.tone === "ok" ? "q-banner-ok" : notice.tone === "warn" ? "q-banner-warn" : notice.tone === "danger" ? "q-banner-danger" : ""
  return (
    <div className={cn("q-banner", cls)} role="status">
      <span>{notice.text}</span>
    </div>
  )
}

function SuperPdpMark() {
  return (
    <span className="inline-flex items-center gap-2 font-semibold text-[var(--q-ink)]">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden className="text-[var(--q-text-3)]">
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="3.2" fill="currentColor" />
      </svg>
      {SUPERPDP_LABEL}
    </span>
  )
}

function ImportCard({ href, free }: { href: string; free?: boolean }) {
  return (
    <section className="q-card flex flex-col gap-2.5 p-5">
      <h2 className="q-h2">J&apos;ai déjà une plateforme agréée</h2>
      <p className="text-sm leading-relaxed text-[var(--q-text-3)]">
        Indiquez-la à vos fournisseurs : vos factures continuent d&apos;y arriver, et vous les importez ici
        {free ? ", avec la version gratuite" : ""}. PDF Factur-X, fichier XML ou PDF simple : lu et contrôlé par Qonforme.
      </p>
      <Link href={href} className="q-btn q-btn-secondary self-start">
        <FileUp aria-hidden />
        Importer une facture reçue
      </Link>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Planches 1 et 2 : à activer                                          */
/* ------------------------------------------------------------------ */

function ActivateView({ view, hrefs, todayLabel, onStart }: { view: EInvoicingView; hrefs: HubHrefs; todayLabel: string | null; onStart: () => void }) {
  const free = !view.hasPlan
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <StatusPill tone={free ? "neutral" : "info"}>{free ? "Avec Essentiel" : "À activer"}</StatusPill>
          <StatusPill tone="neutral">{INCLUDED}</StatusPill>
        </div>
        <TwoVoice first="Facturation électronique" accent="2026" />
        <p className="max-w-2xl text-[15px] leading-relaxed text-[var(--q-text-3)]">
          Depuis le 1er septembre 2026, toute entreprise assujettie à la TVA doit pouvoir recevoir ses factures
          fournisseurs par une plateforme agréée. {free ? "Avec Essentiel, Qonforme" : "Qonforme"} se raccorde à{" "}
          {SUPERPDP_LABEL}, et vos factures arrivent dans « Factures reçues ».
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <section className="q-card flex flex-col gap-3 border-[var(--q-wash-line)] p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SuperPdpMark />
            {!free && <StatusPill tone="info">Recommandé</StatusPill>}
          </div>
          <p className="text-sm leading-relaxed text-[var(--q-text-3)]">
            {free
              ? "Raccordement automatique : vos factures fournisseurs arrivent seules dans Qonforme."
              : "Vous confirmez votre identité et votre entreprise sur le site de Super PDP, puis vous autorisez Qonforme à lire vos factures reçues. Vous revenez ensuite ici."}
          </p>
          {free ? (
            <div className="flex flex-wrap items-center gap-3">
              <Link href={hrefs.pricing} className="q-btn q-btn-primary">
                Passer à Essentiel
                <ArrowRight aria-hidden />
              </Link>
              <span className="text-[13px] text-[var(--q-text-4)]">Raccordement inclus, sans frais en plus</span>
            </div>
          ) : (
            <button type="button" className="q-btn q-btn-primary self-start" onClick={onStart}>
              Choisir {SUPERPDP_LABEL}
              <ArrowRight aria-hidden />
            </button>
          )}
        </section>
        <ImportCard href={hrefs.importHref} free={free} />
      </div>

      {free && (
        <p className="text-[13px] text-[var(--q-text-4)]">
          Aucune de vos factures reçues n&apos;est coupée ni masquée : ce que vous importez reste consultable et
          exportable avec la version gratuite.
        </p>
      )}
      <Responsibilities />
      <ReformTimeline today={todayLabel} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Planche 3 : avant de commencer                                       */
/* ------------------------------------------------------------------ */

function BeforeView({ view, hrefs, onBack }: { view: EInvoicingView; hrefs: HubHrefs; onBack: () => void }) {
  const company = view.companyName ?? "votre entreprise"
  const prep = [
    { title: "Une adresse email professionnelle", text: "Celle de l'entreprise ou du dirigeant : Super PDP y envoie ses messages de confirmation." },
    {
      title: "Le SIREN de l'entreprise",
      text: view.siren && view.mode === "live"
        ? `${company}, SIREN ${view.siren.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3")} : Qonforme le transmet, vous n'avez rien à ressaisir.`
        : "Celui de votre entreprise : vous le vérifiez chez Super PDP.",
    },
    { title: "Une pièce d'identité du dirigeant", text: "Carte d'identité ou passeport, pour la vérification d'identité demandée par la plateforme." },
    { title: "Un appareil avec appareil photo", text: "Un téléphone ou un ordinateur avec caméra, si la vérification se fait par photo." },
  ]
  return (
    <div className="flex flex-col gap-6">
      <Stepper current="before" />
      <header className="flex flex-col gap-3">
        <TwoVoice first="Avant de" accent="commencer" />
        <p className="max-w-2xl text-[15px] leading-relaxed text-[var(--q-text-3)]">
          Vous allez continuer sur le site de {SUPERPDP_LABEL}, la plateforme agréée choisie. Vous y confirmez votre
          identité et votre entreprise, et autorisez Qonforme à lire vos factures reçues. Vous revenez ici ensuite,
          automatiquement.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <section className="q-card p-5 md:p-6">
          <h2 className="q-h2">À prévoir</h2>
          <ul className="mt-4 flex flex-col gap-4">
            {prep.map((p) => (
              <li key={p.title} className="flex flex-col gap-0.5">
                <span className="text-[15px] font-semibold text-[var(--q-ink)]">{p.title}</span>
                <span className="text-[13px] leading-relaxed text-[var(--q-text-3)]">{p.text}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <a href={hrefs.connect} className="q-btn q-btn-primary q-btn-lg">
              Continuer chez {SUPERPDP_LABEL}
              <ExternalLink aria-hidden />
            </a>
            <button type="button" className="q-btn q-btn-ghost" onClick={onBack}>Retour</button>
          </div>
          <p className="mt-3 text-[13px] leading-relaxed text-[var(--q-text-4)]">
            Vous pouvez interrompre à tout moment : rien n&apos;est activé tant que l&apos;autorisation n&apos;est pas donnée.
          </p>
        </section>

        <div className="flex flex-col gap-4">
          <section className="q-card p-5">
            <h2 className="q-h2">Ce que fera Qonforme</h2>
            <ul className="mt-3 flex flex-col gap-2 text-sm leading-relaxed text-[var(--q-text-2)]">
              <li>Lire vos factures reçues sur la plateforme, à intervalles réguliers.</li>
              <li>Les ranger dans « Factures reçues », avec le fichier d&apos;origine.</li>
              <li>Transmettre vos décisions au fournisseur (prise en charge, approbation, refus avec motif).</li>
            </ul>
          </section>
          <section className="q-card p-5">
            <h2 className="q-h2">Ce que Qonforme ne fera pas</h2>
            <ul className="mt-3 flex flex-col gap-2 text-sm leading-relaxed text-[var(--q-text-2)]">
              <li>Payer une facture à votre place.</li>
              <li>Envoyer vos factures par la plateforme : l&apos;émission est prévue pour 2027.</li>
              <li>Modifier ou supprimer une facture reçue.</li>
            </ul>
          </section>
          <p className="text-[13px] text-[var(--q-text-4)]">{INCLUDED}. Vous ne payez rien à {SUPERPDP_LABEL} pour recevoir vos factures.</p>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Planches 5, 7, 8 : raccordement en cours ou bloqué                   */
/* ------------------------------------------------------------------ */

function verificationTone(v: string | null): CheckTone {
  if (v === "verified") return "done"
  if (v === "failed") return "fail"
  return "now"
}

function ProgressList({ view }: { view: EInvoicingView }) {
  const c = view.connection!
  const company = verificationTone(c.companyVerification)
  const identity = c.identityVerification === "not_verified" || !c.identityVerification ? (company === "done" ? "done" : "todo") : verificationTone(c.identityVerification)
  const directory: CheckTone = c.status === "active" ? "done" : c.status === "directory_missing" ? "fail" : company === "done" ? "now" : "todo"
  const sub = (t: CheckTone, done: string, now: string, fail: string) => (t === "done" ? done : t === "fail" ? fail : t === "now" ? now : "À venir")
  return (
    <ol className="flex flex-col">
      <ProgressRow tone="done" title="Autorisation pour Qonforme" sub={`Donnée le ${fmtDay(c.createdAt)}`} />
      <ProgressRow tone={company} title="Vérification de l'entreprise" sub={sub(company, "Validée", c.companyVerification === "needs_review" ? "Contrôle manuel chez Super PDP" : "En cours chez Super PDP", "Refusée")} />
      <ProgressRow
        tone={identity}
        title="Vérification d'identité"
        sub={c.identityVerification === "verified" ? "Validée" : identity === "done" ? "Non demandée par Super PDP" : sub(identity, "Validée", c.identityVerification === "needs_review" ? "Contrôle manuel chez Super PDP" : "En cours chez Super PDP", "Refusée")}
      />
      <ProgressRow tone={directory} title="Adresse dans l'annuaire" sub={sub(directory, c.address ?? "Enregistrée", "Enregistrement en cours", "Introuvable dans l'annuaire")} />
    </ol>
  )
}

function RefreshLine({ view, busy, onRefresh }: { view: EInvoicingView; busy?: boolean; onRefresh: (sync?: boolean) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" className="q-btn q-btn-secondary" onClick={() => onRefresh(false)} disabled={busy}>
        <RefreshCw className={cn(busy && "animate-spin")} aria-hidden />
        Actualiser l&apos;état
      </button>
      <span className="text-[13px] text-[var(--q-text-4)]">Dernière vérification : {fmtDayTime(view.connection?.lastCheckAt)}</span>
    </div>
  )
}

const STATE_COPY = {
  verifying: {
    pill: "Vérification en cours",
    first: "Votre raccordement est",
    accent: "en cours",
    text: "Super PDP vérifie votre identité et votre entreprise. Dès que c'est validé, Qonforme reprend tout seul : vous n'avez rien à refaire. Nous vous écrirons par email quand la réception sera active.",
  },
  manual_review: {
    pill: "Vérification manuelle",
    first: "Votre dossier est contrôlé",
    accent: "à la main",
    text: "Super PDP n'a pas pu tout valider automatiquement. Un contrôle manuel est en cours chez eux. Vous n'avez rien à refaire : Qonforme reprend dès que le résultat arrive.",
  },
  transfer: {
    pill: "Transfert en cours",
    first: "Votre adresse est en cours de",
    accent: "transfert",
    text: "Votre entreprise était rattachée à une autre plateforme. Super PDP vous a demandé de confirmer votre choix par email, puis transfère votre adresse : tant que ce n'est pas terminé, vos fournisseurs continuent d'envoyer vers l'ancienne plateforme. L'ancienne plateforme a 5 jours pour répondre.",
  },
  refused: {
    pill: "Refusée",
    first: "La vérification n'a",
    accent: "pas abouti",
    text: "Super PDP n'a pas pu valider votre identité ou votre entreprise. Le plus souvent, la pièce est illisible ou ne correspond pas au dirigeant déclaré. Vous pouvez recommencer le raccordement.",
  },
  expired: {
    pill: "Autorisation expirée",
    first: "Qonforme n'est plus autorisé à",
    accent: "lire vos factures",
    text: "L'autorisation donnée à Qonforme a expiré ou a été retirée chez Super PDP. Vos factures déjà reçues restent ici ; les nouvelles n'arrivent plus tant que vous n'autorisez pas à nouveau.",
  },
} as const

function PendingView({ view, hrefs, busy, onRefresh, onRemove }: { view: EInvoicingView; hrefs: HubHrefs; busy?: boolean; onRefresh: (sync?: boolean) => void; onRemove: () => void }) {
  const status = view.connection!.status as keyof typeof STATE_COPY
  const copy = STATE_COPY[status]
  const final = status === "refused" || status === "expired"
  return (
    <div className="flex flex-col gap-6">
      {!final && <Stepper current="platform" done={false} />}
      <header className="flex flex-col gap-3">
        <StatusPill tone={PA_STATUS_TONE[status]} className="self-start">{copy.pill}</StatusPill>
        <TwoVoice first={copy.first} accent={copy.accent} />
        <p className="max-w-2xl text-[15px] leading-relaxed text-[var(--q-text-3)]">{copy.text}</p>
      </header>
      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <section className="q-card flex flex-col gap-5 p-5 md:p-6">
          {status === "expired" ? (
            <Facts rows={[
              { label: "Dernière relève réussie", value: fmtDayTime(view.connection!.lastSyncAt) },
              { label: "Factures déjà reçues", value: `${view.received.total}, conservées` },
            ]} />
          ) : (
            <ProgressList view={view} />
          )}
          {final ? (
            <div className="flex flex-wrap gap-3">
              <a href={hrefs.connect} className="q-btn q-btn-primary">
                {status === "expired" ? "Autoriser à nouveau" : "Recommencer le raccordement"}
                <ArrowRight aria-hidden />
              </a>
              <Link href={hrefs.received} className="q-btn q-btn-secondary">Voir mes factures reçues</Link>
            </div>
          ) : (
            <RefreshLine view={view} busy={busy} onRefresh={onRefresh} />
          )}
        </section>
        <div className="flex flex-col gap-4">
          <section className="q-card flex flex-col gap-2.5 p-5">
            <h2 className="q-h2">En attendant</h2>
            <p className="text-sm leading-relaxed text-[var(--q-text-3)]">
              Qonforme reste utilisable comme d&apos;habitude. Si un fournisseur vous a envoyé une facture par un autre
              moyen, importez-la à la main.
            </p>
            <Link href={hrefs.importHref} className="q-btn q-btn-secondary self-start"><FileUp aria-hidden />Importer une facture reçue</Link>
          </section>
          {!final && (
            <section className="q-card flex flex-col gap-2.5 p-5">
              <h2 className="q-h2">Un souci ?</h2>
              <p className="text-sm leading-relaxed text-[var(--q-text-3)]">
                Si la vérification ne repart pas, annulez ce raccordement et recommencez. Aucune facture n&apos;est perdue.
              </p>
              <button type="button" className="q-btn q-btn-ghost self-start" onClick={onRemove} disabled={busy}>
                <Undo2 aria-hidden />
                Annuler et recommencer
              </button>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

function DirectoryMissingView({ view, hrefs, busy, onRefresh }: { view: EInvoicingView; hrefs: HubHrefs; busy?: boolean; onRefresh: (sync?: boolean) => void }) {
  const c = view.connection!
  const company = view.companyName ?? "Mon entreprise"
  const siren = view.siren ?? "[SIREN]"
  const message = `Objet : adresse de facturation électronique absente de l'annuaire

Madame, Monsieur,

Mon entreprise, ${company} (SIREN ${siren}), a désigné la plateforme agréée ${SUPERPDP_LABEL} pour recevoir ses factures électroniques.

L'adresse de facturation électronique ${c.address ?? siren} ne figure pas dans l'annuaire de la facturation électronique. Pourriez-vous vérifier que mon entreprise est bien enregistrée comme assujettie à la TVA et, si oui, faire le nécessaire pour qu'elle apparaisse dans l'annuaire ?

Je reste à votre disposition pour tout justificatif.

Cordialement,
${company}`
  return (
    <div className="flex flex-col gap-6">
      <Stepper current="active" />
      <header className="flex flex-col gap-3">
        <StatusPill tone="warn" className="self-start">Annuaire : adresse introuvable</StatusPill>
        <TwoVoice first="Votre entreprise n'apparaît pas" accent="dans l'annuaire" />
        <p className="max-w-2xl text-[15px] leading-relaxed text-[var(--q-text-3)]">
          Le raccordement chez {SUPERPDP_LABEL} est terminé, mais l&apos;annuaire de la facturation électronique ne
          contient pas encore votre adresse. Tant qu&apos;elle n&apos;y figure pas, vos fournisseurs ne peuvent pas vous
          envoyer de factures par la plateforme. Le plus souvent, l&apos;entreprise n&apos;est pas enregistrée comme
          assujettie à la TVA : c&apos;est votre service des impôts des entreprises qui corrige.
        </p>
      </header>
      <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
        <section className="q-card flex flex-col gap-5 p-5 md:p-6">
          <ProgressList view={view} />
          <ol className="flex flex-col gap-3 text-sm leading-relaxed text-[var(--q-text-2)]">
            <li><strong>1. Copiez le message type</strong> : il contient déjà votre SIREN, votre adresse et la plateforme choisie.</li>
            <li><strong>2. Envoyez-le à votre service des impôts des entreprises</strong>, par la messagerie de votre espace professionnel sur impots.gouv.fr.</li>
            <li><strong>3. Revenez vérifier ici</strong> : Qonforme vérifie l&apos;annuaire régulièrement et vous écrit quand la réception est active.</li>
          </ol>
          <div className="flex flex-wrap gap-3">
            <CopyButton text={message} label="Copier le message type" />
            <button type="button" className="q-btn q-btn-secondary q-btn-sm" onClick={() => onRefresh(false)} disabled={busy}>
              <RefreshCw className={cn(busy && "animate-spin")} aria-hidden />
              Vérifier maintenant
            </button>
          </div>
        </section>
        <section className="q-card flex flex-col gap-3 p-5 md:p-6">
          <h2 className="q-h2">Message type</h2>
          <pre className="whitespace-pre-wrap rounded-xl border border-[var(--q-line)] bg-[var(--q-surface-2)] p-4 font-sans text-[13px] leading-relaxed text-[var(--q-text-2)]">{message}</pre>
          <Link href={hrefs.importHref} className="q-link text-sm">En attendant, importer une facture reçue autrement</Link>
        </section>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Planche 6 : réception active                                          */
/* ------------------------------------------------------------------ */

function ActiveView({ view, hrefs, busy, onRefresh }: { view: EInvoicingView; hrefs: HubHrefs; busy?: boolean; onRefresh: (sync?: boolean) => void }) {
  const c = view.connection!
  const company = view.companyName ?? "Mon entreprise"
  const address = c.address ?? ""
  const supplierMessage = `Bonjour,

Merci d'envoyer désormais vos factures par la plateforme agréée ${SUPERPDP_LABEL}, à l'adresse de facturation électronique ${address}.

Cordialement,
${company}`
  return (
    <div className="flex flex-col gap-6">
      <Stepper current="active" done />
      <header className="flex flex-col gap-3">
        <StatusPill tone="ok" icon={<BadgeCheck strokeWidth={2.25} aria-hidden />} className="self-start">Réception active</StatusPill>
        <TwoVoice first="Vos factures arrivent" accent="toutes seules" />
        <p className="max-w-2xl text-[15px] leading-relaxed text-[var(--q-text-3)]">
          Qonforme est raccordé à {SUPERPDP_LABEL}. Les factures que vos fournisseurs vous envoient par la plateforme
          apparaissent dans « Factures reçues », avec leur fichier d&apos;origine.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div className="flex flex-col gap-4">
          <section className="q-card flex flex-col gap-3 p-5 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="q-eyebrow">Votre adresse de facturation électronique</span>
              {view.mode === "live" && <StatusPill tone="ok">Enregistrée dans l&apos;annuaire</StatusPill>}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="q-mono break-all text-[22px] font-medium text-[var(--q-ink)]">{address || "—"}</span>
              {address && <CopyButton text={address} />}
            </div>
            <p className="text-[13px] leading-relaxed text-[var(--q-text-3)]">
              Vos fournisseurs retrouvent cette adresse dans l&apos;annuaire. Vous n&apos;avez rien à leur communiquer,
              mais vous pouvez les prévenir avec le message ci-dessous.
            </p>
          </section>

          {view.received.total === 0 ? (
            <section className="q-card">
              <EmptyState
                className="py-10"
                icon={<Inbox className="size-5" aria-hidden />}
                title="Aucune facture reçue pour l'instant"
                text="Les prochaines factures de vos fournisseurs s'afficheront dès qu'elles seront arrivées sur la plateforme."
                action={<Link href={hrefs.received} className="q-btn q-btn-secondary">Ouvrir « Factures reçues »</Link>}
              />
            </section>
          ) : (
            <section className="q-card flex flex-wrap items-center justify-between gap-3 p-5">
              <div className="flex flex-col">
                <span className="text-[15px] font-semibold text-[var(--q-ink)]">
                  {view.received.total} facture{view.received.total > 1 ? "s" : ""} reçue{view.received.total > 1 ? "s" : ""} par la plateforme
                </span>
                <span className="text-[13px] text-[var(--q-text-3)]">dont {view.received.thisMonth} ce mois-ci</span>
              </div>
              <Link href={hrefs.received} className="q-btn q-btn-primary">Ouvrir « Factures reçues »<ArrowRight aria-hidden /></Link>
            </section>
          )}

          <section className="q-card flex flex-col gap-3 p-5 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="q-h2">Prévenir vos fournisseurs</h2>
              <CopyButton text={supplierMessage} label="Copier le message" />
            </div>
            <pre className="whitespace-pre-wrap rounded-xl border border-[var(--q-line)] bg-[var(--q-surface-2)] p-4 font-sans text-[13px] leading-relaxed text-[var(--q-text-2)]">{supplierMessage}</pre>
          </section>
        </div>

        <div className="flex flex-col gap-4">
          <section className="q-card flex flex-col gap-4 p-5">
            <Facts rows={[
              { label: "Plateforme", value: SUPERPDP_LABEL },
              { label: "Entreprise", value: company },
              { label: "Dernière relève", value: fmtDayTime(c.lastSyncAt) },
              { label: "Active depuis", value: fmtDay(c.activeSince) },
            ]} />
            <button type="button" className="q-btn q-btn-secondary self-start" onClick={() => onRefresh(true)} disabled={busy}>
              <RefreshCw className={cn(busy && "animate-spin")} aria-hidden />
              Relever maintenant
            </button>
            {c.lastSyncError && <p className="text-[13px] text-[var(--q-warn)]">La dernière relève n&apos;a pas abouti. Qonforme réessaie tout seul.</p>}
          </section>
          <section className="q-card flex flex-col gap-2.5 p-5">
            <h2 className="q-h2">Et pour vos ventes ?</h2>
            <p className="text-sm leading-relaxed text-[var(--q-text-3)]">
              L&apos;envoi de vos factures par la plateforme est prévu pour 2027. D&apos;ici là, vos factures partent par
              email, comme aujourd&apos;hui.
            </p>
          </section>
          <p className="text-[13px] text-[var(--q-text-4)]">{INCLUDED}. <Link href={hrefs.settings} className="q-link">Notifications et réglages</Link></p>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Planche 9 : abonnement arrêté                                         */
/* ------------------------------------------------------------------ */

function StoppedView({ view, hrefs }: { view: EInvoicingView; hrefs: HubHrefs }) {
  const c = view.connection!
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <StatusPill tone="warn" icon={<Pause strokeWidth={2.25} aria-hidden />} className="self-start">Réception suspendue</StatusPill>
        <TwoVoice first="Votre abonnement est" accent="arrêté" />
        <p className="max-w-2xl text-[15px] leading-relaxed text-[var(--q-text-3)]">
          Sans Essentiel, Qonforme ne relève plus vos factures reçues sur {SUPERPDP_LABEL}. Tout ce que vous avez déjà
          reçu reste ici, consultable et exportable.
        </p>
      </header>
      <div className="q-banner q-banner-warn">
        <AlertTriangle className="mt-0.5 size-[18px] shrink-0" aria-hidden />
        <span>Pour ne manquer aucune facture fournisseur, reprenez Essentiel ou désignez une autre plateforme agréée.</span>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <section className="q-card p-5">
              <h2 className="q-h2">Ce qui continue</h2>
              <ul className="mt-3 flex flex-col gap-2 text-sm leading-relaxed text-[var(--q-text-2)]">
                <li>Consulter vos {view.received.total} facture{view.received.total > 1 ? "s" : ""} reçue{view.received.total > 1 ? "s" : ""} et leurs fichiers d&apos;origine.</li>
                <li>Les exporter pour votre comptable.</li>
                <li>Importer à la main une facture reçue autrement.</li>
              </ul>
            </section>
            <section className="q-card p-5">
              <h2 className="q-h2">Ce qui est suspendu</h2>
              <ul className="mt-3 flex flex-col gap-2 text-sm leading-relaxed text-[var(--q-text-2)]">
                <li>La relève automatique des nouvelles factures.</li>
                <li>Les décisions transmises au fournisseur (prise en charge, refus).</li>
                <li>Les emails de résumé.</li>
              </ul>
            </section>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href={hrefs.pricing} className="q-btn q-btn-primary q-btn-lg">Reprendre Essentiel</Link>
            <Link href={hrefs.received} className="q-btn q-btn-secondary q-btn-lg">Voir mes factures reçues</Link>
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <section className="q-card flex flex-col gap-4 p-5">
            <h2 className="q-h2">État du raccordement</h2>
            <Facts rows={[
              { label: "Plateforme", value: SUPERPDP_LABEL },
              { label: "Adresse", value: c.address ?? "—", mono: true },
              { label: "Dernière relève", value: fmtDay(c.lastSyncAt) },
            ]} />
          </section>
          <section className="q-card flex flex-col gap-2.5 p-5">
            <h2 className="q-h2">Retirer l&apos;autorisation</h2>
            <p className="text-sm leading-relaxed text-[var(--q-text-3)]">
              Si vous ne reprenez pas Essentiel, vous pouvez retirer l&apos;autorisation donnée à Qonforme dans
              Paramètres, ou depuis votre compte {SUPERPDP_LABEL}.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link href={hrefs.settings} className="q-btn q-btn-secondary q-btn-sm">Paramètres</Link>
              <a href={SUPERPDP_SITE} target="_blank" rel="noopener noreferrer" className="q-btn q-btn-ghost q-btn-sm">Ouvrir {SUPERPDP_LABEL}<ExternalLink aria-hidden /></a>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Raccordement pas encore proposé                                       */
/* ------------------------------------------------------------------ */

function NotAvailableView({ hrefs, todayLabel }: { hrefs: HubHrefs; todayLabel: string | null }) {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <TwoVoice first="Facturation électronique" accent="2026" />
        <p className="max-w-2xl text-[15px] leading-relaxed text-[var(--q-text-3)]">
          Le raccordement automatique à {SUPERPDP_LABEL} n&apos;est pas encore ouvert sur votre compte. En attendant,
          importez les factures que vos fournisseurs vous envoient : elles sont lues, contrôlées et suivies jusqu&apos;au
          paiement.
        </p>
      </header>
      <ImportCard href={hrefs.importHref} />
      <ReformTimeline today={todayLabel} />
    </div>
  )
}

/* ------------------------------------------------------------------ */

export function EInvoicingHub(p: EInvoicingHubProps) {
  const [step, setStep] = useState<"avant" | null>(p.initialStep ?? null)

  if (p.loading && !p.view) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <div className="q-shimmer h-10 w-2/3 rounded-xl" />
        <div className="q-shimmer h-48 rounded-2xl" />
      </div>
    )
  }
  if (p.error && !p.view) {
    return (
      <section className="q-card">
        <EmptyState
          className="py-14"
          icon={<CircleSlash className="size-5" aria-hidden />}
          title="Page indisponible pour le moment"
          text={p.error}
          action={<button type="button" className="q-btn q-btn-secondary" onClick={p.onRetry}>Réessayer</button>}
        />
      </section>
    )
  }
  const view = p.view!
  const c = view.connection

  let body: React.ReactNode
  if (!c && !view.available) body = <NotAvailableView hrefs={p.hrefs} todayLabel={p.todayLabel} />
  else if (!c && step === "avant" && view.hasPlan) body = <BeforeView view={view} hrefs={p.hrefs} onBack={() => setStep(null)} />
  else if (!c) body = <ActivateView view={view} hrefs={p.hrefs} todayLabel={p.todayLabel} onStart={() => setStep("avant")} />
  else if (!view.hasPlan && c.status !== "refused") body = <StoppedView view={view} hrefs={p.hrefs} />
  else if (c.status === "active") body = <ActiveView view={view} hrefs={p.hrefs} busy={p.busy} onRefresh={p.onRefresh} />
  else if (c.status === "directory_missing") body = <DirectoryMissingView view={view} hrefs={p.hrefs} busy={p.busy} onRefresh={p.onRefresh} />
  else body = <PendingView view={view} hrefs={p.hrefs} busy={p.busy} onRefresh={p.onRefresh} onRemove={p.onRemove} />

  return (
    <div className="flex flex-col gap-5">
      {view.mode === "test" && (
        <div className="q-banner q-banner-warn">
          <ShieldCheck className="mt-0.5 size-[18px] shrink-0" aria-hidden />
          <span>Compte d&apos;essai : raccordement au bac à sable de {SUPERPDP_LABEL}, avec des entreprises et des factures fictives.</span>
        </div>
      )}
      {p.notice && <Notice notice={p.notice} />}
      {body}
      {view.available && (
        <p className="flex items-start gap-1.5 text-[12px] leading-relaxed text-[var(--q-text-4)]">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          La vérification de votre identité se fait sur le site de {SUPERPDP_LABEL} : Qonforme ne voit jamais votre pièce d&apos;identité.
        </p>
      )}
    </div>
  )
}
