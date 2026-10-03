import { Check, Clock } from 'lucide-react'
import { PLANS } from '@/lib/stripe/plans'

/**
 * Tableau « Comparer les offres » de la page Tarifs (planche « Tarifs »).
 *
 * Ne compare que ce que fait le code aujourd'hui : le mur de paiement est à
 * l'émission (envoi, sortie du brouillon, relance — requireIssuingAccess), le
 * reste est ouvert à tous. Les fonctions annoncées viennent de
 * PLANS[…].upcoming et sont toujours dites « à venir ». Les fonctions de la
 * formule Artisan sont livrées (PLANS.pro.features) : incluses dans Artisan,
 * que la formule soit déjà en vente ou non (la carte le précise).
 */

type Cell =
  | { kind: 'yes'; label?: string }
  | { kind: 'soon' }
  | { kind: 'no' }

const yes = (label?: string): Cell => ({ kind: 'yes', label })
const soon: Cell = { kind: 'soon' }
const no: Cell = { kind: 'no' }

const ROWS: { label: string; cells: [Cell, Cell, Cell] }[] = [
  { label: 'Devis', cells: [yes('Illimités'), yes('Illimités'), yes('Illimités')] },
  { label: 'Envoi des devis par email, avec le PDF', cells: [yes(), yes(), yes()] },
  { label: 'Clients et catalogue de prestations', cells: [yes(), yes(), yes()] },
  { label: 'Factures', cells: [yes('Brouillon'), yes('Illimitées'), yes('Illimitées')] },
  { label: 'Envoi des factures par email, avec le PDF', cells: [no, yes(), yes()] },
  { label: 'Relances des impayés', cells: [no, yes(), yes()] },
  ...PLANS.starter.upcoming.map((label) => ({ label, cells: [no, soon, soon] as [Cell, Cell, Cell] })),
  ...PLANS.pro.features.map((label) => ({ label, cells: [no, no, yes()] as [Cell, Cell, Cell] })),
  ...PLANS.pro.upcoming.map((label) => ({ label, cells: [no, no, soon] as [Cell, Cell, Cell] })),
]

const COLUMNS = ['Devis', PLANS.starter.name, PLANS.pro.name]

export default function PlanComparison() {
  return (
    <>
    {/* Légende : sur téléphone, les cellules n'affichent que l'icône */}
    <p className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-q-text-3 sm:hidden" aria-hidden>
      <span className="inline-flex items-center gap-1.5">
        <Check className="h-3.5 w-3.5 text-q-accent" strokeWidth={2.25} />
        Inclus
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Clock className="h-3.5 w-3.5 text-q-text-4" strokeWidth={2} />
        À venir
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="text-q-placeholder">—</span>
        Non inclus
      </span>
    </p>
    <div className="overflow-hidden rounded-2xl border border-q-line bg-q-surface">
      <table className="w-full table-fixed border-collapse text-[13px] sm:text-sm">
        <caption className="sr-only">Fonctions incluses dans chaque formule</caption>
        <thead>
          <tr className="text-left text-[13px] text-q-text-3">
            <th scope="col" className="border-b border-q-line px-3 py-4 font-semibold sm:px-5">
              Fonctionnalité
            </th>
            {COLUMNS.map((name, i) => (
              <th
                key={name}
                scope="col"
                className={`w-[68px] border-b border-q-line px-1.5 py-4 text-xs font-semibold sm:w-[150px] sm:px-5 sm:text-[13px] ${
                  i === 2 ? 'text-q-accent-strong' : ''
                }`}
              >
                {name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row, r) => (
            <tr key={row.label} className="transition-colors hover:bg-q-row-hover">
              <th
                scope="row"
                className={`px-3 py-3.5 text-left font-medium text-q-ink sm:px-5 ${
                  r < ROWS.length - 1 ? 'border-b border-q-line-soft' : ''
                }`}
              >
                {row.label}
              </th>
              {row.cells.map((cell, c) => (
                <td
                  key={c}
                  className={`px-1.5 py-3.5 text-xs sm:px-5 sm:text-sm ${r < ROWS.length - 1 ? 'border-b border-q-line-soft' : ''}`}
                >
                  <CellValue cell={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </>
  )
}

function CellValue({ cell }: { cell: Cell }) {
  if (cell.kind === 'no') {
    return (
      <span className="text-q-placeholder">
        <span aria-hidden>—</span>
        <span className="sr-only">Non inclus</span>
      </span>
    )
  }
  if (cell.kind === 'soon') {
    return (
      <span className="inline-flex items-center gap-1.5 text-q-text-4">
        <Clock className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
        <span className="max-sm:sr-only">À venir</span>
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-q-ink">
      {cell.label ? (
        cell.label
      ) : (
        <>
          <Check className="h-4 w-4 shrink-0 text-q-accent" strokeWidth={2.25} aria-hidden />
          <span className="max-sm:sr-only">Inclus</span>
        </>
      )}
    </span>
  )
}
