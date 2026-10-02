import { DEMO_COMPANY, demoQuote } from "@/lib/demo/data"
import { formatCurrency } from "@/lib/utils/invoice"
import { initialsOf } from "@/components/app/kit"

/**
 * Colonne de droite de l'inscription (canevas « Onb-1-Inscription ») : un
 * devis d'exemple, tiré des données de la démo pour concorder avec elle.
 * Feuille blanche dans les deux thèmes, comme tout aperçu papier.
 */
const QUOTE = demoQuote("D-2026-035")!

const amount = (n: number) =>
  new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

const DAY = 24 * 60 * 60 * 1000
const validityDays = Math.round((Date.parse(QUOTE.valid_until) - Date.parse(QUOTE.issue_date)) / DAY)

export default function QuotePreview() {
  const c = DEMO_COMPANY
  const client = QUOTE.client
  return (
    <figure className="m-0 w-full max-w-[500px]">
      <div className="q-paper !rounded-xl px-[30px] pb-6 pt-7 text-[#0F172A]">
        {/* En-tête : entreprise et numéro */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[10px] bg-[#0A1122] text-[12px] font-semibold text-white">
              {initialsOf(c.owner)}
            </span>
            <div className="leading-tight">
              <p className="text-[13px] font-semibold">{c.name}</p>
              <p className="mt-0.5 text-[11.5px] text-[#64748B]">
                {c.city} · SIREN <span className="font-mono">{c.siren.replace(/(\d{3})(?=\d)/g, "$1 ")}</span>
              </p>
            </div>
          </div>
          <div className="text-right leading-tight">
            <p className="text-[14px] font-semibold">Devis</p>
            <p className="mt-1 font-mono text-[11.5px] text-[#475569]">{QUOTE.quote_number}</p>
          </div>
        </div>

        {/* Client et validité */}
        <div className="mt-6 flex items-start justify-between gap-4 text-[12px]">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#64748B]">Client</p>
            <p className="mt-1">{client.name}</p>
            <p className="mt-0.5">{client.address}, {client.zip_code} {client.city}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#64748B]">Validité</p>
            <p className="mt-1">{validityDays} jours</p>
          </div>
        </div>

        {/* Lignes */}
        <table className="mt-6 w-full border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-[#E6E9F0] text-[11px] font-semibold text-[#64748B]">
              <th className="pb-2 text-left font-semibold">Prestation</th>
              <th className="pb-2 pl-3 text-right font-semibold">Qté</th>
              <th className="pb-2 pl-3 text-right font-semibold">Prix HT</th>
              <th className="pb-2 pl-3 text-right font-semibold">Total HT</th>
            </tr>
          </thead>
          <tbody>
            {QUOTE.lines.map((l) => (
              <tr key={l.id} className="border-b border-[#EEF1F5] align-top">
                <td className="py-2.5 pr-2">{l.description}</td>
                <td className="whitespace-nowrap py-2.5 pl-3 text-right tabular-nums">
                  {l.quantity} {l.unit === "forfait" ? "" : l.unit}
                </td>
                <td className="whitespace-nowrap py-2.5 pl-3 text-right tabular-nums">{amount(l.unit_price_ht)}</td>
                <td className="whitespace-nowrap py-2.5 pl-3 text-right tabular-nums">{amount(l.total_ht)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totaux */}
        <dl className="ml-auto mt-4 grid w-[220px] grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-[12px] tabular-nums">
          <dt className="text-[#475569]">Total HT</dt>
          <dd className="m-0 text-right">{formatCurrency(QUOTE.subtotal_ht)}</dd>
          <dt className="text-[#475569]">TVA</dt>
          <dd className="m-0 text-right">{formatCurrency(QUOTE.total_vat)}</dd>
          <dt className="self-baseline pt-1 text-[#475569]">Total TTC</dt>
          <dd className="m-0 self-baseline pt-1 text-right text-[17px] font-semibold tracking-[-0.01em]">
            {formatCurrency(QUOTE.total_ttc)}
          </dd>
        </dl>
      </div>
      <figcaption className="mt-3 text-center text-[12px] text-q-text-4">
        Exemple de devis, avec des données fictives.
      </figcaption>
    </figure>
  )
}
