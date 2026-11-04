/**
 * Remises sur les fiches à l'écran (devis, facture, bon de commande, avoir,
 * page de signature) : mention sous la ligne remisée et lignes du récapitulatif
 * (total avant remise, remises de ligne, remise globale). Les lignes de remise
 * globale ne s'affichent jamais comme des prestations (itemLines).
 */
import { discountSummary, lineDiscountLabel, type DiscountableLine } from "@/lib/documents/discounts"
import { formatCurrency } from "@/lib/utils/invoice"

/** « Remise −10 % (−144,00 €) » sous une ligne remisée, rien sinon. */
export function LineDiscountNote({ line, className }: { line: DiscountableLine; className?: string }) {
  const label = lineDiscountLabel(line)
  const amount = Number(line.discount_amount) || 0
  if (!label || amount <= 0) return null
  const pct = String(line.discount_kind) === "pct"
  return (
    <span className={className ?? "block text-[11px] text-[var(--q-ok,#15803d)]"}>
      Remise {label}{pct ? ` (−${formatCurrency(amount)})` : ""}
    </span>
  )
}

/** Lignes du récapitulatif avant le sous-total HT (signe négatif pour une facture, inversé pour un avoir). */
export function discountTotalRows(lines: DiscountableLine[] | null | undefined, sign: 1 | -1 = 1): { label: string; value: string }[] {
  const s = discountSummary(lines)
  if (!s) return []
  const rows = [{ label: "Total HT avant remise", value: formatCurrency(sign * s.gross) }]
  if (s.lineDiscount > 0) rows.push({ label: "Remises sur les lignes", value: formatCurrency(-sign * s.lineDiscount) })
  if (s.global) rows.push({ label: s.global.label, value: formatCurrency(-sign * s.global.amount) })
  return rows
}

export function DiscountTotalRows({ lines, labelClassName, rowClassName, sign = 1 }: {
  lines: DiscountableLine[] | null | undefined
  labelClassName?: string
  rowClassName?: string
  sign?: 1 | -1
}) {
  return (
    <>
      {discountTotalRows(lines, sign).map((r) => (
        <div key={r.label} className={rowClassName ?? "flex justify-between gap-4"}>
          <span className={labelClassName}>{r.label}</span><span>{r.value}</span>
        </div>
      ))}
    </>
  )
}
