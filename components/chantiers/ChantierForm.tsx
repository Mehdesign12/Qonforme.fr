'use client'

/**
 * Création d'un chantier : client, adresse, dates, lots du marché, retenue de
 * garantie, autoliquidation. Champs à 16 px sur mobile (règle iOS, CLAUDE.md).
 */

import { useMemo, useState } from "react"
import Link from "next/link"
import { Info, Loader2, Plus, Trash2 } from "lucide-react"
import { formatCurrency } from "@/lib/utils/invoice"
import { cleanLots } from "@/lib/chantiers/metrics"
import { cn } from "@/lib/utils"
import { cardStyle } from "@/components/chantiers/shared"

export interface FormClient {
  id:      string
  name:    string
  address: string
}

export interface ChantierPayload {
  name:             string
  client_id:        string | null
  address:          string
  start_date:       string | null
  end_date:         string | null
  lots:             { label: string; amount_ht: number }[]
  retenue_garantie: boolean
  retenue_rate:     number
  autoliquidation:  boolean
  notes:            string
}

export type SubmitResult = { ok: true; id: string } | { ok: false; message: string }

interface Props {
  clients:    FormClient[] | null
  cancelHref: string
  onSubmit:   (p: ChantierPayload) => Promise<SubmitResult>
  onCreated:  (id: string) => void
}

const input =
  "w-full h-11 rounded-xl border border-[#DDE3EC] dark:border-[#1E3A5F] bg-white dark:bg-[#0F1E35] px-3 text-base md:text-sm text-[#0F172A] dark:text-[#E2E8F0] outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15"
const label = "text-[13px] font-semibold text-[#0F172A] dark:text-[#E2E8F0]"

function Switch({ on, onChange, aria }: { on: boolean; onChange: (v: boolean) => void; aria: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={aria}
      onClick={() => onChange(!on)}
      className={cn("relative w-11 h-6 rounded-full transition-colors shrink-0", on ? "bg-[#2563EB]" : "bg-[#CBD5E1] dark:bg-[#1E3A5F]")}
    >
      <span className={cn("absolute top-[3px] w-[18px] h-[18px] rounded-full bg-white shadow transition-all", on ? "left-[23px]" : "left-[3px]")} />
    </button>
  )
}

export function ChantierForm({ clients, cancelHref, onSubmit, onCreated }: Props) {
  const [name, setName]         = useState("")
  const [clientId, setClientId] = useState("")
  const [address, setAddress]   = useState("")
  const [start, setStart]       = useState("")
  const [end, setEnd]           = useState("")
  const [lots, setLots]         = useState<{ label: string; amount: string }[]>([{ label: "", amount: "" }])
  const [rg, setRg]             = useState(false)
  const [rate, setRate]         = useState("5")
  const [autoliq, setAutoliq]   = useState(false)
  const [notes, setNotes]       = useState("")
  const [saving, setSaving]     = useState(false)
  const [err, setErr]           = useState<string | null>(null)

  const clean = useMemo(() => cleanLots(lots.map((l) => ({ label: l.label, amount_ht: l.amount }))), [lots])
  const totalHt = clean.reduce((s, l) => s + l.amount_ht, 0)
  const rateNum = Math.min(5, Math.max(0, Number(rate.replace(",", ".")) || 0))

  const pickClient = (id: string) => {
    setClientId(id)
    const c = clients?.find((x) => x.id === id)
    if (c && !address.trim()) setAddress(c.address)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null)
    if (!name.trim()) { setErr("Donnez un nom au chantier"); return }
    if (start && end && end < start) { setErr("La fin prévue précède le début"); return }
    setSaving(true)
    const r = await onSubmit({
      name: name.trim(),
      client_id: clientId || null,
      address: address.trim(),
      start_date: start || null,
      end_date: end || null,
      lots: clean,
      retenue_garantie: rg,
      retenue_rate: rateNum,
      autoliquidation: autoliq,
      notes: notes.trim(),
    })
    setSaving(false)
    if (r.ok) onCreated(r.id)
    else setErr(r.message)
  }

  return (
    <form onSubmit={submit} className="space-y-4 max-w-[1200px] mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500 dark:text-slate-400">Un chantier regroupe le marché, ses lots, et tous ses devis et factures.</p>
        <div className="flex gap-2">
          <Link href={cancelHref} className="inline-flex items-center h-10 px-4 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-[#162032]">Annuler</Link>
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-bold disabled:opacity-60 transition-colors">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}Créer le chantier
          </button>
        </div>
      </div>

      {err && <p role="alert" className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#B91C1C]">{err}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-4 items-start">
        <div className="flex flex-col gap-4 min-w-0">
          <section className="rounded-2xl border border-white/60 dark:border-[#1E3A5F] p-4 md:p-5 flex flex-col gap-3" style={cardStyle}>
            <h2 className="text-[15px] font-bold text-[#0F172A] dark:text-[#E2E8F0]">Le chantier</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="ch-name" className={label}>Nom du chantier</label>
                <input id="ch-name" className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Résidence Les Acacias" maxLength={160} required />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="ch-client" className={label}>Client</label>
                <select id="ch-client" className={input} value={clientId} onChange={(e) => pickClient(e.target.value)} disabled={!clients}>
                  <option value="">{clients ? "Sans client pour l’instant" : "Chargement…"}</option>
                  {(clients ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label htmlFor="ch-addr" className={label}>Adresse du chantier</label>
                <input id="ch-addr" className={input} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="4 quai de la Loire, 44000 Nantes" maxLength={300} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="ch-start" className={label}>Début</label>
                <input id="ch-start" type="date" className={input} value={start} onChange={(e) => setStart(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="ch-end" className={label}>Fin prévue</label>
                <input id="ch-end" type="date" className={input} value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} />
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/60 dark:border-[#1E3A5F] overflow-hidden" style={cardStyle}>
            <div className="flex items-center justify-between px-4 md:px-5 py-4">
              <h2 className="text-[15px] font-bold text-[#0F172A] dark:text-[#E2E8F0]">Lots du marché</h2>
              <span className="text-[12px] text-slate-400">Facultatif · pour suivre l’avancement</span>
            </div>
            <div className="border-t border-[#F1F5F9] dark:border-[#162032] divide-y divide-[#F1F5F9] dark:divide-[#162032]">
              {lots.map((l, i) => (
                <div key={i} className="flex items-center gap-2 px-4 md:px-5 py-2.5">
                  <input
                    aria-label={`Nom du lot ${i + 1}`}
                    className={cn(input, "flex-1")}
                    value={l.label}
                    placeholder="Doublages et isolation"
                    onChange={(e) => setLots(lots.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                  />
                  <input
                    aria-label={`Montant HT du lot ${i + 1}`}
                    className={cn(input, "w-28 md:w-32 text-right font-mono")}
                    inputMode="decimal"
                    value={l.amount}
                    placeholder="0,00"
                    onChange={(e) => setLots(lots.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))}
                  />
                  <button
                    type="button"
                    aria-label={`Supprimer le lot ${i + 1}`}
                    onClick={() => setLots(lots.length > 1 ? lots.filter((_, j) => j !== i) : [{ label: "", amount: "" }])}
                    className="w-9 h-9 grid place-items-center rounded-lg text-slate-400 hover:text-[#B91C1C] hover:bg-[#FEF2F2] shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="px-4 md:px-5 py-3 border-t border-[#F1F5F9] dark:border-[#162032]">
              <button type="button" onClick={() => setLots([...lots, { label: "", amount: "" }])} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#2563EB]">
                <Plus className="w-4 h-4" />Ajouter un lot
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-white/60 dark:border-[#1E3A5F] p-4 md:p-5 flex flex-col gap-1.5" style={cardStyle}>
            <label htmlFor="ch-notes" className={label}>Notes internes</label>
            <textarea id="ch-notes" rows={3} className={cn(input, "h-auto py-2.5 leading-relaxed")} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Accès, contact sur place, contraintes…" maxLength={2000} />
          </section>
        </div>

        <div className="flex flex-col gap-4">
          <section className="rounded-2xl border border-white/60 dark:border-[#1E3A5F] p-4 flex flex-col gap-3" style={cardStyle}>
            <h2 className="text-[15px] font-bold text-[#0F172A] dark:text-[#E2E8F0]">Marché</h2>
            <div className="flex justify-between text-[13px]"><span className="text-slate-500">Total des lots HT</span><span className="font-mono font-semibold">{formatCurrency(totalHt)}</span></div>
            <div className="flex justify-between text-[13px]"><span className="text-slate-500">TVA 20 %</span><span className="font-mono">{formatCurrency(Math.round(totalHt * 20) / 100)}</span></div>
            <div className="flex justify-between text-[14px] font-bold pt-2 border-t border-[#F1F5F9] dark:border-[#162032]"><span>Total TTC</span><span className="font-mono">{formatCurrency(Math.round(totalHt * 120) / 100)}</span></div>

            <div className="flex items-center gap-3 pt-3 border-t border-[#F1F5F9] dark:border-[#162032]">
              <span className="flex-1">
                <span className="block text-[13px] font-semibold text-[#0F172A] dark:text-[#E2E8F0]">Retenue de garantie</span>
                <span className="block text-[12px] text-slate-500">{rg ? `${formatCurrency(Math.round(totalHt * 1.2 * rateNum) / 100)} retenus sur le marché` : "Jusqu’à 5 %, libérée un an après réception"}</span>
              </span>
              <Switch on={rg} onChange={setRg} aria="Retenue de garantie" />
            </div>
            {rg && (
              <div className="flex items-center gap-2">
                <label htmlFor="ch-rate" className="text-[13px] text-slate-500">Taux</label>
                <input id="ch-rate" className={cn(input, "w-20 text-right font-mono")} inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
                <span className="text-[13px] text-slate-500">% (5 % maximum)</span>
              </div>
            )}
            <div className="flex items-center gap-3">
              <span className="flex-1">
                <span className="block text-[13px] font-semibold text-[#0F172A] dark:text-[#E2E8F0]">Autoliquidation de la TVA</span>
                <span className="block text-[12px] text-slate-500">Sous-traitance : article 283-2 nonies du CGI</span>
              </span>
              <Switch on={autoliq} onChange={setAutoliq} aria="Autoliquidation de la TVA" />
            </div>
          </section>
          <section className="rounded-2xl bg-[#EEF3FF] dark:bg-[#1E3A5F]/40 p-4 flex gap-3 text-[13px] leading-relaxed text-[#1E3A8A] dark:text-[#BFDBFE]">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <span>Sans lots, le marché est calculé d’après les devis acceptés rattachés au chantier. Vous pourrez rattacher les devis et factures existants du client depuis la fiche.</span>
          </section>
        </div>
      </div>
    </form>
  )
}
