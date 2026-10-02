/**
 * Aperçu papier d'une facture (canevas « Facture-detail » › Document).
 *
 * Reprend ce que contient le PDF (lib/pdf/invoice.ts) : émetteur, client,
 * lignes, totaux, IBAN, notes et mentions de l'entreprise. La feuille reste
 * blanche en thème sombre, comme une page imprimée.
 *
 * Brouillon : filigrane « BROUILLON » à l'écran et à l'impression — un
 * brouillon imprimé ne doit pas pouvoir circuler comme une facture émise.
 */
import Link from "next/link"
import { formatCurrency } from "@/lib/utils/invoice"
import { initialsOf } from "@/components/app/kit"
import {
  type CompanyView, type InvoiceView, formatIban, formatSiren, mediumDate,
} from "@/components/invoices/invoice-view"

const num = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const qty = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 3 })

export function InvoicePaper({
  invoice,
  company,
  settingsHref,
}: {
  invoice: InvoiceView
  company: CompanyView | null
  /** Lien pour compléter l'entreprise quand elle n'est pas encore renseignée. */
  settingsHref?: string
}) {
  const draft = invoice.status === "draft"
  const client = invoice.client

  // TVA par taux, à partir des lignes (une seule ligne « TVA » s'il n'y a qu'un taux)
  const vatByRate = new Map<number, number>()
  for (const l of invoice.lines ?? []) {
    vatByRate.set(l.vat_rate, (vatByRate.get(l.vat_rate) ?? 0) + (l.total_ttc - l.total_ht))
  }
  const vatRows = Array.from(vatByRate.entries()).sort((a, b) => b[0] - a[0])

  return (
    <article
      data-invoice-print=""
      aria-label={`Aperçu de la facture ${invoice.invoice_number}`}
      className="q-paper relative mx-auto flex w-full max-w-[640px] flex-col gap-6 overflow-hidden px-5 py-6 text-[12px] leading-[1.55] text-[#0F172A] sm:px-9 sm:py-9"
    >
      {draft && (
        <>
          <p className="-mb-2 text-center text-[11px] font-semibold text-[#B91C1C]">
            Brouillon : ce document n&apos;est pas une facture émise.
          </p>
          <div aria-hidden className="pointer-events-none absolute inset-0 z-10 flex select-none items-center justify-center overflow-hidden">
            <span className="-rotate-[30deg] text-[56px] font-extrabold tracking-[0.2em] text-[#DC2626]/[0.12] sm:text-[92px]">
              BROUILLON
            </span>
          </div>
        </>
      )}

      {/* En-tête */}
      <header className="flex items-start justify-between gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-[10px] bg-[#0F172A] text-[13px] font-semibold text-white">
          {initialsOf(company?.name)}
        </span>
        <span className="flex min-w-0 flex-col items-end gap-0.5 text-right">
          <span className="text-[18px] font-semibold tracking-[-0.01em]">Facture</span>
          <span className="font-mono text-[#475569]">
            {invoice.invoice_number} · {mediumDate(invoice.issue_date)}
          </span>
          <span className="text-[#475569]">Échéance : {mediumDate(invoice.due_date)}</span>
        </span>
      </header>

      {/* Parties */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.04em] text-[#64748B]">ÉMETTEUR</p>
          {company ? (
            <>
              <p className="font-semibold">{company.name}</p>
              {company.address && <p>{company.address}</p>}
              {(company.zip_code || company.city) && <p>{[company.zip_code, company.city].filter(Boolean).join(" ")}</p>}
              {(company.siret || company.siren) && (
                <p>{company.siret ? `SIRET ${company.siret}` : `SIREN ${formatSiren(company.siren!)}`}</p>
              )}
              {company.vat_number && <p>TVA {company.vat_number}</p>}
            </>
          ) : settingsHref ? (
            <Link href={settingsHref} className="font-semibold text-[#1D4ED8] underline underline-offset-2">
              Complétez votre entreprise dans Paramètres › Entreprise
            </Link>
          ) : null}
        </div>
        <div>
          <p className="text-[11px] font-semibold tracking-[0.04em] text-[#64748B]">CLIENT</p>
          {client ? (
            <>
              <p className="font-semibold">{client.name}</p>
              {client.address && <p>{client.address}</p>}
              {(client.zip_code || client.city) && <p>{[client.zip_code, client.city].filter(Boolean).join(" ")}</p>}
              {client.siren && <p>SIREN {formatSiren(client.siren)}</p>}
              {client.vat_number && <p>TVA {client.vat_number}</p>}
            </>
          ) : (
            <p className="text-[#64748B]">—</p>
          )}
        </div>
      </div>

      {/* Lignes */}
      <div className="flex flex-col">
        <div className="hidden grid-cols-[minmax(0,1fr)_48px_84px_44px_88px] gap-2 border-b border-[#E6E9F0] py-2 font-semibold text-[#64748B] sm:grid">
          <span>Désignation</span>
          <span className="text-right">Qté</span>
          <span className="text-right">PU HT</span>
          <span className="text-right">TVA</span>
          <span className="text-right">Total HT</span>
        </div>
        {(invoice.lines ?? []).map((l, i) => (
          <div
            key={i}
            className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-2 gap-y-0.5 border-b border-[#F1F4F8] py-2 tabular-nums sm:grid-cols-[minmax(0,1fr)_48px_84px_44px_88px]"
          >
            <span className="min-w-0 break-words">{l.description}</span>
            <span className="hidden text-right sm:block">{qty.format(l.quantity)}{l.unit ? ` ${l.unit}` : ""}</span>
            <span className="hidden text-right sm:block">{num.format(l.unit_price_ht)}</span>
            <span className="hidden text-right sm:block">{qty.format(l.vat_rate)} %</span>
            <span className="text-right font-medium">{num.format(l.total_ht)}</span>
            {/* Téléphone : quantité, prix et TVA sous la désignation */}
            <span className="col-span-2 text-[11px] text-[#64748B] sm:hidden">
              {qty.format(l.quantity)}{l.unit ? ` ${l.unit}` : ""} × {num.format(l.unit_price_ht)} HT · TVA {qty.format(l.vat_rate)} %
            </span>
          </div>
        ))}
      </div>

      {/* Totaux */}
      <div className="ml-auto flex w-full flex-col gap-1.5 tabular-nums sm:w-[58%]">
        <div className="flex justify-between gap-4"><span className="text-[#475569]">Sous-total HT</span><span>{formatCurrency(invoice.subtotal_ht)}</span></div>
        {vatRows.length > 1 ? (
          vatRows.map(([rate, amount]) => (
            <div key={rate} className="flex justify-between gap-4">
              <span className="text-[#475569]">TVA {qty.format(rate)} %</span><span>{formatCurrency(amount)}</span>
            </div>
          ))
        ) : (
          <div className="flex justify-between gap-4">
            <span className="text-[#475569]">TVA{vatRows[0] ? ` ${qty.format(vatRows[0][0])} %` : ""}</span>
            <span>{formatCurrency(invoice.total_vat)}</span>
          </div>
        )}
        <div className="flex justify-between gap-4 border-t border-[#E6E9F0] pt-1.5 text-[14px] font-semibold">
          <span>Total TTC</span><span>{formatCurrency(invoice.total_ttc)}</span>
        </div>
        {company?.iban && (
          <div className="flex justify-between gap-4 pt-1 text-[11px]">
            <span className="text-[#64748B]">IBAN</span><span className="font-mono text-[#334155]">{formatIban(company.iban)}</span>
          </div>
        )}
      </div>

      {invoice.notes?.trim() && (
        <div className="border-l-2 border-[#2563EB] pl-3">
          <p className="text-[11px] font-semibold tracking-[0.04em] text-[#64748B]">CONDITIONS DE PAIEMENT / NOTES</p>
          <p className="whitespace-pre-line">{invoice.notes.trim()}</p>
        </div>
      )}

      {company?.legal_notice?.trim() && (
        <p className="whitespace-pre-line border-t border-[#F1F4F8] pt-3 text-[10px] leading-[1.55] text-[#64748B]">
          {company.legal_notice.trim()}
        </p>
      )}
    </article>
  )
}
