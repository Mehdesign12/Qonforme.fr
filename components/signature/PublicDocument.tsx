"use client"

/**
 * Le document lu en entier sur la page du client (DECISIONS § 11, étape 1) :
 * émetteur, client, prestations, totaux par taux de TVA, notes et mentions.
 * Lignes empilées sur téléphone, tableau à partir de 768 px. Reste blanc en
 * thème sombre, comme une feuille.
 */
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/utils/invoice"
import { fmtQty, fmtRate, fmtSiren, fmtUnit, longDate, vatBreakdown } from "@/components/quotes/QuoteListHelpers"
import type { PublicCompanyView, PublicDocView } from "@/lib/signature/view"

export function PublicDocument({ doc, company }: { doc: PublicDocView; company: PublicCompanyView }) {
  const label = "block text-[11px] font-semibold uppercase tracking-[.06em] text-[#64748B]"
  const companyCity = [company.zip_code, company.city].filter(Boolean).join(" ")
  const client = doc.client
  const clientCity = [client?.zip_code, client?.city].filter(Boolean).join(" ")
  const title = doc.type === "quote" ? "Devis" : "Bon de commande"

  return (
    <article aria-label={`${title} ${doc.number}`} className="q-paper flex flex-col gap-5 p-5 text-[14px] leading-normal sm:p-8 sm:text-[13px]">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[20px] font-semibold tracking-[-0.01em]">{title}</span>
          <span className="font-mono text-[13px] text-[#475569]">{doc.number}</span>
        </div>
        <div className="flex flex-col gap-0.5 text-[13px] text-[#475569] sm:items-end sm:text-right">
          <span>Émis le {longDate(doc.issue_date)}</span>
          {doc.valid_until && <span>Valable jusqu&apos;au {longDate(doc.valid_until)}</span>}
          {doc.delivery_date && <span>Livraison souhaitée le {longDate(doc.delivery_date)}</span>}
          {doc.reference && <span>Réf. client {doc.reference}</span>}
        </div>
      </header>

      <div className="grid gap-4 leading-[1.55] sm:grid-cols-2">
        <div className="min-w-0 break-words">
          <strong className={label}>Émetteur</strong>
          {company.name}
          {company.address && <><br />{company.address}</>}
          {companyCity && <><br />{companyCity}</>}
          {(company.siret || company.siren) && <><br />{company.siret ? `SIRET ${fmtSiren(company.siret)}` : `SIREN ${fmtSiren(company.siren!)}`}</>}
          {company.vat_number && <><br />TVA {company.vat_number}</>}
        </div>
        <div className="min-w-0 break-words">
          <strong className={label}>{doc.type === "quote" ? "Client" : "Destinataire"}</strong>
          {client?.name ?? "—"}
          {client?.address && <><br />{client.address}</>}
          {clientCity && <><br />{clientCity}</>}
          {client?.siren && <><br />SIREN {fmtSiren(client.siren)}</>}
        </div>
      </div>

      {/* Prestations : cartes empilées sur téléphone */}
      <div className="flex flex-col md:hidden">
        <strong className={cn(label, "mb-1")}>Prestations</strong>
        {doc.lines.map((l, i) => (
          <div key={i} className="flex items-start justify-between gap-3 border-b border-[#EEF1F5] py-2.5">
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="break-words font-medium">{l.description || "Prestation"}</span>
              <span className="text-[13px] tabular-nums text-[#64748B]">
                {fmtQty(l.quantity)}{l.unit ? ` ${fmtUnit(l.quantity, l.unit)}` : ""} × {formatCurrency(l.unit_price_ht)} HT · TVA {fmtRate(l.vat_rate)} %
              </span>
            </span>
            <span className="shrink-0 font-semibold tabular-nums">{formatCurrency(l.total_ht)}</span>
          </div>
        ))}
      </div>

      {/* Tableau à partir de 768 px */}
      <table className="hidden w-full border-collapse text-left tabular-nums md:table">
        <caption className="sr-only">Prestations</caption>
        <thead>
          <tr className="border-b border-[#E6E9F0] text-[12px] text-[#64748B]">
            <th scope="col" className="py-2 pr-2 font-semibold">Désignation</th>
            <th scope="col" className="py-2 pr-2 text-right font-semibold">Qté</th>
            <th scope="col" className="py-2 pr-2 text-right font-semibold">Prix HT</th>
            <th scope="col" className="py-2 pr-2 text-right font-semibold">TVA</th>
            <th scope="col" className="py-2 text-right font-semibold">Total HT</th>
          </tr>
        </thead>
        <tbody>
          {doc.lines.map((l, i) => (
            <tr key={i} className="border-b border-[#F1F4F8] align-top">
              <td className="break-words py-2 pr-2">{l.description}</td>
              <td className="whitespace-nowrap py-2 pr-2 text-right">{fmtQty(l.quantity)}{l.unit ? ` ${fmtUnit(l.quantity, l.unit)}` : ""}</td>
              <td className="whitespace-nowrap py-2 pr-2 text-right">{formatCurrency(l.unit_price_ht)}</td>
              <td className="whitespace-nowrap py-2 pr-2 text-right">{fmtRate(l.vat_rate)} %</td>
              <td className="whitespace-nowrap py-2 text-right">{formatCurrency(l.total_ht)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="ml-auto flex w-full flex-col gap-1.5 tabular-nums sm:w-[60%]">
        <div className="flex justify-between gap-3"><span className="text-[#475569]">Total HT</span><span>{formatCurrency(doc.subtotal_ht)}</span></div>
        {vatBreakdown(doc.lines).map((v) => (
          <div key={v.rate} className="flex justify-between gap-3"><span className="text-[#475569]">TVA {fmtRate(v.rate)} %</span><span>{formatCurrency(v.amount)}</span></div>
        ))}
        <div className="flex justify-between gap-3 border-t border-[#E6E9F0] pt-2 text-[16px] font-semibold"><span>Total TTC</span><span>{formatCurrency(doc.total_ttc)}</span></div>
      </div>

      {doc.notes && (
        <div className="border-t border-[#F1F4F8] pt-3 text-[13px] leading-[1.6] text-[#475569]">
          <strong className={cn(label, "mb-1")}>Notes et conditions</strong>
          <span className="whitespace-pre-line break-words">{doc.notes}</span>
        </div>
      )}
      {company.legal_notice && (
        <p className="whitespace-pre-line break-words border-t border-[#F1F4F8] pt-3 text-[12px] leading-[1.6] text-[#64748B]">{company.legal_notice}</p>
      )}
    </article>
  )
}
