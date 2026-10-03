"use client"

/**
 * Création ou modification d'un chantier (formule Artisan) : nom, client,
 * adresse, dates, statut, retenue de garantie et sous-traitance.
 * Validation finale côté serveur (lib/artisan/chantier.ts, parseChantierInput).
 */
import { useState } from "react"
import { Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Switch } from "@/components/app/kit"
import { CHANTIER_STATUSES, CHANTIER_STATUS_LABELS, type Chantier, type ChantierInput } from "@/lib/artisan/chantier"
import { RETENTION_MAX_RATE, type RetentionMode } from "@/lib/artisan/retention"
import { REVERSE_CHARGE_CONDITIONS } from "@/lib/artisan/reverse-charge"

export interface ChantierFormValues extends Omit<ChantierInput, "retention_rate"> {
  retention_rate: string
}

export function emptyChantierForm(): ChantierFormValues {
  return {
    client_id: null, name: "", address: null, zip_code: null, city: null, start_date: null, end_date: null,
    status: "preparation", reception_date: null, retention_mode: "aucune", retention_rate: "5", subcontracting: false, notes: null,
  }
}

export function chantierToForm(c: Chantier): ChantierFormValues {
  return {
    client_id: c.client_id, name: c.name, address: c.address, zip_code: c.zip_code, city: c.city,
    start_date: c.start_date, end_date: c.end_date, status: c.status, reception_date: c.reception_date,
    retention_mode: c.retention_mode, retention_rate: c.retention_rate ? String(c.retention_rate).replace(".", ",") : "5",
    subcontracting: c.subcontracting, notes: c.notes,
  }
}

/** Corps JSON envoyé à POST /api/chantiers ou PATCH /api/chantiers/[id]. */
export function chantierFormBody(v: ChantierFormValues): Record<string, unknown> {
  const rate = parseFloat(v.retention_rate.replace(",", "."))
  return {
    ...v,
    retention_rate: v.retention_mode === "aucune" ? 0 : Number.isFinite(rate) ? rate : NaN,
  }
}

export function ChantierFormDialog({
  open, onOpenChange, title, initial, clients, saving, onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  initial: ChantierFormValues
  clients: { id: string; name: string }[]
  saving?: boolean
  onSubmit: (values: ChantierFormValues) => void
}) {
  const [v, setV] = useState<ChantierFormValues>(initial)
  const set = <K extends keyof ChantierFormValues>(k: K, value: ChantierFormValues[K]) => setV((p) => ({ ...p, [k]: value }))
  const rate = parseFloat(v.retention_rate.replace(",", "."))
  const rateError = v.retention_mode === "retenue" && (!Number.isFinite(rate) || rate <= 0 || rate > RETENTION_MAX_RATE)
  const dateError = Boolean(v.start_date && v.end_date && v.end_date < v.start_date)
  const canSave = v.name.trim().length > 0 && !rateError && !dateError

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!saving) onOpenChange(o) }}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto p-0 sm:max-w-[560px]">
        <div className="flex flex-col gap-1 px-[22px] pr-14 pt-5">
          <DialogTitle className="q-display text-[22px] leading-tight text-[var(--q-ink)]">{title}</DialogTitle>
          <DialogDescription className="text-sm text-[var(--q-text-4)]">Vous pourrez y rattacher ensuite ses devis, factures et avoirs.</DialogDescription>
        </div>
        <form
          className="flex flex-col gap-4 px-[22px] pb-5 pt-4"
          onSubmit={(e) => { e.preventDefault(); if (canSave) onSubmit(v) }}
          id="chantier-form"
        >
          <label className="flex flex-col gap-1.5">
            <span className="q-label">Nom du chantier</span>
            <input className="q-input" value={v.name} maxLength={160} required onChange={(e) => set("name", e.target.value)} placeholder="Résidence Les Tilleuls, lot plâtrerie" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="q-label">Client</span>
            <select className="q-input" value={v.client_id ?? ""} onChange={(e) => set("client_id", e.target.value || null)}>
              <option value="">Aucun pour l&apos;instant</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="q-label">Adresse du chantier</span>
            <input className="q-input" value={v.address ?? ""} maxLength={200} onChange={(e) => set("address", e.target.value || null)} />
          </label>
          <div className="grid grid-cols-[110px_1fr] gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="q-label">Code postal</span>
              <input className="q-input" inputMode="numeric" value={v.zip_code ?? ""} maxLength={10} onChange={(e) => set("zip_code", e.target.value || null)} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="q-label">Ville</span>
              <input className="q-input" value={v.city ?? ""} maxLength={200} onChange={(e) => set("city", e.target.value || null)} />
            </label>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="q-label">Début</span>
              <input type="date" className="q-input" value={v.start_date ?? ""} onChange={(e) => set("start_date", e.target.value || null)} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="q-label">Fin prévue</span>
              <input type="date" className="q-input" value={v.end_date ?? ""} aria-invalid={dateError || undefined} onChange={(e) => set("end_date", e.target.value || null)} />
              {dateError && <span className="q-field-error">La fin ne peut pas précéder le début.</span>}
            </label>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="q-label">Statut</span>
            <select className="q-input" value={v.status} onChange={(e) => set("status", e.target.value as ChantierFormValues["status"])}>
              {CHANTIER_STATUSES.map((s) => <option key={s} value={s}>{CHANTIER_STATUS_LABELS[s]}</option>)}
            </select>
          </label>

          <fieldset className="flex flex-col gap-2.5">
            <legend className="q-label mb-2">Retenue de garantie</legend>
            <div className="q-seg self-start" role="group" aria-label="Retenue de garantie">
              {(["aucune", "retenue", "caution"] as RetentionMode[]).map((m) => (
                <button key={m} type="button" aria-pressed={v.retention_mode === m} onClick={() => set("retention_mode", m)}>
                  {m === "aucune" ? "Aucune" : m === "retenue" ? "Retenue" : "Caution"}
                </button>
              ))}
            </div>
            {v.retention_mode === "retenue" && (
              <div className="flex items-center gap-2">
                <input className="q-input max-w-[100px] tabular-nums" inputMode="decimal" aria-label="Taux de la retenue" aria-invalid={rateError || undefined} value={v.retention_rate} onChange={(e) => set("retention_rate", e.target.value)} />
                <span className="text-sm text-[var(--q-text-3)]">% du TTC de chaque situation</span>
              </div>
            )}
            {rateError && <span className="q-field-error">Entre 0 et {RETENTION_MAX_RATE} % (loi n° 71-584 du 16 juillet 1971).</span>}
            <span className="q-field-hint">
              {v.retention_mode === "caution"
                ? "Remplacée par une caution bancaire : rien n'est retenu sur les factures."
                : "Appliquée par défaut aux situations et au solde de ce chantier. Libérée un an après la réception, sauf opposition motivée."}
            </span>
          </fieldset>

          <div className="flex items-start justify-between gap-4">
            <span className="flex flex-col gap-1">
              <span className="q-label" id="ch-sub-label">Sous-traitance (autoliquidation)</span>
              <span className="q-field-hint">{REVERSE_CHARGE_CONDITIONS[0]}</span>
            </span>
            <Switch checked={v.subcontracting} onCheckedChange={(c) => set("subcontracting", c)} label="Chantier en sous-traitance" />
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="q-label">Notes</span>
            <textarea className="q-input" value={v.notes ?? ""} maxLength={2000} onChange={(e) => set("notes", e.target.value || null)} />
          </label>
        </form>
        <div
          className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--q-line-soft)] bg-[var(--q-surface-2)] px-[22px] py-4"
          style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom, 16px))" }}
        >
          <button type="button" className="q-btn q-btn-ghost" onClick={() => onOpenChange(false)} disabled={saving}>Annuler</button>
          <button type="submit" form="chantier-form" className="q-btn q-btn-primary" disabled={!canSave || saving}>
            {saving && <Loader2 className="animate-spin" aria-hidden />}
            Enregistrer
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
