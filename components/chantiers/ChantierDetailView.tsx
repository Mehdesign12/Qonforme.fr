'use client'

/**
 * Fiche chantier : marché et lots, facturé / reste à facturer, retenue de
 * garantie, devis et factures rattachés. Présentationnelle : les actions
 * (statut, rattachement, suppression) sont fournies par la page réelle ou la démo.
 */

import { useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { ArrowLeft, FileCheck2, FileText, Link2, Loader2, MapPin, Plus, Trash2, Unlink } from "lucide-react"
import { formatCurrency, INVOICE_STATUS_LABELS, QUOTE_STATUS_LABELS } from "@/lib/utils/invoice"
import { chantierMetrics, CHANTIER_STATUS_LABELS, type Chantier, type ChantierStatus } from "@/lib/chantiers/metrics"
import { cn } from "@/lib/utils"
import { cardStyle, ChantierStatusBadge, fmtDate, periodLabel, ProgressBar } from "@/components/chantiers/shared"
import type { InvoiceStatus, QuoteStatus } from "@/types"

export interface AttachableDoc {
  id:         string
  number:     string
  status:     string
  issue_date: string
  total_ttc:  number
}

export type ActionResult = { ok: true } | { ok: false; message: string }

interface Props {
  chantier:    Chantier | null
  attachable:  { quotes: AttachableDoc[]; invoices: AttachableDoc[] }
  error?:      string | null
  hrefs: {
    list:       string
    quote:      (id: string) => string
    invoice:    (id: string) => string
    newQuote:   string
    newInvoice: string
  }
  onStatus:    (status: ChantierStatus) => Promise<ActionResult>
  onAttach:    (type: "quote" | "invoice", id: string, attach: boolean) => Promise<ActionResult>
  onDelete:    () => Promise<ActionResult>
}

const NEXT_STATUS: Partial<Record<ChantierStatus, { to: ChantierStatus; label: string }>> = {
  todo:   { to: "active", label: "Démarrer le chantier" },
  active: { to: "done",   label: "Marquer comme terminé" },
  done:   { to: "archived", label: "Archiver" },
}

export function ChantierDetailView({ chantier, attachable, error, hrefs, onStatus, onAttach, onDelete }: Props) {
  const [busy, setBusy] = useState<string | null>(null)
  const [picker, setPicker] = useState(false)

  if (error) {
    return (
      <div className="max-w-[1200px] mx-auto rounded-2xl border border-white/60 dark:border-[#1E3A5F] px-6 py-10 text-center" style={cardStyle}>
        <p className="text-[15px] font-bold text-[#0F172A] dark:text-[#E2E8F0] mb-1">{error}</p>
        <Link href={hrefs.list} className="text-sm font-semibold text-[#2563EB] hover:underline">Retour aux chantiers</Link>
      </div>
    )
  }
  if (!chantier) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="w-6 h-6 text-[#2563EB] animate-spin" /></div>
  }

  const m = chantierMetrics(chantier)
  const next = NEXT_STATUS[chantier.status]

  const run = async (key: string, fn: () => Promise<ActionResult>, okMsg: string) => {
    setBusy(key)
    const r = await fn()
    setBusy(null)
    if (r.ok) toast.success(okMsg)
    else toast.error(r.message)
    return r.ok
  }

  const docs = [
    ...chantier.quotes.map((d) => ({ ...d, type: "quote" as const })),
    ...chantier.invoices.map((d) => ({ ...d, type: "invoice" as const })),
  ].sort((a, b) => (b.issue_date || "").localeCompare(a.issue_date || ""))
  const canAttach = attachable.quotes.length + attachable.invoices.length > 0

  return (
    <div className="space-y-4 max-w-[1200px] mx-auto">
      {/* ── En-tête ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5 min-w-0">
          <Link href={hrefs.list} className="inline-flex items-center gap-1 text-[13px] font-medium text-slate-500 hover:text-[#2563EB]"><ArrowLeft className="w-3.5 h-3.5" />Chantiers</Link>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-[22px] md:text-[26px] font-bold tracking-tight text-[#0F172A] dark:text-[#E2E8F0]">{chantier.name}</h1>
            <ChantierStatusBadge status={chantier.status} />
          </div>
          <p className="text-[13px] text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>{chantier.client_name || "Sans client"}</span>
            {chantier.address && <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{chantier.address}</span>}
            <span>{periodLabel(chantier.start_date, chantier.end_date)}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={hrefs.newQuote} className="inline-flex items-center gap-2 h-9 px-3.5 rounded-xl border border-[#DDE3EC] dark:border-[#1E3A5F] bg-white dark:bg-[#0F1E35] text-sm font-bold text-[#0F172A] dark:text-[#E2E8F0] hover:border-[#2563EB]"><FileCheck2 className="w-4 h-4" />Devis</Link>
          <Link href={hrefs.newInvoice} className="inline-flex items-center gap-2 h-9 px-3.5 rounded-xl border border-[#DDE3EC] dark:border-[#1E3A5F] bg-white dark:bg-[#0F1E35] text-sm font-bold text-[#0F172A] dark:text-[#E2E8F0] hover:border-[#2563EB]"><FileText className="w-4 h-4" />Facture</Link>
          {next && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => run("status", () => onStatus(next.to), `Chantier : ${CHANTIER_STATUS_LABELS[next.to].toLowerCase()}`)}
              className="inline-flex items-center gap-2 h-9 px-3.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-bold disabled:opacity-60 transition-colors"
            >
              {busy === "status" && <Loader2 className="w-4 h-4 animate-spin" />}{next.label}
            </button>
          )}
        </div>
      </div>

      {/* ── Chiffres ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tile label="Marché HT" value={formatCurrency(m.marketHt)} sub={m.marketFrom === "lots" ? `${chantier.lots.length} lot${chantier.lots.length > 1 ? "s" : ""}` : m.marketFrom === "quotes" ? "d’après les devis acceptés" : "ajoutez des lots ou un devis accepté"} />
        <Tile label="Facturé HT" value={formatCurrency(m.invoicedHt)} sub={`${formatCurrency(m.paidTtc)} TTC encaissés`} />
        <Tile label="Reste à facturer" value={formatCurrency(m.remainingHt)} sub={`${m.progress} % du marché facturé`} />
        <div className="rounded-2xl bg-[#0A1122] p-4 flex flex-col gap-1.5">
          <span className="text-[13px] text-[#AFBDD3]">Retenue de garantie</span>
          <span className="font-mono text-[20px] md:text-[24px] font-bold tracking-tight text-white">{chantier.retenue_garantie ? formatCurrency(m.retenueTtc) : "—"}</span>
          <span className="text-[12px] text-[#94A3B8]">{chantier.retenue_garantie ? `${chantier.retenue_rate} % du TTC facturé, libérée un an après réception` : "Non appliquée sur ce chantier"}</span>
        </div>
      </div>

      <div className="rounded-2xl border border-white/60 dark:border-[#1E3A5F] p-4" style={cardStyle}>
        <div className="flex justify-between text-[12px] text-slate-500 mb-2"><span>Avancement de la facturation</span><span className="font-mono">{m.progress} %</span></div>
        <ProgressBar value={m.progress} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-4 items-start">
        {/* ── Documents ── */}
        <section aria-labelledby="ch-docs" className="rounded-2xl border border-white/60 dark:border-[#1E3A5F] overflow-hidden" style={cardStyle}>
          <div className="flex items-center justify-between gap-3 px-4 md:px-5 py-4">
            <h2 id="ch-docs" className="text-[15px] font-bold text-[#0F172A] dark:text-[#E2E8F0]">Devis et factures</h2>
            {canAttach && (
              <button type="button" onClick={() => setPicker((v) => !v)} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#2563EB] hover:underline">
                <Link2 className="w-3.5 h-3.5" />{picker ? "Fermer" : "Rattacher un document"}
              </button>
            )}
          </div>

          {picker && (
            <div className="mx-4 md:mx-5 mb-4 rounded-xl border border-[#DCE6FD] dark:border-[#1E3A5F] bg-[#F5F8FF] dark:bg-[#162032] p-3 flex flex-col gap-1">
              <p className="text-[12px] text-slate-500 px-1 pb-1">Documents de {chantier.client_name || "ce client"} sans chantier</p>
              {[...attachable.quotes.map((d) => ({ ...d, type: "quote" as const })), ...attachable.invoices.map((d) => ({ ...d, type: "invoice" as const }))].map((d) => (
                <button
                  key={d.type + d.id}
                  type="button"
                  disabled={busy !== null}
                  onClick={() => run("attach-" + d.id, () => onAttach(d.type, d.id, true), `${d.number} rattaché au chantier`)}
                  className="flex items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-white dark:hover:bg-[#0F1E35] disabled:opacity-60"
                >
                  {d.type === "quote" ? <FileCheck2 className="w-4 h-4 text-slate-400 shrink-0" /> : <FileText className="w-4 h-4 text-slate-400 shrink-0" />}
                  <span className="flex-1 min-w-0 text-[13px]"><span className="font-mono font-bold text-[#2563EB]">{d.number}</span> <span className="text-slate-500">· {fmtDate(d.issue_date)}</span></span>
                  <span className="font-mono text-[13px] font-bold text-[#0F172A] dark:text-[#E2E8F0]">{formatCurrency(d.total_ttc)}</span>
                  {busy === "attach-" + d.id ? <Loader2 className="w-4 h-4 animate-spin text-[#2563EB]" /> : <Plus className="w-4 h-4 text-[#2563EB]" />}
                </button>
              ))}
            </div>
          )}

          {docs.length === 0 ? (
            <p className="px-5 pb-6 text-sm text-slate-500">Aucun document rattaché. Créez un devis ou une facture, ou rattachez un document existant du client.</p>
          ) : (
            <ul className="divide-y divide-[#F1F5F9] dark:divide-[#162032] border-t border-[#F1F5F9] dark:border-[#162032]">
              {docs.map((d) => (
                <li key={d.type + d.id} className="flex items-center gap-3 px-4 md:px-5 py-3">
                  {d.type === "quote" ? <FileCheck2 className="w-4 h-4 text-slate-400 shrink-0" /> : <FileText className="w-4 h-4 text-slate-400 shrink-0" />}
                  <Link href={d.type === "quote" ? hrefs.quote(d.id) : hrefs.invoice(d.id)} className="flex-1 min-w-0 group">
                    <span className="block font-mono text-[13px] font-bold text-[#2563EB] group-hover:underline">{d.number}</span>
                    <span className="block text-[12px] text-slate-500">
                      {d.type === "quote" ? "Devis" : "Facture"} · {fmtDate(d.issue_date)} · {d.type === "quote" ? QUOTE_STATUS_LABELS[d.status as QuoteStatus] ?? d.status : INVOICE_STATUS_LABELS[d.status as InvoiceStatus] ?? d.status}
                    </span>
                  </Link>
                  <span className="font-mono text-[13px] font-bold text-[#0F172A] dark:text-[#E2E8F0]">{formatCurrency(d.total_ttc)}</span>
                  <button
                    type="button"
                    aria-label={`Détacher ${d.number} du chantier`}
                    title="Détacher du chantier"
                    disabled={busy !== null}
                    onClick={() => run("detach-" + d.id, () => onAttach(d.type, d.id, false), `${d.number} détaché du chantier`)}
                    className="w-8 h-8 grid place-items-center rounded-lg text-slate-400 hover:text-[#B91C1C] hover:bg-[#FEF2F2] dark:hover:bg-[#451a1a]/40 disabled:opacity-50"
                  >
                    {busy === "detach-" + d.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlink className="w-4 h-4" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── Lots et conditions ── */}
        <div className="flex flex-col gap-4">
          <section className="rounded-2xl border border-white/60 dark:border-[#1E3A5F] p-4 flex flex-col gap-2" style={cardStyle}>
            <h2 className="text-[15px] font-bold text-[#0F172A] dark:text-[#E2E8F0]">Lots du marché</h2>
            {chantier.lots.length === 0 ? (
              <p className="text-[13px] text-slate-500">Aucun lot : le marché est calculé d’après les devis acceptés.</p>
            ) : (
              <>
                {chantier.lots.map((l, i) => (
                  <div key={i} className="flex justify-between gap-3 text-[13px] py-1.5 border-b border-[#F1F5F9] dark:border-[#162032]">
                    <span className="text-slate-600 dark:text-slate-300">{l.label}</span>
                    <span className="font-mono font-semibold text-[#0F172A] dark:text-[#E2E8F0] whitespace-nowrap">{formatCurrency(l.amount_ht)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-[13px] font-bold pt-1"><span>Total HT</span><span className="font-mono">{formatCurrency(m.marketHt)}</span></div>
              </>
            )}
          </section>
          <section className="rounded-2xl border border-white/60 dark:border-[#1E3A5F] p-4 flex flex-col gap-2 text-[13px]" style={cardStyle}>
            <h2 className="text-[15px] font-bold text-[#0F172A] dark:text-[#E2E8F0]">Conditions</h2>
            <p className="flex justify-between gap-3"><span className="text-slate-500">Retenue de garantie</span><span className="font-semibold">{chantier.retenue_garantie ? `${chantier.retenue_rate} %` : "Non"}</span></p>
            <p className="flex justify-between gap-3"><span className="text-slate-500">Autoliquidation de la TVA</span><span className="font-semibold">{chantier.autoliquidation ? "Oui (sous-traitance)" : "Non"}</span></p>
            {chantier.autoliquidation && <p className="text-[12px] text-slate-500 leading-relaxed">Mention à porter sur les factures : « Autoliquidation — article 283-2 nonies du CGI ».</p>}
            {chantier.notes && <p className="text-slate-600 dark:text-slate-300 whitespace-pre-line border-t border-[#F1F5F9] dark:border-[#162032] pt-2">{chantier.notes}</p>}
          </section>
          <button
            type="button"
            disabled={busy !== null}
            onClick={async () => {
              if (!window.confirm("Supprimer ce chantier ? Ses devis et factures sont conservés, simplement détachés.")) return
              await run("delete", onDelete, "Chantier supprimé")
            }}
            className={cn("inline-flex items-center justify-center gap-2 h-10 rounded-xl border border-[#FECACA] bg-white dark:bg-[#0F1E35] text-[#B91C1C] text-sm font-bold hover:bg-[#FEF2F2] disabled:opacity-60 transition-colors")}
          >
            {busy === "delete" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}Supprimer le chantier
          </button>
        </div>
      </div>
    </div>
  )
}

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-white/60 dark:border-[#1E3A5F] p-4 flex flex-col gap-1.5" style={cardStyle}>
      <span className="text-[13px] text-slate-500">{label}</span>
      <span className="font-mono text-[20px] md:text-[24px] font-bold tracking-tight text-[#0F172A] dark:text-[#E2E8F0]">{value}</span>
      <span className="text-[12px] text-slate-500 leading-snug">{sub}</span>
    </div>
  )
}
