"use client"

/**
 * Page du client, après la signature (DECISIONS-STRATEGIQUES.md § 11) :
 * - l'acompte : virement à l'entreprise (IBAN, référence, QR code SEPA), tout
 *   de suite après une signature à distance ; annoncé pour J+8 après une
 *   signature sur place chez un particulier (aucun paiement avant 7 jours) ;
 * - « Changer d'avis » : rétractation en ligne d'un particulier, dans le délai
 *   de 14 jours, avec un formulaire court et une confirmation explicite.
 *
 * Pas de page de paiement : le client vire l'acompte, l'artisan l'encaisse.
 */
import { useState } from "react"
import { toast } from "sonner"
import { CalendarClock, Copy, Landmark, Loader2, QrCode, Undo2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/utils/invoice"
import { longDate } from "@/components/quotes/QuoteListHelpers"
import { formatIbanGroups } from "@/lib/payment-link/iban"
import { validateWithdrawPayload } from "@/lib/signature/rules"
import type { PublicDeposit } from "@/lib/signature/view"
import type { PublicSignApi } from "@/components/signature/PublicSignView"

/** Montant tel qu'on le saisit dans une application bancaire : « 1234,50 ». */
const plainAmount = (n: number) => n.toFixed(2).replace(".", ",")
const percentLabel = (n: number) => `${String(n).replace(".", ",")} %`

function copy(value: string, label: string) {
  if (!navigator.clipboard) { toast.error("Copie impossible sur ce navigateur"); return }
  navigator.clipboard.writeText(value).then(() => toast.success(`${label} copié`), () => toast.error("Copie impossible"))
}

function CopyRow({ label, value, display, mono }: { label: string; value: string; display?: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-xs text-[var(--q-text-4)]">{label}</span>
        <span className={cn("break-words text-[15px] font-medium text-[var(--q-ink)]", mono && "font-mono text-[14px] tracking-[0.01em]")}>
          {display ?? value}
        </span>
      </span>
      <button type="button" className="q-btn q-btn-secondary q-btn-sm min-h-11 shrink-0 md:min-h-0" onClick={() => copy(value, label)} aria-label={`Copier : ${label}`}>
        <Copy aria-hidden />
        Copier
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Acompte                                                             */
/* ------------------------------------------------------------------ */

export function DepositCard({ deposit, companyName, consumer }: { deposit: PublicDeposit; companyName: string; consumer: boolean }) {
  const title = `Acompte de ${formatCurrency(deposit.amount)}`
  const share = deposit.percent > 0 ? ` (${percentLabel(deposit.percent)} du montant TTC)` : ""

  if (deposit.timing === "later" || !deposit.account) {
    return (
      <section aria-labelledby="acompte-titre" className="q-card flex items-start gap-3.5 p-5">
        <span className="grid size-11 shrink-0 place-items-center rounded-[14px] bg-[var(--q-wash)] text-[var(--q-accent-strong)]">
          <CalendarClock className="size-5" aria-hidden />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id="acompte-titre" className="text-[17px] font-semibold text-[var(--q-ink)]">{title}{share}</h2>
          <p className="text-[15px] leading-relaxed text-[var(--q-text-3)]">
            {deposit.requestOn
              ? <>Signé sur place : aucun paiement ne peut vous être demandé avant 7 jours. Les coordonnées du virement vous seront envoyées par email le {longDate(deposit.requestOn)}.</>
              : <>{companyName} vous communiquera les coordonnées du virement.</>}
          </p>
        </div>
      </section>
    )
  }

  const account = deposit.account
  return (
    <section aria-labelledby="acompte-titre" className="q-card overflow-hidden">
      <div className="flex flex-col gap-1 px-5 pb-1 pt-4">
        <span className="flex items-center gap-2.5">
          <Landmark className="size-[18px] text-[var(--q-accent-strong)]" aria-hidden />
          <h2 id="acompte-titre" className="q-h2">Prochaine étape : l&apos;acompte</h2>
        </span>
        <p className="text-[15px] leading-relaxed text-[var(--q-text-3)]">
          {companyName} vous demande un acompte de <strong className="font-semibold text-[var(--q-ink)]">{formatCurrency(deposit.amount)}</strong>{share}, par virement.
          {consumer && " Il vous est remboursé si vous vous rétractez dans le délai."}
        </p>
      </div>
      <div className="grid items-start gap-x-6 md:grid-cols-[minmax(0,1fr)_200px]">
        <div className="flex min-w-0 flex-col divide-y divide-[var(--q-line-soft)] px-5">
          <CopyRow label="Bénéficiaire" value={account.holder} />
          <CopyRow label="IBAN" value={account.iban} display={formatIbanGroups(account.iban)} mono />
          {account.bic && <CopyRow label="BIC" value={account.bic} mono />}
          <CopyRow label="Montant" value={plainAmount(deposit.amount)} display={formatCurrency(deposit.amount)} />
          <CopyRow label="Référence à indiquer" value={deposit.reference} />
        </div>
        {deposit.qr && (
          <details className="group mx-5 mb-3 mt-2 md:mb-0 md:mt-3" open>
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-[14px] font-semibold text-[var(--q-ink)] md:hidden [&::-webkit-details-marker]:hidden">
              <QrCode className="size-4 text-[var(--q-accent-strong)]" aria-hidden />QR code de virement
            </summary>
            <svg
              viewBox={`0 0 ${deposit.qr.size} ${deposit.qr.size}`}
              className="aspect-square w-full max-w-[200px] rounded-lg bg-white"
              shapeRendering="crispEdges"
              role="img"
              aria-label="QR code de virement SEPA"
            >
              <rect width={deposit.qr.size} height={deposit.qr.size} fill="#fff" />
              <path d={deposit.qr.path} fill="#000" />
            </svg>
            <p className="mt-2 text-[12px] leading-relaxed text-[var(--q-text-4)]">Lisible par certaines applications bancaires. Vérifiez le bénéficiaire et le montant.</p>
          </details>
        )}
      </div>
      <p className="mx-5 mb-5 mt-2 rounded-xl bg-[var(--q-surface-2)] px-3.5 py-3 text-[13px] leading-relaxed text-[var(--q-text-3)]">
        Indiquez la référence <span className="font-medium text-[var(--q-ink)]">{deposit.reference}</span> dans le libellé du virement.
        Les coordonnées sont aussi dans l&apos;email de confirmation.
      </p>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Rétractation                                                        */
/* ------------------------------------------------------------------ */

export function WithdrawCard({
  api, companyName, deadline, defaultName, theDoc, startOpen, onWithdrawn,
}: {
  api: PublicSignApi
  companyName: string
  deadline: string | null
  defaultName: string
  theDoc: string
  startOpen: boolean
  onWithdrawn: (info: { at: string; name: string }) => void
}) {
  const [open, setOpen] = useState(startOpen)
  const [name, setName] = useState(defaultName)
  const [message, setMessage] = useState("")
  const [confirm, setConfirm] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({})
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    const check = validateWithdrawPayload({ name, message, confirm })
    if (!check.ok) {
      setErrors({ [check.field]: check.error })
      document.getElementById(`f-${check.field}`)?.focus()
      return
    }
    setErrors({})
    setBusy(true)
    const r = await api.post("withdraw", { name, message, confirm })
    setBusy(false)
    if (r.ok) { onWithdrawn({ at: String(r.json.withdrawn_at ?? new Date().toISOString()), name: check.value.name }); return }
    if (typeof r.json.field === "string") setErrors({ [r.json.field]: String(r.json.error) })
    else setFormError(String(r.json.error ?? "Votre rétractation n'a pas pu être enregistrée. Réessayez."))
  }

  if (!open) {
    return (
      <section aria-labelledby="retractation-titre" className="q-card flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 id="retractation-titre" className="text-[17px] font-semibold text-[var(--q-ink)]">Changer d&apos;avis</h2>
          <p className="text-[15px] leading-relaxed text-[var(--q-text-3)]">
            Vous pouvez vous rétracter sans donner de motif{deadline ? <> jusqu&apos;au {longDate(deadline)} inclus</> : null}. {companyName} sera prévenue tout de suite.
          </p>
        </div>
        <button type="button" onClick={() => setOpen(true)} className="q-btn q-btn-secondary q-btn-lg shrink-0">
          <Undo2 aria-hidden />
          Me rétracter
        </button>
      </section>
    )
  }

  return (
    <form id="retractation" onSubmit={submit} noValidate aria-labelledby="retractation-titre" className="q-card flex flex-col gap-4 p-5">
      <div className="flex flex-col gap-1">
        <h2 id="retractation-titre" className="text-[17px] font-semibold text-[var(--q-ink)]">Me rétracter</h2>
        <p className="text-[14px] leading-relaxed text-[var(--q-text-3)]">
          Déclaration de rétractation du contrat conclu avec {companyName} ({theDoc}). Vous n&apos;avez pas à donner de motif.
          Un accusé de réception vous est envoyé par email.
        </p>
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <label htmlFor="f-withdraw_name" className="q-label">Nom et prénom</label>
        <input
          id="f-withdraw_name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className="q-input"
          aria-invalid={!!errors.withdraw_name} aria-describedby={errors.withdraw_name ? "f-withdraw_name-help" : undefined}
        />
        {errors.withdraw_name && <p id="f-withdraw_name-help" className="q-field-error text-[13px]" role="alert">{errors.withdraw_name}</p>}
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="f-withdraw_message" className="q-label">Message (facultatif)</label>
        <textarea id="f-withdraw_message" rows={3} maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} className="q-input" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="f-withdraw_confirm" className="flex cursor-pointer items-start gap-3 text-[14px] leading-relaxed text-[var(--q-text-3)]">
          <input
            id="f-withdraw_confirm" type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)}
            aria-invalid={!!errors.withdraw_confirm} className="mt-0.5 size-5 shrink-0 accent-[var(--q-accent)]"
          />
          <span>Je vous notifie par la présente ma rétractation du contrat portant sur la prestation de services ci-dessus.</span>
        </label>
        {errors.withdraw_confirm && <p className="q-field-error pl-8 text-[13px]" role="alert">{errors.withdraw_confirm}</p>}
      </div>
      {formError && <p className="q-field-error text-[13px]" role="alert">{formError}</p>}
      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="submit" disabled={busy} className="q-btn q-btn-danger q-btn-lg sm:flex-1">
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Undo2 aria-hidden />}
          Confirmer ma rétractation
        </button>
        <button type="button" onClick={() => setOpen(false)} className="q-btn q-btn-ghost min-h-[44px]">Annuler</button>
      </div>
    </form>
  )
}
