"use client"

/**
 * Page de règlement par virement, vue par le client de l'artisan (sans
 * connexion). Maquette « Page de règlement du client » (DECISIONS § 12) :
 * virement seul — IBAN, BIC, montant, référence à copier, QR code de virement
 * SEPA, PDF de la facture, et « J'ai effectué le virement » qui prévient
 * l'artisan. Pas de carte ni de prélèvement, rien n'est encaissé par Qonforme.
 *
 * Partagée par /regler/[jeton] (données réelles, lib/payment-link/server.ts)
 * et /demo/regler/[facture] (lib/demo/payment-link.ts, rien n'est envoyé).
 * Mobile d'abord ; ni backdrop-filter ni will-change (règle iOS de CLAUDE.md),
 * champs à 16 px sur téléphone (classe q-input).
 */
import { useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
  ArrowLeft, Ban, Check, CheckCircle2, ChevronDown, Copy, Download, FileText, FileX, Landmark, Loader2,
  QrCode, SearchX, Send,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/utils/invoice"
import { formatIbanGroups } from "@/lib/payment-link/iban"
import { parisDay } from "@/lib/payment-link/rules"
import { longDate, mediumDate } from "@/components/invoices/invoice-view"
import type { PaymentPageData, PublicCompany, PublicDeclaration, PublicInvoice } from "@/lib/payment-link/types"

export interface PaymentPageProps {
  data: PaymentPageData
  mode: "live" | "demo"
  /** Téléchargement du PDF (null : indisponible). */
  pdfHref: string | null
  /** Route POST de la déclaration (null en démo). */
  declareUrl: string | null
  /** Date du jour « AAAA-MM-JJ » (valeur par défaut du formulaire). */
  today: string
  /** Démo : retour vers la fiche facture. */
  backHref?: string
}

/* ------------------------------------------------------------------ */
/* Coque                                                               */
/* ------------------------------------------------------------------ */

function Shell({ company, mode, backHref, children }: {
  company: PublicCompany | null
  mode: "live" | "demo"
  backHref?: string
  children: React.ReactNode
}) {
  return (
    <div className="min-h-[100dvh] bg-[var(--q-bg)] text-[var(--q-ink)]">
      {mode === "demo" && (
        <div className="border-b border-[var(--q-info-line)] bg-[var(--q-info-bg)] px-4 py-2.5 text-[13px] text-[var(--q-accent-ink)]">
          <div className="mx-auto flex max-w-[960px] flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <span><strong>Démo</strong> · la page que reçoit votre client. Données fictives, rien n&apos;est envoyé.</span>
            {backHref && (
              <Link href={backHref} className="q-link inline-flex min-h-9 items-center gap-1">
                <ArrowLeft className="size-3.5" aria-hidden />
                Retour à la facture
              </Link>
            )}
          </div>
        </div>
      )}
      <main
        className="mx-auto flex w-full max-w-[960px] flex-col gap-4 px-4 pb-10 pt-[max(20px,env(safe-area-inset-top))] md:gap-5 md:px-6 md:pt-10"
        style={{ paddingBottom: "max(40px, env(safe-area-inset-bottom))" }}
      >
        {company && <CompanyHeader company={company} />}
        {children}
        <footer className="mt-4 flex flex-col items-center gap-1 text-center text-xs text-[var(--q-text-4)]">
          {company && (
            <p>
              {[company.name, [company.address, [company.zipCode, company.city].filter(Boolean).join(" ")].filter(Boolean).join(", "),
                company.siren ? `SIREN ${company.siren.replace(/(\d{3})(?=\d)/g, "$1 ")}` : null].filter(Boolean).join(" · ")}
            </p>
          )}
          <p>Page de règlement fournie par Qonforme. Aucun paiement n&apos;est encaissé par Qonforme.</p>
        </footer>
      </main>
    </div>
  )
}

function CompanyHeader({ company }: { company: PublicCompany }) {
  return (
    <header className="flex items-center gap-3">
      {company.logoUrl ? (
        <span className="grid h-12 w-[72px] shrink-0 place-items-center overflow-hidden rounded-xl border border-[var(--q-line)] bg-white p-1.5">
          {/* Logo du bucket Storage du projet (vérifié côté serveur) : <img>, comme dans les réglages */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={company.logoUrl} alt="" className="max-h-full max-w-full object-contain" />
        </span>
      ) : (
        <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-xl bg-[var(--q-ink)] text-base font-semibold text-[var(--q-surface)]">
          {company.name.trim().slice(0, 1).toUpperCase()}
        </span>
      )}
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-[17px] font-semibold leading-tight">{company.name}</span>
        <span className="text-[13px] text-[var(--q-text-4)]">Règlement de facture</span>
      </span>
    </header>
  )
}

/* ------------------------------------------------------------------ */
/* États sans paiement                                                 */
/* ------------------------------------------------------------------ */

function StateCard({ icon, tone = "neutral", title, children, action }: {
  icon: React.ReactNode
  tone?: "neutral" | "ok"
  title: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <section className="q-card flex flex-col items-center gap-3 px-5 py-10 text-center md:py-14">
      <span className={cn(
        "grid size-12 place-items-center rounded-2xl",
        tone === "ok" ? "bg-[var(--q-ok-bg)] text-[var(--q-ok)]" : "bg-[var(--q-neutral-bg)] text-[var(--q-neutral)]",
      )}>
        {icon}
      </span>
      <h1 className="q-display text-[24px] leading-tight md:text-[28px]">{title}</h1>
      <div className="max-w-md text-[15px] leading-relaxed text-[var(--q-text-3)]">{children}</div>
      {action && <div className="mt-2 flex flex-wrap justify-center gap-2">{action}</div>}
    </section>
  )
}

function PdfButton({ href, mode, className }: { href: string | null; mode: "live" | "demo"; className?: string }) {
  if (!href) return null
  if (mode === "demo") {
    return (
      <button type="button" className={cn("q-btn q-btn-secondary q-btn-lg", className)} onClick={() => toast("Démo : le PDF de la facture se télécharge ici.")}>
        <Download aria-hidden />
        Télécharger la facture (PDF)
      </button>
    )
  }
  return (
    <a href={href} className={cn("q-btn q-btn-secondary q-btn-lg", className)} download>
      <Download aria-hidden />
      Télécharger la facture (PDF)
    </a>
  )
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function PaymentPage(props: PaymentPageProps) {
  const { data, mode, pdfHref, backHref } = props

  if (data.state === "not_found") {
    return (
      <Shell company={null} mode={mode} backHref={backHref}>
        <StateCard icon={<SearchX className="size-6" aria-hidden />} title="Lien introuvable">
          Ce lien de paiement n&apos;existe pas ou n&apos;est plus valide. Vérifiez l&apos;adresse reçue par email,
          ou demandez un nouveau lien à l&apos;entreprise qui vous a envoyé la facture.
        </StateCard>
      </Shell>
    )
  }
  if (data.state === "unavailable") {
    return (
      <Shell company={null} mode={mode} backHref={backHref}>
        <StateCard icon={<Landmark className="size-6" aria-hidden />} title="Page momentanément indisponible">
          La page de règlement n&apos;a pas pu être chargée. Réessayez dans un instant.
        </StateCard>
      </Shell>
    )
  }
  if (data.state === "disabled") {
    return (
      <Shell company={data.company} mode={mode} backHref={backHref}>
        <StateCard icon={<Ban className="size-6" aria-hidden />} title="Lien de paiement désactivé">
          {data.company.name} a désactivé ce lien. Pour régler la facture, utilisez les coordonnées bancaires
          qui figurent sur la facture{data.company.email ? <>, ou écrivez à <a className="q-link" href={`mailto:${data.company.email}`}>{data.company.email}</a></> : null}.
        </StateCard>
      </Shell>
    )
  }
  if (data.state === "paid") {
    return (
      <Shell company={data.company} mode={mode} backHref={backHref}>
        <StateCard
          tone="ok"
          icon={<CheckCircle2 className="size-6" aria-hidden />}
          title="Facture réglée"
          action={<PdfButton href={pdfHref} mode={mode} />}
        >
          {data.company.name} a enregistré le règlement de la facture <span className="font-mono">{data.invoice.number}</span>.
          Il n&apos;y a plus rien à payer.
        </StateCard>
      </Shell>
    )
  }
  if (data.state === "credited") {
    return (
      <Shell company={data.company} mode={mode} backHref={backHref}>
        <StateCard
          icon={<FileX className="size-6" aria-hidden />}
          title="Rien à régler"
          action={<PdfButton href={pdfHref} mode={mode} />}
        >
          La facture <span className="font-mono">{data.invoice.number}</span> a été annulée par un avoir de {data.company.name}.
          Il n&apos;y a rien à payer.
        </StateCard>
      </Shell>
    )
  }
  if (data.state === "closed") {
    return (
      <Shell company={data.company} mode={mode} backHref={backHref}>
        <StateCard
          icon={<FileText className="size-6" aria-hidden />}
          title="Facture plus à régler en ligne"
          action={<PdfButton href={pdfHref} mode={mode} />}
        >
          La facture <span className="font-mono">{data.invoice.number}</span> n&apos;est plus à régler par ce lien.
          Rapprochez-vous de {data.company.name}{data.company.email ? <> (<a className="q-link" href={`mailto:${data.company.email}`}>{data.company.email}</a>)</> : null}.
        </StateCard>
      </Shell>
    )
  }

  if (data.state !== "payable") return null
  return <Payable {...props} data={data} />
}

/* ------------------------------------------------------------------ */
/* Facture à régler                                                    */
/* ------------------------------------------------------------------ */

type PayableData = Extract<PaymentPageData, { state: "payable" }>

/** Montant tel qu'on le saisit dans une application bancaire : « 19584,00 ». */
const plainAmount = (n: number) => n.toFixed(2).replace(".", ",")

function copy(value: string, label: string) {
  if (!navigator.clipboard) { toast.error("Copie impossible sur ce navigateur"); return }
  navigator.clipboard.writeText(value).then(() => toast.success(`${label} copié`), () => toast.error("Copie impossible"))
}

function Payable({ data, mode, pdfHref, declareUrl, today, backHref }: PaymentPageProps & { data: PayableData }) {
  const { company, invoice, account, qr } = data
  const [declaration, setDeclaration] = useState<PublicDeclaration | null>(data.declaration)

  return (
    <Shell company={company} mode={mode} backHref={backHref}>
      <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1fr)_320px] md:gap-5">
        <div className="flex min-w-0 flex-col gap-4 md:gap-5">
          <AmountCard invoice={invoice} />
          {account ? (
            <BankCard account={account} invoice={invoice} />
          ) : (
            <section className="q-card flex flex-col gap-2 p-5">
              <h2 className="q-h2">Coordonnées bancaires indisponibles</h2>
              <p className="text-sm leading-relaxed text-[var(--q-text-3)]">
                {company.name} n&apos;a pas de coordonnées bancaires valides enregistrées pour le moment. Utilisez celles qui
                figurent sur la facture{company.email ? <>, ou écrivez à <a className="q-link" href={`mailto:${company.email}`}>{company.email}</a></> : null}.
              </p>
            </section>
          )}
          {qr && <QrCard qr={qr} className="md:hidden" collapsible />}
          <DeclareCard
            company={company}
            invoice={invoice}
            declaration={declaration}
            onDeclared={setDeclaration}
            declareUrl={declareUrl}
            mode={mode}
            today={today}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-4 md:gap-5">
          {qr && <QrCard qr={qr} className="hidden md:flex" />}
          <InvoiceCard invoice={invoice} pdfHref={pdfHref} mode={mode} />
        </div>
      </div>
    </Shell>
  )
}

function AmountCard({ invoice }: { invoice: PublicInvoice }) {
  return (
    <section className="q-card flex flex-col gap-1.5 rounded-[22px] p-5 md:p-6" aria-label="Montant à régler">
      <span className="text-[13px] text-[var(--q-text-3)]">
        Facture <span className="font-mono">{invoice.number}</span> · montant à régler
      </span>
      <span className="q-display text-[38px] leading-[1.05] tracking-[-0.04em] tabular-nums md:text-[44px]">
        {formatCurrency(invoice.remaining)}
      </span>
      <span className="text-sm text-[var(--q-text-3)]">Échéance le {longDate(invoice.dueDate)}</span>
      {invoice.credited > 0 && (
        <span className="text-[13px] text-[var(--q-text-4)]">
          Total de la facture {formatCurrency(invoice.totalTtc)}, avoir déduit : −{formatCurrency(invoice.credited)}
        </span>
      )}
      {(invoice.retention ?? 0) > 0 && (
        <span className="text-[13px] text-[var(--q-text-4)]">
          Retenue de garantie de {formatCurrency(invoice.retention ?? 0)} non comprise : elle se règle à sa libération.
        </span>
      )}
    </section>
  )
}

function CopyRow({ label, value, display, copyLabel, mono }: {
  label: string
  value: string
  display?: React.ReactNode
  copyLabel: string
  mono?: boolean
}) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-xs text-[var(--q-text-4)]">{label}</span>
        <span className={cn("break-words text-[15px] font-medium text-[var(--q-ink)]", mono && "font-mono text-[14px] tracking-[0.01em]")}>
          {display ?? value}
        </span>
      </span>
      <button
        type="button"
        className="q-btn q-btn-secondary q-btn-sm min-h-11 shrink-0 md:min-h-0"
        onClick={() => copy(value, copyLabel)}
        aria-label={`Copier : ${label}`}
      >
        <Copy aria-hidden />
        Copier
      </button>
    </div>
  )
}

function BankCard({ account, invoice }: { account: NonNullable<PayableData["account"]>; invoice: PublicInvoice }) {
  return (
    <section className="q-card overflow-hidden" aria-labelledby="virement-titre">
      <div className="flex items-center gap-2.5 px-5 pb-1 pt-4">
        <Landmark className="size-[18px] text-[var(--q-accent-strong)]" aria-hidden />
        <h2 id="virement-titre" className="q-h2">Payer par virement</h2>
      </div>
      <div className="flex flex-col divide-y divide-[var(--q-line-soft)] px-5">
        <CopyRow label="Titulaire du compte" value={account.holder} copyLabel="Titulaire" />
        <CopyRow label="IBAN" value={account.iban} display={formatIbanGroups(account.iban)} copyLabel="IBAN" mono />
        {account.bic && <CopyRow label="BIC" value={account.bic} copyLabel="BIC" mono />}
        <CopyRow label="Montant" value={plainAmount(invoice.remaining)} display={formatCurrency(invoice.remaining)} copyLabel="Montant" />
        <CopyRow label="Référence à indiquer" value={invoice.number} copyLabel="Référence" mono />
      </div>
      <p className="mx-5 mb-5 mt-1 rounded-xl bg-[var(--q-surface-2)] px-3.5 py-3 text-[13px] leading-relaxed text-[var(--q-text-3)]">
        Indiquez la référence <span className="font-mono font-medium text-[var(--q-ink)]">{invoice.number}</span> dans le
        libellé du virement : l&apos;entreprise retrouve ainsi votre règlement.
      </p>
    </section>
  )
}

function QrCard({ qr, className, collapsible }: { qr: NonNullable<PayableData["qr"]>; className?: string; collapsible?: boolean }) {
  const svg = (
    <svg
      viewBox={`0 0 ${qr.size} ${qr.size}`}
      className="aspect-square w-full max-w-[220px] rounded-lg bg-white"
      shapeRendering="crispEdges"
      role="img"
      aria-label="QR code de virement SEPA"
    >
      <rect width={qr.size} height={qr.size} fill="#fff" />
      <path d={qr.path} fill="#000" />
    </svg>
  )
  const hint = (
    <p className="text-[13px] leading-relaxed text-[var(--q-text-3)]">
      Certaines applications bancaires lisent ce code (norme EPC du virement SEPA) et remplissent le virement pour vous.
      Vérifiez toujours le bénéficiaire et le montant avant de valider.
    </p>
  )
  if (collapsible) {
    return (
      <details className={cn("q-card group overflow-hidden", className)}>
        <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2.5 px-5 py-3.5 [&::-webkit-details-marker]:hidden">
          <QrCode className="size-[18px] text-[var(--q-accent-strong)]" aria-hidden />
          <span className="q-h2 flex-1">QR code de virement</span>
          <ChevronDown className="size-4 text-[var(--q-text-4)] transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <div className="flex flex-col items-center gap-3 px-5 pb-5">
          {svg}
          {hint}
        </div>
      </details>
    )
  }
  return (
    <section className={cn("q-card flex-col items-center gap-3 p-5", className)} aria-labelledby="qr-titre">
      <h2 id="qr-titre" className="q-h2 self-start">QR code de virement</h2>
      {svg}
      {hint}
    </section>
  )
}

function InvoiceCard({ invoice, pdfHref, mode }: { invoice: PublicInvoice; pdfHref: string | null; mode: "live" | "demo" }) {
  return (
    <section className="q-card flex flex-col gap-3 p-5" aria-labelledby="facture-titre">
      <h2 id="facture-titre" className="q-h2">Facture</h2>
      <dl className="flex flex-col gap-2 text-sm">
        <Row label="Numéro"><span className="font-mono">{invoice.number}</span></Row>
        <Row label="Émise le">{mediumDate(invoice.issueDate)}</Row>
        <Row label="Échéance">{mediumDate(invoice.dueDate)}</Row>
        <Row label="Total TTC"><span className="tabular-nums">{formatCurrency(invoice.totalTtc)}</span></Row>
        {invoice.credited > 0 && (
          <Row label="Avoirs émis"><span className="tabular-nums">−{formatCurrency(invoice.credited)}</span></Row>
        )}
        {(invoice.retention ?? 0) > 0 && (
          <Row label="Retenue de garantie"><span className="tabular-nums">−{formatCurrency(invoice.retention ?? 0)}</span></Row>
        )}
        <Row label="Reste à régler"><span className="font-semibold tabular-nums">{formatCurrency(invoice.remaining)}</span></Row>
      </dl>
      <PdfButton href={pdfHref} mode={mode} className="w-full" />
    </section>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-[var(--q-text-3)]">{label}</dt>
      <dd className="text-right text-[var(--q-ink)]">{children}</dd>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* « J'ai effectué le virement »                                       */
/* ------------------------------------------------------------------ */

function DeclareCard({ company, invoice, declaration, onDeclared, declareUrl, mode, today }: {
  company: PublicCompany
  invoice: PublicInvoice
  declaration: PublicDeclaration | null
  onDeclared: (d: PublicDeclaration) => void
  declareUrl: string | null
  mode: "live" | "demo"
  today: string
}) {
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(today)
  const [amount, setAmount] = useState(plainAmount(invoice.remaining))
  const [note, setNote] = useState("")
  const [sending, setSending] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<"transfer_date" | "amount" | "note" | "form", string>>>({})

  if (declaration) {
    return (
      <section className="q-banner q-banner-ok flex-col gap-1 !p-5" role="status">
        <span className="flex items-center gap-2 font-semibold">
          <Check className="size-[18px]" strokeWidth={2.5} aria-hidden />
          Virement signalé le {longDate(parisDay(declaration.declaredAt))}
        </span>
        <span className="text-[14px] leading-relaxed opacity-90">
          {formatCurrency(declaration.amount)} viré le {longDate(declaration.transferDate)}, selon votre déclaration.
          {" "}Votre signalement a été transmis à {company.name}, qui marquera la facture comme réglée à réception des fonds.
        </span>
      </section>
    )
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})
    if (!date) { setErrors({ transfer_date: "Indiquez la date du virement." }); return }
    if (!amount.trim()) { setErrors({ amount: "Indiquez le montant viré, en euros." }); return }
    if (mode === "demo" || !declareUrl) {
      toast("Démo : en vrai, l'entreprise est prévenue par email.")
      onDeclared({ transferDate: date, amount: Number(amount.replace(/[\s  ]/g, "").replace(",", ".")) || invoice.remaining, declaredAt: new Date().toISOString() })
      return
    }
    setSending(true)
    try {
      const res = await fetch(declareUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transfer_date: date, amount, note: note.trim() || null }),
      })
      const json = await res.json().catch(() => ({}))
      if (res.ok && json.declaration) {
        onDeclared(json.declaration)
        return
      }
      const field = json.field as "transfer_date" | "amount" | "note" | undefined
      setErrors({ [field ?? "form"]: json.error ?? "L'envoi n'a pas abouti. Réessayez." })
    } catch {
      setErrors({ form: "Connexion impossible. Vérifiez votre réseau et réessayez." })
    } finally {
      setSending(false)
    }
  }

  if (!open) {
    return (
      <section className="q-card flex flex-col gap-3 p-5" aria-labelledby="declarer-titre">
        <div className="flex flex-col gap-1">
          <h2 id="declarer-titre" className="q-h2">Vous avez fait le virement ?</h2>
          <p className="text-sm leading-relaxed text-[var(--q-text-3)]">
            Prévenez {company.name} : l&apos;entreprise vérifiera son compte et marquera la facture comme réglée à réception.
          </p>
        </div>
        <button type="button" className="q-btn q-btn-primary q-btn-xl w-full md:w-auto md:self-start" onClick={() => setOpen(true)}>
          <Send aria-hidden />
          J&apos;ai effectué le virement
        </button>
      </section>
    )
  }

  return (
    <form onSubmit={submit} noValidate className="q-card flex flex-col gap-4 p-5" aria-labelledby="declarer-titre">
      <div className="flex flex-col gap-1">
        <h2 id="declarer-titre" className="q-h2">J&apos;ai effectué le virement</h2>
        <p className="text-sm text-[var(--q-text-3)]">Votre signalement est transmis à {company.name} par email.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="q-label">Date du virement</span>
          <input
            type="date"
            className="q-input"
            value={date}
            max={today}
            onChange={(e) => setDate(e.target.value)}
            aria-invalid={!!errors.transfer_date}
            required
          />
          {errors.transfer_date && <span className="q-field-error">{errors.transfer_date}</span>}
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="q-label">Montant viré (€)</span>
          <input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            className="q-input tabular-nums"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-invalid={!!errors.amount}
            required
          />
          {errors.amount && <span className="q-field-error">{errors.amount}</span>}
        </label>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="q-label">Note <span className="font-normal text-[var(--q-text-4)]">(facultatif)</span></span>
        <textarea
          className="q-input"
          rows={3}
          maxLength={500}
          placeholder="Par exemple : virement fait depuis le compte de la société."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          aria-invalid={!!errors.note}
        />
        {errors.note && <span className="q-field-error">{errors.note}</span>}
      </label>
      {errors.form && <p className="q-field-error text-[13px]" role="alert">{errors.form}</p>}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" className="q-btn q-btn-ghost q-btn-lg" onClick={() => setOpen(false)} disabled={sending}>
          Annuler
        </button>
        <button type="submit" className="q-btn q-btn-primary q-btn-lg" disabled={sending} aria-busy={sending || undefined}>
          {sending ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
          {sending ? "Envoi…" : `Prévenir ${company.name.length > 28 ? "l'entreprise" : company.name}`}
        </button>
      </div>
    </form>
  )
}
