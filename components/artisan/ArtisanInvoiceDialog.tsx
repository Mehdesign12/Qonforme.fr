"use client"

/**
 * Fenêtre de création d'une facture d'acompte, d'une situation de travaux ou
 * d'une facture de solde, depuis un devis accepté (formule Artisan).
 *
 * L'aperçu est calculé ici avec les fonctions que la route rejoue côté
 * serveur (lib/artisan/build.ts) : ce qui s'affiche est ce qui sera créé, au
 * centime. Le brouillon naît sans numéro ; il le reçoit à l'envoi.
 *
 * Partagée par l'application et la démo (où « Créer » invite à s'inscrire).
 */
import { useMemo, useState } from "react"
import { AlertTriangle, Info, Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { buildArtisanInvoice, defaultRetention, parseCreateRequest, type QuoteBilling, type Preview } from "@/lib/artisan/build"
import { invoiceTitle, type BillingLine } from "@/lib/artisan/billing"
import { RETENTION_MAX_RATE, type RetentionMode } from "@/lib/artisan/retention"
import { formatPercentFr, fromCents, toCents } from "@/lib/artisan/money"
import { ArtisanTag, money } from "./ui"

export type ArtisanInvoiceKind = "deposit" | "situation" | "final"

export interface ArtisanInvoiceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  kind: ArtisanInvoiceKind
  billing: QuoteBilling
  clientName?: string | null
  today: string
  submitting?: boolean
  /** Corps de la requête POST /api/artisan/quotes/[id]/billing. */
  onSubmit: (body: Record<string, unknown>) => void
  /** Sans la formule Artisan : le bouton ouvre le mur (ou, en démo, l'invitation). */
  submitLabel?: string
}

const parseNum = (v: string) => {
  const n = parseFloat(v.replace(/\s/g, "").replace(",", "."))
  return Number.isFinite(n) ? n : NaN
}

export function ArtisanInvoiceDialog({
  open, onOpenChange, kind, billing, clientName, today, submitting, onSubmit, submitLabel,
}: ArtisanInvoiceDialogProps) {
  const lines = billing.quote.lines ?? []
  const prev = billing.state.previous.percents
  const def = defaultRetention(billing)

  // Acompte
  const [depMode, setDepMode] = useState<"percent" | "amount">("percent")
  const [depValue, setDepValue] = useState("30")
  // Situation
  const [sitMode, setSitMode] = useState<"global" | "lines">(prev.some((p, i) => p !== prev[0] && i > 0) ? "lines" : "global")
  const [globalValue, setGlobalValue] = useState(() => String(Math.min(100, Math.max(...prev, 0) + 25)))
  const [lineValues, setLineValues] = useState<string[]>(() => prev.map((p) => formatPercentFr(p)))
  // Retenue de garantie (situation, solde)
  const [retMode, setRetMode] = useState<RetentionMode>(def.mode)
  const [retRate, setRetRate] = useState(def.rate ? formatPercentFr(def.rate) : "5")
  const [dueDate, setDueDate] = useState("")

  const body = useMemo<Record<string, unknown>>(() => {
    const retention = { mode: retMode, rate: retMode === "aucune" ? 0 : parseNum(retRate) }
    const due = dueDate || null
    if (kind === "deposit") {
      return depMode === "percent"
        ? { kind, deposit: { mode: "percent", percent: parseNum(depValue) }, due_date: due }
        : { kind, deposit: { mode: "amount", amount_ttc: parseNum(depValue) }, due_date: due }
    }
    if (kind === "situation") {
      return {
        kind,
        progress: sitMode === "global" ? { global: parseNum(globalValue) } : lineValues.map((v) => ({ percent: parseNum(v) })),
        retention,
        due_date: due,
      }
    }
    return { kind, retention, due_date: due }
  }, [kind, depMode, depValue, sitMode, globalValue, lineValues, retMode, retRate, dueDate])

  const result = useMemo<{ preview: Preview | null; error: string | null }>(() => {
    const req = parseCreateRequest(body)
    if ("error" in req) return { preview: null, error: req.error }
    const built = buildArtisanInvoice(billing, req, today)
    return "error" in built ? { preview: null, error: built.error } : { preview: built, error: null }
  }, [body, billing, today])

  const title = kind === "situation" ? invoiceTitle("situation", { situation: { number: billing.state.nextSituation } as never }) : invoiceTitle(kind)
  const p = result.preview
  const retention = p?.retention
  const dueNow = p ? fromCents(toCents(p.total_ttc) - (retention?.mode === "retenue" ? toCents(retention.amount) : 0)) : 0

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!submitting) onOpenChange(o) }}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto p-0 sm:max-w-[640px]">
        <div className="flex flex-col gap-1 px-[22px] pr-14 pt-5">
          <div className="flex items-center gap-2"><ArtisanTag /></div>
          <DialogTitle className="q-display text-[22px] leading-tight text-[var(--q-ink)]">{title}</DialogTitle>
          <DialogDescription className="text-sm text-[var(--q-text-4)]">
            Devis <span className="font-mono">{billing.quote.quote_number}</span>{clientName ? ` · ${clientName}` : ""} · {money(fromCents(billing.state.contractTtc))} TTC
          </DialogDescription>
        </div>

        <div className="flex flex-col gap-5 px-[22px] pb-5 pt-4">
          {/* ── Saisie ── */}
          {kind === "deposit" && (
            <fieldset className="flex flex-col gap-2.5">
              <legend className="q-label mb-2">Montant de l&apos;acompte</legend>
              <div className="q-seg self-start" role="group" aria-label="Acompte en pourcentage ou en montant">
                <button type="button" aria-pressed={depMode === "percent"} onClick={() => { setDepMode("percent"); setDepValue("30") }}>Pourcentage</button>
                <button type="button" aria-pressed={depMode === "amount"} onClick={() => { setDepMode("amount"); setDepValue("") }}>Montant TTC</button>
              </div>
              <div className="flex items-center gap-2">
                <input
                  className="q-input max-w-[180px] tabular-nums"
                  inputMode="decimal"
                  aria-label={depMode === "percent" ? "Pourcentage du devis" : "Montant TTC de l'acompte"}
                  value={depValue}
                  onChange={(e) => setDepValue(e.target.value)}
                />
                <span className="text-sm text-[var(--q-text-3)]">{depMode === "percent" ? "% du devis TTC" : "€ TTC"}</span>
              </div>
              {billing.state.depositsTtc > 0 && (
                <p className="q-field-hint">Acomptes déjà facturés sur ce devis : {money(fromCents(billing.state.depositsTtc))} TTC.</p>
              )}
              <p className="q-field-hint">
                La TVA est celle du devis, ventilée par taux : pour des travaux, elle est due à l&apos;encaissement de l&apos;acompte (CGI, art. 269).
              </p>
            </fieldset>
          )}

          {kind === "situation" && (
            <fieldset className="flex flex-col gap-2.5">
              <legend className="q-label mb-2">Avancement cumulé des travaux</legend>
              <div className="q-seg self-start" role="group" aria-label="Avancement global ou par ligne">
                <button type="button" aria-pressed={sitMode === "global"} onClick={() => setSitMode("global")}>Global</button>
                <button type="button" aria-pressed={sitMode === "lines"} onClick={() => setSitMode("lines")}>Par ligne</button>
              </div>
              {sitMode === "global" ? (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    className="q-input max-w-[120px] tabular-nums"
                    inputMode="decimal"
                    aria-label="Avancement cumulé, en pourcentage"
                    value={globalValue}
                    onChange={(e) => setGlobalValue(e.target.value)}
                  />
                  <span className="text-sm text-[var(--q-text-3)]">% de l&apos;ensemble du devis</span>
                  <button type="button" className="q-btn q-btn-ghost q-btn-sm" onClick={() => setGlobalValue("100")}>100 %</button>
                </div>
              ) : (
                <div className="q-inset flex flex-col divide-y divide-[var(--q-line-soft)] p-0">
                  {lines.map((l, i) => (
                    <label key={i} className="flex items-center gap-3 px-3 py-2">
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm text-[var(--q-ink)]">{l.description || `Ligne ${i + 1}`}</span>
                        <span className="text-xs tabular-nums text-[var(--q-text-4)]">
                          {money(Number(l.total_ht) || 0)} HT{prev[i] > 0 ? ` · déjà ${formatPercentFr(prev[i])} %` : ""}
                        </span>
                      </span>
                      <input
                        className="q-input w-[84px] shrink-0 text-right tabular-nums"
                        inputMode="decimal"
                        aria-label={`Avancement cumulé de « ${l.description || `ligne ${i + 1}`} », en pourcentage`}
                        value={lineValues[i] ?? ""}
                        onChange={(e) => setLineValues((v) => v.map((x, j) => (j === i ? e.target.value : x)))}
                      />
                      <span className="text-sm text-[var(--q-text-4)]">%</span>
                    </label>
                  ))}
                </div>
              )}
              <p className="q-field-hint">
                Chaque situation facture le cumul moins ce qui a déjà été facturé
                {billing.state.deposits.length > 0 ? ", et reprend les acomptes au prorata de l'avancement" : ""}. À 100 % partout, elle fait office de décompte final.
              </p>
            </fieldset>
          )}

          {kind === "final" && (
            <div className="q-banner text-[13px] leading-normal">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p>La facture de solde reprend toutes les lignes du devis et déduit chaque acompte déjà facturé, à son taux de TVA : son total est ce qui reste à payer.</p>
            </div>
          )}

          {kind !== "deposit" && (
            <fieldset className="flex flex-col gap-2.5">
              <legend className="q-label mb-2">Retenue de garantie</legend>
              <div className="q-seg self-start" role="group" aria-label="Retenue de garantie">
                <button type="button" aria-pressed={retMode === "aucune"} onClick={() => setRetMode("aucune")}>Aucune</button>
                <button type="button" aria-pressed={retMode === "retenue"} onClick={() => setRetMode("retenue")}>Retenue</button>
                <button type="button" aria-pressed={retMode === "caution"} onClick={() => setRetMode("caution")}>Caution</button>
              </div>
              {retMode === "retenue" && (
                <div className="flex items-center gap-2">
                  <input
                    className="q-input max-w-[100px] tabular-nums"
                    inputMode="decimal"
                    aria-label="Taux de la retenue de garantie"
                    value={retRate}
                    onChange={(e) => setRetRate(e.target.value)}
                  />
                  <span className="text-sm text-[var(--q-text-3)]">% du TTC, {RETENTION_MAX_RATE} % au plus</span>
                </div>
              )}
              <p className="q-field-hint">
                {retMode === "caution"
                  ? "Remplacée par une caution bancaire : rien n'est retenu, la facture le mentionne."
                  : "Loi n° 71-584 du 16 juillet 1971 : libérée un an après la réception des travaux, sauf opposition motivée du client."}
              </p>
            </fieldset>
          )}

          <label className="flex flex-col gap-1.5">
            <span className="q-label">Échéance</span>
            <input type="date" className="q-input max-w-[200px]" value={dueDate} min={today} onChange={(e) => setDueDate(e.target.value)} />
            <span className="q-field-hint">{kind === "deposit" ? "Par défaut : à réception." : "Par défaut : 30 jours."} La date reste décalée d&apos;autant si la facture part plus tard.</span>
          </label>

          {/* ── Aperçu ── */}
          <section aria-label="Aperçu de la facture" className="flex flex-col gap-2">
            <h3 className="q-label">Aperçu</h3>
            {result.error ? (
              <div className="q-banner q-banner-warn text-[13px] leading-normal" role="status">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                <p>{result.error}</p>
              </div>
            ) : p ? (
              <div className="q-inset flex flex-col gap-2 p-3.5 text-sm">
                <ul className="flex flex-col gap-1.5">
                  {p.lines.map((l: BillingLine) => (
                    <li key={l.id} className="flex items-start justify-between gap-3">
                      <span className={cn("min-w-0 break-words", l.total_ht < 0 ? "text-[var(--q-text-3)]" : "text-[var(--q-text-2)]")}>{l.description}</span>
                      <span className="shrink-0 tabular-nums">{money(l.total_ht)}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-1 flex flex-col gap-1 border-t border-[var(--q-line-soft)] pt-2 tabular-nums">
                  <Row label="Total HT" value={money(p.subtotal_ht)} />
                  <Row label="TVA" value={money(p.total_vat)} />
                  <Row label="Total TTC" value={money(p.total_ttc)} strong />
                  {retention?.mode === "retenue" && retention.amount > 0 && (
                    <>
                      <Row label={`Retenue de garantie ${formatPercentFr(retention.rate)} %`} value={money(-retention.amount)} />
                      <Row label="À régler à l'échéance" value={money(dueNow)} strong />
                    </>
                  )}
                </div>
              </div>
            ) : null}
          </section>
        </div>

        <div
          className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--q-line-soft)] bg-[var(--q-surface-2)] px-[22px] py-4"
          style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom, 16px))" }}
        >
          <button type="button" className="q-btn q-btn-ghost" onClick={() => onOpenChange(false)} disabled={submitting}>Annuler</button>
          <button type="button" className="q-btn q-btn-primary" disabled={!p || submitting} onClick={() => onSubmit(body)}>
            {submitting && <Loader2 className="animate-spin" aria-hidden />}
            {submitLabel ?? "Créer le brouillon"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-4", strong ? "font-semibold text-[var(--q-ink)]" : "text-[var(--q-text-3)]")}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}
