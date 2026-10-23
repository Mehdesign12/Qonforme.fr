"use client"

/**
 * Champs d'un document scanné : type, fournisseur, numéro, date, montant,
 * rattachement. Partagé par l'écran « Classer le document » du scan et par la
 * fiche d'un document. Tout est facultatif : Qonforme ne lit pas le texte de la
 * photo, l'artisan saisit seulement ce qu'il veut retrouver.
 */
import { SCAN_KINDS, SCAN_KIND_LABELS, formatAmountInput, type ScanKind } from "@/lib/scan/documents"
import { cn } from "@/lib/utils"
import type { ScanFieldsInput } from "@/lib/scan/api"

export interface ScanFormValues {
  kind: ScanKind
  supplier: string
  doc_number: string
  doc_date: string
  amount: string
  client_id: string
  chantier_id: string
}

export const EMPTY_SCAN_FORM: ScanFormValues = { kind: "other", supplier: "", doc_number: "", doc_date: "", amount: "", client_id: "", chantier_id: "" }

export function formFromDocument(d: { kind: ScanKind; supplier: string | null; doc_number: string | null; doc_date: string | null; amount_cents: number | null; client_id: string | null; chantier_id: string | null }): ScanFormValues {
  return {
    kind: d.kind, supplier: d.supplier ?? "", doc_number: d.doc_number ?? "", doc_date: d.doc_date ?? "",
    amount: d.amount_cents === null ? "" : formatAmountInput(d.amount_cents), client_id: d.client_id ?? "", chantier_id: d.chantier_id ?? "",
  }
}

/** Corps envoyé à l'API : chaîne vide → champ effacé. */
export function fieldsFromForm(v: ScanFormValues, status: "to_classify" | "classified"): ScanFieldsInput {
  return {
    kind: v.kind, status,
    supplier: v.supplier.trim() || null, doc_number: v.doc_number.trim() || null, doc_date: v.doc_date || null,
    amount: v.amount.trim() || null, client_id: v.client_id || null, chantier_id: v.chantier_id || null,
  }
}

export function ClassifyForm({
  values, onChange, clients, chantiers, disabled,
}: {
  values: ScanFormValues
  onChange: (v: ScanFormValues) => void
  clients: { id: string; name: string }[]
  chantiers: { id: string; name: string }[]
  disabled?: boolean
}) {
  const set = <K extends keyof ScanFormValues>(k: K, value: ScanFormValues[K]) => onChange({ ...values, [k]: value })
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Type de document">
        {SCAN_KINDS.map((k) => (
          <button
            key={k} type="button" disabled={disabled} aria-pressed={values.kind === k} onClick={() => set("kind", k)}
            className={cn(
              "h-11 rounded-full border px-4 text-sm font-semibold",
              values.kind === k ? "border-[var(--q-ink)] bg-[var(--q-ink)] text-[var(--q-surface)]" : "border-[var(--q-field)] bg-[var(--q-surface)] text-[var(--q-text-2)]",
            )}
          >
            {SCAN_KIND_LABELS[k]}
          </button>
        ))}
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="q-label">Fournisseur</span>
        <input className="q-input" value={values.supplier} maxLength={200} disabled={disabled} onChange={(e) => set("supplier", e.target.value)} placeholder="Point P Lyon" />
      </label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="q-label">N° du document</span>
          <input className="q-input" value={values.doc_number} maxLength={80} disabled={disabled} onChange={(e) => set("doc_number", e.target.value)} placeholder="BL-48213" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="q-label">Date</span>
          <input type="date" className="q-input" value={values.doc_date} disabled={disabled} onChange={(e) => set("doc_date", e.target.value)} />
        </label>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="q-label">Montant <span className="font-normal text-[var(--q-text-4)]">(facultatif)</span></span>
        <input className="q-input tabular-nums" inputMode="decimal" value={values.amount} disabled={disabled} onChange={(e) => set("amount", e.target.value)} placeholder="1 240,50" aria-label="Montant en euros" />
      </label>
      {clients.length > 0 && (
        <label className="flex flex-col gap-1.5">
          <span className="q-label">Client</span>
          <select className="q-input" value={values.client_id} disabled={disabled} onChange={(e) => set("client_id", e.target.value)}>
            <option value="">Aucun</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
      )}
      {chantiers.length > 0 && (
        <label className="flex flex-col gap-1.5">
          <span className="q-label">Chantier</span>
          <select className="q-input" value={values.chantier_id} disabled={disabled} onChange={(e) => set("chantier_id", e.target.value)}>
            <option value="">Aucun chantier</option>
            {chantiers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
      )}
    </div>
  )
}
