/**
 * Adresse de la page Actions SEO : onglet d'état, filtres, période et constat
 * ouvert vivent dans l'adresse (partageable, bouton Retour du navigateur).
 * Module pur, utilisable côté serveur et navigateur.
 */
import { PAGE_TYPE_LABELS, FINDING_SOURCE_LABELS, type FindingSource, type FindingStatus, type PageType } from "@/lib/seo/types"
import { parsePeriod, type PeriodKey } from "@/lib/seo/period"
import { isFindingRule, type FindingRule } from "@/lib/seo/actions/rules"

export const ACTIONS_PATH = "/admin/seo/actions"

export type EtatKey = "a-faire" | "faites" | "ignorees"

export const ETATS: { key: EtatKey; label: string; status: FindingStatus }[] = [
  { key: "a-faire", label: "À faire", status: "open" },
  { key: "faites", label: "Faites", status: "done" },
  { key: "ignorees", label: "Ignorées", status: "ignored" },
]

export interface ActionsQuery {
  etat: EtatKey
  type: PageType | null
  source: FindingSource | null
  q: string
  suggestions: boolean
  regle: FindingRule | null
  periode: PeriodKey
}

type Raw = Record<string, string | string[] | undefined>
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ""

export function parseActionsQuery(sp: Raw): ActionsQuery & { constat: string | null } {
  const etat = first(sp.etat)
  const type = first(sp.type)
  const source = first(sp.source)
  const regle = first(sp.regle)
  return {
    etat: ETATS.some((e) => e.key === etat) ? (etat as EtatKey) : "a-faire",
    type: Object.prototype.hasOwnProperty.call(PAGE_TYPE_LABELS, type) ? (type as PageType) : null,
    source: Object.prototype.hasOwnProperty.call(FINDING_SOURCE_LABELS, source) ? (source as FindingSource) : null,
    q: first(sp.q).trim().slice(0, 100),
    suggestions: first(sp.suggestions) === "1",
    regle: isFindingRule(regle) ? regle : null,
    periode: parsePeriod(first(sp.periode) || undefined),
    constat: first(sp.constat) || null,
  }
}

/** Adresse avec les valeurs différentes des valeurs par défaut seulement. */
export function actionsHref(q: Partial<ActionsQuery>, extra: { constat?: string | null } = {}): string {
  const params = new URLSearchParams()
  if (q.etat && q.etat !== "a-faire") params.set("etat", q.etat)
  if (q.type) params.set("type", q.type)
  if (q.source) params.set("source", q.source)
  if (q.q) params.set("q", q.q)
  if (q.suggestions) params.set("suggestions", "1")
  if (q.regle) params.set("regle", q.regle)
  if (q.periode && q.periode !== "28j") params.set("periode", q.periode)
  if (extra.constat) params.set("constat", extra.constat)
  const qs = params.toString()
  return qs ? `${ACTIONS_PATH}?${qs}` : ACTIONS_PATH
}

/** Vrai si un filtre de la liste est actif (hors onglet et période). */
export function hasFilters(q: ActionsQuery): boolean {
  return Boolean(q.type || q.source || q.q || q.suggestions || q.regle)
}
