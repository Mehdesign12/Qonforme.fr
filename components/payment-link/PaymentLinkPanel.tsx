"use client"

/**
 * Fiche facture, panneau « Paiement » : IBAN, lien de la page de règlement
 * (copier, ouvrir, désactiver) et bandeau « Virement déclaré par le client ».
 * Présentation seule, partagée par la fiche réelle (InvoiceDetail, API
 * /api/invoices/[id]/payment-link) et la démo (lib/demo/payment-link.ts).
 *
 * Un virement déclaré ne marque jamais la facture payée : l'artisan vérifie
 * son compte puis confirme « Marquer payée ».
 */
import Link from "next/link"
import { toast } from "sonner"
import { AlertTriangle, Ban, Copy, CreditCard, ExternalLink, Eye, Landmark, Link2, Loader2, XCircle } from "lucide-react"
import { formatCurrency } from "@/lib/utils/invoice"
import type { InvoiceStatus } from "@/types"
import type { ArtisanDeclaration, PaymentLinkState } from "@/lib/payment-link/types"
import { isPayableStatus } from "@/lib/payment-link/rules"
import { formatIban, longDate, shortDate } from "@/components/invoices/invoice-view"
import { parisDay, parisTime } from "@/lib/payment-link/rules"

export interface PaymentLinkHandlers {
  create: () => void
  disable: () => void
  enable: () => void
  busy?: boolean
}

/** Adresse absolue (la démo fournit un chemin relatif). */
/** « 9 oct. à 18:12 » (heure de Paris). */
function shortDayTime(iso: string): string {
  const t = parisTime(iso)
  return `${shortDate(parisDay(iso))}${t ? ` à ${t}` : ""}`
}

function absolute(url: string): string {
  if (/^https?:\/\//.test(url) || typeof window === "undefined") return url
  return `${window.location.origin}${url}`
}

function copyText(value: string, done: string) {
  if (!navigator.clipboard) { toast.error("Copie impossible sur ce navigateur"); return }
  navigator.clipboard.writeText(value).then(() => toast.success(done), () => toast.error("Copie impossible"))
}

export function PaymentLinkPanel({
  status, state, iban, settingsHref, handlers: h,
}: {
  status: InvoiceStatus
  state: PaymentLinkState
  /** IBAN de l'entreprise, affiché et copiable. */
  iban: string | null
  settingsHref: string
  handlers: PaymentLinkHandlers
}) {
  const open = isPayableStatus(status)

  return (
    <div className="flex flex-col gap-3">
      {/* IBAN */}
      {iban ? (
        <div className="q-inset flex items-center gap-2 py-1.5 pl-3 pr-1.5">
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-[11px] text-[var(--q-text-4)]">IBAN</span>
            <span className="truncate font-mono text-[13px] text-[var(--q-text-2)]">{formatIban(iban)}</span>
          </span>
          <button
            type="button"
            aria-label="Copier l'IBAN"
            title="Copier l'IBAN"
            className="q-btn q-btn-secondary q-btn-sm q-btn-icon shrink-0"
            onClick={() => copyText(iban.replace(/\s+/g, ""), "IBAN copié")}
          >
            <Copy aria-hidden />
          </button>
        </div>
      ) : (
        <p className="text-[13px] text-[var(--q-text-3)]">
          Aucun IBAN renseigné. <Link href={settingsHref} className="q-link">Ajoutez-le</Link> pour qu&apos;il figure sur vos
          factures et pour proposer à vos clients une page de règlement par virement.
        </p>
      )}
      {state.iban === "invalid" && (
        <p className="flex items-start gap-1.5 text-[13px] text-[var(--q-warn)]">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            Cet IBAN ne passe pas la clé de contrôle. <Link href={settingsHref} className="q-link">Corrigez-le</Link> pour
            proposer un lien de paiement.
          </span>
        </p>
      )}

      {/* Lien de paiement */}
      {state.iban === "ok" && status === "draft" && (
        <p className="q-field-hint">
          À l&apos;envoi, l&apos;email contiendra un lien vers une page de règlement : IBAN, montant et référence à copier,
          et un bouton pour vous signaler le virement.
        </p>
      )}
      {state.iban === "ok" && open && state.link && (
        <div className="flex flex-col gap-2">
          <div className="q-inset flex items-center gap-2 py-1.5 pl-3 pr-1.5">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-[11px] text-[var(--q-text-4)]">Lien de paiement</span>
              <span className="truncate font-mono text-[12px] text-[var(--q-text-2)]">{state.link.url.replace(/^https?:\/\//, "")}</span>
            </span>
            <a
              href={state.link.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Ouvrir la page de règlement"
              title="Ouvrir la page de règlement"
              className="q-btn q-btn-ghost q-btn-sm q-btn-icon shrink-0"
            >
              <ExternalLink aria-hidden />
            </a>
            <button
              type="button"
              className="q-btn q-btn-secondary q-btn-sm shrink-0"
              onClick={() => copyText(absolute(state.link!.url), "Lien de paiement copié")}
            >
              <Copy aria-hidden />
              Copier
            </button>
          </div>
          {state.views && (
            <p className="flex items-center gap-1.5 text-[13px] text-[var(--q-text-2)]">
              <Eye className="size-4 shrink-0 text-[var(--q-text-4)]" aria-hidden />
              {state.views.count > 0 && state.views.last
                ? <>Ouverte par votre client {state.views.count === 1 ? "1 fois" : `${state.views.count} fois`}, {state.views.count === 1 ? "le" : "dernière le"} {shortDayTime(state.views.last)}</>
                : <>Pas encore ouverte par votre client</>}
            </p>
          )}
          <p className="q-field-hint">
            Votre client y trouve l&apos;IBAN, le montant et la référence, et peut vous signaler son virement.
            Le lien figure dans l&apos;email d&apos;envoi.{" "}
            <button type="button" className="font-semibold text-[var(--q-text-3)] underline-offset-2 hover:underline" onClick={h.disable} disabled={h.busy}>
              Désactiver le lien
            </button>
          </p>
        </div>
      )}
      {state.iban === "ok" && open && !state.link && !state.disabledAt && (
        <button type="button" className="q-btn q-btn-secondary self-start" onClick={h.create} disabled={h.busy}>
          {h.busy ? <Loader2 className="animate-spin" aria-hidden /> : <Link2 aria-hidden />}
          Créer le lien de paiement
        </button>
      )}
      {state.iban === "ok" && open && !state.link && state.disabledAt && (
        <div className="flex flex-col gap-2">
          <p className="flex items-center gap-1.5 text-[13px] text-[var(--q-text-3)]">
            <Ban className="size-3.5 shrink-0" aria-hidden />
            Lien de paiement désactivé le {shortDate(parisDay(state.disabledAt))}.
          </p>
          <button type="button" className="q-btn q-btn-secondary self-start" onClick={h.enable} disabled={h.busy}>
            {h.busy ? <Loader2 className="animate-spin" aria-hidden /> : <Link2 aria-hidden />}
            Créer un nouveau lien
          </button>
          <p className="q-field-hint">L&apos;ancien lien reste inactif.</p>
        </div>
      )}
    </div>
  )
}

/** Bandeau de la fiche : virement signalé par le client, en attente de vérification. */
export function DeclarationBanner({
  declaration, onMarkPaid, onDismiss, busy,
}: {
  declaration: ArtisanDeclaration
  onMarkPaid: () => void
  onDismiss: () => void
  busy?: boolean
}) {
  const t = parisTime(declaration.declaredAt)
  return (
    <div className="q-banner q-banner-ok flex-wrap items-center print:hidden" role="status">
      <Landmark className="size-[18px] shrink-0 self-start" aria-hidden />
      {/* Base de 240 px : sur téléphone, les boutons passent dessous au lieu d'écraser le texte */}
      <div className="min-w-0 flex-1 basis-[240px]">
        <p className="font-semibold">
          Virement déclaré par le client le {longDate(parisDay(declaration.declaredAt), false)}{t ? ` à ${t}` : ""}
        </p>
        <p className="text-[13px] opacity-90">
          {formatCurrency(declaration.amount)} viré le {longDate(declaration.transferDate)}, selon le client.
          Vérifiez votre compte bancaire, puis marquez la facture payée à réception.
        </p>
        {declaration.note && (
          <p className="mt-1 whitespace-pre-line break-words text-[13px] opacity-90">« {declaration.note} »</p>
        )}
      </div>
      <div className="ml-[30px] flex shrink-0 flex-wrap gap-2 sm:ml-0">
        <button type="button" className="q-btn q-btn-secondary q-btn-sm" onClick={onDismiss} disabled={busy}>
          <XCircle aria-hidden />
          Pas reçu
        </button>
        <button type="button" className="q-btn q-btn-primary q-btn-sm" onClick={onMarkPaid} disabled={busy}>
          <CreditCard aria-hidden />
          Marquer payée
        </button>
      </div>
    </div>
  )
}
