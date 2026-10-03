"use client"

/**
 * Contenu d'une facture reçue, lu dans son fichier : parties, lignes,
 * ventilation de TVA, totaux, paiement, notes. Utilisé par la fiche et par
 * l'aperçu avant import (application et démo).
 */
import { Copy } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { formatIban, formatSiren, mediumDate } from "@/components/invoices/invoice-view"
import { documentTypeLabel, profileLabel, type ParsedInvoice, type ReceivedParty } from "@/lib/reception/types"
import { money, paymentMeansLabel, unitLabel, vatCategoryLabel } from "@/components/reception/reception-ui"

const qty = (n: number | null) =>
  n === null ? "—" : new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 4 }).format(n)

function PartyBlock({ title, party }: { title: string; party: ReceivedParty }) {
  const a = party.address
  const place = [a?.zip, a?.city].filter(Boolean).join(" ")
  return (
    <div className="flex min-w-0 flex-col gap-1 text-sm">
      <span className="text-xs font-semibold uppercase tracking-[0.06em] text-[var(--q-text-4)]">{title}</span>
      <span className="break-words text-[15px] font-semibold text-[var(--q-ink)]">{party.name ?? "—"}</span>
      {a?.line1 && <span className="break-words text-[var(--q-text-3)]">{a.line1}</span>}
      {a?.line2 && <span className="break-words text-[var(--q-text-3)]">{a.line2}</span>}
      {(place || (a?.country && a.country !== "FR")) && (
        <span className="text-[var(--q-text-3)]">{place}{a?.country && a.country !== "FR" ? ` · ${a.country}` : ""}</span>
      )}
      <dl className="mt-1 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 text-[13px]">
        {party.siren && (<><dt className="text-[var(--q-text-4)]">SIREN</dt><dd className="font-mono text-[var(--q-text-2)]">{formatSiren(party.siren)}</dd></>)}
        {party.siret && (<><dt className="text-[var(--q-text-4)]">SIRET</dt><dd className="font-mono text-[var(--q-text-2)]">{party.siret}</dd></>)}
        {party.vat_number && (<><dt className="text-[var(--q-text-4)]">TVA</dt><dd className="font-mono text-[var(--q-text-2)]">{party.vat_number}</dd></>)}
        {party.electronic_address && (<><dt className="text-[var(--q-text-4)]">Adresse électronique</dt><dd className="break-all font-mono text-[var(--q-text-2)]">{party.electronic_address}</dd></>)}
        {party.email && (<><dt className="text-[var(--q-text-4)]">Email</dt><dd className="break-all text-[var(--q-text-2)]">{party.email}</dd></>)}
      </dl>
    </div>
  )
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs text-[var(--q-text-4)]">{label}</dt>
      <dd className="break-words text-sm font-medium text-[var(--q-ink)]">{children}</dd>
    </div>
  )
}

export function ReceivedInvoiceDocument({ invoice: inv, className }: { invoice: ParsedInvoice; className?: string }) {
  const cur = inv.currency
  const t = inv.totals
  const totalRows: { label: string; value: number | null; strong?: boolean; negative?: boolean }[] = [
    { label: "Total des lignes HT", value: t.line_total },
    ...(t.allowances ? [{ label: "Remises", value: t.allowances, negative: true }] : []),
    ...(t.charges ? [{ label: "Frais", value: t.charges }] : []),
    { label: "Total HT", value: t.tax_basis },
    { label: "TVA", value: t.tax_total },
    { label: "Total TTC", value: t.grand_total, strong: true },
    ...(t.prepaid ? [{ label: "Déjà payé", value: t.prepaid, negative: true }] : []),
    ...(t.rounding ? [{ label: "Arrondi", value: t.rounding }] : []),
    ...(t.due_payable !== null && t.due_payable !== t.grand_total ? [{ label: "Net à payer", value: t.due_payable, strong: true }] : []),
  ].filter((r) => r.value !== null)

  return (
    <article className={cn("q-card flex min-w-0 flex-col gap-6 p-5 sm:p-6", className)} aria-label="Contenu de la facture">
      {/* En-tête */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="q-display text-[22px] text-[var(--q-ink)]">
            {documentTypeLabel(inv.type_code)} <span className="font-mono text-[18px] font-medium">{inv.number ?? "sans numéro"}</span>
          </h2>
          <span className="flex flex-wrap gap-1.5">
            <span className="q-tag">{inv.syntax}</span>
            {profileLabel(inv.profile) && <span className="q-tag">{profileLabel(inv.profile)}</span>}
          </span>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          <Meta label="Date">{mediumDate(inv.issue_date)}</Meta>
          <Meta label="Échéance">{mediumDate(inv.due_date)}</Meta>
          {inv.delivery_date && <Meta label="Livraison">{mediumDate(inv.delivery_date)}</Meta>}
          {inv.order_reference && <Meta label="Commande">{inv.order_reference}</Meta>}
          {inv.buyer_reference && <Meta label="Votre référence">{inv.buyer_reference}</Meta>}
          {inv.preceding_invoice && (
            <Meta label="Facture d’origine">
              <span className="font-mono">{inv.preceding_invoice.number}</span>
              {inv.preceding_invoice.issue_date ? ` du ${mediumDate(inv.preceding_invoice.issue_date)}` : ""}
            </Meta>
          )}
        </dl>
      </div>

      {/* Parties */}
      <div className="grid gap-5 border-t border-[var(--q-line-soft)] pt-5 sm:grid-cols-2">
        <PartyBlock title="Fournisseur" party={inv.seller} />
        <PartyBlock title="Client" party={inv.buyer} />
      </div>

      {/* Lignes */}
      <section aria-label="Lignes" className="flex flex-col gap-2 border-t border-[var(--q-line-soft)] pt-5">
        <h3 className="q-h2">Détail</h3>
        {inv.lines.length === 0 ? (
          <p className="text-sm text-[var(--q-text-4)]">Le fichier ne détaille pas les lignes de la facture.</p>
        ) : (
          <>
            <div className="-mx-5 hidden overflow-x-auto sm:-mx-6 md:block">
              <table className="q-table min-w-[500px]">
                <thead>
                  <tr>
                    <th scope="col">Désignation</th>
                    <th scope="col" className="is-num">Quantité</th>
                    <th scope="col" className="is-num">Prix unitaire HT</th>
                    <th scope="col" className="is-num">TVA</th>
                    <th scope="col" className="is-num">Montant HT</th>
                  </tr>
                </thead>
                <tbody>
                  {inv.lines.map((l, i) => (
                    <tr key={i}>
                      <td className="max-w-[340px]">
                        <span className="block break-words">{l.name}</span>
                        {l.description && <span className="block break-words text-xs text-[var(--q-text-4)]">{l.description}</span>}
                      </td>
                      <td className="is-num whitespace-nowrap">{qty(l.quantity)} {unitLabel(l.unit_code)}</td>
                      <td className="is-num whitespace-nowrap">{l.unit_price === null ? "—" : money(l.unit_price, cur)}</td>
                      <td className="is-num whitespace-nowrap">{l.vat_category && l.vat_category !== "S" ? l.vat_category : l.vat_rate === null ? "—" : `${qty(l.vat_rate)} %`}</td>
                      <td className="is-num whitespace-nowrap font-semibold">{money(l.net_amount, cur)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="q-list -mx-5 border-y border-[var(--q-line-soft)] sm:-mx-6 md:hidden">
              {inv.lines.map((l, i) => (
                <li key={i} className="flex items-start justify-between gap-3 px-5 py-3 sm:px-6">
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="break-words text-sm font-medium">{l.name}</span>
                    <span className="text-xs tabular-nums text-[var(--q-text-4)]">
                      {qty(l.quantity)} {unitLabel(l.unit_code)}{l.unit_price !== null ? ` × ${money(l.unit_price, cur)}` : ""}
                      {l.vat_rate !== null && l.vat_category === "S" ? ` · TVA ${qty(l.vat_rate)} %` : l.vat_category ? ` · ${l.vat_category}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">{money(l.net_amount, cur)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        {inv.allowances_charges.length > 0 && (
          <ul className="flex flex-col gap-1 text-sm">
            {inv.allowances_charges.map((ac, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span className="text-[var(--q-text-3)]">{ac.charge ? "Frais" : "Remise"}{ac.reason ? ` · ${ac.reason}` : ""}</span>
                <span className="tabular-nums">{ac.charge ? "" : "−"}{money(ac.amount, cur)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* TVA et totaux */}
      <div className="grid gap-5 border-t border-[var(--q-line-soft)] pt-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,300px)]">
        <section aria-label="Ventilation de la TVA" className="flex min-w-0 flex-col gap-2">
          <h3 className="q-h2">TVA</h3>
          {inv.vat.length === 0 ? (
            <p className="text-sm text-[var(--q-text-4)]">Pas de ventilation de TVA dans le fichier.</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {inv.vat.map((v, i) => (
                <li key={i} className="flex flex-col gap-0.5 rounded-xl bg-[var(--q-surface-2)] px-3 py-2">
                  <span className="flex justify-between gap-3">
                    <span className="font-medium">
                      {v.category === "S" && v.rate !== null ? `TVA ${qty(v.rate)} %` : vatCategoryLabel(v.category)}
                    </span>
                    <span className="font-semibold tabular-nums">{money(v.tax, cur)}</span>
                  </span>
                  <span className="text-xs tabular-nums text-[var(--q-text-4)]">
                    sur {money(v.base, cur)} HT{v.exemption_reason ? ` · ${v.exemption_reason}` : v.exemption_code ? ` · ${v.exemption_code}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section aria-label="Totaux" className="flex flex-col gap-1.5 text-sm">
          <h3 className="sr-only">Totaux</h3>
          {totalRows.map((r) => (
            <div key={r.label} className={cn("flex justify-between gap-3", r.strong && "border-t border-[var(--q-line-soft)] pt-1.5 text-base font-semibold text-[var(--q-ink)]")}>
              <span className={cn(!r.strong && "text-[var(--q-text-3)]")}>{r.label}</span>
              <span className="tabular-nums">{r.negative ? "−" : ""}{money(r.value!, cur)}</span>
            </div>
          ))}
        </section>
      </div>

      {/* Paiement */}
      {(inv.payment.iban || inv.payment.terms || inv.payment.means_code || inv.payment.reference) && (
        <section aria-label="Paiement" className="flex flex-col gap-2 border-t border-[var(--q-line-soft)] pt-5 text-sm">
          <h3 className="q-h2">Paiement</h3>
          <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
            {paymentMeansLabel(inv.payment.means_code) && <Meta label="Moyen de paiement">{paymentMeansLabel(inv.payment.means_code)}</Meta>}
            {inv.payment.reference && <Meta label="Référence à rappeler">{inv.payment.reference}</Meta>}
            {inv.payment.bic && <Meta label="BIC">{inv.payment.bic}</Meta>}
            {inv.payment.terms && <Meta label="Conditions">{inv.payment.terms}</Meta>}
          </dl>
          {inv.payment.iban && <IbanRow iban={inv.payment.iban} />}
        </section>
      )}

      {/* Notes */}
      {inv.notes.length > 0 && (
        <section aria-label="Notes" className="flex flex-col gap-2 border-t border-[var(--q-line-soft)] pt-5">
          <h3 className="q-h2">Mentions et notes</h3>
          <ul className="flex flex-col gap-1.5">
            {inv.notes.map((n, i) => (
              <li key={i} className="whitespace-pre-line break-words text-[13px] leading-relaxed text-[var(--q-text-3)]">{n}</li>
            ))}
          </ul>
        </section>
      )}
    </article>
  )
}

/** IBAN du fournisseur avec copie. */
export function IbanRow({ iban }: { iban: string }) {
  return (
    <div className="q-inset flex items-center gap-2 py-1.5 pl-3 pr-1.5">
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[11px] text-[var(--q-text-4)]">IBAN du fournisseur</span>
        <span className="truncate font-mono text-[13px] text-[var(--q-text-2)]">{formatIban(iban)}</span>
      </span>
      <button
        type="button"
        aria-label="Copier l'IBAN du fournisseur"
        title="Copier l'IBAN"
        className="q-btn q-btn-secondary q-btn-sm q-btn-icon shrink-0"
        onClick={() => {
          navigator.clipboard?.writeText(iban.replace(/\s+/g, "")).then(() => toast.success("IBAN copié"), () => toast.error("Copie impossible"))
        }}
      >
        <Copy aria-hidden />
      </button>
    </div>
  )
}
