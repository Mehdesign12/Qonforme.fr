"use client"

/**
 * Fenêtre « Envoyer la facture » (canevas, planches D14 et M13) : par la
 * plateforme agréée quand le client est dans l'annuaire de la facturation
 * électronique, sinon par email, comme avant. Les canaux viennent du serveur
 * (`/api/invoices/[id]/delivery`, lib/pa/delivery.ts) ; la route d'envoi refait
 * le contrôle. Tant que la plateforme n'est pas proposée, la fenêtre est celle
 * d'avant (email seul).
 */
import { useEffect, useId, useState } from "react"
import { Info, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { invoiceNumberLabel } from "@/lib/utils/document-numbering"
import { SUPERPDP_LABEL } from "@/lib/pa/superpdp/config"
import {
  normalizeAddress, PLATFORM_UNAVAILABLE_TEXT, type DeliveryChoice, type DeliveryOptions, type PlatformUnavailable,
} from "@/lib/pa/delivery"

/** Raisons qu'on ne dit pas à l'artisan raccordé (rien à faire de son côté). */
const SILENT_REASONS: readonly PlatformUnavailable[] = ["disabled", "not_installed"]

export interface SendInvoiceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoice: { id: string; invoice_number?: string | null; status: string; client?: { name?: string | null; email?: string | null } | null }
  companyName?: string | null
  loading: boolean
  onSend: (choice: DeliveryChoice) => void
  /** Canaux d'envoi ; par défaut, l'API. Null : email seul (démo, panne). */
  loadOptions?: (invoiceId: string) => Promise<DeliveryOptions | null>
}

async function fetchOptions(invoiceId: string): Promise<DeliveryOptions | null> {
  try {
    const res = await fetch(`/api/invoices/${invoiceId}/delivery`, { cache: "no-store" })
    if (!res.ok) return null
    const json = await res.json()
    return (json?.options as DeliveryOptions | undefined) ?? null
  } catch {
    return null
  }
}

export function SendInvoiceDialog({ open, onOpenChange, invoice, companyName, loading, onSend, loadOptions = fetchOptions }: SendInvoiceDialogProps) {
  const [options, setOptions] = useState<DeliveryOptions | null>(null)
  const [checking, setChecking] = useState(false)
  const [channel, setChannel] = useState<"platform" | "email">("email")
  const [address, setAddress] = useState("")
  const addressId = useId()

  useEffect(() => {
    if (!open) return
    let live = true
    setChecking(true)
    setOptions(null)
    setChannel("email")
    setAddress("")
    loadOptions(invoice.id)
      .then((o) => {
        if (!live) return
        setOptions(o)
        if (o?.platform.offered) {
          setChannel(o.recommended === "platform" ? "platform" : "email")
          setAddress(o.platform.defaultAddress ?? "")
        }
      })
      .finally(() => { if (live) setChecking(false) })
    return () => { live = false }
  }, [open, invoice.id, loadOptions])

  const draft = invoice.status === "draft"
  const email = invoice.client?.email?.trim() || null
  const platform = options?.platform.offered ? options.platform : null
  const viaPlatform = !!platform && channel === "platform"
  const chosenAddress = viaPlatform ? normalizeAddress(address) : null
  const reason = options && !options.platform.offered && options.connected && !SILENT_REASONS.includes(options.platform.reason)
    ? PLATFORM_UNAVAILABLE_TEXT[options.platform.reason]
    : null
  const canSend = !loading && !checking && (viaPlatform ? !!chosenAddress : !!email)
  const clientName = invoice.client?.name?.trim() || "Votre client"

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !loading) onOpenChange(false) }}>
      <DialogContent showCloseButton={!loading} className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto p-0 sm:max-w-[520px]">
        <div className="flex flex-col gap-1 px-[22px] pr-14 pt-5">
          <DialogTitle className="q-display text-[22px] leading-tight text-[var(--q-ink)]">{draft ? "Envoyer la facture" : "Renvoyer la facture"}</DialogTitle>
          <DialogDescription className="text-sm text-[var(--q-text-4)]">
            <span className={cn(invoice.invoice_number && "font-mono")}>{invoiceNumberLabel(invoice.invoice_number)}</span>
            {invoice.client?.name ? ` · ${invoice.client.name}` : ""}
          </DialogDescription>
        </div>

        <div className="flex flex-col gap-3.5 px-[22px] pb-5 pt-[18px]">
          {platform && (
            <div role="radiogroup" aria-label="Canal d'envoi" className="grid gap-2">
              <ChannelOption
                on={channel === "platform"}
                onSelect={() => setChannel("platform")}
                title="Par la plateforme agréée"
                badge="Recommandé"
                text={`Qonforme dépose la facture chez ${SUPERPDP_LABEL}, qui la transmet à la plateforme de votre client. Il la reçoit directement dans son logiciel.`}
              />
              <ChannelOption
                on={channel === "email"}
                onSelect={() => setChannel("email")}
                disabled={!email}
                title="Par email"
                text={email ? `Un email avec le PDF Factur-X, comme aujourd'hui, à ${email}.` : "Aucune adresse email : ajoutez-en une dans la fiche client."}
              />
            </div>
          )}

          {viaPlatform && platform && (
            <div className="q-inset flex flex-col gap-2 px-4 py-3.5 text-sm leading-relaxed text-[var(--q-text-2)]">
              {platform.addresses.length === 1 && !platform.manualEntry ? (
                <p>
                  Adresse de {clientName} dans l&apos;annuaire :{" "}
                  <span className="font-mono text-[var(--q-ink)]" data-replay-mask>{platform.addresses[0].identifier}</span>
                </p>
              ) : platform.addresses.length > 0 ? (
                <label className="flex flex-col gap-1.5" htmlFor={addressId}>
                  <span className="text-xs text-[var(--q-text-4)]">
                    {clientName} a plusieurs adresses dans l&apos;annuaire : choisissez celle qu&apos;il vous a donnée.
                  </span>
                  <select id={addressId} className="q-input font-mono" value={address} onChange={(e) => setAddress(e.target.value)} data-replay-mask>
                    {!platform.defaultAddress && <option value="">Choisir une adresse</option>}
                    {platform.addresses.map((a) => (
                      <option key={a.identifier} value={a.identifier}>{a.identifier}{a.main ? " (adresse principale)" : ""}</option>
                    ))}
                  </select>
                </label>
              ) : null}
              {platform.manualEntry && (
                <label className="flex flex-col gap-1.5" htmlFor={`${addressId}-manual`}>
                  <span className="text-xs text-[var(--q-text-4)]">
                    Bac à sable : saisissez l&apos;adresse de l&apos;entreprise d&apos;essai destinataire (ex. 0225:315143296_117728).
                  </span>
                  <input
                    id={`${addressId}-manual`}
                    className="q-input font-mono"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="0225:…"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </label>
              )}
            </div>
          )}

          {!viaPlatform && (
            <div className="q-inset px-4 py-3.5 text-sm leading-relaxed text-[var(--q-text-2)]">
              {email ? (
                <span className="mb-1.5 block text-xs text-[var(--q-text-4)]">À : {email}</span>
              ) : (
                <span className="mb-1.5 block text-xs text-[var(--q-danger)]">Aucune adresse email : ajoutez-en une dans la fiche client</span>
              )}
              Objet : <span className="font-medium text-[var(--q-ink)]">Facture {invoice.invoice_number ?? "(numéro attribué à l’envoi)"} — {companyName ?? "votre entreprise"}</span>
            </div>
          )}

          {reason && !platform && <p className="text-[13px] leading-snug text-[var(--q-text-4)]">{reason}</p>}

          <div className="q-banner text-[13px] leading-normal">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            {draft ? (
              <p>
                {viaPlatform
                  ? "La facture part avec son fichier Factur-X."
                  : "Le PDF de la facture est joint à l'email et une copie vous est adressée."}
                {!invoice.invoice_number && " La facture reçoit son numéro définitif, à la date du jour."}
                {" "}Elle passe au statut <strong>Envoyée</strong> : elle ne pourra plus être modifiée. Une erreur se corrige par un avoir.
              </p>
            ) : (
              <p>
                {viaPlatform
                  ? "La facture est transmise par la plateforme agréée."
                  : "Une copie de la facture et de son PDF est renvoyée à votre client, avec une copie pour vous."}
                {" "}Son numéro et son statut ne changent pas.
              </p>
            )}
          </div>
        </div>

        <div
          className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--q-line-soft)] bg-[var(--q-surface-2)] px-[22px] py-4"
          style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom, 16px))" }}
        >
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>Annuler</Button>
          <Button
            onClick={() => onSend(viaPlatform && chosenAddress ? { channel: "platform", address: chosenAddress } : { channel: "email" })}
            disabled={!canSend}
          >
            <Send />
            {loading ? "Envoi en cours…" : viaPlatform ? "Envoyer par la plateforme" : draft ? "Envoyer" : "Renvoyer"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ChannelOption({ on, onSelect, title, text, badge, disabled }: {
  on: boolean
  onSelect: () => void
  title: string
  text: string
  badge?: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex min-w-0 items-start gap-2.5 rounded-xl border bg-[var(--q-surface)] px-3.5 py-3 text-left transition-[border-color,background-color] disabled:cursor-not-allowed disabled:opacity-60",
        on ? "border-[var(--q-accent)] bg-[var(--q-wash)]" : "border-[var(--q-field)] hover:border-[var(--q-text-4)]",
      )}
    >
      <span aria-hidden className={cn("mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-full border-2", on ? "border-[var(--q-accent)]" : "border-[var(--q-field)]")}>
        {on && <span className="size-2 rounded-full bg-[var(--q-accent)]" />}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-2 text-[15px] font-semibold leading-tight text-[var(--q-ink)]">
          {title}
          {badge && <span className="q-pill q-pill-info text-[11px]">{badge}</span>}
        </span>
        <span className="text-[13px] leading-snug text-[var(--q-text-4)]">{text}</span>
      </span>
    </button>
  )
}
