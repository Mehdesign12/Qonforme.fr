'use client'

/**
 * Vue Relances : file des relances que le cron enverra, historique, factures
 * déjà relancées deux fois. Présentationnelle : la page réelle branche
 * `onRemind` sur /api/invoices/[id]/remind, la démo sur une simulation locale.
 */

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { AlertTriangle, BellRing, CheckCircle2, ChevronRight, Loader2, MailX, Send } from "lucide-react"
import { formatCurrency } from "@/lib/utils/invoice"
import { fmtDay, isoDay } from "@/lib/treasury/forecast"
import { buildReminderQueue, REMINDER_DELAYS, type ReminderInvoice } from "@/lib/reminders/queue"
import { cn } from "@/lib/utils"

const cardStyle: React.CSSProperties = {
  background: "var(--card-glass-bg)",
  boxShadow:  "var(--card-glass-shadow)",
}

export type RemindResult = { ok: true; step: 1 | 2; sentTo: string } | { ok: false; message: string }

interface Props {
  invoices:     ReminderInvoice[] | null
  error?:       string | null
  invoiceHref:  (id: string) => string
  treasuryHref: string
  onRemind:     (id: string) => Promise<RemindResult>
}

type Tab = "upcoming" | "sent" | "exhausted"

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`
const stepLabel = (s: 1 | 2) => `Relance ${s} · J+${REMINDER_DELAYS[s]}`

export function RemindersView({ invoices, error, invoiceHref, treasuryHref, onRemind }: Props) {
  const [list, setList]       = useState<ReminderInvoice[] | null>(invoices)
  const [today, setToday]     = useState<string | null>(null)
  const [tab, setTab]         = useState<Tab>("upcoming")
  const [sending, setSending] = useState<string | null>(null)

  useEffect(() => setList(invoices), [invoices])
  useEffect(() => setToday(isoDay(new Date())), [])

  const q = useMemo(() => (list && today ? buildReminderQueue(list, today) : null), [list, today])

  if (error) {
    return (
      <div className="max-w-[1200px] mx-auto rounded-2xl border border-white/60 dark:border-[#1E3A5F] px-6 py-10 text-center" style={cardStyle}>
        <p className="text-[15px] font-bold text-[#0F172A] dark:text-[#E2E8F0] mb-1">Les relances n’ont pas pu être chargées</p>
        <p className="text-sm text-slate-500">{error}</p>
      </div>
    )
  }
  if (!q) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 text-[#2563EB] animate-spin" />
      </div>
    )
  }

  const remind = async (id: string, client: string) => {
    setSending(id)
    const r = await onRemind(id)
    setSending(null)
    if (!r.ok) { toast.error(r.message); return }
    const now = new Date().toISOString()
    setList((cur) => (cur ?? []).map((i) => (i.id !== id ? i : {
      ...i,
      status: "overdue",
      ...(r.step === 1 ? { reminder_1_sent_at: now } : { reminder_2_sent_at: now }),
    })))
    toast.success(`Relance ${r.step} envoyée à ${client} (${r.sentTo})`)
  }

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: "upcoming",  label: "À venir",   count: q.upcoming.length },
    { key: "sent",      label: "Envoyées",  count: q.sent.length },
    { key: "exhausted", label: "À traiter", count: q.exhausted.length },
  ]

  return (
    <div className="space-y-4 max-w-[1200px] mx-auto">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Qonforme relance vos clients par email : une première fois {REMINDER_DELAYS[1]} jours après l’échéance, une seconde à {REMINDER_DELAYS[2]} jours. Vous recevez une copie de chaque relance.
      </p>

      {/* ── Chiffres clés ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className={cn("rounded-2xl border p-4 flex flex-col gap-1.5", q.stats.lateCount ? "border-[#F5DDB5] dark:border-[#92400E]/50" : "border-white/60 dark:border-[#1E3A5F]")} style={cardStyle}>
          <span className={cn("flex items-center gap-1.5 text-[13px] font-semibold", q.stats.lateCount ? "text-[#B45309] dark:text-[#FBBF24]" : "text-slate-500")}><AlertTriangle className="w-3.5 h-3.5" />En retard</span>
          <span className="font-mono text-[22px] md:text-[26px] font-bold tracking-tight text-[#0F172A] dark:text-[#E2E8F0]">{formatCurrency(q.stats.lateAmount)}</span>
          <span className="text-[12px] text-slate-500">{q.stats.lateCount ? plural(q.stats.lateCount, "facture échue", "factures échues") : "Aucune facture échue"}</span>
        </div>
        <div className="rounded-2xl border border-white/60 dark:border-[#1E3A5F] p-4 flex flex-col gap-1.5" style={cardStyle}>
          <span className="text-[13px] text-slate-500">Prochains 10 jours</span>
          <span className="font-mono text-[22px] md:text-[26px] font-bold tracking-tight text-[#0F172A] dark:text-[#E2E8F0]">{q.stats.next10Count}</span>
          <span className="text-[12px] text-slate-500">{q.stats.next10Count > 1 ? "relances programmées" : "relance programmée"}</span>
        </div>
        <div className="rounded-2xl border border-white/60 dark:border-[#1E3A5F] p-4 flex flex-col gap-1.5" style={cardStyle}>
          <span className="text-[13px] text-slate-500">Envoyées, 30 jours</span>
          <span className="font-mono text-[22px] md:text-[26px] font-bold tracking-tight text-[#0F172A] dark:text-[#E2E8F0]">{q.stats.sent30Count}</span>
          <span className="text-[12px] text-slate-500">automatiques et manuelles</span>
        </div>
        <div className="rounded-2xl bg-[#0A1122] p-4 flex flex-col gap-1.5">
          <span className="text-[13px] text-[#AFBDD3]">Relancées deux fois</span>
          <span className="font-mono text-[22px] md:text-[26px] font-bold tracking-tight text-white">{q.exhausted.length}</span>
          <span className="text-[12px] text-[#94A3B8]">{q.exhausted.length ? "toujours impayées, à traiter" : "rien à traiter"}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-4 items-start">
        <div className="flex flex-col gap-3 min-w-0">
          {/* ── Onglets ── */}
          <div role="tablist" aria-label="Relances" className="flex items-center gap-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-semibold border transition-all whitespace-nowrap flex items-center gap-1.5",
                  tab === t.key
                    ? "bg-[#2563EB] text-white border-[#2563EB] shadow-sm"
                    : "bg-white/80 dark:bg-[#0F1E35]/80 text-slate-600 dark:text-slate-400 border-[#E2E8F0] dark:border-[#1E3A5F] hover:border-[#2563EB] hover:text-[#2563EB]"
                )}
              >
                {t.label}
                <span className={cn("font-mono text-[11px]", tab === t.key ? "text-white/80" : "text-slate-400")}>{t.count}</span>
              </button>
            ))}
          </div>

          <section aria-label="Liste des relances" className="rounded-2xl border border-white/60 dark:border-[#1E3A5F] overflow-hidden" style={cardStyle}>
            {tab === "upcoming" && (q.upcoming.length === 0 ? (
              <Empty text="Aucune relance programmée : aucune facture envoyée n’est en attente de paiement." />
            ) : (
              <ul className="divide-y divide-[#F1F5F9] dark:divide-[#162032]">
                {q.upcoming.map((r) => (
                  <li key={r.id} className="flex flex-wrap sm:flex-nowrap items-center gap-x-3 gap-y-2 px-4 md:px-5 py-3">
                    <span className={cn("w-[86px] shrink-0 text-[12px] font-semibold", r.ready ? "text-[#B45309]" : "text-slate-500")}>
                      {r.ready ? "Au prochain envoi" : fmtDay(r.date)}
                    </span>
                    <Link href={invoiceHref(r.id)} className="flex-1 min-w-[140px] group">
                      <span className="block text-[13px] font-semibold text-[#0F172A] dark:text-[#E2E8F0] truncate group-hover:text-[#2563EB]">{r.client}</span>
                      <span className="block text-[12px] text-slate-500"><span className="font-mono text-[#2563EB]">{r.number}</span> · {stepLabel(r.step)}{r.daysLate ? ` · ${plural(r.daysLate, "jour", "jours")} de retard` : ""}</span>
                    </Link>
                    <span className="w-24 text-right font-mono text-[13px] font-bold text-[#0F172A] dark:text-[#E2E8F0] shrink-0">{formatCurrency(r.amount)}</span>
                    {r.daysLate === 0 ? (
                      <span className="text-[12px] text-slate-400 whitespace-nowrap">Échéance le {fmtDay(r.due_date)}</span>
                    ) : r.noEmail ? (
                      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold bg-[#FEF2F2] text-[#B91C1C] whitespace-nowrap" title="Ajoutez l’email du client pour qu’il soit relancé">
                        <MailX className="w-3 h-3" />Email manquant
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={sending !== null}
                        onClick={() => remind(r.id, r.client)}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-[#DDE3EC] dark:border-[#1E3A5F] bg-white dark:bg-[#0F1E35] text-[12px] font-bold text-[#0F172A] dark:text-[#E2E8F0] hover:border-[#2563EB] hover:text-[#2563EB] disabled:opacity-50 transition-colors whitespace-nowrap"
                      >
                        {sending === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        Relancer maintenant
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            ))}

            {tab === "sent" && (q.sent.length === 0 ? (
              <Empty text="Aucune relance envoyée pour l’instant." />
            ) : (
              <ul className="divide-y divide-[#F1F5F9] dark:divide-[#162032]">
                {q.sent.map((r) => (
                  <li key={`${r.id}-${r.step}`}>
                    <Link href={invoiceHref(r.id)} className="flex items-center gap-3 px-4 md:px-5 py-3 hover:bg-[#F8FAFC] dark:hover:bg-[#162032] transition-colors">
                      <span className="w-[86px] shrink-0 font-mono text-[12px] text-slate-500">{fmtDay(r.date)}</span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-[13px] font-semibold text-[#0F172A] dark:text-[#E2E8F0] truncate">{r.client}</span>
                        <span className="block text-[12px] text-slate-500"><span className="font-mono text-[#2563EB]">{r.number}</span> · {stepLabel(r.step)}</span>
                      </span>
                      <span className="hidden sm:block w-24 text-right font-mono text-[13px] font-bold text-[#0F172A] dark:text-[#E2E8F0] shrink-0">{formatCurrency(r.amount)}</span>
                      <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold whitespace-nowrap", r.paid ? "bg-[#D1FAE5] text-[#065F46]" : "bg-[#F1F5F9] text-[#475569] dark:bg-[#162032] dark:text-slate-300")}>
                        {r.paid ? <><CheckCircle2 className="w-3 h-3" />Réglée</> : "Impayée"}
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                    </Link>
                  </li>
                ))}
              </ul>
            ))}

            {tab === "exhausted" && (q.exhausted.length === 0 ? (
              <Empty text="Aucune facture n’a épuisé ses deux relances." />
            ) : (
              <ul className="divide-y divide-[#F1F5F9] dark:divide-[#162032]">
                {q.exhausted.map((r) => (
                  <li key={r.id}>
                    <Link href={invoiceHref(r.id)} className="flex items-center gap-3 px-4 md:px-5 py-3 hover:bg-[#F8FAFC] dark:hover:bg-[#162032] transition-colors">
                      <span className="flex-1 min-w-0">
                        <span className="block text-[13px] font-semibold text-[#0F172A] dark:text-[#E2E8F0] truncate">{r.client}</span>
                        <span className="block text-[12px] text-slate-500"><span className="font-mono text-[#2563EB]">{r.number}</span> · {plural(r.daysLate, "jour", "jours")} de retard</span>
                      </span>
                      <span className="w-24 text-right font-mono text-[13px] font-bold text-[#0F172A] dark:text-[#E2E8F0] shrink-0">{formatCurrency(r.amount)}</span>
                      <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                    </Link>
                  </li>
                ))}
                <li className="px-4 md:px-5 py-3 text-[12px] leading-relaxed text-slate-500">
                  Deux relances sont restées sans effet : un appel au client, puis une mise en demeure par lettre recommandée, sont les étapes suivantes.
                </li>
              </ul>
            ))}
          </section>
        </div>

        {/* ── Le scénario ── */}
        <div className="flex flex-col gap-4">
          <section className="rounded-2xl border border-white/60 dark:border-[#1E3A5F] p-4 flex flex-col" style={cardStyle}>
            <h2 className="flex items-center gap-2 text-[15px] font-bold text-[#0F172A] dark:text-[#E2E8F0] mb-1"><BellRing className="w-4 h-4 text-[#2563EB]" />Le scénario</h2>
            {[
              [`J+${REMINDER_DELAYS[1]} · rappel courtois`, "Le détail de la facture et vos coordonnées bancaires, sur un ton cordial."],
              [`J+${REMINDER_DELAYS[2]} · dernier rappel`, "Ton ferme, mention d’une procédure de recouvrement possible."],
              ["À tout moment · relance manuelle", "Le bouton « Relancer maintenant » envoie la prochaine relance sans attendre."],
            ].map(([t, d]) => (
              <div key={t} className="py-2.5 border-t border-[#F1F5F9] dark:border-[#162032] first:border-t-0">
                <p className="text-[13px] font-semibold text-[#0F172A] dark:text-[#E2E8F0]">{t}</p>
                <p className="text-[12px] text-slate-500 leading-relaxed">{d}</p>
              </div>
            ))}
          </section>
          <section className="rounded-2xl bg-[#EEF3FF] dark:bg-[#1E3A5F]/40 p-4 text-[13px] leading-relaxed text-[#1E3A8A] dark:text-[#BFDBFE]">
            Une relance s’arrête dès que la facture est marquée payée. Pour suivre l’argent attendu semaine par semaine, ouvrez la{" "}
            <Link href={treasuryHref} className="font-bold underline underline-offset-2">trésorerie</Link>.
          </section>
        </div>
      </div>
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <p className="px-5 py-12 text-center text-sm text-slate-500">{text}</p>
}
