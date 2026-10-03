"use client"

/**
 * « Importer les prestations courantes de votre métier » (catalogue) : liste
 * des prestations types du métier (lib/catalogue/trades.ts), cochées par
 * l'artisan, avec l'unité et le taux de TVA proposé selon le chantier type.
 * Aucun prix proposé : chaque prix se saisit ici ou plus tard ; vide, la
 * prestation est importée « Prix à compléter ».
 *
 * Fenêtre centrée sur ordinateur, feuille du bas sur mobile (comme la fiche
 * prestation). Même composant pour la démo.
 */
import { useMemo, useState } from "react"
import { Check, Info, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { TRADES, isTradeId, type TradeId, type VatRegime } from "@/lib/legal/profile"
import {
  VAT_CONTEXTS, normalizeProductName, proposedVatRate, tradeItems,
  type VatContext,
} from "@/lib/catalogue/trades"

export interface TradeImportRequest {
  trade: TradeId
  context: VatContext
  items: { id: string; unit_price_ht: number | null }[]
}

const formatVat = (rate: number) => `${String(rate).replace(".", ",")} %`

/** Prix saisi à la française (« 1 250,50 ») → nombre, null si vide, NaN si illisible. */
function parsePrice(raw: string): number | null {
  const clean = raw.replace(/[\s  €]/g, "").replace(",", ".")
  if (!clean) return null
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return NaN
  return Number(clean)
}

export function TradeImportDialog({
  open,
  onClose,
  trade: initialTrade,
  vatRegime,
  existingNames,
  onImport,
}: {
  open: boolean
  onClose: () => void
  /** Métier du profil (Paramètres › Entreprise), présélectionné. */
  trade: TradeId | null
  /** Régime de TVA du profil : en franchise, prestations à 0 %. */
  vatRegime: VatRegime | null
  /** Désignations déjà au catalogue : signalées et décochées. */
  existingNames: string[]
  /** Renvoie vrai si l'import a réussi (la fenêtre se ferme). */
  onImport: (request: TradeImportRequest) => Promise<boolean> | boolean
}) {
  const [trade, setTrade] = useState<TradeId | "">(initialTrade ?? "")
  const [context, setContext] = useState<VatContext | "">(vatRegime === "franchise" ? "franchise" : "")
  const existing = useMemo(() => new Set(existingNames.map(normalizeProductName)), [existingNames])
  const items = useMemo(() => tradeItems(trade || null), [trade])
  const [checked, setChecked] = useState<Set<string>>(() => defaultChecked(initialTrade, existing))
  const [prices, setPrices] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function defaultChecked(t: TradeId | "" | null, known: Set<string>): Set<string> {
    return new Set(tradeItems(t || null).filter((i) => !known.has(normalizeProductName(i.name))).map((i) => i.id))
  }

  function chooseTrade(value: string) {
    const next = isTradeId(value) ? value : ""
    setTrade(next)
    setChecked(defaultChecked(next, existing))
    setPrices({})
    setError(null)
  }

  const importable = items.filter((i) => !existing.has(normalizeProductName(i.name)))
  const selected = importable.filter((i) => checked.has(i.id))
  const invalidPrice = selected.find((i) => Number.isNaN(parsePrice(prices[i.id] ?? "")))
  const allChecked = importable.length > 0 && selected.length === importable.length

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function submit() {
    if (!trade || !context || selected.length === 0 || saving) return
    if (invalidPrice) { setError(`Prix illisible pour « ${invalidPrice.name} » : chiffres seulement, par exemple 45 ou 45,50.`); return }
    setSaving(true)
    setError(null)
    try {
      const done = await onImport({
        trade,
        context,
        items: selected.map((i) => ({ id: i.id, unit_price_ht: parsePrice(prices[i.id] ?? "") })),
      })
      if (done) onClose()
    } finally {
      setSaving(false)
    }
  }

  const contexts = VAT_CONTEXTS.filter((c) => (vatRegime === "franchise" ? c.id === "franchise" : vatRegime === "assujetti" ? c.id !== "franchise" : true))
  const contextHint = VAT_CONTEXTS.find((c) => c.id === context)?.hint

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !saving) onClose() }}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "flex max-h-[calc(100dvh-80px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-none md:max-w-[640px]",
          "max-md:inset-x-0 max-md:bottom-0 max-md:top-auto max-md:left-0 max-md:max-h-[92dvh] max-md:w-full max-md:max-w-none",
          "max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-b-none max-md:rounded-t-[24px] max-md:border-x-0 max-md:border-b-0",
        )}
      >
        <span className="q-sheet-grip md:hidden" aria-hidden />
        <div className="flex items-start justify-between gap-3 px-4 pt-3 md:px-[22px] md:pt-5">
          <div className="flex flex-col gap-1">
            <DialogTitle className="q-display text-[22px] font-semibold leading-tight tracking-[-0.02em]">
              Prestations de votre métier
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-[var(--q-text-4)]">
              Désignation, unité et taux de TVA proposés. Aucun prix : vos tarifs sont les vôtres, à saisir ici ou plus tard.
            </DialogDescription>
          </div>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Fermer" className="hidden shrink-0 md:inline-flex" onClick={onClose} disabled={saving}>
            <X className="!size-[18px]" aria-hidden />
          </Button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4 pt-4 md:px-[22px] md:pb-5">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-1.5">
              <label htmlFor="import-trade" className="q-label">Métier</label>
              <select id="import-trade" className="q-input pr-2 max-md:!h-12 max-md:!rounded-[14px]" value={trade} onChange={(e) => chooseTrade(e.target.value)}>
                <option value="">Choisir un métier</option>
                {TRADES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <label htmlFor="import-context" className="q-label">Vos chantiers, le plus souvent</label>
              <select
                id="import-context"
                className="q-input pr-2 max-md:!h-12 max-md:!rounded-[14px]"
                value={context}
                onChange={(e) => { setContext(e.target.value as VatContext | ""); setError(null) }}
              >
                <option value="">Choisir pour proposer la TVA</option>
                {contexts.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
          </div>
          {contextHint && <p className="q-field-hint -mt-2 leading-relaxed">{contextHint} Le taux reste modifiable sur chaque prestation et chaque ligne de devis.</p>}

          {trade && items.length > 0 && (
            <div className="flex flex-col">
              <div className="flex items-center justify-between gap-3 border-b border-[var(--q-line-soft)] pb-2">
                <span className="text-[13px] font-semibold text-[var(--q-text-3)]">
                  {selected.length} sur {importable.length} cochée{selected.length > 1 ? "s" : ""}
                </span>
                {importable.length > 0 && (
                  <button
                    type="button"
                    className="q-link text-[13px]"
                    onClick={() => setChecked(allChecked ? new Set() : new Set(importable.map((i) => i.id)))}
                  >
                    {allChecked ? "Tout décocher" : "Tout cocher"}
                  </button>
                )}
              </div>
              <ul className="flex flex-col">
                {items.map((item) => {
                  const known = existing.has(normalizeProductName(item.name))
                  const on = !known && checked.has(item.id)
                  const rate = context ? proposedVatRate(item.vat, context) : null
                  // Précision propre à la prestation (critère, exclusion) ; la règle générale est sous les listes
                  const note = item.note ?? null
                  const priceBad = on && Number.isNaN(parsePrice(prices[item.id] ?? ""))
                  return (
                    <li key={item.id} className="flex flex-col gap-2 border-b border-[var(--q-line-soft)] py-2.5 md:flex-row md:items-center md:gap-3">
                      <label className={cn("flex min-w-0 flex-1 cursor-pointer items-start gap-2.5", known && "cursor-default opacity-60")}>
                        <input
                          type="checkbox"
                          className="mt-0.5 size-[18px] shrink-0 accent-[var(--q-accent)]"
                          checked={on}
                          disabled={known}
                          onChange={() => toggle(item.id)}
                        />
                        <span className="flex min-w-0 flex-col gap-0.5">
                          <span className="text-[15px] font-medium leading-snug text-[var(--q-ink)]">{item.name}</span>
                          <span className="text-[13px] text-[var(--q-text-4)]">
                            {item.unit}
                            {rate !== null && <> · TVA {formatVat(rate)}</>}
                            {known && " · Déjà au catalogue"}
                          </span>
                          {note && !known && context !== "franchise" && context !== "standard" && (
                            <span className="text-[12px] leading-snug text-[var(--q-text-4)]">{note}</span>
                          )}
                        </span>
                      </label>
                      {!known && (
                        <div
                          className={cn(
                            "q-fw ml-[28px] flex h-10 shrink-0 items-center gap-1.5 rounded-[10px] border bg-[var(--q-surface)] px-3 md:ml-0 md:w-[148px]",
                            priceBad ? "border-[var(--q-danger)]" : "border-[var(--q-field)]",
                            !on && "opacity-50",
                          )}
                        >
                          <input
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            aria-label={`Prix HT de « ${item.name} » (facultatif)`}
                            placeholder="À compléter"
                            disabled={!on}
                            value={prices[item.id] ?? ""}
                            onChange={(e) => { setPrices((p) => ({ ...p, [item.id]: e.target.value })); setError(null) }}
                            className="h-full w-full min-w-0 bg-transparent text-base tabular-nums text-[var(--q-ink)] outline-none placeholder:text-[var(--q-placeholder)] md:text-[14px]"
                          />
                          <span className="whitespace-nowrap text-[12px] text-[var(--q-text-4)]" aria-hidden>€ HT</span>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {context && context !== "franchise" && context !== "standard" && (
            <p className="flex gap-2 text-[13px] leading-relaxed text-[var(--q-text-3)]">
              <Info className="mt-0.5 size-4 shrink-0 text-[var(--q-accent-strong)]" aria-hidden />
              Taux réduit : votre client certifie sur le devis ou la facture que les travaux portent sur un logement
              achevé depuis plus de deux ans (CGI, art. 279-0 bis et 278-0 bis A). Exclus des taux réduits : les
              chaudières au gaz ou au fioul, la climatisation, les espaces verts, le nettoyage, la fourniture sans pose.
            </p>
          )}

          {error && <p className="q-field-error" role="alert">{error}</p>}
        </div>

        <div
          className="flex flex-col-reverse gap-2 border-t border-[var(--q-line-soft)] bg-[var(--q-surface)] px-4 pt-3 md:flex-row md:items-center md:bg-[var(--q-surface-2)] md:px-[22px] md:py-4"
          style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
        >
          <span className="text-[13px] text-[var(--q-text-4)] md:mr-auto">
            {!trade ? "Choisissez votre métier." : !context ? "Choisissez vos chantiers pour proposer la TVA." : "Prix laissés vides : « Prix à compléter »."}
          </span>
          <Button type="button" variant="ghost" className="hidden md:inline-flex" onClick={onClose} disabled={saving}>
            Annuler
          </Button>
          <Button
            type="button"
            className="max-md:h-[52px] max-md:rounded-2xl max-md:text-base"
            onClick={() => void submit()}
            disabled={saving || !trade || !context || selected.length === 0}
          >
            {saving ? <Loader2 className="animate-spin" aria-hidden /> : <Check strokeWidth={2.25} aria-hidden />}
            {selected.length > 1 ? `Importer ${selected.length} prestations` : "Importer"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
