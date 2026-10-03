"use client"

/**
 * Acompte libre (formule Artisan) : facture d'acompte sans devis enregistré,
 * pour une commande passée de vive voix ou sur un bon du client. Elle se
 * rattache ensuite au devis signé pour être reprise. Aperçu calculé avec la
 * fonction que la route rejoue (lib/artisan/build.ts, buildFreeDeposit).
 */
import { useMemo, useState } from "react"
import { AlertTriangle, Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Switch } from "@/components/app/kit"
import { buildFreeDeposit, parseFreeDeposit } from "@/lib/artisan/build"
import { REVERSE_CHARGE_CONDITIONS } from "@/lib/artisan/reverse-charge"
import { ArtisanTag, money } from "./ui"

export function FreeDepositDialog({
  open, onOpenChange, clientId, clientName, chantier, defaultReverseCharge, today, submitting, onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  clientId: string
  clientName?: string | null
  chantier: { id: string; name: string } | null
  defaultReverseCharge?: boolean
  today: string
  submitting?: boolean
  onSubmit: (body: Record<string, unknown>) => void
}) {
  const [label, setLabel] = useState(chantier ? `Acompte à la commande — ${chantier.name}` : "Acompte à la commande")
  const [amount, setAmount] = useState("")
  const [rate, setRate] = useState("20")
  const [reverse, setReverse] = useState(Boolean(defaultReverseCharge))

  const body = useMemo(() => ({
    client_id: clientId,
    chantier_id: chantier?.id ?? null,
    label,
    amount_ttc: parseFloat(amount.replace(/\s/g, "").replace(",", ".")),
    vat_rate: Number(rate),
    autoliquidation: reverse,
  }), [clientId, chantier, label, amount, rate, reverse])

  const result = useMemo(() => {
    const input = parseFreeDeposit(body)
    if ("error" in input) return { error: amount ? input.error : null, preview: null }
    const p = buildFreeDeposit(input, chantier, today)
    return "error" in p ? { error: p.error, preview: null } : { error: null, preview: p }
  }, [body, chantier, today, amount])

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!submitting) onOpenChange(o) }}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto p-0 sm:max-w-[520px]">
        <div className="flex flex-col gap-1 px-[22px] pr-14 pt-5">
          <ArtisanTag className="self-start" />
          <DialogTitle className="q-display text-[22px] leading-tight text-[var(--q-ink)]">Acompte libre</DialogTitle>
          <DialogDescription className="text-sm text-[var(--q-text-4)]">
            Facture d&apos;acompte sans devis{clientName ? `, pour ${clientName}` : ""}. Rattachez-la ensuite au devis signé pour qu&apos;elle soit reprise.
          </DialogDescription>
        </div>
        <div className="flex flex-col gap-4 px-[22px] pb-5 pt-4">
          <label className="flex flex-col gap-1.5">
            <span className="q-label">Objet</span>
            <input className="q-input" value={label} maxLength={200} onChange={(e) => setLabel(e.target.value)} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="q-label">Montant TTC</span>
              <input className="q-input tabular-nums" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="1 500" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="q-label">TVA</span>
              <select className="q-input" value={reverse ? "0" : rate} disabled={reverse} onChange={(e) => setRate(e.target.value)}>
                {["20", "10", "5.5", "0"].map((r) => <option key={r} value={r}>{r.replace(".", ",")} %</option>)}
              </select>
            </label>
          </div>
          <div className="flex items-start justify-between gap-4">
            <span className="flex flex-col gap-1">
              <span className="q-label">Sous-traitance, autoliquidation</span>
              <span className="q-field-hint">{REVERSE_CHARGE_CONDITIONS[0]}</span>
            </span>
            <Switch checked={reverse} onCheckedChange={setReverse} label="Autoliquidation" />
          </div>
          {result.error && (
            <div className="q-banner q-banner-warn text-[13px]" role="status"><AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /><p>{result.error}</p></div>
          )}
          {result.preview && (
            <div className="q-inset flex flex-col gap-1 p-3.5 text-sm tabular-nums">
              <div className="flex justify-between gap-4 text-[var(--q-text-3)]"><span>Total HT</span><span>{money(result.preview.subtotal_ht)}</span></div>
              <div className="flex justify-between gap-4 text-[var(--q-text-3)]"><span>TVA</span><span>{money(result.preview.total_vat)}</span></div>
              <div className="flex justify-between gap-4 font-semibold"><span>Total TTC</span><span>{money(result.preview.total_ttc)}</span></div>
            </div>
          )}
        </div>
        <div
          className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--q-line-soft)] bg-[var(--q-surface-2)] px-[22px] py-4"
          style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom, 16px))" }}
        >
          <button type="button" className="q-btn q-btn-ghost" onClick={() => onOpenChange(false)} disabled={submitting}>Annuler</button>
          <button type="button" className="q-btn q-btn-primary" disabled={!result.preview || submitting} onClick={() => onSubmit(body)}>
            {submitting && <Loader2 className="animate-spin" aria-hidden />}
            Créer le brouillon
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
