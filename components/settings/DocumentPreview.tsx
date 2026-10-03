/**
 * Aperçu d'une facture avec les réglages en cours (planche « Paramètres —
 * Modèles de documents », colonne de droite). Reprend la mise en page réelle
 * du PDF (lib/pdf/invoice.ts) : bande et numéro à la couleur d'accent, logo ou
 * raison sociale, total TTC, IBAN sous le total, mentions légales en bas
 * (automatiques puis libres, comme le PDF). Les lignes sont des exemples.
 *
 * La feuille reste blanche en thème sombre (c'est un document).
 */
import { formatCurrency } from "@/lib/utils/invoice"

export interface PreviewCompany {
  name: string
  address: string
  zip_code: string
  city: string
  siren: string
  siret: string
  vat_number: string
  iban: string
}

const SAMPLE_LINES = [
  { label: "Cloison sur ossature 72/48", qty: "12 m²", ht: 576 },
  { label: "Doublage isolant collé 10+80", qty: "18 m²", ht: 648 },
]
const SAMPLE_HT = 1224
const SAMPLE_TVA = 122.4 // 10 %, travaux de rénovation

export function DocumentPreview({
  accent,
  logo,
  company,
  number,
  legalNotice,
}: {
  accent: string
  logo: string | null
  company: PreviewCompany
  number: string
  legalNotice: string
}) {
  const color = /^#[0-9a-f]{6}$/i.test(accent) ? accent : "#2563EB"
  const cityLine = [company.zip_code, company.city].filter(Boolean).join(" ")
  // Mentions automatiques puis libres, comme le pied du PDF (coupé à 16 lignes)
  const notice = legalNotice.trim().split("\n").filter(Boolean).slice(0, 16)

  return (
    <div className="q-paper flex flex-col gap-3.5 p-6 text-[11px] leading-snug" aria-label="Aperçu d'une facture">
      <div className="flex items-start justify-between gap-3">
        <span className="flex min-w-0 flex-col gap-1">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" className="mb-1 h-10 max-w-[150px] object-contain object-left" />
          ) : (
            <strong className="text-[14px] leading-tight" style={{ color }}>{company.name || "Votre entreprise"}</strong>
          )}
          {company.address && <span className="text-[#475569]">{company.address}</span>}
          {cityLine && <span className="text-[#475569]">{cityLine}</span>}
          {(company.siret || company.siren) && (
            <span className="text-[#94A3B8]">{company.siret ? `SIRET : ${company.siret}` : `SIREN : ${company.siren}`}</span>
          )}
          {company.vat_number && <span className="text-[#94A3B8]">TVA : {company.vat_number}</span>}
        </span>
        <span className="flex shrink-0 flex-col items-end gap-0.5">
          <strong className="font-display text-[17px] tracking-[-0.01em] text-[#0F172A]">FACTURE</strong>
          <span className="font-mono text-[12px] font-medium" style={{ color }}>{number}</span>
        </span>
      </div>

      <div className="h-[3px] rounded-sm" style={{ background: color }} />

      <div className="flex flex-col">
        <div className="grid grid-cols-[minmax(0,1fr)_52px_64px] gap-1.5 border-b border-[#E6E9F0] py-1.5 font-semibold text-[#64748B]">
          <span>Désignation</span>
          <span className="text-right">Qté</span>
          <span className="text-right">Total HT</span>
        </div>
        {SAMPLE_LINES.map((l) => (
          <div key={l.label} className="grid grid-cols-[minmax(0,1fr)_52px_64px] gap-1.5 border-b border-[#F1F4F8] py-[7px] tabular-nums">
            <span className="truncate">{l.label}</span>
            <span className="text-right">{l.qty}</span>
            <span className="text-right">{formatCurrency(l.ht).replace(/\s?€$/, "")}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-col items-end gap-1 tabular-nums">
        <span className="flex gap-5 text-[#475569]">
          <span>Sous-total HT</span><span className="min-w-[72px] text-right text-[#0F172A]">{formatCurrency(SAMPLE_HT)}</span>
        </span>
        <span className="flex gap-5 text-[#475569]">
          <span>TVA</span><span className="min-w-[72px] text-right text-[#0F172A]">{formatCurrency(SAMPLE_TVA)}</span>
        </span>
        <span className="mt-1 flex items-baseline gap-5 border-t-[1.5px] pt-1.5" style={{ borderColor: color }}>
          <strong style={{ color }}>TOTAL TTC</strong>
          <strong className="min-w-[72px] text-right text-[15px]" style={{ color }}>{formatCurrency(SAMPLE_HT + SAMPLE_TVA)}</strong>
        </span>
        {company.iban && (
          <span className="mt-1 flex gap-3 text-[9.5px]">
            <span className="text-[#94A3B8]">IBAN</span>
            <span className="font-mono text-[#475569]">{company.iban}</span>
          </span>
        )}
      </div>

      {notice.length > 0 && (
        <div className="flex flex-col items-center gap-0.5 border-t border-[#F1F4F8] pt-2.5 text-center text-[9px] leading-relaxed text-[#94A3B8]">
          {notice.map((l, i) => <span key={i}>{l}</span>)}
        </div>
      )}

      <div className="border-t border-[#F1F4F8] pt-2 text-[9px] text-[#94A3B8]">
        {(company.name || "Votre entreprise")} — {number}
      </div>
    </div>
  )
}
