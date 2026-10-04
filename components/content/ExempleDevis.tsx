import { Check } from "lucide-react"
import type { ExempleDevis as Exemple } from "@/lib/pseo/guides"
import { totauxExemple } from "@/lib/pseo/exemple-devis"
import { formatCentimes, formatNombreFr, versEntier } from "@/lib/outils/decimal"
import { SectionHeading } from "@/components/content/ui"
import { fr } from "@/components/content/text"

/**
 * Devis d'exemple d'un guide : lignes, totaux et conditions. Prix fictifs,
 * totaux calculés (jamais recopiés à la main) ; sur mobile, la quantité et le
 * prix unitaire passent sous la désignation.
 */
export function ExempleDevisCard({ exemple, id }: { exemple: Exemple; id: string }) {
  const t = totauxExemple(exemple)
  const taux = `${formatNombreFr(exemple.tauxTva)} %`

  return (
    <section aria-labelledby={id} className="mt-14">
      <SectionHeading id={id} title="Un exemple" accent="de devis chiffré." className="mb-4" />
      <p className="mb-6 max-w-[68ch] text-[15px] leading-[1.6] text-q-text-3">{fr(exemple.contexte)}</p>

      <figure className="overflow-hidden rounded-[20px] border border-q-line bg-q-surface shadow-[var(--q-shadow-card)]">
        <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-q-line px-5 py-4 sm:px-7">
          <span className="font-display text-[18px] font-semibold tracking-[-0.02em] text-q-ink-strong">{fr(exemple.titre)}</span>
          <span className="text-[13px] text-q-text-4">Devis d&apos;exemple · TVA {fr(taux)}</span>
        </figcaption>

        <table className="w-full text-left text-[14px] leading-[1.5]">
          <thead className="bg-q-wash text-[12px] font-semibold uppercase tracking-[0.06em] text-q-text-4">
            <tr>
              <th scope="col" className="px-5 py-2.5 font-semibold sm:px-7">Désignation</th>
              <th scope="col" className="hidden px-3 py-2.5 text-right font-semibold sm:table-cell">Qté</th>
              <th scope="col" className="hidden whitespace-nowrap px-3 py-2.5 text-right font-semibold sm:table-cell">Prix unit. HT</th>
              <th scope="col" className="whitespace-nowrap px-5 py-2.5 text-right font-semibold sm:px-7">Total HT</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-q-line-soft">
            {t.lignes.map((l, i) => {
              const quantite = `${formatNombreFr(l.quantite)} ${exemple.lignes[i].unite}`
              const prix = formatCentimes(versEntier(l.prixHT, 2))
              return (
                <tr key={i} className="align-top">
                  <td className="px-5 py-3 text-q-text-2 sm:px-7">
                    {fr(l.description)}
                    <span className="mt-1 block text-[13px] tabular-nums text-q-text-4 sm:hidden">
                      {quantite} × {prix} HT
                    </span>
                  </td>
                  <td className="hidden whitespace-nowrap px-3 py-3 text-right tabular-nums text-q-text-3 sm:table-cell">{quantite}</td>
                  <td className="hidden whitespace-nowrap px-3 py-3 text-right tabular-nums text-q-text-3 sm:table-cell">{prix}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-right font-medium tabular-nums text-q-ink sm:px-7">{formatCentimes(l.htCentimes)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <div className="flex justify-end border-t border-q-line px-5 py-4 sm:px-7">
          <dl className="grid w-full max-w-[340px] gap-1.5 text-[14px] tabular-nums">
            <div className="flex justify-between gap-4 text-q-text-3">
              <dt>Total HT</dt>
              <dd>{formatCentimes(t.htCentimes)}</dd>
            </div>
            <div className="flex justify-between gap-4 text-q-text-3">
              <dt>TVA {fr(taux)}</dt>
              <dd>{formatCentimes(t.tvaCentimes)}</dd>
            </div>
            <div className="mt-1 flex justify-between gap-4 border-t border-q-line-soft pt-2 text-[15px] font-semibold text-q-ink-strong">
              <dt>Total TTC</dt>
              <dd>{formatCentimes(t.ttcCentimes)}</dd>
            </div>
            {t.acompteCentimes !== undefined && (
              <div className="flex justify-between gap-4 text-q-text-3">
                <dt>Acompte de {fr(`${formatNombreFr(exemple.acomptePourcent!)} %`)} à la signature</dt>
                <dd>{formatCentimes(t.acompteCentimes)}</dd>
              </div>
            )}
          </dl>
        </div>

        <ul className="flex flex-col gap-2 border-t border-q-line bg-q-wash px-5 py-4 text-[14px] leading-[1.55] text-q-text-3 sm:px-7">
          {exemple.conditions.map((c) => (
            <li key={c} className="flex items-start gap-2.5">
              <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-q-accent-strong" strokeWidth={2.5} aria-hidden />
              {fr(c)}
            </li>
          ))}
        </ul>
      </figure>
    </section>
  )
}
