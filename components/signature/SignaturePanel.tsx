"use client"

/**
 * Panneau « Signature en ligne » des fiches devis et bon de commande
 * (canevas « Signature en ligne » : panneau, fenêtre « Partager pour
 * signature », signature sur place, preuve). Même composant pour l'application
 * et la démo.
 *
 * - Compte gratuit : badge « Avec Essentiel », mur de paiement au clic
 *   (DECISIONS § 12, point 4). L'accord sur papier reste possible.
 * - Lien actif : envoyé, consulté (combien de fois), expiration ; partager,
 *   faire signer sur place, nouveau lien, désactiver.
 * - Signé : signataire, date, méthode, PDF signé et dossier de preuve.
 * - Refusé : motif et message du client.
 */
import { useState } from "react"
import Link from "next/link"
import {
  Ban, CheckCircle2, ChevronDown, Copy, Download, ExternalLink, KeyRound, Link2, Loader2, Mail, PenLine,
  RefreshCw, Send, Share2, ShieldCheck, Smartphone, XCircle,
} from "lucide-react"
import { toast } from "sonner"
import { StatusPill, type Tone } from "@/components/app/kit"
import { Act, DocModal, InfoNote, RecipientBox, useIsCompact } from "@/components/purchase-orders/detail-bits"
import { dateTime, longDate } from "@/components/quotes/QuoteListHelpers"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/utils/invoice"
import { EVENT_LABELS, LINK_STATE_LABELS, isLinkActionable, refusalLabel, withdrawalDeadline } from "@/lib/signature/rules"
import type { LinkState, SignatureDocType, SignaturePanelData } from "@/lib/signature/types"

export interface SignaturePanelActions {
  /** Crée ou reprend le lien de signature ; renvoie son adresse. */
  link: () => Promise<string | null>
  /** Envoie au client l'email « Consulter et signer ». */
  send: () => Promise<boolean>
  renew: () => Promise<string | null>
  disable: () => Promise<boolean>
  downloadSigned: () => void
  /** Ouvre le mur de paiement (compte gratuit). */
  upgrade: () => void
  /** Ouvre la page de signature sur cet appareil, en mode « sur place ». */
  onSite: (url: string) => void
}

const STATE_TONE: Record<LinkState, Tone> = {
  ready: "neutral", sent: "info", viewed: "info", signed: "ok", refused: "danger", expired: "warn", superseded: "neutral", disabled: "neutral",
}

export function SignaturePanel({
  docType, docNumber, docStatus, totalTtc, validUntil, today, clientName, clientEmail, clientHref,
  data, busy, actions, settingsHref, demo = false, previewHref,
}: {
  /** Démo : lien vers la page de signature telle que la voit le client. */
  previewHref?: string
  docType: SignatureDocType
  docNumber: string
  docStatus: string
  totalTtc: number
  validUntil?: string | null
  /** AAAA-MM-JJ : date du navigateur, ou date fixe de la démo. */
  today: string
  clientName: string | null
  clientEmail: string | null
  clientHref?: string | null
  data: SignaturePanelData
  busy: string | null
  actions: SignaturePanelActions
  settingsHref: string
  demo?: boolean
}) {
  const compact = useIsCompact()
  const [modal, setModal] = useState<"share" | "onsite" | "disable" | "renew" | null>(null)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [proofOpen, setProofOpen] = useState(false)

  const isQuote = docType === "quote"
  const theDoc = isQuote ? "le devis" : "le bon de commande"
  const link = data.link
  const state = link?.state ?? null
  const active = state ? isLinkActionable(state) : false
  const quoteExpired = isQuote && !!validUntil && validUntil < today
  const waiting = docStatus === "draft" || docStatus === "sent"
  const canStart = data.enabled && waiting && !quoteExpired
  // Lien à partager : celui qui vient d'être créé, sinon le lien de signature actif.
  // Un lien de consultation seule (envoyé sans formule) sera remplacé par un lien de signature.
  const url = shareUrl ?? (active && link?.mode === "sign" ? link.url : null)

  const close = () => setModal(null)

  /* ── Actions ── */
  const openShare = () => {
    if (!data.access) { actions.upgrade(); return }
    setShareUrl(null)
    setModal("share")
  }
  const getLink = async (): Promise<string | null> => {
    if (url) return url
    const u = await actions.link()
    if (u) setShareUrl(u)
    return u
  }
  const copy = async () => {
    const u = await getLink()
    if (!u) return
    try {
      await navigator.clipboard.writeText(u)
      toast.success("Lien copié")
    } catch {
      toast("Copiez le lien affiché dans la fenêtre")
    }
  }
  const shareNative = async () => {
    const u = await getLink()
    if (!u) return
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ title: `${isQuote ? "Devis" : "Bon de commande"} ${docNumber}`, text: `Votre ${isQuote ? "devis" : "bon de commande"} ${docNumber} à consulter et signer en ligne :`, url: u })
      } catch { /* partage annulé */ }
    } else {
      await copy()
    }
  }
  const sendEmail = async () => {
    if (await actions.send()) close()
  }
  const startOnSite = async () => {
    const u = await getLink()
    if (u) actions.onSite(u)
  }

  /* ── Rendu ── */
  return (
    <section aria-label="Signature en ligne" className="q-card flex flex-col gap-3 p-[18px] print:hidden">
      <div className="flex items-center justify-between gap-2.5">
        <h2 className="q-h2 flex items-center gap-2"><PenLine className="size-4 text-[var(--q-accent-strong)]" aria-hidden />Signature en ligne</h2>
        {!data.access
          ? <span className="q-pill q-pill-info">Avec Essentiel</span>
          : state && <StatusPill tone={STATE_TONE[state]}>{LINK_STATE_LABELS[state]}{state === "viewed" && link ? ` · ${link.view_count}×` : ""}</StatusPill>}
      </div>

      {/* Compte gratuit */}
      {!data.access && (state !== "signed" && state !== "refused") && (
        <>
          <p className="text-[13px] leading-normal text-[var(--q-text-3)]">
            Avec Essentiel, votre client lit {theDoc} en entier et le signe en ligne, sur ordinateur ou téléphone.
            {isQuote ? " Le devis passe en « Accepté » tout seul" : " La commande est confirmée toute seule"}, avec un dossier de preuve.
          </p>
          <p className="text-[13px] leading-normal text-[var(--q-text-4)]">
            Aujourd&apos;hui, {theDoc} part par email avec son PDF et un lien de consultation ; vous enregistrez l&apos;accord de votre client à la main.
          </p>
          <div className="flex flex-wrap gap-2">
            <Act label="Découvrir Essentiel" icon={ShieldCheck} size="sm" onClick={actions.upgrade} />
          </div>
        </>
      )}

      {/* Formule active mais signature coupée dans les réglages */}
      {data.access && !data.enabled && !link && (
        <p className="text-[13px] leading-normal text-[var(--q-text-3)]">
          La signature en ligne est désactivée.{" "}
          <Link href={settingsHref} className="q-link font-semibold">Paramètres › Modèles de documents</Link>
        </p>
      )}

      {/* Pas de lien actif : proposer l'envoi */}
      {data.access && (!link || (!active && state !== "signed" && state !== "refused")) && (data.enabled || link) && (
        <>
          {link && state && (
            <p className="text-[13px] text-[var(--q-text-4)]">
              Dernier lien : {LINK_STATE_LABELS[state].toLowerCase()}
              {state === "expired" ? ` le ${dateTime(link.expires_at)}` : ""}.
            </p>
          )}
          {canStart ? (
            <>
              <p className="text-[13px] leading-normal text-[var(--q-text-3)]">
                Votre client lit {theDoc} en entier, puis le signe en ligne ou le refuse. {isQuote ? "Le devis passe alors en « Accepté »" : "La commande est alors confirmée"} et vous êtes prévenu par email.
              </p>
              <div className="flex flex-wrap gap-2">
                <Act label="Envoyer pour signature" icon={Send} variant="primary" size="sm" onClick={openShare} loading={busy === "send"} />
                <Act label="Faire signer sur place" icon={Smartphone} size="sm" onClick={() => setModal("onsite")} />
              </div>
            </>
          ) : (
            <p className="text-[13px] leading-normal text-[var(--q-text-3)]">
              {quoteExpired && waiting
                ? "Ce devis a expiré : dupliquez-le pour proposer une version à jour, puis envoyez-la pour signature."
                : `${isQuote ? "Ce devis" : "Ce bon de commande"} n'attend plus de signature.`}
            </p>
          )}
        </>
      )}

      {/* Lien actif */}
      {link && active && (
        <>
          <dl className="flex flex-col gap-1.5 text-[13px]">
            <Row label="Envoi">{link.sent_at ? `${dateTime(link.sent_at)}${link.sent_to ? ` · ${link.sent_to}` : ""}` : "Lien prêt, pas encore envoyé par email"}</Row>
            <Row label="Consultation">{link.view_count > 0 && link.last_viewed_at ? `${link.view_count} fois · dernière le ${dateTime(link.last_viewed_at)}` : "Pas encore ouvert"}</Row>
            <Row label="Expiration">{dateTime(link.expires_at)}</Row>
            {link.mode === "sign" && <Row label="Code par email">{link.code_required ? "Oui, demandé à la signature" : "Non"}</Row>}
            {link.mode === "view" && <Row label="Type">Consultation seule</Row>}
          </dl>
          <div className="flex flex-wrap gap-2">
            {link.mode === "sign" || data.access ? (
              <>
                <Act label="Partager" icon={Share2} variant="primary" size="sm" onClick={openShare} />
                <Act label="Sur place" icon={Smartphone} size="sm" onClick={() => (data.access ? setModal("onsite") : actions.upgrade())} />
              </>
            ) : null}
            {link.url && link.mode === "sign" && (
              <Act label="Copier le lien" icon={Copy} size="sm" onClick={() => void copy()} />
            )}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {data.access && (
              <button type="button" onClick={() => setModal("renew")} className="q-link min-h-[36px] text-[13px] font-semibold">Nouveau lien</button>
            )}
            <button type="button" onClick={() => setModal("disable")} className="min-h-[36px] text-[13px] font-semibold text-[var(--q-danger)] hover:underline">Désactiver le lien</button>
          </div>
        </>
      )}

      {/* Signé */}
      {link && state === "signed" && (
        <>
          <div className="flex items-start gap-2.5 rounded-[14px] border border-[var(--q-ok-line)] bg-[var(--q-ok-bg)] px-3.5 py-3 text-[14px] leading-normal text-[var(--q-ok)]">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              <strong className="font-semibold">Signé par {link.signer_name}</strong>
              {link.signer_role ? `, ${link.signer_role}` : ""}{link.signer_company ? ` (${link.signer_company})` : ""}
              {link.signed_at ? ` le ${dateTime(link.signed_at)}` : ""}.
            </span>
          </div>
          <dl className="flex flex-col gap-1.5 text-[13px]">
            <Row label="Méthode">{link.signature_method === "drawn" ? "Signature tracée" : "Nom tapé"}{link.code_required ? " · code email vérifié" : ""}</Row>
            <Row label="Lieu">{link.signature_context === "in_person" ? "Sur place, sur votre appareil" : "À distance, par le lien"}</Row>
            {link.client_order_number && <Row label="N° de commande"><span className="font-mono">{link.client_order_number}</span></Row>}
            {link.consents?.reduced_vat_certified && <Row label="TVA réduite">Certifiée par le client</Row>}
            {link.client_kind === "consumer" && link.signed_at && (
              <Row label="Rétractation">
                Jusqu&apos;au {longDate(withdrawalDeadline(new Date(link.signed_at)))}
                {link.consents?.early_start_requested ? " · démarrage anticipé demandé" : " · pas de démarrage anticipé"}
              </Row>
            )}
          </dl>
          {link.client_kind === "consumer" && link.signature_context === "in_person" && (
            <InfoNote>Signé sur place chez un particulier : aucun paiement ne peut être demandé avant 7 jours.</InfoNote>
          )}
          <div className="flex flex-wrap gap-2">
            <Act label="PDF signé" icon={Download} variant="primary" size="sm" onClick={actions.downloadSigned} loading={busy === "pdf"} />
          </div>
          <button
            type="button"
            onClick={() => setProofOpen((o) => !o)}
            aria-expanded={proofOpen}
            className="flex min-h-[40px] items-center gap-1.5 self-start text-[13px] font-semibold text-[var(--q-accent-strong)]"
          >
            <ChevronDown className={cn("size-4 transition-transform", proofOpen && "rotate-180")} aria-hidden />
            Dossier de preuve
          </button>
          {proofOpen && (
            <div className="q-inset flex flex-col gap-2 p-3 text-[12px] text-[var(--q-text-3)]">
              <span>Email : <span className="break-all">{link.signer_email}</span></span>
              {link.signer_ip && <span>Adresse IP : <span className="font-mono">{link.signer_ip}</span></span>}
              {link.document_sha256 && <span>Empreinte SHA-256 : <span className="break-all font-mono">{link.document_sha256}</span></span>}
              {link.events.length > 0 && (
                <ol className="m-0 flex list-none flex-col gap-1 border-t border-[var(--q-line-soft)] p-0 pt-2">
                  {link.events.map((e, i) => (
                    <li key={i} className="flex justify-between gap-3">
                      <span>{EVENT_LABELS[e.type] ?? e.type}</span>
                      <span className="shrink-0 tabular-nums text-[var(--q-text-4)]">{dateTime(e.created_at)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </>
      )}

      {/* Refusé */}
      {link && state === "refused" && (
        <div className="flex items-start gap-2.5 rounded-[14px] border border-[var(--q-line)] bg-[var(--q-surface-2)] px-3.5 py-3 text-[14px] leading-normal text-[var(--q-text-2)]">
          <XCircle className="mt-0.5 size-4 shrink-0 text-[var(--q-danger)]" aria-hidden />
          <span className="flex min-w-0 flex-col gap-1">
            <span>
              <strong className="font-semibold text-[var(--q-ink)]">Refusé{link.signer_name ? ` par ${link.signer_name}` : ""}</strong>
              {link.refused_at ? ` le ${dateTime(link.refused_at)}` : ""} · {refusalLabel(link.refusal_reason).toLowerCase()}
            </span>
            {link.refusal_message && <span className="whitespace-pre-line break-words text-[13px] text-[var(--q-text-3)]">« {link.refusal_message} »</span>}
          </span>
        </div>
      )}

      {demo && previewHref && (
        <Link href={previewHref} className="q-link inline-flex min-h-[36px] items-center gap-1.5 self-start text-[13px] font-semibold">
          <ExternalLink className="size-4" aria-hidden />
          Voir la page de votre client
        </Link>
      )}

      {/* ── Fenêtre « Partager pour signature » ── */}
      <DocModal
        open={modal === "share"}
        onOpenChange={(o) => !o && close()}
        compact={compact}
        title="Partager pour signature"
        description={`${docNumber} · ${formatCurrency(totalTtc)} TTC`}
        actions={[
          {
            label: busy === "send" ? "Envoi…" : "Envoyer par email",
            icon: busy === "send" ? <Loader2 className="animate-spin" aria-hidden /> : <Mail aria-hidden />,
            variant: "primary",
            onClick: () => void sendEmail(),
            disabled: !!busy || !clientEmail,
          },
        ]}
      >
        <RecipientBox name={clientName} email={clientEmail} clientHref={clientHref} />
        <p className="text-sm leading-relaxed text-[var(--q-text-3)]">
          L&apos;email contient le PDF et un bouton « Consulter et signer ». Votre client signe en traçant sa signature ou en tapant son nom
          {data.client_kind === "business" ? ", avec sa fonction et son numéro de commande s'il en a un" : ""}.
          {docStatus === "draft" && <> {isQuote ? "Le devis" : "Le bon"} passe au statut <strong className="font-semibold text-[var(--q-ink)]">Envoyé</strong> et ne se modifie plus.</>}
        </p>
        <div className="flex flex-col gap-2 border-t border-[var(--q-line-soft)] pt-3">
          <span className="q-label">Ou partagez le lien vous-même (SMS, WhatsApp…)</span>
          {url ? (
            <div className="flex gap-2">
              <input readOnly value={url} aria-label="Lien de signature" onFocus={(e) => e.currentTarget.select()} className="q-input flex-1 font-mono text-base md:text-[13px]" />
              <button type="button" onClick={() => void copy()} className="q-btn q-btn-secondary h-[42px]"><Copy aria-hidden />Copier</button>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {!url && <Act label="Créer le lien" icon={Link2} size="sm" onClick={() => void getLink()} loading={busy === "link"} />}
            <Act label="Partager…" icon={Share2} size="sm" onClick={() => void shareNative()} loading={busy === "link" && !!url} />
          </div>
          <p className="text-[12px] leading-normal text-[var(--q-text-4)]">
            Ce lien est personnel : il donne accès au document. {isQuote && validUntil ? `Il expire avec le devis, le ${longDate(validUntil)}.` : ""}
          </p>
        </div>
        {link?.code_required && (
          <p className="flex items-start gap-1.5 text-[13px] text-[var(--q-text-3)]">
            <KeyRound className="mt-0.5 size-4 shrink-0" aria-hidden />
            Un code à 6 chiffres sera envoyé à votre client par email pour signer (réglage dans Paramètres › Modèles de documents).
          </p>
        )}
      </DocModal>

      {/* ── Signature sur place ── */}
      <DocModal
        open={modal === "onsite"}
        onOpenChange={(o) => !o && close()}
        compact={compact}
        title="Faire signer sur place"
        description={`${docNumber}${clientName ? ` · ${clientName}` : ""}`}
        actions={[{
          label: busy === "link" ? "Préparation…" : "Ouvrir la page de signature",
          icon: busy === "link" ? <Loader2 className="animate-spin" aria-hidden /> : <ExternalLink aria-hidden />,
          variant: "primary",
          onClick: () => void startOnSite(),
          disabled: !!busy,
        }]}
      >
        <p className="text-sm leading-relaxed text-[var(--q-text-3)]">
          Tendez votre téléphone ou votre tablette à votre client : il lit {theDoc}, signe et reçoit son exemplaire par email.
        </p>
        {data.client_kind === "consumer" && (
          <InfoNote>
            Chez un particulier, le contrat est conclu hors établissement : il garde 14 jours pour se rétracter, et aucun paiement, même un acompte, ne peut être demandé avant 7 jours.
          </InfoNote>
        )}
        {docStatus === "draft" && <p className="text-[13px] text-[var(--q-text-4)]">{isQuote ? "Le devis" : "Le bon"} passe au statut Envoyé et ne se modifie plus.</p>}
      </DocModal>

      {/* ── Désactiver ── */}
      <DocModal
        open={modal === "disable"}
        onOpenChange={(o) => !o && close()}
        compact={compact}
        title="Désactiver le lien ?"
        description={docNumber}
        actions={[{
          label: busy === "disable" ? "Désactivation…" : "Désactiver",
          icon: busy === "disable" ? <Loader2 className="animate-spin" aria-hidden /> : <Ban aria-hidden />,
          variant: "danger",
          onClick: async () => { if (await actions.disable()) close() },
          disabled: !!busy,
        }]}
      >
        <p className="text-sm leading-relaxed text-[var(--q-text-3)]">
          Votre client ne pourra plus ouvrir ni signer {theDoc} avec ce lien. Vous pourrez en envoyer un nouveau.
        </p>
      </DocModal>

      {/* ── Nouveau lien ── */}
      <DocModal
        open={modal === "renew"}
        onOpenChange={(o) => !o && close()}
        compact={compact}
        title="Créer un nouveau lien ?"
        description={docNumber}
        actions={[{
          label: busy === "renew" ? "Création…" : "Créer un nouveau lien",
          icon: busy === "renew" ? <Loader2 className="animate-spin" aria-hidden /> : <RefreshCw aria-hidden />,
          variant: "primary",
          onClick: async () => { const u = await actions.renew(); if (u) { setShareUrl(u); setModal("share") } },
          disabled: !!busy,
        }]}
      >
        <p className="text-sm leading-relaxed text-[var(--q-text-3)]">
          L&apos;ancien lien ne fonctionnera plus : la page indiquera à votre client qu&apos;un lien plus récent lui a été envoyé.
        </p>
      </DocModal>
    </section>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="shrink-0 text-[var(--q-text-4)]">{label}</dt>
      <dd className="min-w-0 break-words text-right text-[var(--q-text-2)]">{children}</dd>
    </div>
  )
}
