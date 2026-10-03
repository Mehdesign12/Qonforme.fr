'use client'

/**
 * Aperçu en direct du document, calculé à partir du formulaire : émetteur
 * (Paramètres › Entreprise), client, lignes, totaux et mentions saisies.
 * Feuille blanche sur fond grisé (q-paper-bed > q-paper), blanche aussi en
 * thème sombre. Ce n'est pas le PDF : le PDF reste la référence.
 */
import Image from "next/image"
import { formatCurrency } from "@/lib/utils/invoice"
import { isAllowedLogoUrl } from "@/lib/utils/logo-url"
import { initialsOf } from "@/components/app/kit"
import {
  DOC_TEXT, formatDayFr, formatRate, formatSiren, num, secondDateOf, vatBreakdown,
  type DocClient, type DocCompany, type DocKind,
} from "./model"
import type { DocumentFormApi } from "./useDocumentForm"

export function LivePreview({
  kind,
  doc,
  number,
  client,
  company,
  action,
}: {
  kind: DocKind
  doc: DocumentFormApi
  /** Numéro définitif (modification) ; absent tant que le document n'est pas enregistré. */
  number?: string | null
  client: DocClient | null
  company: DocCompany | null
  /** Action à droite de l'intitulé (ex. « Aperçu PDF »). */
  action?: React.ReactNode
}) {
  const { form, computed, totals } = doc
  const text = DOC_TEXT[kind]
  const breakdown = vatBreakdown(form.lines, computed)
  const second = secondDateOf(kind, form)
  const lines = form.lines.filter((l, i) => l.description.trim() || computed[i].totalHT > 0)
  const companyName = company?.name?.trim() || "Votre entreprise"
  // Logo du bucket Storage public du projet (motif autorisé par next.config)
  const logo = company?.logo_url && isAllowedLogoUrl(company.logo_url) && company.logo_url.includes("/storage/v1/object/public/")
    ? company.logo_url
    : null
  const companyAddress = [company?.address, [company?.zip_code, company?.city].filter(Boolean).join(" ")].filter(Boolean).join(", ")
  const clientAddress = client ? [client.address, [client.zip_code, client.city].filter(Boolean).join(" ")].filter(Boolean).join(", ") : ""
  // Le PDF imprime les 3 premières lignes des notes et 4 des mentions légales
  const notes = form.notes.trim().split("\n").slice(0, 3).join("\n")
  const legal = (company?.legal_notice ?? "").trim().split("\n").slice(0, 4).join("\n")
  const secondLabel = kind === "invoice" ? "Échéance" : kind === "quote" ? "Valable jusqu'au" : "Livraison souhaitée"

  return (
    <section className="q-paper-bed !p-4 md:!p-5" aria-label={`Aperçu ${kind === "invoice" ? "de la facture" : kind === "quote" ? "du devis" : "du bon de commande"}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-[13px] font-semibold text-[var(--q-text-3)]">Aperçu en direct</span>
        {action}
      </div>

      <div className="q-paper flex flex-col gap-4 p-5 text-[11.5px] leading-snug md:p-7">
        {/* En-tête : émetteur à gauche, document à droite */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-start gap-2.5">
            {logo ? (
              <Image src={logo} alt="" width={40} height={40} sizes="40px" className="size-10 shrink-0 rounded-[9px] object-contain" />
            ) : (
              <span className="grid size-9 shrink-0 place-items-center rounded-[9px] bg-[#0A1122] text-xs font-semibold text-white" aria-hidden>
                {initialsOf(companyName)}
              </span>
            )}
            <span className="flex min-w-0 flex-col">
              <strong className="text-[12.5px] font-semibold">{companyName}</strong>
              {companyAddress && <span className="text-[#64748B]">{companyAddress}</span>}
              {company?.siren && <span className="font-mono text-[10.5px] text-[#64748B]">SIREN {formatSiren(company.siren)}</span>}
            </span>
          </div>
          <div className="flex max-w-[48%] shrink-0 flex-col items-end gap-0.5 text-right">
            <strong className="text-[15px] font-semibold leading-tight tracking-[-0.01em]">{text.paperTitle}</strong>
            {/* Numéro attribué par le serveur (facture : à l'envoi, autres documents : à l'enregistrement), jamais deviné ici */}
            <span className="font-mono text-[10.5px] text-[#475569]">{number || (kind === "invoice" ? "Brouillon" : "N° à l'enregistrement")}</span>
            {form.issue_date && <span className="font-mono text-[10.5px] text-[#475569]">{formatDayFr(form.issue_date)}</span>}
          </div>
        </div>

        {/* Client */}
        <div className="leading-relaxed">
          <span className="block text-[10px] font-semibold tracking-[0.06em] text-[#64748B]">CLIENT</span>
          {client ? (
            <>
              <span className="font-medium">{client.name}</span>
              {clientAddress && <span className="text-[#475569]"> · {clientAddress}</span>}
              {client.siren && <span className="block font-mono text-[10.5px] text-[#64748B]">SIREN {formatSiren(client.siren)}</span>}
            </>
          ) : (
            <span className="text-[#94A3B8]">Choisissez un client</span>
          )}
          {kind === "purchase_order" && form.reference.trim() && (
            <span className="block text-[#475569]">Votre référence : <span className="font-mono">{form.reference.trim()}</span></span>
          )}
        </div>

        {/* Lignes */}
        <div className="flex flex-col">
          <div className="grid grid-cols-[minmax(0,1fr)_40px_62px_66px] gap-1.5 border-b border-[#E6E9F0] py-1.5 text-[10.5px] font-semibold text-[#64748B]">
            <span>Désignation</span>
            <span className="text-right">Qté</span>
            <span className="text-right">Prix HT</span>
            <span className="text-right">Total HT</span>
          </div>
          {lines.length === 0 ? (
            <p className="border-b border-[#F1F4F8] py-3 text-[#94A3B8]">Les lignes saisies apparaissent ici.</p>
          ) : (
            form.lines.map((line, i) => {
              if (!line.description.trim() && computed[i].totalHT === 0) return null
              return (
                <div key={line.id} className="grid grid-cols-[minmax(0,1fr)_40px_62px_66px] gap-1.5 border-b border-[#F1F4F8] py-1.5 tabular-nums">
                  <span className="min-w-0 break-words">{line.description.trim() || <span className="text-[#94A3B8]">Sans désignation</span>}</span>
                  <span className="text-right">{String(num(line.quantity)).replace(".", ",")}</span>
                  <span className="text-right">{formatAmount(num(line.unit_price_ht))}</span>
                  <span className="text-right">{formatAmount(computed[i].totalHT)}</span>
                </div>
              )
            })
          )}
        </div>

        {/* Totaux */}
        <div className="flex flex-col gap-1 self-end tabular-nums" style={{ minWidth: "min(220px, 100%)" }}>
          <div className="flex justify-between gap-5">
            <span className="text-[#475569]">Total HT</span>
            <span>{formatCurrency(totals.subtotal_ht)}</span>
          </div>
          {breakdown.length === 0 ? (
            <div className="flex justify-between gap-5">
              <span className="text-[#475569]">TVA</span>
              <span>{formatCurrency(0)}</span>
            </div>
          ) : breakdown.map((v) => (
            <div key={v.rate} className="flex justify-between gap-5">
              <span className="text-[#475569]">TVA {formatRate(v.rate)}</span>
              <span>{formatCurrency(v.amount)}</span>
            </div>
          ))}
          <div className="flex justify-between gap-5 border-t border-[#E6E9F0] pt-1 text-[13.5px] font-semibold">
            <span>Total TTC</span>
            <span>{formatCurrency(totals.total_ttc)}</span>
          </div>
        </div>

        {/* Mentions : dates, IBAN, notes et mentions légales de l'entreprise (comme le PDF) */}
        <div className="flex flex-col gap-1.5 border-t border-[#F1F4F8] pt-2.5 text-[9.5px] leading-relaxed text-[#64748B]">
          {second && <p>{secondLabel} : {formatDayFr(second)}.</p>}
          {kind === "invoice" && company?.iban && <p>IBAN : <span className="font-mono">{company.iban}</span></p>}
          {notes && <p className="whitespace-pre-line">{notes}</p>}
          {legal && <p className="whitespace-pre-line">{legal}</p>}
        </div>
      </div>
    </section>
  )
}

/** Montant sans symbole (colonnes du tableau) : « 1 564,00 ». */
function formatAmount(n: number): string {
  return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}
