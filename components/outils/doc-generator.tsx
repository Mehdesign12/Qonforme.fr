"use client"

import { Check, Plus, Trash2 } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * Pièces communes aux générateurs gratuits de facture et de devis :
 * étapes, saisie des lignes et aperçu papier en direct (q-paper-bed >
 * q-paper, comme l'aperçu des formulaires de création du canevas).
 * L'état, les validations et l'appel à /api/outils/* restent dans chaque page.
 */

export interface Ligne {
  id: string
  description: string
  quantite: number
  prixHT: number
  tauxTVA: number
}

export function newLigne(): Ligne {
  return { id: crypto.randomUUID(), description: "", quantite: 1, prixHT: 0, tauxTVA: 20 }
}

function fmtEur(n: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n)
}

function fmtDate(iso: string): string {
  if (!iso) return ""
  const d = new Date(`${iso}T00:00:00`)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
}

function fmtRate(r: number): string {
  return `${String(r).replace(".", ",")}\u00a0%`
}

/* ─────────────────────────────────────────────────────────
   Étapes
───────────────────────────────────────────────────────── */
export function Stepper({
  steps,
  current,
  onSelect,
}: {
  steps: { label: string }[]
  current: number
  onSelect: (i: number) => void
}) {
  return (
    <nav aria-label="Étapes" className="border-b border-q-line-soft px-4 py-4 sm:px-7">
      <ol className="flex items-center gap-2">
        {steps.map((s, i) => {
          const done = i < current
          const active = i === current
          return (
            <li key={s.label} className={cn("flex items-center gap-2", i < steps.length - 1 && "flex-auto")}>
              <button
                type="button"
                onClick={() => onSelect(i)}
                aria-current={active ? "step" : undefined}
                className="flex min-h-[44px] shrink-0 items-center gap-2 rounded-lg pr-1 text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--q-focus)]"
              >
                <span
                  className={cn(
                    "grid h-7 w-7 shrink-0 place-items-center rounded-full text-[13px] font-semibold tabular-nums transition-colors",
                    active && "bg-q-accent text-white",
                    done && "bg-q-wash text-q-accent-strong",
                    !active && !done && "border border-q-field bg-q-surface text-q-text-4",
                  )}
                >
                  {done ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden /> : i + 1}
                </span>
                {/* Sur mobile, seul le libellé de l'étape courante s'affiche */}
                <span className={cn("whitespace-nowrap text-[13px] font-semibold sm:text-[14px]", active ? "text-q-ink" : "sr-only text-q-text-4 sm:not-sr-only")}>
                  {s.label}
                </span>
              </button>
              {i < steps.length - 1 && <span aria-hidden className={cn("h-px min-w-[16px] flex-1", done ? "bg-q-accent" : "bg-q-line")} />}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/* ─────────────────────────────────────────────────────────
   Lignes du document
───────────────────────────────────────────────────────── */
export function LineItemsEditor({
  lignes,
  onUpdate,
  onRemove,
  onAdd,
  rates,
}: {
  lignes: Ligne[]
  onUpdate: (id: string, field: keyof Ligne, value: string | number) => void
  onRemove: (id: string) => void
  onAdd: () => void
  /** Taux de TVA proposés. */
  rates: number[]
}) {
  return (
    <div className="flex flex-col gap-3">
      {lignes.map((l, i) => (
        <div key={l.id} className="q-inset flex flex-col gap-3 p-3.5 sm:p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13px] font-semibold text-q-text-3">Ligne {i + 1}</span>
            <button
              type="button"
              onClick={() => onRemove(l.id)}
              disabled={lignes.length === 1}
              aria-label={`Supprimer la ligne ${i + 1}`}
              className="q-btn q-btn-ghost q-btn-sm q-btn-icon hover:!text-q-danger"
            >
              <Trash2 aria-hidden />
            </button>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`ligne-${i + 1}-desc`} className="sr-only">
              Désignation de la ligne {i + 1}
            </label>
            <input id={`ligne-${i + 1}-desc`} className="q-input" placeholder="Désignation de la prestation" value={l.description} onChange={(e) => onUpdate(l.id, "description", e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="flex min-w-0 flex-col gap-1.5">
              <label htmlFor={`ligne-${i + 1}-qte`} className="text-[12px] font-semibold text-q-text-3">
                Quantité
              </label>
              <input id={`ligne-${i + 1}-qte`} className="q-input tabular-nums" type="number" inputMode="decimal" min={0} value={l.quantite || ""} onChange={(e) => onUpdate(l.id, "quantite", parseFloat(e.target.value) || 0)} />
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <label htmlFor={`ligne-${i + 1}-pu`} className="text-[12px] font-semibold text-q-text-3">
                Prix HT
              </label>
              <input id={`ligne-${i + 1}-pu`} className="q-input tabular-nums" type="number" inputMode="decimal" min={0} step={0.01} value={l.prixHT || ""} onChange={(e) => onUpdate(l.id, "prixHT", parseFloat(e.target.value) || 0)} />
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <label htmlFor={`ligne-${i + 1}-tva`} className="text-[12px] font-semibold text-q-text-3">
                TVA
              </label>
              <select id={`ligne-${i + 1}-tva`} className="q-input pr-2" value={l.tauxTVA} onChange={(e) => onUpdate(l.id, "tauxTVA", parseFloat(e.target.value))}>
                {rates.map((r) => (
                  <option key={r} value={r}>
                    {fmtRate(r)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {l.prixHT > 0 && <p className="text-right text-[13px] font-medium tabular-nums text-q-text-3">{fmtEur(l.quantite * l.prixHT)} HT</p>}
        </div>
      ))}
      <button type="button" onClick={onAdd} className="q-btn q-btn-ghost self-start !text-q-accent-strong hover:!bg-q-wash">
        <Plus aria-hidden />
        Ajouter une ligne
      </button>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────
   Aperçu papier en direct (reste blanc en thème sombre)
───────────────────────────────────────────────────────── */
interface Party {
  nom: string
  adresse?: string
  siret?: string
  email?: string
}

export function DocPaper({
  kind,
  numero,
  numeroPlaceholder,
  date,
  dateLabel,
  date2,
  date2Label,
  emetteur,
  client,
  lignes,
  totals,
  mention,
  notes,
  className,
}: {
  kind: "Facture" | "Devis"
  numero: string
  numeroPlaceholder: string
  date: string
  dateLabel: string
  date2: string
  date2Label: string
  emetteur: Party
  client: Party
  lignes: Ligne[]
  totals: { ht: number; tva: number; ttc: number }
  mention?: string
  notes?: string
  className?: string
}) {
  const filled = lignes.filter((l) => l.description.trim() || l.prixHT > 0)
  const muted = "text-[#94A3B8]"
  return (
    <div className={cn("q-paper-bed !p-3 sm:!p-5", className)}>
      <div className="q-paper flex min-h-[460px] flex-col p-5 text-[11px] leading-[1.5] sm:p-7" aria-label={`Aperçu du ${kind.toLowerCase()}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className={cn("truncate text-[13px] font-semibold", !emetteur.nom && muted)}>{emetteur.nom || "Votre entreprise"}</p>
            {emetteur.adresse && <p className="text-[#475569]">{emetteur.adresse}</p>}
            {emetteur.siret && <p className="font-mono text-[10px] text-[#475569]">SIRET {emetteur.siret}</p>}
            {emetteur.email && <p className="text-[#475569]">{emetteur.email}</p>}
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[15px] font-semibold tracking-[-0.01em]">{kind}</p>
            <p className={cn("font-mono text-[10px]", numero ? "text-[#475569]" : muted)}>{numero || numeroPlaceholder}</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[#64748B]">{dateLabel}</p>
            <p className="tabular-nums">{fmtDate(date) || "—"}</p>
          </div>
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[#64748B]">{date2Label}</p>
            <p className="tabular-nums">{fmtDate(date2) || "—"}</p>
          </div>
        </div>

        <div className="mt-4 rounded-[3px] bg-[#F8FAFC] px-3 py-2.5">
          <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[#64748B]">Client</p>
          <p className={cn("font-semibold", !client.nom && muted)}>{client.nom || "Nom du client"}</p>
          {client.adresse && <p className="text-[#475569]">{client.adresse}</p>}
          {client.siret && <p className="font-mono text-[10px] text-[#475569]">SIRET {client.siret}</p>}
        </div>

        <table className="mt-5 w-full border-collapse">
          <thead>
            <tr className="border-b border-[#E2E8F0] text-[9px] uppercase tracking-[0.06em] text-[#64748B]">
              <th className="py-1.5 text-left font-semibold">Désignation</th>
              <th className="py-1.5 pl-2 text-right font-semibold">Qté</th>
              <th className="hidden py-1.5 pl-2 text-right font-semibold sm:table-cell">TVA</th>
              <th className="py-1.5 pl-2 text-right font-semibold">Total HT</th>
            </tr>
          </thead>
          <tbody>
            {filled.length === 0 ? (
              <tr className="border-b border-[#F1F5F9]">
                <td className={cn("py-2", muted)} colSpan={4}>
                  Désignation de la prestation
                </td>
              </tr>
            ) : (
              filled.map((l) => (
                <tr key={l.id} className="border-b border-[#F1F5F9] align-top">
                  <td className={cn("break-words py-2 pr-2", !l.description.trim() && muted)}>{l.description || "Sans désignation"}</td>
                  <td className="py-2 pl-2 text-right tabular-nums">{String(l.quantite).replace(".", ",")}</td>
                  <td className="hidden py-2 pl-2 text-right tabular-nums sm:table-cell">{fmtRate(l.tauxTVA)}</td>
                  <td className="whitespace-nowrap py-2 pl-2 text-right tabular-nums">{fmtEur(l.quantite * l.prixHT)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <dl className="ml-auto mt-4 flex w-full max-w-[220px] flex-col gap-1 tabular-nums">
          <div className="flex justify-between gap-3">
            <dt className="text-[#475569]">Total HT</dt>
            <dd>{fmtEur(totals.ht)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-[#475569]">TVA</dt>
            <dd>{fmtEur(totals.tva)}</dd>
          </div>
          <div className="mt-1 flex justify-between gap-3 border-t border-[#0F172A] pt-1.5 text-[12px] font-semibold">
            <dt>Total TTC</dt>
            <dd>{fmtEur(totals.ttc)}</dd>
          </div>
        </dl>

        {(mention || notes) && (
          <div className="mt-auto pt-6 text-[9.5px] leading-[1.5] text-[#64748B]">
            {mention && <p>{mention}</p>}
            {notes && <p>{notes}</p>}
          </div>
        )}
      </div>
    </div>
  )
}

/** Bloc récapitulatif d'une partie (émetteur, client) sur l'étape Aperçu. */
export function PartySummary({ label, party }: { label: string; party: Party }) {
  return (
    <div className="q-inset px-4 py-3">
      <p className="text-[12px] font-semibold text-q-text-4">{label}</p>
      <p className="mt-0.5 text-[15px] font-semibold text-q-ink">{party.nom || "—"}</p>
      {party.adresse && <p className="text-[13px] text-q-text-3">{party.adresse}</p>}
    </div>
  )
}

/** Totaux (étape Aperçu). */
export function TotalsBox({ totals, children }: { totals: { ht: number; tva: number; ttc: number }; children?: ReactNode }) {
  return (
    <dl className="flex flex-col gap-2 rounded-2xl border border-q-line bg-q-surface-2 p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-3 text-[15px]">
        <dt className="text-q-text-3">Total HT</dt>
        <dd className="font-medium tabular-nums text-q-ink">{fmtEur(totals.ht)}</dd>
      </div>
      <div className="flex items-baseline justify-between gap-3 text-[15px]">
        <dt className="text-q-text-3">TVA</dt>
        <dd className="font-medium tabular-nums text-q-ink">{fmtEur(totals.tva)}</dd>
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-q-line pt-3">
        <dt className="text-[16px] font-semibold text-q-ink">Total TTC</dt>
        <dd className="font-display text-[24px] font-semibold tracking-[-0.02em] tabular-nums text-q-ink">{fmtEur(totals.ttc)}</dd>
      </div>
      {children}
    </dl>
  )
}
