"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { AlertCircle, ArrowLeft, ArrowRight, Check, Download, Info, Loader2, Plus, RotateCcw, Trash2 } from "lucide-react"
import { trackEvent } from "@/lib/meta-pixel"
import { cn } from "@/lib/utils"
import { Callout, Field, PanelTitle } from "@/components/outils/kit"
import { SwitchRow } from "@/components/outils/controls"
import { formatNombreFr } from "@/lib/outils/decimal"
import {
  LIMITES,
  MENTIONS_PAIEMENT_DEFAUT,
  MENTION_FRANCHISE,
  TAUX_TVA_DOCUMENT,
  calculerTotaux,
  dateValide,
  ligneVierge,
  nomFichier,
  totalLigneCentimes,
  validerLigne,
  type ErreursLigne,
  type Ligne,
  type Totaux,
  type TypeDocument,
} from "@/lib/outils/document"

/**
 * Générateurs gratuits de facture et de devis : étapes, saisie des lignes,
 * aperçu papier en direct (q-paper-bed > q-paper) et téléchargement du PDF.
 *
 * L'aperçu et le PDF partagent la validation et le calcul de lib/outils/document.ts :
 * mêmes totaux au centime, même ventilation de la TVA par taux.
 */

/* ─────────────────────────────────────────────────────────
   Saisie
───────────────────────────────────────────────────────── */

/** Ligne telle que saisie : quantité et prix restent du texte (« 12,5 », « 1 234,56 »). */
export interface LigneForm {
  id: string
  description: string
  quantite: string
  prixHT: string
  tauxTVA: number
}

export function newLigne(tauxTVA = 20): LigneForm {
  return { id: crypto.randomUUID(), description: "", quantite: "1", prixHT: "", tauxTVA }
}

const fmtEur = (centimes: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(centimes / 100)
const fmtTaux = (r: number) => `${formatNombreFr(r, 2)} %`

function fmtDate(iso: string): string {
  if (!dateValide(iso)) return ""
  return new Date(`${iso}T00:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
}

/** Date du jour (fuseau de l'appareil), décalée de `jours`, au format AAAA-MM-JJ. */
function dateLocale(jours = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + jours)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

const EMETTEUR_VIDE = { nom: "", adresse: "", siret: "", tva: "", email: "" }
const CLIENT_VIDE = { nom: "", adresse: "", siret: "" }

interface AnalyseLigne {
  id: string
  vierge: boolean
  ligne?: Ligne
  erreurs: ErreursLigne
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
              {i < steps.length - 1 && <span aria-hidden className={cn("h-px min-w-[12px] flex-1", done ? "bg-q-accent" : "bg-q-line")} />}
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
function FieldError({ id, children }: { id: string; children?: ReactNode }) {
  if (!children) return null
  return (
    <p id={id} className="q-field-error">
      {children}
    </p>
  )
}

export function LineItemsEditor({
  lignes,
  analyse,
  montrerManques,
  onUpdate,
  onRemove,
  onAdd,
  rates,
}: {
  lignes: LigneForm[]
  analyse: AnalyseLigne[]
  /** Affiche aussi les champs obligatoires restés vides (après « Suivant » ou au téléchargement). */
  montrerManques: boolean
  onUpdate: (id: string, field: "description" | "quantite" | "prixHT" | "tauxTVA", value: string | number) => void
  onRemove: (id: string) => void
  onAdd: () => void
  /** Taux de TVA proposés. */
  rates: readonly number[]
}) {
  const plein = lignes.length >= LIMITES.lignes
  return (
    <div className="flex flex-col gap-3">
      {lignes.map((l, i) => {
        const a = analyse[i]
        // Une erreur « manquant » n'apparaît qu'une fois la saisie terminée ; une saisie fautive, tout de suite
        const err = (champ: keyof ErreursLigne, valeur: string) => (!a || a.vierge ? undefined : valeur.trim() || montrerManques ? a.erreurs[champ] : undefined)
        const eDesc = err("description", l.description)
        const eQte = err("quantite", l.quantite)
        const ePu = err("prixHT", l.prixHT)
        const n = i + 1
        return (
          <div key={l.id} className="q-inset flex flex-col gap-3 p-3.5 sm:p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] font-semibold text-q-text-3">Ligne {n}</span>
              <button
                type="button"
                onClick={() => onRemove(l.id)}
                disabled={lignes.length === 1}
                aria-label={`Supprimer la ligne ${n}`}
                className="q-btn q-btn-ghost q-btn-sm q-btn-icon hover:!text-q-danger"
              >
                <Trash2 aria-hidden />
              </button>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`ligne-${n}-desc`} className="sr-only">
                Désignation de la ligne {n}
              </label>
              <textarea
                id={`ligne-${n}-desc`}
                rows={2}
                maxLength={LIMITES.designation}
                className="q-input !min-h-[64px]"
                placeholder="Désignation de la prestation"
                value={l.description}
                aria-invalid={eDesc ? true : undefined}
                aria-describedby={eDesc ? `ligne-${n}-desc-err` : undefined}
                onChange={(e) => onUpdate(l.id, "description", e.target.value)}
              />
              <FieldError id={`ligne-${n}-desc-err`}>{eDesc}</FieldError>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <div className="flex min-w-0 flex-col gap-1.5">
                <label htmlFor={`ligne-${n}-qte`} className="text-[12px] font-semibold text-q-text-3">
                  Quantité
                </label>
                <input
                  id={`ligne-${n}-qte`}
                  className="q-input tabular-nums"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={l.quantite}
                  aria-invalid={eQte ? true : undefined}
                  aria-describedby={eQte ? `ligne-${n}-qte-err` : undefined}
                  onChange={(e) => onUpdate(l.id, "quantite", e.target.value)}
                />
              </div>
              <div className="flex min-w-0 flex-col gap-1.5">
                <label htmlFor={`ligne-${n}-pu`} className="text-[12px] font-semibold text-q-text-3">
                  Prix unit. HT
                </label>
                <input
                  id={`ligne-${n}-pu`}
                  className="q-input tabular-nums"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0,00"
                  value={l.prixHT}
                  aria-invalid={ePu ? true : undefined}
                  aria-describedby={ePu ? `ligne-${n}-pu-err` : undefined}
                  onChange={(e) => onUpdate(l.id, "prixHT", e.target.value)}
                />
              </div>
              <div className="flex min-w-0 flex-col gap-1.5">
                <label htmlFor={`ligne-${n}-tva`} className="text-[12px] font-semibold text-q-text-3">
                  TVA
                </label>
                <select id={`ligne-${n}-tva`} className="q-input pr-2" value={l.tauxTVA} disabled={rates.length === 1} onChange={(e) => onUpdate(l.id, "tauxTVA", Number(e.target.value))}>
                  {rates.map((r) => (
                    <option key={r} value={r}>
                      {fmtTaux(r)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <FieldError id={`ligne-${n}-qte-err`}>{eQte}</FieldError>
            <FieldError id={`ligne-${n}-pu-err`}>{ePu}</FieldError>
            {a?.ligne && <p className="text-right text-[13px] font-medium tabular-nums text-q-text-3">{fmtEur(totalLigneCentimes(a.ligne.quantite, a.ligne.prixHT))} HT</p>}
          </div>
        )
      })}
      <button type="button" onClick={onAdd} disabled={plein} className="q-btn q-btn-ghost self-start !text-q-accent-strong hover:!bg-q-wash">
        <Plus aria-hidden />
        Ajouter une ligne
      </button>
      {plein && <p className="q-field-hint">{LIMITES.lignes} lignes au plus dans le générateur gratuit.</p>}
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
  tva?: string
  email?: string
}

export function DocPaper({
  type,
  numero,
  numeroPlaceholder,
  date,
  date2,
  emetteur,
  client,
  analyse,
  totaux,
  textes,
  className,
}: {
  type: TypeDocument
  numero: string
  numeroPlaceholder: string
  date: string
  date2: string
  emetteur: Party
  client: Party
  analyse: (AnalyseLigne & { description: string; quantite: string; tauxTVA: number })[]
  totaux: Totaux
  /** Mentions en pied : TVA, conditions, assurance, notes. */
  textes: string[]
  className?: string
}) {
  const remplies = analyse.filter((a) => !a.vierge)
  const muted = "text-[#94A3B8]"
  const facture = type === "facture"
  return (
    <div className={cn("q-paper-bed !p-3 sm:!p-5", className)}>
      <div className="q-paper flex min-h-[460px] flex-col p-5 text-[11px] leading-[1.5] sm:p-7" aria-label={facture ? "Aperçu de la facture" : "Aperçu du devis"}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className={cn("break-words text-[13px] font-semibold", !emetteur.nom && muted)}>{emetteur.nom || "Votre entreprise"}</p>
            {emetteur.adresse && <p className="break-words text-[#475569]">{emetteur.adresse}</p>}
            {emetteur.siret && <p className="font-mono text-[10px] text-[#475569]">SIRET {emetteur.siret}</p>}
            {emetteur.tva && <p className="font-mono text-[10px] text-[#475569]">N° TVA {emetteur.tva}</p>}
            {emetteur.email && <p className="break-all text-[#475569]">{emetteur.email}</p>}
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[15px] font-semibold tracking-[-0.01em]">{facture ? "Facture" : "Devis"}</p>
            <p className={cn("max-w-[140px] break-all font-mono text-[10px]", numero ? "text-[#475569]" : muted)}>{numero || numeroPlaceholder}</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[#64748B]">{facture ? "Émise le" : "Établi le"}</p>
            <p className="tabular-nums">{fmtDate(date) || "—"}</p>
          </div>
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[#64748B]">{facture ? "Échéance" : "Valable jusqu'au"}</p>
            <p className="tabular-nums">{fmtDate(date2) || "—"}</p>
          </div>
        </div>

        <div className="mt-4 rounded-[3px] bg-[#F8FAFC] px-3 py-2.5">
          <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[#64748B]">Client</p>
          <p className={cn("break-words font-semibold", !client.nom && muted)}>{client.nom || "Nom du client"}</p>
          {client.adresse && <p className="break-words text-[#475569]">{client.adresse}</p>}
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
            {remplies.length === 0 ? (
              <tr className="border-b border-[#F1F5F9]">
                <td className={cn("py-2", muted)} colSpan={4}>
                  Désignation de la prestation
                </td>
              </tr>
            ) : (
              remplies.map((a) => (
                <tr key={a.id} className="border-b border-[#F1F5F9] align-top">
                  <td className={cn("whitespace-pre-line break-words py-2 pr-2", !a.description.trim() && muted)}>{a.description.trim() || "Sans désignation"}</td>
                  <td className="py-2 pl-2 text-right tabular-nums">{a.ligne ? formatNombreFr(a.ligne.quantite, 3) : a.quantite || "—"}</td>
                  <td className="hidden py-2 pl-2 text-right tabular-nums sm:table-cell">{fmtTaux(a.tauxTVA)}</td>
                  <td className="whitespace-nowrap py-2 pl-2 text-right tabular-nums">{a.ligne ? fmtEur(totalLigneCentimes(a.ligne.quantite, a.ligne.prixHT)) : "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <dl className="ml-auto mt-4 flex w-full max-w-[250px] flex-col gap-1 tabular-nums">
          <div className="flex justify-between gap-3">
            <dt className="text-[#475569]">Total HT</dt>
            <dd>{fmtEur(totaux.htCentimes)}</dd>
          </div>
          {totaux.ventilation.map((v) => (
            <div key={v.taux} className="flex justify-between gap-3">
              <dt className="text-[#475569]">
                TVA {fmtTaux(v.taux)} <span className="text-[#94A3B8]">sur {fmtEur(v.baseCentimes)}</span>
              </dt>
              <dd>{fmtEur(v.tvaCentimes)}</dd>
            </div>
          ))}
          <div className="mt-1 flex justify-between gap-3 border-t border-[#0F172A] pt-1.5 text-[12px] font-semibold">
            <dt>Total TTC</dt>
            <dd>{fmtEur(totaux.ttcCentimes)}</dd>
          </div>
        </dl>

        {textes.some(Boolean) && (
          <div className="mt-auto flex flex-col gap-1 pt-6 text-[9.5px] leading-[1.5] text-[#64748B]">
            {textes.filter(Boolean).map((t, i) => (
              <p key={i} className="whitespace-pre-line break-words">
                {t}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/** Bloc récapitulatif d'une partie (émetteur, client) sur l'étape Aperçu. */
export function PartySummary({ label, party }: { label: string; party: Party }) {
  return (
    <div className="q-inset min-w-0 px-4 py-3">
      <p className="text-[12px] font-semibold text-q-text-4">{label}</p>
      <p className="mt-0.5 break-words text-[15px] font-semibold text-q-ink">{party.nom || "—"}</p>
      {party.adresse && <p className="break-words text-[13px] text-q-text-3">{party.adresse}</p>}
    </div>
  )
}

/** Totaux et ventilation de la TVA (étape Aperçu). */
export function TotalsBox({ totaux, children }: { totaux: Totaux; children?: ReactNode }) {
  return (
    <dl className="flex flex-col gap-2 rounded-2xl border border-q-line bg-q-surface-2 p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-3 text-[15px]">
        <dt className="text-q-text-3">Total HT</dt>
        <dd className="font-medium tabular-nums text-q-ink">{fmtEur(totaux.htCentimes)}</dd>
      </div>
      {totaux.ventilation.map((v) => (
        <div key={v.taux} className="flex items-baseline justify-between gap-3 text-[15px]">
          <dt className="min-w-0 text-q-text-3">
            TVA {fmtTaux(v.taux)} <span className="text-[13px] text-q-text-4">sur {fmtEur(v.baseCentimes)} HT</span>
          </dt>
          <dd className="shrink-0 font-medium tabular-nums text-q-ink">{fmtEur(v.tvaCentimes)}</dd>
        </div>
      ))}
      {totaux.ventilation.length > 1 && (
        <div className="flex items-baseline justify-between gap-3 text-[15px]">
          <dt className="text-q-text-3">Total TVA</dt>
          <dd className="font-medium tabular-nums text-q-ink">{fmtEur(totaux.tvaCentimes)}</dd>
        </div>
      )}
      <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-q-line pt-3">
        <dt className="text-[16px] font-semibold text-q-ink">Total TTC</dt>
        <dd className="font-display text-[24px] font-semibold tracking-[-0.02em] tabular-nums text-q-ink">{fmtEur(totaux.ttcCentimes)}</dd>
      </div>
      {children}
    </dl>
  )
}

/* ─────────────────────────────────────────────────────────
   Générateur complet (facture ou devis)
───────────────────────────────────────────────────────── */
const STEPS = [{ label: "Émetteur" }, { label: "Client" }, { label: "Lignes" }, { label: "Mentions" }, { label: "Aperçu" }]
const APERCU = STEPS.length - 1

export function DocumentGenerator({ type }: { type: TypeDocument }) {
  const facture = type === "facture"
  const p = facture ? "f" : "d"
  const [step, setStep] = useState(0)
  const [visite, setVisite] = useState(0)
  const [emetteur, setEmetteur] = useState(EMETTEUR_VIDE)
  const [client, setClient] = useState(CLIENT_VIDE)
  const [numero, setNumero] = useState("")
  // Dates du jour posées après le montage : le serveur (UTC) et l'appareil peuvent ne pas être au même jour
  const [date, setDate] = useState("")
  const [date2, setDate2] = useState("")
  useEffect(() => {
    setDate((d) => d || dateLocale())
    setDate2((d) => d || dateLocale(30))
  }, [])
  const [lignes, setLignes] = useState<LigneForm[]>(() => [newLigne()])
  const [franchise, setFranchise] = useState(false)
  const [remises, setRemises] = useState(false)
  const [mentionTVA, setMentionTVA] = useState("")
  const [mentions, setMentions] = useState(facture ? MENTIONS_PAIEMENT_DEFAUT : "")
  const [assurance, setAssurance] = useState("")
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)
  const [erreurServeur, setErreurServeur] = useState("")

  const allerA = (i: number) => {
    setStep(i)
    setVisite((v) => Math.max(v, i))
  }

  const analyse = useMemo(
    () =>
      lignes.map((l) => {
        const vierge = ligneVierge(l)
        const { ligne, erreurs } = vierge ? { ligne: undefined, erreurs: {} } : validerLigne(l, { remises })
        return { id: l.id, vierge, ligne, erreurs, description: l.description, quantite: l.quantite, tauxTVA: l.tauxTVA }
      }),
    [lignes, remises],
  )
  const { valides, totaux } = useMemo(() => {
    const v = analyse.flatMap((a) => (a.ligne ? [a.ligne] : []))
    return { valides: v, totaux: calculerTotaux(v) }
  }, [analyse])

  // Ce qui manque pour télécharger, dans l'ordre des étapes
  const manques: { message: string; etape: number }[] = []
  if (!emetteur.nom.trim()) manques.push({ message: "Votre nom ou raison sociale.", etape: 0 })
  if (!client.nom.trim()) manques.push({ message: "Le nom du client.", etape: 1 })
  if (facture && !numero.trim()) manques.push({ message: "Le numéro de facture (unique et à la suite des précédents).", etape: 1 })
  if (!dateValide(date)) manques.push({ message: facture ? "La date d'émission." : "La date du devis.", etape: 1 })
  else if (date2 && (!dateValide(date2) || date2 < date)) manques.push({ message: facture ? "Une échéance postérieure à la date d'émission." : "Une fin de validité postérieure à la date du devis.", etape: 1 })
  analyse.forEach((a, i) => {
    if (!a.vierge && !a.ligne) manques.push({ message: `Ligne ${i + 1} : ${Object.values(a.erreurs)[0]}`, etape: 2 })
  })
  if (!valides.length) manques.push({ message: "Au moins une ligne avec une désignation et un prix.", etape: 2 })
  else if (totaux.htCentimes < 0) manques.push({ message: "Un total positif : le total ne peut pas être négatif.", etape: 2 })
  else if (valides.reduce((s, l) => s + Math.abs(totalLigneCentimes(l.quantite, l.prixHT)), 0) > LIMITES.totalHT * 100)
    manques.push({ message: `Un total de ${LIMITES.totalHT.toLocaleString("fr-FR")} € HT au plus.`, etape: 2 })
  const pret = manques.length === 0

  const updateLigne = (id: string, field: "description" | "quantite" | "prixHT" | "tauxTVA", value: string | number) => {
    setLignes((prev) => prev.map((l) => (l.id === id ? { ...l, [field]: value } : l)))
  }
  const removeLigne = (id: string) => setLignes((prev) => (prev.length > 1 ? prev.filter((l) => l.id !== id) : prev))
  const addLigne = () => setLignes((prev) => (prev.length < LIMITES.lignes ? [...prev, newLigne(franchise ? 0 : 20)] : prev))

  const changerFranchise = (on: boolean) => {
    setFranchise(on)
    setLignes((prev) => prev.map((l) => ({ ...l, tauxTVA: on ? 0 : 20 })))
    setMentionTVA((m) => (on ? (m.trim() ? m : MENTION_FRANCHISE) : m === MENTION_FRANCHISE ? "" : m))
  }

  const reset = () => {
    setEmetteur(EMETTEUR_VIDE)
    setClient(CLIENT_VIDE)
    setNumero("")
    setDate(dateLocale())
    setDate2(dateLocale(30))
    setLignes([newLigne()])
    setFranchise(false)
    setRemises(false)
    setMentionTVA("")
    setMentions(facture ? MENTIONS_PAIEMENT_DEFAUT : "")
    setAssurance("")
    setNotes("")
    setErreurServeur("")
    setStep(0)
    setVisite(0)
  }

  const telecharger = async () => {
    setVisite(APERCU)
    if (!pret) return
    setLoading(true)
    setErreurServeur("")
    try {
      const res = await fetch(`/api/outils/${type}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emetteur,
          client,
          numero,
          date,
          [facture ? "echeance" : "validite"]: date2,
          lignes: valides,
          remises,
          mentionTVA,
          mentions,
          assurance,
          notes,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setErreurServeur(data?.error || "La génération a échoué. Réessayez dans un instant.")
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = nomFichier(type, numero)
      a.click()
      trackEvent("Schedule", { content_name: facture ? "Generateur facture PDF" : "Generateur devis PDF", content_category: "tools" })
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch {
      setErreurServeur("Connexion impossible. Vérifiez votre réseau et réessayez.")
    } finally {
      setLoading(false)
    }
  }

  const paper = (
    <DocPaper
      type={type}
      numero={numero}
      numeroPlaceholder={facture ? "F-2026-001" : "D-2026-001"}
      date={date}
      date2={date2}
      emetteur={emetteur}
      client={client}
      analyse={analyse}
      totaux={totaux}
      textes={[mentionTVA, mentions, assurance && `Assurance professionnelle : ${assurance}`, notes]}
    />
  )

  const montrerManques = visite > 2 || step > 2
  const rates = franchise ? [0] : TAUX_TVA_DOCUMENT

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
      <div className="q-card min-w-0 overflow-hidden">
        <Stepper steps={STEPS} current={step} onSelect={allerA} />

        <div className="min-h-[320px] p-5 sm:p-7">
          {step === 0 && (
            <div>
              <PanelTitle>Vos informations</PanelTitle>
              <div className="flex flex-col gap-4">
                <Field label="Nom / Raison sociale *" htmlFor={`${p}-em-nom`}>
                  <input id={`${p}-em-nom`} className="q-input" maxLength={LIMITES.nom} value={emetteur.nom} onChange={(e) => setEmetteur((v) => ({ ...v, nom: e.target.value }))} placeholder="Dupont Rénovation" autoComplete="organization" />
                </Field>
                <Field label="Adresse" htmlFor={`${p}-em-adresse`}>
                  <input id={`${p}-em-adresse`} className="q-input" maxLength={LIMITES.adresse} value={emetteur.adresse} onChange={(e) => setEmetteur((v) => ({ ...v, adresse: e.target.value }))} placeholder="12 rue de la Paix, 75001 Paris" autoComplete="street-address" />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="SIRET" htmlFor={`${p}-em-siret`}>
                    <input id={`${p}-em-siret`} className="q-input font-mono" maxLength={LIMITES.courts} value={emetteur.siret} onChange={(e) => setEmetteur((v) => ({ ...v, siret: e.target.value }))} placeholder="123 456 789 00012" />
                  </Field>
                  <Field label="N° de TVA intracommunautaire" htmlFor={`${p}-em-tva`} hint="Si vous facturez la TVA.">
                    <input id={`${p}-em-tva`} className="q-input font-mono" maxLength={LIMITES.courts} value={emetteur.tva} onChange={(e) => setEmetteur((v) => ({ ...v, tva: e.target.value.toUpperCase() }))} placeholder="FR12 123456789" />
                  </Field>
                </div>
                <Field label="Email" htmlFor={`${p}-em-email`}>
                  <input id={`${p}-em-email`} className="q-input" type="email" maxLength={LIMITES.email} value={emetteur.email} onChange={(e) => setEmetteur((v) => ({ ...v, email: e.target.value }))} placeholder="contact@email.fr" autoComplete="email" />
                </Field>
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <PanelTitle>Client et références</PanelTitle>
              <div className="flex flex-col gap-4">
                <Field label="Nom / Raison sociale *" htmlFor={`${p}-cl-nom`}>
                  <input id={`${p}-cl-nom`} className="q-input" maxLength={LIMITES.nom} value={client.nom} onChange={(e) => setClient((v) => ({ ...v, nom: e.target.value }))} placeholder="SCI Les Tilleuls" />
                </Field>
                <Field label="Adresse" htmlFor={`${p}-cl-adresse`}>
                  <input id={`${p}-cl-adresse`} className="q-input" maxLength={LIMITES.adresse} value={client.adresse} onChange={(e) => setClient((v) => ({ ...v, adresse: e.target.value }))} placeholder="5 avenue des Champs-Élysées, 75008 Paris" />
                </Field>
                <Field label="SIRET du client (professionnel)" htmlFor={`${p}-cl-siret`}>
                  <input id={`${p}-cl-siret`} className="q-input font-mono" maxLength={LIMITES.courts} value={client.siret} onChange={(e) => setClient((v) => ({ ...v, siret: e.target.value }))} placeholder="987 654 321 00034" />
                </Field>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label={facture ? "N° facture *" : "N° devis"} htmlFor={`${p}-numero`}>
                    <input id={`${p}-numero`} className="q-input font-mono" maxLength={LIMITES.courts} value={numero} onChange={(e) => setNumero(e.target.value)} placeholder={facture ? "F-2026-001" : "D-2026-001"} />
                  </Field>
                  <Field label={facture ? "Émission *" : "Date *"} htmlFor={`${p}-date`}>
                    <input id={`${p}-date`} className="q-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-invalid={!dateValide(date) ? true : undefined} />
                  </Field>
                  <Field label={facture ? "Échéance" : "Validité"} htmlFor={`${p}-echeance`}>
                    <input id={`${p}-echeance`} className="q-input" type="date" min={dateValide(date) ? date : undefined} value={date2} onChange={(e) => setDate2(e.target.value)} aria-invalid={date2 && dateValide(date) && date2 < date ? true : undefined} />
                  </Field>
                </div>
                {date2 && dateValide(date) && date2 < date && <p className="q-field-error -mt-2">{facture ? "L'échéance précède la date d'émission." : "La fin de validité précède la date du devis."}</p>}
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <PanelTitle>{facture ? "Lignes de facturation *" : "Lignes du devis *"}</PanelTitle>
              <div className="mb-4">
                <SwitchRow
                  checked={franchise}
                  onChange={changerFranchise}
                  label="Franchise en base de TVA"
                  desc={`Micro-entreprise sous les seuils : lignes à 0 % et mention « ${MENTION_FRANCHISE} ».`}
                />
              </div>
              <LineItemsEditor lignes={lignes} analyse={analyse} montrerManques={montrerManques} onUpdate={updateLigne} onRemove={removeLigne} onAdd={addLigne} rates={rates} />
              <div className="mt-4">
                <SwitchRow
                  checked={remises}
                  onChange={setRemises}
                  label="Lignes de remise"
                  desc="Accepte une quantité ou un prix négatifs (remise, acompte déjà versé). Le total reste positif."
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <PanelTitle>Mentions</PanelTitle>
              <div className="flex flex-col gap-4">
                <Field
                  label="Mention TVA"
                  htmlFor={`${p}-mention`}
                  hint={`Franchise : « ${MENTION_FRANCHISE} ». Sous-traitance du bâtiment : « Autoliquidation ».`}
                >
                  <input id={`${p}-mention`} className="q-input" maxLength={LIMITES.texte} value={mentionTVA} onChange={(e) => setMentionTVA(e.target.value)} placeholder={MENTION_FRANCHISE} />
                </Field>
                <Field
                  label={facture ? "Conditions de paiement et pénalités" : "Conditions"}
                  htmlFor={`${p}-mentions`}
                  hint={
                    facture
                      ? "Entre professionnels, la facture indique le taux des pénalités de retard, l'indemnité forfaitaire de 40 € et les conditions d'escompte (art. L441-9 du Code de commerce)."
                      : "Conditions de paiement, acompte demandé, délai d'exécution…"
                  }
                  aside={
                    facture && mentions !== MENTIONS_PAIEMENT_DEFAUT ? (
                      <button type="button" className="q-btn q-btn-ghost q-btn-sm" onClick={() => setMentions(MENTIONS_PAIEMENT_DEFAUT)}>
                        <RotateCcw aria-hidden />
                        Texte par défaut
                      </button>
                    ) : undefined
                  }
                >
                  <textarea id={`${p}-mentions`} className="q-input" rows={4} maxLength={LIMITES.texte} value={mentions} onChange={(e) => setMentions(e.target.value)} placeholder={facture ? MENTIONS_PAIEMENT_DEFAUT : "Acompte de 30 % à la signature, solde à la fin des travaux."} />
                </Field>
                <Field
                  label="Assurance professionnelle"
                  htmlFor={`${p}-assurance`}
                  hint="Artisans : assureur, ses coordonnées et la couverture géographique, sur chaque devis et facture (Code de l'artisanat, art. L132-1). Assurance décennale : joignez aussi l'attestation au devis et à la facture (Code des assurances, art. L243-2)."
                >
                  <textarea id={`${p}-assurance`} className="q-input !min-h-[64px]" rows={2} maxLength={LIMITES.texte} value={assurance} onChange={(e) => setAssurance(e.target.value)} placeholder="Décennale n° 123456, Assureur SA, 1 rue X, 75000 Paris — couverture : France métropolitaine" />
                </Field>
                <Field label="Notes" htmlFor={`${p}-notes`}>
                  <textarea id={`${p}-notes`} className="q-input !min-h-[64px]" rows={2} maxLength={LIMITES.texte} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Merci pour votre confiance." />
                </Field>
              </div>
            </div>
          )}

          {step === APERCU && (
            <div>
              <PanelTitle>Récapitulatif</PanelTitle>
              <div className="flex flex-col gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <PartySummary label="Émetteur" party={emetteur} />
                  <PartySummary label="Client" party={client} />
                </div>
                {/* Aperçu papier : sur mobile ici, sur grand écran dans la colonne de droite */}
                <div className="lg:hidden">{paper}</div>
                <TotalsBox totaux={totaux} />
                {!pret && (
                  <Callout tone="neutral" icon={Info} title="Pour télécharger le PDF, il manque :">
                    <ul className="mt-1 flex list-disc flex-col gap-1 pl-5">
                      {manques.map((m) => (
                        <li key={m.message}>
                          <button type="button" className="text-left underline decoration-q-line underline-offset-2 hover:text-q-ink" onClick={() => allerA(m.etape)}>
                            {m.message}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </Callout>
                )}
                {erreurServeur && (
                  <Callout tone="danger" icon={AlertCircle}>
                    {erreurServeur}
                  </Callout>
                )}
              </div>

              <button type="button" onClick={telecharger} disabled={!pret || loading} className="lp-btn-p mt-5 w-full">
                {loading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Download className="h-5 w-5" aria-hidden />}
                Télécharger le PDF
              </button>
            </div>
          )}
        </div>

        {/* Navigation entre les étapes */}
        <div className="flex items-center justify-between gap-3 border-t border-q-line-soft px-5 py-4 sm:px-7">
          <button type="button" onClick={() => (step > 0 ? allerA(step - 1) : reset())} className="q-btn q-btn-ghost">
            {step > 0 ? (
              <>
                <ArrowLeft aria-hidden /> Précédent
              </>
            ) : (
              <>
                <RotateCcw aria-hidden /> Réinitialiser
              </>
            )}
          </button>
          {step < APERCU && (
            <button type="button" onClick={() => allerA(step + 1)} className="q-btn q-btn-primary q-btn-lg sm:!h-10 sm:!rounded-[10px] sm:!text-[14px]">
              Suivant <ArrowRight aria-hidden />
            </button>
          )}
        </div>
      </div>

      {/* Aperçu en direct (grand écran) */}
      <aside className="hidden min-w-0 lg:sticky lg:top-24 lg:block" aria-label="Aperçu en direct">
        <p className="mb-2 text-[13px] font-semibold text-q-text-3">Aperçu en direct</p>
        {paper}
      </aside>
    </div>
  )
}
