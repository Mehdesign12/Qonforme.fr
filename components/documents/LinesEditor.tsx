'use client'

/**
 * Lignes d'un document : tableau éditable sur ordinateur, liste compacte et
 * feuille « Modifier la ligne » sur mobile (canevas Nouveau-devis et
 * Mobile-devis-creation). Les deux vues partagent le même état.
 */
import { useRef, useState } from "react"
import { Plus, Trash2, Check } from "lucide-react"
import { VAT_RATES, formatCurrency } from "@/lib/utils/invoice"
import { ProductCombobox, type ProductSuggestion } from "@/components/products/ProductCombobox"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { formatRate, lineHasError, lineSummary, vatBreakdown, type DocLine } from "./model"
import type { DocumentFormApi } from "./useDocumentForm"

const COLS = "grid-cols-[minmax(0,1fr)_60px_92px_76px_92px_34px]"

const cellInput =
  "h-9 w-full min-w-0 rounded-[9px] border border-[var(--q-field)] bg-[var(--q-surface)] px-2.5 text-base text-[var(--q-ink)] outline-none transition-[border-color,box-shadow] placeholder:text-[var(--q-placeholder)] focus:border-[var(--q-accent)] focus:shadow-[0_0_0_4px_var(--q-focus)] aria-invalid:border-[var(--q-danger)] aria-invalid:shadow-[0_0_0_3px_var(--q-danger-bg)] md:text-sm"

export function LinesEditor({
  doc,
  title,
  catalog,
}: {
  doc: DocumentFormApi
  title: string
  catalog: { products?: ProductSuggestion[]; manageHref: string }
}) {
  const { form, errors, computed } = doc
  const [editing, setEditing] = useState<string | null>(null)
  const sheetHeadRef = useRef<HTMLDivElement>(null)
  const canRemove = form.lines.length > 1

  const set = (line: DocLine, index: number, key: "description" | "quantity" | "unit_price_ht" | "vat_rate", value: string) => {
    doc.setLineValue(line.id, key, value)
    const suffix = key === "description" ? "desc" : key === "quantity" ? "qty" : key === "unit_price_ht" ? "price" : null
    if (suffix) doc.clearError(`line_${index}_${suffix}`)
  }

  const editIndex = editing ? form.lines.findIndex((l) => l.id === editing) : -1
  const editLine = editIndex >= 0 ? form.lines[editIndex] : null
  const count = form.lines.length

  return (
    // Mobile : intitulé au-dessus d'une carte de lignes compactes ; ordinateur : une carte
    <section className="flex flex-col gap-2.5 md:q-card md:gap-0 md:overflow-hidden" aria-labelledby="doc-lines-title">
      <div className="flex flex-wrap items-center justify-between gap-3 md:px-5 md:pb-3 md:pt-4">
        <h2 id="doc-lines-title" className="q-h2">{title}</h2>
        <span className="text-[13px] tabular-nums text-[var(--q-text-4)] md:hidden">
          {count} ligne{count > 1 ? "s" : ""}
        </span>
        <div className="hidden md:block">
          <ProductCombobox onSelect={doc.insertProduct} products={catalog.products} manageHref={catalog.manageHref} />
        </div>
      </div>

      {/* ── Ordinateur : tableau éditable ── */}
      <div className="hidden md:block">
        <div className={cn("grid gap-1.5 border-y border-[var(--q-line-soft)] bg-[var(--q-surface-2)] px-5 py-2 text-xs text-[var(--q-text-4)]", COLS)}>
          <span>Désignation</span>
          <span className="text-right">Qté</span>
          <span className="text-right">Prix unit. HT</span>
          <span>TVA</span>
          <span className="text-right">Total HT</span>
          <span />
        </div>
        {form.lines.map((line, i) => {
          const descErr = errors[`line_${i}_desc`]
          const qtyErr = errors[`line_${i}_qty`]
          const priceErr = errors[`line_${i}_price`]
          const msgs = [descErr, qtyErr, priceErr].filter(Boolean)
          return (
            <div key={line.id} className="border-b border-[var(--q-line-soft)] px-5 py-2">
              <div className={cn("grid items-center gap-1.5", COLS)}>
                <input
                  type="text"
                  aria-label={`Désignation, ligne ${i + 1}`}
                  placeholder="Désignation de la prestation"
                  title={line.description || undefined}
                  value={line.description}
                  onChange={(e) => set(line, i, "description", e.target.value)}
                  aria-invalid={descErr ? true : undefined}
                  className={cellInput}
                />
                <input
                  type="number" min="0" step="0.01" inputMode="decimal" placeholder="1"
                  aria-label={`Quantité, ligne ${i + 1}`}
                  value={line.quantity}
                  onChange={(e) => set(line, i, "quantity", e.target.value)}
                  aria-invalid={qtyErr ? true : undefined}
                  className={cn(cellInput, "text-right tabular-nums")}
                />
                <input
                  type="number" min="0" step="0.01" inputMode="decimal" placeholder="0,00"
                  aria-label={`Prix unitaire HT en euros, ligne ${i + 1}`}
                  value={line.unit_price_ht}
                  onChange={(e) => set(line, i, "unit_price_ht", e.target.value)}
                  aria-invalid={priceErr ? true : undefined}
                  className={cn(cellInput, "text-right tabular-nums")}
                />
                <select
                  aria-label={`Taux de TVA, ligne ${i + 1}`}
                  value={line.vat_rate}
                  disabled={doc.form.autoliquidation}
                  title={doc.form.autoliquidation ? "Autoliquidation : TVA due par le client" : undefined}
                  onChange={(e) => set(line, i, "vat_rate", e.target.value)}
                  className={cn(cellInput, "px-1.5 tabular-nums")}
                >
                  {VAT_RATES.map((rate) => <option key={rate} value={rate}>{formatRate(rate)}</option>)}
                </select>
                <span className="text-right text-[15px] font-semibold tabular-nums text-[var(--q-ink)]">
                  {formatCurrency(computed[i].totalHT)}
                </span>
                {canRemove ? (
                  <button
                    type="button"
                    onClick={() => doc.removeLine(line.id)}
                    aria-label={`Supprimer la ligne ${i + 1}`}
                    className="grid size-[34px] place-items-center rounded-[9px] text-[var(--q-placeholder)] transition-colors hover:bg-[var(--q-danger-bg)] hover:text-[var(--q-danger)]"
                  >
                    <Trash2 className="size-4" strokeWidth={1.75} aria-hidden />
                  </button>
                ) : <span />}
              </div>
              {msgs.length > 0 && <p className="q-field-error mt-1">{msgs.join(" · ")}</p>}
            </div>
          )
        })}
        <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-3">
          <button
            type="button"
            onClick={() => doc.addLine()}
            className="inline-flex h-9 items-center gap-1.5 rounded-[9px] px-1 text-sm font-semibold text-[var(--q-accent-strong)] hover:text-[var(--q-accent-ink)]"
          >
            <Plus className="size-4" strokeWidth={2.25} aria-hidden />
            Ajouter une ligne
          </button>
          <TotalsBlock doc={doc} />
        </div>
      </div>

      {/* ── Mobile : liste compacte, une feuille pour modifier ── */}
      <div className="q-card overflow-hidden md:hidden">
        <div className="q-list">
          {form.lines.map((line, i) => {
            const hasErr = lineHasError(errors, i)
            return (
              <button
                key={line.id}
                type="button"
                onClick={() => setEditing(line.id)}
                className="q-list-row w-full text-left"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className={cn("truncate text-[15px] font-semibold", !line.description.trim() && "text-[var(--q-text-4)]")}>
                    {line.description.trim() || "Nouvelle ligne"}
                  </span>
                  {hasErr ? (
                    <span className="text-[13px] font-medium text-[var(--q-danger)]">À compléter</span>
                  ) : (
                    <span className="truncate text-[13px] tabular-nums text-[var(--q-text-4)]">{lineSummary(line)}</span>
                  )}
                </span>
                <span className="shrink-0 text-[15px] font-semibold tabular-nums">{formatCurrency(computed[i].totalHT)}</span>
              </button>
            )
          })}
        </div>
        <div className="grid grid-cols-2 gap-2 border-t border-[var(--q-line-soft)] p-3">
          <button
            type="button"
            onClick={() => setEditing(doc.addLine())}
            className="q-btn q-btn-secondary !h-11 w-full !rounded-[14px] !text-[15px]"
          >
            <Plus aria-hidden strokeWidth={2.25} />
            Ligne
          </button>
          <ProductCombobox
            variant="block"
            onSelect={doc.insertProduct}
            products={catalog.products}
            manageHref={catalog.manageHref}
          />
        </div>
      </div>

      {/* Feuille « Modifier la ligne » (mobile) */}
      <Sheet open={editLine !== null} onOpenChange={(open) => { if (!open) setEditing(null) }}>
        {editLine && (
          <SheetContent
            side="bottom"
            // Ligne neuve : focus sur la désignation ; ligne existante touchée au doigt : pas de clavier d'office
            initialFocus={(type) => (type === "keyboard" || !editLine.description.trim() ? true : sheetHeadRef.current)}
            className="max-h-[88dvh] gap-3 overflow-auto px-4 pb-[max(24px,env(safe-area-inset-bottom))] pt-2 md:hidden"
          >
            <span className="q-sheet-grip !mt-0" aria-hidden />
            <div ref={sheetHeadRef} tabIndex={-1} className="flex flex-col gap-1 pr-10 outline-none">
              <SheetTitle className="q-display text-[22px] text-[var(--q-ink)]">Modifier la ligne</SheetTitle>
              <SheetDescription className="text-sm text-[var(--q-text-4)]">Prix unitaire hors taxes, TVA par ligne.</SheetDescription>
            </div>
            <LineFields
              line={editLine}
              index={editIndex}
              errors={errors}
              total={computed[editIndex]?.totalHT ?? 0}
              vatLocked={doc.form.autoliquidation}
              onChange={(key, value) => set(editLine, editIndex, key, value)}
            />
            <button type="button" onClick={() => setEditing(null)} className="q-btn q-btn-primary q-btn-xl mt-1 w-full">
              <Check aria-hidden strokeWidth={2.5} />
              Terminé
            </button>
            {canRemove && (
              <button
                type="button"
                onClick={() => { doc.removeLine(editLine.id); setEditing(null) }}
                className="q-btn q-btn-danger q-btn-lg w-full"
              >
                <Trash2 aria-hidden strokeWidth={1.75} />
                Supprimer la ligne
              </button>
            )}
          </SheetContent>
        )}
      </Sheet>
    </section>
  )
}

/** Champs d'une ligne dans la feuille mobile (48 px, 16 px : pas de zoom iOS). */
function LineFields({
  line,
  index,
  errors,
  total,
  vatLocked,
  onChange,
}: {
  line: DocLine
  index: number
  errors: Record<string, string>
  total: number
  /** Autoliquidation : taux figé à 0 %. */
  vatLocked?: boolean
  onChange: (key: "description" | "quantity" | "unit_price_ht" | "vat_rate", value: string) => void
}) {
  const big = "q-input !h-12 !rounded-[14px] !text-base"
  const descErr = errors[`line_${index}_desc`]
  const qtyErr = errors[`line_${index}_qty`]
  const priceErr = errors[`line_${index}_price`]
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="ml-label" className="q-label">Désignation</label>
        <input
          id="ml-label" type="text" value={line.description} placeholder="Désignation de la prestation"
          onChange={(e) => onChange("description", e.target.value)}
          aria-invalid={descErr ? true : undefined}
          className={big}
        />
        {descErr && <p className="q-field-error">{descErr}</p>}
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ml-qty" className="q-label">Quantité</label>
          <input
            id="ml-qty" type="number" min="0" step="0.01" inputMode="decimal" value={line.quantity}
            onChange={(e) => onChange("quantity", e.target.value)}
            aria-invalid={qtyErr ? true : undefined}
            className={cn(big, "tabular-nums")}
          />
          {qtyErr && <p className="q-field-error">{qtyErr}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ml-price" className="q-label">Prix unit. HT (€)</label>
          <input
            id="ml-price" type="number" min="0" step="0.01" inputMode="decimal" value={line.unit_price_ht} placeholder="0,00"
            onChange={(e) => onChange("unit_price_ht", e.target.value)}
            aria-invalid={priceErr ? true : undefined}
            className={cn(big, "tabular-nums")}
          />
          {priceErr && <p className="q-field-error">{priceErr}</p>}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="ml-vat" className="q-label">TVA</label>
        <select id="ml-vat" value={line.vat_rate} disabled={vatLocked} onChange={(e) => onChange("vat_rate", e.target.value)} className={big}>
          {VAT_RATES.map((rate) => <option key={rate} value={rate}>{formatRate(rate)}</option>)}
        </select>
      </div>
      <p className="flex items-baseline justify-between text-sm text-[var(--q-text-3)]">
        Total HT de la ligne
        <span className="text-base font-semibold tabular-nums text-[var(--q-ink)]">{formatCurrency(total)}</span>
      </p>
    </div>
  )
}

/** Totaux : HT, TVA par taux, TTC. */
export function TotalsBlock({ doc, className }: { doc: DocumentFormApi; className?: string }) {
  const breakdown = vatBreakdown(doc.form.lines, doc.computed)
  return (
    <dl className={cn("flex min-w-[240px] flex-col gap-1.5 text-sm tabular-nums", className)}>
      <div className="flex justify-between gap-6">
        <dt className="text-[var(--q-text-3)]">Total HT</dt>
        <dd className="font-semibold text-[var(--q-ink)]">{formatCurrency(doc.totals.subtotal_ht)}</dd>
      </div>
      {breakdown.length > 1 ? (
        breakdown.map((v) => (
          <div key={v.rate} className="flex justify-between gap-6">
            <dt className="text-[var(--q-text-3)]">TVA {formatRate(v.rate)}</dt>
            <dd className="text-[var(--q-text-2)]">{formatCurrency(v.amount)}</dd>
          </div>
        ))
      ) : (
        <div className="flex justify-between gap-6">
          <dt className="text-[var(--q-text-3)]">{doc.form.autoliquidation ? "TVA (autoliquidation)" : `TVA${breakdown[0] ? ` ${formatRate(breakdown[0].rate)}` : ""}`}</dt>
          <dd className="text-[var(--q-text-2)]">{formatCurrency(doc.totals.total_vat)}</dd>
        </div>
      )}
      <div className="mt-1 flex items-baseline justify-between gap-6 border-t border-[var(--q-line)] pt-2">
        <dt className="font-semibold text-[var(--q-ink)]">Total TTC</dt>
        <dd className="text-[19px] font-semibold tracking-[-0.01em] text-[var(--q-ink)]">{formatCurrency(doc.totals.total_ttc)}</dd>
      </div>
    </dl>
  )
}
