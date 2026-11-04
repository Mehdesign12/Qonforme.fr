'use client'

/**
 * Lignes d'un document : tableau éditable sur ordinateur, liste compacte et
 * feuille « Modifier la ligne » sur mobile (canevas Nouveau-devis et
 * Mobile-devis-creation). Les deux vues partagent le même état.
 */
import { useRef, useState } from "react"
import { Plus, Trash2, Check, Percent, X } from "lucide-react"
import { VAT_RATES, formatCurrency } from "@/lib/utils/invoice"
import { ProductCombobox, type ProductSuggestion } from "@/components/products/ProductCombobox"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { formLineDiscountLabel, formatRate, lineHasError, lineSummary, vatBreakdown, type DocLine } from "./model"
import type { DiscountKind } from "@/lib/documents/discounts"
import type { DocumentFormApi } from "./useDocumentForm"
import { SheetGrip } from "@/components/ui/sheet-grip"

const COLS = "grid-cols-[minmax(0,1fr)_60px_92px_76px_92px_34px]"
// Remise par ligne : la désignation passe sur toute la largeur, les montants dessous
const COLS_DISC = "grid-cols-[minmax(0,1fr)_64px_92px_150px_76px_100px_34px]"

/** Choix % / € d'une remise (contrôle segmenté du kit). */
export function DiscountUnit({
  value, onChange, label, size = "sm",
}: { value: DiscountKind; onChange: (k: DiscountKind) => void; label: string; size?: "sm" | "lg" }) {
  const btn = size === "lg" ? "!h-[42px] !min-w-[48px] !text-[15px]" : "!h-[30px] !min-w-[30px] !px-2"
  return (
    <span className="q-seg shrink-0" role="group" aria-label={label}>
      <button type="button" aria-pressed={value === "pct"} onClick={() => onChange("pct")} className={btn}>%</button>
      <button type="button" aria-pressed={value === "eur"} onClick={() => onChange("eur")} className={btn}>€</button>
    </span>
  )
}

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
  const [globalSheet, setGlobalSheet] = useState(false)
  // « Remise par ligne » : colonne affichée si une ligne a déjà une remise ; la couper les retire
  const [lineDiscOn, setLineDiscOn] = useState(() => form.lines.some((l) => l.discount_value.trim() !== ""))
  const cols = lineDiscOn ? COLS_DISC : COLS
  const toggleLineDisc = () => {
    if (lineDiscOn) doc.clearLineDiscounts()
    setLineDiscOn(!lineDiscOn)
  }
  const sheetHeadRef = useRef<HTMLDivElement>(null)
  const canRemove = form.lines.length > 1

  type LineKey = "description" | "quantity" | "unit_price_ht" | "vat_rate" | "discount_kind" | "discount_value"
  const set = (line: DocLine, index: number, key: LineKey, value: string) => {
    doc.setLineValue(line.id, key, value)
    const suffix = key === "description" ? "desc" : key === "quantity" ? "qty" : key === "unit_price_ht" ? "price" : key.startsWith("discount") ? "disc" : null
    if (suffix) doc.clearError(`line_${index}_${suffix}`)
    // Une remise saisie ailleurs que dans la colonne (feuille mobile) affiche la colonne
    if (key === "discount_value" && value.trim() !== "") setLineDiscOn(true)
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
        <div className="hidden items-center gap-3 md:flex">
          <label className="flex cursor-pointer items-center gap-2.5 text-[13px] font-semibold text-[var(--q-text-2)]">
            <button type="button" role="switch" aria-checked={lineDiscOn} onClick={toggleLineDisc} className="q-switch" />
            Remise par ligne
          </label>
          <ProductCombobox onSelect={doc.insertProduct} products={catalog.products} manageHref={catalog.manageHref} />
        </div>
      </div>

      {/* ── Ordinateur : tableau éditable ── */}
      <div className="hidden md:block">
        <div className={cn("grid gap-1.5 border-y border-[var(--q-line-soft)] bg-[var(--q-surface-2)] px-5 py-2 text-xs text-[var(--q-text-4)]", cols)}>
          <span>Désignation</span>
          <span className="text-right">Qté</span>
          <span className="text-right">Prix unit. HT</span>
          {lineDiscOn && <span>Remise</span>}
          <span>TVA</span>
          <span className="text-right">Total HT</span>
          <span />
        </div>
        {form.lines.map((line, i) => {
          const descErr = errors[`line_${i}_desc`]
          const qtyErr = errors[`line_${i}_qty`]
          const priceErr = errors[`line_${i}_price`]
          const discErr = errors[`line_${i}_disc`] ?? computed[i].discountError
          const msgs = [descErr, qtyErr, priceErr, discErr].filter(Boolean)
          const discounted = computed[i].discountHT > 0
          return (
            <div key={line.id} className="border-b border-[var(--q-line-soft)] px-5 py-2">
              <div className={cn("grid items-center gap-1.5", cols)}>
                <input
                  type="text"
                  aria-label={`Désignation, ligne ${i + 1}`}
                  placeholder="Désignation de la prestation"
                  title={line.description || undefined}
                  value={line.description}
                  onChange={(e) => set(line, i, "description", e.target.value)}
                  aria-invalid={descErr ? true : undefined}
                  className={cn(cellInput, lineDiscOn && "col-span-full")}
                />
                {lineDiscOn && <span aria-hidden />}
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
                {lineDiscOn && (
                  <div className="flex min-w-0 items-center gap-1">
                    <input
                      type="number" min="0" step="0.01" inputMode="decimal" placeholder="0"
                      aria-label={`Remise, ligne ${i + 1}, en ${line.discount_kind === "pct" ? "pourcentage" : "euros"}`}
                      value={line.discount_value}
                      onChange={(e) => set(line, i, "discount_value", e.target.value)}
                      aria-invalid={discErr ? true : undefined}
                      className={cn(cellInput, "px-2 text-right tabular-nums")}
                    />
                    <DiscountUnit
                      value={line.discount_kind}
                      onChange={(k) => set(line, i, "discount_kind", k)}
                      label={`Unité de la remise, ligne ${i + 1}`}
                    />
                  </div>
                )}
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
                <span className="flex flex-col items-end tabular-nums">
                  <span className="text-[15px] font-semibold text-[var(--q-ink)]">{formatCurrency(computed[i].totalHT)}</span>
                  {discounted && <s className="text-xs text-[var(--q-text-4)]">{formatCurrency(computed[i].grossHT)}</s>}
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
              {msgs.length === 0 && discounted && (
                <p className="mt-1 text-xs font-medium text-[var(--q-ok)]">
                  Remise {formLineDiscountLabel(line)?.replace("−", "")}{line.discount_kind === "pct" ? ` : −${formatCurrency(computed[i].discountHT)}` : ""}
                </p>
              )}
            </div>
          )
        })}
        <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-3">
          <div className="flex min-w-0 flex-col items-start gap-1">
            <button
              type="button"
              onClick={() => doc.addLine()}
              className="inline-flex h-9 items-center gap-1.5 rounded-[9px] px-1 text-sm font-semibold text-[var(--q-accent-strong)] hover:text-[var(--q-accent-ink)]"
            >
              <Plus className="size-4" strokeWidth={2.25} aria-hidden />
              Ajouter une ligne
            </button>
            {form.global_discount ? (
              <GlobalDiscountFields doc={doc} />
            ) : (
              <button
                type="button"
                onClick={() => doc.setGlobalDiscount({ value: "" })}
                className="inline-flex h-9 items-center gap-1.5 rounded-[9px] px-1 text-sm font-semibold text-[var(--q-accent-strong)] hover:text-[var(--q-accent-ink)]"
              >
                <Percent className="size-4" strokeWidth={1.75} aria-hidden />
                Ajouter une remise globale
              </button>
            )}
          </div>
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
                    <span className="truncate text-[13px] tabular-nums text-[var(--q-text-4)]">
                      {lineSummary(line)}
                      {computed[i].discountHT > 0 && <span className="text-[var(--q-ok)]"> · {formLineDiscountLabel(line)}</span>}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-[15px] font-semibold tabular-nums">{formatCurrency(computed[i].totalHT)}</span>
              </button>
            )
          })}
        </div>
        {form.global_discount && doc.totals.global_discount > 0 && (
          <button type="button" onClick={() => setGlobalSheet(true)} className="q-list-row w-full border-t border-[var(--q-line-soft)] bg-[var(--q-wash)] text-left">
            <Percent className="size-5 shrink-0 text-[var(--q-accent)]" strokeWidth={1.75} aria-hidden />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-[15px] font-semibold">{globalLabel(form.global_discount)}</span>
              <span className="text-[13px] text-[var(--q-text-4)]">Remise globale, avant TVA</span>
            </span>
            <span className="shrink-0 text-[15px] font-semibold tabular-nums text-[var(--q-ok)]">−{formatCurrency(doc.totals.global_discount)}</span>
          </button>
        )}
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
          {!(form.global_discount && doc.totals.global_discount > 0) && (
            <button
              type="button"
              onClick={() => { if (!form.global_discount) doc.setGlobalDiscount({ value: "" }); setGlobalSheet(true) }}
              className="q-btn q-btn-secondary col-span-2 !h-11 w-full !rounded-[14px] !text-[15px]"
            >
              <Percent aria-hidden strokeWidth={1.75} />
              Remise globale
            </button>
          )}
        </div>
      </div>

      {/* Feuille « Remise globale » (mobile) */}
      <Sheet open={globalSheet} onOpenChange={(open) => {
        setGlobalSheet(open)
        // Fermée sans valeur : la remise vide n'est pas gardée
        if (!open && form.global_discount && form.global_discount.value.trim() === "") doc.setGlobalDiscount(null)
      }}>
        {globalSheet && form.global_discount && (
          <SheetContent side="bottom" className="max-h-[88dvh] gap-3 overflow-auto px-4 pb-[max(24px,env(safe-area-inset-bottom))] pt-2 md:hidden">
            <SheetGrip className="!mt-0" />
            <div className="flex flex-col gap-1 pr-10">
              <SheetTitle className="q-display text-[22px] text-[var(--q-ink)]">Remise globale</SheetTitle>
              <SheetDescription className="text-sm text-[var(--q-text-4)]">Appliquée au total HT, avant TVA. La TVA est recalculée taux par taux.</SheetDescription>
            </div>
            <GlobalDiscountFields doc={doc} large />
            <button
              type="button"
              onClick={() => { if (form.global_discount?.value.trim() === "") doc.setGlobalDiscount(null); setGlobalSheet(false) }}
              className="q-btn q-btn-primary q-btn-xl mt-1 w-full"
            >
              <Check aria-hidden strokeWidth={2.5} />
              Valider
            </button>
            {doc.totals.global_discount > 0 && (
              <button type="button" onClick={() => { doc.setGlobalDiscount(null); setGlobalSheet(false) }} className="q-btn q-btn-danger q-btn-lg w-full">
                <Trash2 aria-hidden strokeWidth={1.75} />
                Retirer la remise
              </button>
            )}
          </SheetContent>
        )}
      </Sheet>

      {/* Feuille « Modifier la ligne » (mobile) */}
      <Sheet open={editLine !== null} onOpenChange={(open) => { if (!open) setEditing(null) }}>
        {editLine && (
          <SheetContent
            side="bottom"
            // Ligne neuve : focus sur la désignation ; ligne existante touchée au doigt : pas de clavier d'office
            initialFocus={(type) => (type === "keyboard" || !editLine.description.trim() ? true : sheetHeadRef.current)}
            className="max-h-[88dvh] gap-3 overflow-auto px-4 pb-[max(24px,env(safe-area-inset-bottom))] pt-2 md:hidden"
          >
            <SheetGrip className="!mt-0" />
            <div ref={sheetHeadRef} tabIndex={-1} className="flex flex-col gap-1 pr-10 outline-none">
              <SheetTitle className="q-display text-[22px] text-[var(--q-ink)]">Modifier la ligne</SheetTitle>
              <SheetDescription className="text-sm text-[var(--q-text-4)]">Prix unitaire hors taxes, TVA par ligne.</SheetDescription>
            </div>
            <LineFields
              line={editLine}
              index={editIndex}
              errors={errors}
              total={computed[editIndex]?.totalHT ?? 0}
              gross={computed[editIndex]?.grossHT ?? 0}
              discount={computed[editIndex]?.discountHT ?? 0}
              discountError={computed[editIndex]?.discountError ?? null}
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
  gross,
  discount,
  discountError,
  vatLocked,
  onChange,
}: {
  line: DocLine
  index: number
  errors: Record<string, string>
  total: number
  gross: number
  discount: number
  discountError: string | null
  /** Autoliquidation : taux figé à 0 %. */
  vatLocked?: boolean
  onChange: (key: "description" | "quantity" | "unit_price_ht" | "vat_rate" | "discount_kind" | "discount_value", value: string) => void
}) {
  const big = "q-input !h-12 !rounded-[14px] !text-base"
  const descErr = errors[`line_${index}_desc`]
  const qtyErr = errors[`line_${index}_qty`]
  const priceErr = errors[`line_${index}_price`]
  const discErr = errors[`line_${index}_disc`] ?? discountError
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
        <label htmlFor="ml-disc" className="q-label">Remise <span className="font-normal text-[var(--q-text-4)]">(facultatif)</span></label>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2.5">
          <input
            id="ml-disc" type="number" min="0" step="0.01" inputMode="decimal" value={line.discount_value} placeholder="0"
            onChange={(e) => onChange("discount_value", e.target.value)}
            aria-invalid={discErr ? true : undefined}
            className={cn(big, "tabular-nums")}
          />
          <DiscountUnit value={line.discount_kind} onChange={(k) => onChange("discount_kind", k)} label="Unité de la remise" size="lg" />
        </div>
        {discErr && <p className="q-field-error">{discErr}</p>}
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="ml-vat" className="q-label">TVA</label>
        <select id="ml-vat" value={line.vat_rate} disabled={vatLocked} onChange={(e) => onChange("vat_rate", e.target.value)} className={big}>
          {VAT_RATES.map((rate) => <option key={rate} value={rate}>{formatRate(rate)}</option>)}
        </select>
      </div>
      {discount > 0 && (
        <div className="flex flex-col gap-1 text-sm tabular-nums text-[var(--q-text-3)]">
          <p className="flex justify-between">Avant remise <s>{formatCurrency(gross)}</s></p>
          <p className="flex justify-between">Remise <span className="text-[var(--q-ok)]">−{formatCurrency(discount)}</span></p>
        </div>
      )}
      <p className="flex items-baseline justify-between text-sm text-[var(--q-text-3)]">
        Total HT de la ligne
        <span className="text-base font-semibold tabular-nums text-[var(--q-ink)]">{formatCurrency(total)}</span>
      </p>
    </div>
  )
}

/** Totaux : HT, TVA par taux, TTC. */
export function TotalsBlock({ doc, className }: { doc: DocumentFormApi; className?: string }) {
  const { totals } = doc
  const breakdown = vatBreakdown(doc.form.lines, doc.computed, totals.discount_lines)
  const discounted = totals.line_discount > 0 || totals.global_discount > 0
  return (
    <dl className={cn("flex min-w-[240px] flex-col gap-1.5 text-sm tabular-nums", className)}>
      {discounted && (
        <div className="flex justify-between gap-6">
          <dt className="text-[var(--q-text-3)]">Total HT avant remise</dt>
          <dd className="text-[var(--q-text-2)]">{formatCurrency(totals.gross_ht)}</dd>
        </div>
      )}
      {totals.line_discount > 0 && (
        <div className="flex justify-between gap-6">
          <dt className="text-[var(--q-text-3)]">Remises sur les lignes</dt>
          <dd className="text-[var(--q-ok)]">−{formatCurrency(totals.line_discount)}</dd>
        </div>
      )}
      {totals.global_discount > 0 && doc.form.global_discount && (
        <div className="flex justify-between gap-6">
          <dt className="text-[var(--q-text-3)]">{globalLabel(doc.form.global_discount)}</dt>
          <dd className="text-[var(--q-ok)]">−{formatCurrency(totals.global_discount)}</dd>
        </div>
      )}
      <div className="flex justify-between gap-6">
        <dt className="text-[var(--q-text-3)]">Total HT</dt>
        <dd className="font-semibold text-[var(--q-ink)]">{formatCurrency(doc.totals.subtotal_ht)}</dd>
      </div>
      {breakdown.length > 1 ? (
        breakdown.map((v) => (
          <div key={v.rate} className="flex justify-between gap-6">
            <dt className="text-[var(--q-text-3)]">TVA {formatRate(v.rate)}{totals.global_discount > 0 ? ` sur ${formatCurrency(v.base)}` : ""}</dt>
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

/** « Remise commerciale 5 % » ou « Geste commercial ». */
function globalLabel(g: { kind: DiscountKind; value: string; label: string }): string {
  const label = g.label.trim() || "Remise commerciale"
  return g.kind === "pct" && g.value.trim() !== "" ? `${label} ${g.value.trim().replace(".", ",")} %` : label
}

/** Libellé, montant et unité de la remise globale (encart ordinateur, feuille mobile). */
function GlobalDiscountFields({ doc, large = false }: { doc: DocumentFormApi; large?: boolean }) {
  const g = doc.form.global_discount
  if (!g) return null
  const err = doc.errors.global_discount ?? doc.totals.global_error
  if (large) {
    const big = "q-input !h-12 !rounded-[14px] !text-base"
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="gd-label" className="q-label">Libellé</label>
          <input id="gd-label" type="text" value={g.label} onChange={(e) => doc.setGlobalDiscount({ label: e.target.value })} className={big} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="gd-value" className="q-label">Montant</label>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2.5">
            <input
              id="gd-value" type="number" min="0" step="0.01" inputMode="decimal" placeholder="0" value={g.value}
              onChange={(e) => doc.setGlobalDiscount({ value: e.target.value })}
              aria-invalid={err ? true : undefined}
              className={cn(big, "tabular-nums")}
            />
            <DiscountUnit value={g.kind} onChange={(kind) => doc.setGlobalDiscount({ kind })} label="Unité de la remise globale" size="lg" />
          </div>
          {err && <p className="q-field-error">{err}</p>}
        </div>
        <p className="flex justify-between text-sm tabular-nums text-[var(--q-text-3)]">
          Remise sur {formatCurrency(doc.totals.gross_ht - doc.totals.line_discount)} HT
          <span className="font-semibold text-[var(--q-ok)]">−{formatCurrency(doc.totals.global_discount)}</span>
        </p>
      </div>
    )
  }
  return (
    <div className="flex w-[440px] max-w-full flex-col gap-1.5 rounded-xl border border-[var(--q-wash-line)] bg-[var(--q-wash)] px-3.5 py-3">
      <label htmlFor="gd-label-d" className="q-label">Remise globale, avant TVA</label>
      <div className="flex items-center gap-1.5">
        <input
          id="gd-label-d" type="text" aria-label="Libellé de la remise globale" value={g.label}
          onChange={(e) => doc.setGlobalDiscount({ label: e.target.value })}
          className={cn(cellInput, "flex-1")}
        />
        <input
          type="number" min="0" step="0.01" inputMode="decimal" placeholder="0" value={g.value}
          aria-label={`Remise globale, en ${g.kind === "pct" ? "pourcentage" : "euros"}`}
          onChange={(e) => doc.setGlobalDiscount({ value: e.target.value })}
          aria-invalid={err ? true : undefined}
          className={cn(cellInput, "w-[84px] text-right tabular-nums")}
        />
        <DiscountUnit value={g.kind} onChange={(kind) => doc.setGlobalDiscount({ kind })} label="Unité de la remise globale" />
        <button
          type="button"
          onClick={() => doc.setGlobalDiscount(null)}
          aria-label="Retirer la remise globale"
          className="grid size-[34px] shrink-0 place-items-center rounded-[9px] text-[var(--q-placeholder)] transition-colors hover:bg-[var(--q-danger-bg)] hover:text-[var(--q-danger)]"
        >
          <X className="size-4" strokeWidth={1.75} aria-hidden />
        </button>
      </div>
      {err ? (
        <p className="q-field-error">{err}</p>
      ) : (
        <p className="text-xs text-[var(--q-text-4)]">Répartie sur chaque taux de TVA au prorata, comme l&apos;exige la facture électronique.</p>
      )}
    </div>
  )
}
