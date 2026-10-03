"use client"

/**
 * Espace comptable — un dossier, en lecture seule : période, totaux, TVA
 * facturée par taux, factures émises, avoirs, factures fournisseurs (si la
 * réception existe), téléchargements (FEC, ventes en CSV, PDF en ZIP).
 *
 * Aucune action d'écriture : ni modification, ni envoi, ni relance.
 * Partagé par /comptable/[accès] (données lues côté serveur après
 * vérification de l'accès) et /demo/comptable/[id] (lib/demo/accountant.ts,
 * rien n'est téléchargé).
 */
import { useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
  AlertCircle, ArrowLeft, Check, CheckCircle2, Clock, Download, Eye, FileArchive, FileSpreadsheet, FileText, Info,
  Inbox, Loader2, Lock, ReceiptText, Undo2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/utils/invoice"
import { EmptyState, Kpi, KpiGrid, PageHeader, StatusPill, INVOICE_PILLS, type Tone } from "@/components/app/kit"
import { formatSiren, mediumDate, plural, shortDate } from "@/components/invoices/invoice-view"
import { periodText } from "@/components/accountant/format"
import { PAYMENT_LABELS, ZIP_MAX_DOCUMENTS, type PeriodPreset } from "@/lib/accountant/rules"
import { SUPPLIER_STATUS_LABELS } from "@/lib/accountant/suppliers"
import type { DossierData, DossierInvoice, ExportFormat, PaymentState } from "@/lib/accountant/types"

export interface DossierViewProps {
  mode: "app" | "demo"
  data: DossierData
  presets: PeriodPreset[]
  /** Adresse de la page (période en ?du=&au=). */
  basePath: string
  /** Liste des dossiers. */
  backHref: string
  /** Route des exports (null en démo). */
  exportUrl: string | null
}

const PAYMENT_TONE: Record<PaymentState, Tone> = { paid: "ok", open: "info", late: "warn", credited: "neutral", other: "neutral" }
const PAYMENT_ICON: Partial<Record<PaymentState, React.ReactNode>> = {
  paid: <Check strokeWidth={2.75} aria-hidden />,
  late: <Clock strokeWidth={2.25} aria-hidden />,
  credited: <Undo2 strokeWidth={2.25} aria-hidden />,
}

function PaymentPill({ inv }: { inv: DossierInvoice }) {
  const label = inv.payment === "other" ? INVOICE_PILLS[inv.status]?.label ?? PAYMENT_LABELS.other : PAYMENT_LABELS[inv.payment]
  return <StatusPill tone={PAYMENT_TONE[inv.payment]} icon={PAYMENT_ICON[inv.payment]}>{label}</StatusPill>
}

const neg = (n: number) => formatCurrency(n === 0 ? 0 : -n)

type Tab = "invoices" | "credits" | "suppliers"

export function DossierView({ mode, data, presets, basePath, backHref, exportUrl }: DossierViewProps) {
  const { company, period, totals, vat } = data
  const [tab, setTab] = useState<Tab>("invoices")
  const refYear = Number(period.to.slice(0, 4))
  const hrefOf = (p: { from: string; to: string }) => `${basePath}?du=${p.from}&au=${p.to}`
  const activePreset = presets.find((p) => p.period.from === period.from && p.period.to === period.to)?.key ?? null
  const vatNet = vat.reduce((s, r) => s + r.vat, 0)
  const docCount = totals.invoiceCount + totals.creditCount

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "invoices", label: "Factures émises", count: totals.invoiceCount },
    { key: "credits", label: "Avoirs", count: totals.creditCount },
    ...(data.supplierInvoices ? [{ key: "suppliers" as const, label: "Factures fournisseurs", count: data.supplierInvoices.length }] : []),
  ]

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <Link href={backHref} className="q-link -mt-2 inline-flex min-h-11 items-center gap-1 self-start text-[15px]">
          <ArrowLeft className="size-4" aria-hidden />
          Vos dossiers
        </Link>
        <PageHeader
          eyebrow="Dossier"
          title={company.name}
          subtitle={[company.siren ? `SIREN ${formatSiren(company.siren)}` : null, company.city].filter(Boolean).join(" · ") || undefined}
          actions={<StatusPill tone="neutral" icon={<Lock strokeWidth={2.25} aria-hidden />}>Lecture seule</StatusPill>}
        />
      </div>

      {/* ── Période ── */}
      <section aria-label="Période" className="q-card flex flex-col gap-3 p-4">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {presets.map((p) => {
            const active = p.key === activePreset
            return (
              <Link
                key={p.key}
                href={hrefOf(p.period)}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "inline-flex h-[38px] shrink-0 items-center whitespace-nowrap rounded-full border px-3.5 text-sm",
                  active
                    ? "border-[var(--q-ink-strong)] bg-[var(--q-ink-strong)] font-semibold text-[var(--q-surface)]"
                    : "border-[var(--q-field)] bg-[var(--q-surface)] font-medium text-[var(--q-text-2)] hover:bg-[var(--q-hover)]",
                )}
              >
                {p.label}
              </Link>
            )
          })}
        </div>
        <form method="get" action={basePath} className="grid grid-cols-2 items-end gap-3 border-t border-[var(--q-line-soft)] pt-3 sm:flex sm:flex-wrap">
          <label className="flex min-w-0 flex-col gap-1.5">
            <span className="q-label">Du</span>
            <input type="date" name="du" defaultValue={period.from} max={period.to} required className="q-input sm:w-[180px]" />
          </label>
          <label className="flex min-w-0 flex-col gap-1.5">
            <span className="q-label">Au</span>
            <input type="date" name="au" defaultValue={period.to} min={period.from} required className="q-input sm:w-[180px]" />
          </label>
          <button type="submit" className="q-btn q-btn-secondary col-span-2 sm:col-span-1">Afficher</button>
          <p className="col-span-2 self-center text-[13px] text-[var(--q-text-3)] sm:ml-auto">
            Période {periodText(period)}
          </p>
        </form>
      </section>

      {/* ── Totaux ── */}
      <KpiGrid>
        <Kpi
          label="Facturé HT"
          value={formatCurrency(totals.invoicedHt)}
          sub={`${plural(totals.invoiceCount, "facture", "factures")} · ${formatCurrency(totals.invoicedTtc)} TTC`}
        />
        <Kpi label="TVA facturée" value={formatCurrency(vatNet)} sub="Factures moins avoirs" />
        <Kpi
          label="Avoirs"
          value={totals.creditedTtc ? neg(totals.creditedTtc) : formatCurrency(0)}
          sub={`${plural(totals.creditCount, "avoir", "avoirs")} · ${totals.creditedHt ? neg(totals.creditedHt) : formatCurrency(0)} HT`}
        />
        <Kpi
          label="À encaisser"
          tone={totals.lateTtc > 0 ? "warn" : "default"}
          value={formatCurrency(totals.openTtc)}
          sub={totals.lateTtc > 0 ? `dont ${formatCurrency(totals.lateTtc)} en retard` : `${formatCurrency(totals.paidTtc)} réglés`}
        />
      </KpiGrid>

      {data.truncated && (
        <div className="q-banner" role="status">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>Les listes affichent les 500 documents les plus récents de la période. Totaux et exports, eux, couvrent toute la période.</p>
        </div>
      )}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]">
        {/* ── Documents ── */}
        <div className="flex min-w-0 flex-col gap-3">
          <div role="tablist" aria-label="Documents du dossier" className="q-tabs">
            {tabs.map((t) => (
              <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}>
                {t.label}
                <span className="q-count">{t.count}</span>
              </button>
            ))}
          </div>
          {tab === "invoices" && <InvoicesTable data={data} refYear={refYear} />}
          {tab === "credits" && <CreditsTable data={data} refYear={refYear} />}
          {tab === "suppliers" && <SuppliersTable data={data} refYear={refYear} />}
        </div>

        <aside className="flex flex-col gap-4">
          <ExportsCard mode={mode} exportUrl={exportUrl} period={period} docCount={docCount} hasSiren={!!company.siren} />
          <VatCard data={data} />
        </aside>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Téléchargements                                                     */
/* ------------------------------------------------------------------ */

const EXPORTS: { format: ExportFormat; title: string; text: string; icon: React.ReactNode }[] = [
  { format: "fec", title: "FEC", text: "Fichier des écritures comptables : ventes et avoirs, TVA par taux", icon: <FileText className="size-[18px]" strokeWidth={1.75} aria-hidden /> },
  { format: "csv", title: "Ventes (CSV)", text: "Une ligne par document et par taux de TVA, pour un tableur", icon: <FileSpreadsheet className="size-[18px]" strokeWidth={1.75} aria-hidden /> },
  { format: "zip", title: "PDF de la période (ZIP)", text: `Factures et avoirs, ${ZIP_MAX_DOCUMENTS} au plus par archive`, icon: <FileArchive className="size-[18px]" strokeWidth={1.75} aria-hidden /> },
]

function ExportsCard({ mode, exportUrl, period, docCount, hasSiren }: {
  mode: "app" | "demo"
  exportUrl: string | null
  period: { from: string; to: string }
  docCount: number
  hasSiren: boolean
}) {
  const [busy, setBusy] = useState<ExportFormat | null>(null)
  const [done, setDone] = useState<ExportFormat | null>(null)
  const [error, setError] = useState<string | null>(null)

  const download = async (format: ExportFormat) => {
    setError(null)
    setDone(null)
    if (mode === "demo" || !exportUrl) {
      toast("Démo : le fichier se télécharge ici, et l'entreprise le voit dans son journal.")
      return
    }
    setBusy(format)
    try {
      const res = await fetch(`${exportUrl}?format=${format}&du=${period.from}&au=${period.to}`, { cache: "no-store" })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? "Le téléchargement a échoué. Réessayez.")
      }
      const blob = await res.blob()
      const match = (res.headers.get("Content-Disposition") ?? "").match(/filename="([^"]+)"/)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = match?.[1] ?? `export-${format}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      setDone(format)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <section aria-labelledby="exports-titre" className="q-card flex flex-col gap-3 p-5">
      <div className="flex flex-col gap-1">
        <h2 id="exports-titre" className="q-h2">Télécharger</h2>
        <p className="text-[13px] text-[var(--q-text-4)]">Période {periodText(period)}</p>
      </div>
      <ul className="flex flex-col gap-2">
        {EXPORTS.map((e) => {
          const disabled = busy !== null || docCount === 0 || (e.format === "fec" && !hasSiren)
          return (
            <li key={e.format}>
              <button
                type="button"
                onClick={() => download(e.format)}
                disabled={disabled}
                className="flex w-full items-center gap-3 rounded-xl border border-[var(--q-line)] bg-[var(--q-surface)] p-3 text-left transition-colors hover:border-[var(--q-field)] hover:bg-[var(--q-hover)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-[var(--q-wash)] text-[var(--q-accent-strong)]">{e.icon}</span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[15px] font-semibold text-[var(--q-ink)]">{e.title}</span>
                  <span className="text-[13px] leading-snug text-[var(--q-text-4)]">
                    {e.format === "fec" && !hasSiren ? "SIREN de l'entreprise manquant : nom du fichier impossible" : e.text}
                  </span>
                </span>
                <span className="shrink-0 text-[var(--q-text-3)]">
                  {busy === e.format ? <Loader2 className="size-4 animate-spin" aria-label="Préparation…" />
                    : done === e.format ? <CheckCircle2 className="size-4 text-[var(--q-ok)]" aria-label="Téléchargé" />
                    : <Download className="size-4" aria-hidden />}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      {docCount === 0 && <p className="text-[13px] text-[var(--q-text-4)]">Aucune facture ni aucun avoir sur cette période.</p>}
      {error && (
        <div className="q-banner border-[var(--q-danger-line)] bg-[var(--q-danger-bg)] text-[var(--q-danger)]" role="alert">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p className="text-[13px] leading-relaxed">{error}</p>
        </div>
      )}
      <p className="flex items-start gap-2 border-t border-[var(--q-line-soft)] pt-3 text-[13px] leading-relaxed text-[var(--q-text-4)]">
        <Eye className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden />
        Chaque téléchargement est enregistré et visible par l&apos;entreprise.
      </p>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* TVA                                                                 */
/* ------------------------------------------------------------------ */

function VatCard({ data }: { data: DossierData }) {
  const total = data.vat.reduce((s, r) => ({ base: s.base + r.base, vat: s.vat + r.vat }), { base: 0, vat: 0 })
  return (
    <section aria-labelledby="tva-titre" className="q-card flex flex-col gap-3 p-5">
      <div className="flex flex-col gap-1">
        <h2 id="tva-titre" className="q-h2">TVA facturée par taux</h2>
        <p className="text-[13px] text-[var(--q-text-4)]">Factures moins avoirs de la période</p>
      </div>
      {data.vat.length === 0 ? (
        <p className="text-[13px] text-[var(--q-text-4)]">Aucun montant sur cette période.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-[var(--q-text-4)]">
              <th scope="col" className="pb-2 font-medium">Taux</th>
              <th scope="col" className="pb-2 text-right font-medium">Base HT</th>
              <th scope="col" className="pb-2 text-right font-medium">TVA</th>
            </tr>
          </thead>
          <tbody>
            {data.vat.map((r) => (
              <tr key={r.key} className="border-t border-[var(--q-line-soft)]">
                <td className="py-2 pr-2 text-[var(--q-text-2)]">{r.label}</td>
                <td className="whitespace-nowrap py-2 text-right tabular-nums">{formatCurrency(r.base)}</td>
                <td className="whitespace-nowrap py-2 pl-2 text-right tabular-nums">{formatCurrency(r.vat)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-[var(--q-line)] font-semibold">
              <td className="py-2">Total</td>
              <td className="whitespace-nowrap py-2 text-right tabular-nums">{formatCurrency(total.base)}</td>
              <td className="whitespace-nowrap py-2 pl-2 text-right tabular-nums">{formatCurrency(total.vat)}</td>
            </tr>
          </tfoot>
        </table>
      )}
      {/* CGI, art. 269, 2-c ; BOFiP BOI-TVA-BASE-20-20 (exigibilité des prestations de services) */}
      <p className="border-t border-[var(--q-line-soft)] pt-3 text-[13px] leading-relaxed text-[var(--q-text-4)]">
        Montants d&apos;après la date des documents. Pour les prestations de services, dont les travaux immobiliers,
        la TVA est exigible à l&apos;encaissement, sauf option pour les débits (CGI, art. 269, 2-c).
      </p>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Listes                                                              */
/* ------------------------------------------------------------------ */

function Empty({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <section className="q-card">
      <EmptyState icon={icon} title={title} text="Choisissez une autre période ci-dessus." />
    </section>
  )
}

function InvoicesTable({ data, refYear }: { data: DossierData; refYear: number }) {
  const rows = data.invoices
  if (rows.length === 0) return <Empty icon={<FileText className="size-5" aria-hidden />} title="Aucune facture émise sur cette période" />
  return (
    <>
      <section aria-label="Factures émises" className="q-card hidden overflow-hidden md:block">
        <div className="overflow-x-auto">
          <table className="q-table min-w-[720px]">
            <thead className="bg-[var(--q-surface-2)] [&_th]:border-t-0">
              <tr>
                <th scope="col">Numéro</th>
                <th scope="col">Client</th>
                <th scope="col">Émise</th>
                <th scope="col">Échéance</th>
                <th scope="col" className="is-num">HT</th>
                <th scope="col" className="is-num">TTC</th>
                <th scope="col">Paiement</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((inv) => (
                <tr key={inv.id}>
                  <td className="whitespace-nowrap font-mono text-[13px]">{inv.number}</td>
                  <td className="max-w-[240px]"><span className="block truncate font-semibold">{inv.clientName ?? "—"}</span></td>
                  <td className="whitespace-nowrap text-[var(--q-text-3)]">{shortDate(inv.issueDate, refYear)}</td>
                  <td className={cn("whitespace-nowrap", inv.payment === "late" ? "font-semibold text-[var(--q-warn)]" : "text-[var(--q-text-3)]")}>
                    {shortDate(inv.dueDate, refYear)}
                  </td>
                  <td className="is-num whitespace-nowrap">{formatCurrency(inv.totalHt)}</td>
                  <td className="is-num whitespace-nowrap font-semibold">{formatCurrency(inv.totalTtc)}</td>
                  <td><PaymentPill inv={inv} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section aria-label="Factures émises" className="q-card q-list overflow-hidden rounded-[18px] md:hidden">
        {rows.map((inv) => (
          <div key={inv.id} className="q-list-row">
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-[15px] font-semibold">{inv.clientName ?? "—"}</span>
              <span className="truncate font-mono text-xs text-[var(--q-text-4)]">{inv.number} · {shortDate(inv.issueDate, refYear)}</span>
            </span>
            <span className="flex shrink-0 flex-col items-end gap-1">
              <span className="text-[15px] font-semibold tabular-nums">{formatCurrency(inv.totalTtc)}</span>
              <PaymentPill inv={inv} />
            </span>
          </div>
        ))}
      </section>
    </>
  )
}

function CreditsTable({ data, refYear }: { data: DossierData; refYear: number }) {
  const rows = data.creditNotes
  if (rows.length === 0) return <Empty icon={<ReceiptText className="size-5" aria-hidden />} title="Aucun avoir sur cette période" />
  return (
    <>
      <section aria-label="Avoirs" className="q-card hidden overflow-hidden md:block">
        <div className="overflow-x-auto">
          <table className="q-table min-w-[720px]">
            <thead className="bg-[var(--q-surface-2)] [&_th]:border-t-0">
              <tr>
                <th scope="col">Numéro</th>
                <th scope="col">Client</th>
                <th scope="col">Date</th>
                <th scope="col">Facture</th>
                <th scope="col">Motif</th>
                <th scope="col" className="is-num">TTC</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td className="whitespace-nowrap font-mono text-[13px]">{c.number}</td>
                  <td className="max-w-[200px]"><span className="block truncate font-semibold">{c.clientName ?? "—"}</span></td>
                  <td className="whitespace-nowrap text-[var(--q-text-3)]">{shortDate(c.issueDate, refYear)}</td>
                  <td className="whitespace-nowrap font-mono text-[13px] text-[var(--q-text-3)]">{c.invoiceNumber ?? "—"}</td>
                  <td className="max-w-[220px]"><span className="block truncate text-[var(--q-text-3)]">{c.reason ?? "—"}</span></td>
                  <td className="is-num whitespace-nowrap font-semibold">{neg(c.totalTtc)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section aria-label="Avoirs" className="q-card q-list overflow-hidden rounded-[18px] md:hidden">
        {rows.map((c) => (
          <div key={c.id} className="q-list-row">
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-[15px] font-semibold">{c.clientName ?? "—"}</span>
              <span className="truncate text-xs text-[var(--q-text-4)]">
                <span className="font-mono">{c.number}</span>{c.invoiceNumber ? ` · sur ${c.invoiceNumber}` : ""} · {shortDate(c.issueDate, refYear)}
              </span>
            </span>
            <span className="shrink-0 text-[15px] font-semibold tabular-nums">{neg(c.totalTtc)}</span>
          </div>
        ))}
      </section>
    </>
  )
}

function SuppliersTable({ data, refYear }: { data: DossierData; refYear: number }) {
  const rows = data.supplierInvoices ?? []
  if (rows.length === 0) return <Empty icon={<Inbox className="size-5" aria-hidden />} title="Aucune facture fournisseur sur cette période" />
  const amount = (v: number | null) => (v === null ? "—" : formatCurrency(v))
  return (
    <>
      <section aria-label="Factures fournisseurs" className="q-card hidden overflow-hidden md:block">
        <div className="overflow-x-auto">
          <table className="q-table min-w-[680px]">
            <thead className="bg-[var(--q-surface-2)] [&_th]:border-t-0">
              <tr>
                <th scope="col">Fournisseur</th>
                <th scope="col">Numéro</th>
                <th scope="col">Date</th>
                <th scope="col" className="is-num">HT</th>
                <th scope="col" className="is-num">TTC</th>
                <th scope="col">Statut</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td className="max-w-[220px]"><span className="block truncate font-semibold">{s.supplierName ?? "—"}</span></td>
                  <td className="whitespace-nowrap font-mono text-[13px]">{s.number ?? "—"}</td>
                  <td className="whitespace-nowrap text-[var(--q-text-3)]">{s.issueDate ? shortDate(s.issueDate, refYear) : "—"}</td>
                  <td className="is-num whitespace-nowrap">{amount(s.totalHt)}</td>
                  <td className="is-num whitespace-nowrap font-semibold">{amount(s.totalTtc)}</td>
                  <td className="whitespace-nowrap text-[var(--q-text-3)]">{(s.status && SUPPLIER_STATUS_LABELS[s.status]) ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section aria-label="Factures fournisseurs" className="q-card q-list overflow-hidden rounded-[18px] md:hidden">
        {rows.map((s) => (
          <div key={s.id} className="q-list-row">
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-[15px] font-semibold">{s.supplierName ?? "—"}</span>
              <span className="truncate text-xs text-[var(--q-text-4)]">
                {[s.number, s.issueDate ? mediumDate(s.issueDate) : null, s.status ? SUPPLIER_STATUS_LABELS[s.status] : null].filter(Boolean).join(" · ")}
              </span>
            </span>
            <span className="shrink-0 text-[15px] font-semibold tabular-nums">{amount(s.totalTtc)}</span>
          </div>
        ))}
      </section>
    </>
  )
}
