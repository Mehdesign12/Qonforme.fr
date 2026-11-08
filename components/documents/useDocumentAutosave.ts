'use client'

/**
 * Enregistrement automatique d'un document en cours de création (devis, facture,
 * bon de commande), en deux temps :
 *
 * 1. **Sur l'appareil**, dès la première saisie : copie locale (lib/documents/local-draft.ts),
 *    reprise à la réouverture de l'éditeur. Couvre ce que le serveur ne peut pas encore
 *    enregistrer (pas de client, ligne incomplète).
 * 2. **Dans les documents**, dès que le document est complet (mêmes contrôles que le bouton
 *    « Enregistrer le brouillon ») : un vrai brouillon est créé (POST) puis tenu à jour
 *    (PATCH), 2,5 s après la dernière frappe. La copie locale est alors effacée.
 *
 * Rien n'est jamais envoyé au client ni émis : seul un brouillon s'enregistre. Les
 * boutons de l'éditeur passent par `persist`, qui met à jour le brouillon déjà créé au
 * lieu d'en créer un second. Un refus de formule (402) arrête l'enregistrement automatique
 * sans rien afficher : le bouton montrera le mur de paiement.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { computeDocTotals, computeLines, hasEnteredContent, toPayloadLines, validateDoc, type DocForm, type DocKind } from "./model"
import type { DocumentFormApi } from "./useDocumentForm"
import { clearLocalDraft, readLocalDraft, writeLocalDraft } from "@/lib/documents/local-draft"

export const AUTOSAVE_DELAY_MS = 2500
const LOCAL_DELAY_MS = 500

export type AutosaveStatus = "idle" | "saving" | "saved" | "error"
export type SaveAction = "autosave" | "draft" | "send"

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface PersistResult {
  ok: boolean
  status: number
  json: any
  /** Identifiant du brouillon (créé ou déjà existant), null si l'enregistrement a échoué. */
  id: string | null
  /** Vrai seulement pour l'enregistrement qui a créé le brouillon. */
  created: boolean
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Lignes du document telles que l'API les attend, calculées sur un état donné. */
export function payloadLinesOf(form: DocForm) {
  const auto = Boolean(form.autoliquidation)
  return toPayloadLines(form.lines, computeLines(form.lines, auto), auto, computeDocTotals(form).discount_lines)
}

/** Document assez complet pour être enregistré sur le serveur sans erreur de saisie. */
export function canAutosave(kind: DocKind, form: DocForm): boolean {
  return hasEnteredContent(form) && Object.keys(validateDoc(kind, form)).length === 0
}

export function useDocumentAutosave({
  kind, doc, endpoint, entity, buildPayload, owner, blank, onCreated, enabled = true,
}: {
  kind: DocKind
  doc: DocumentFormApi
  /** Création : `POST endpoint` ; mise à jour : `PATCH endpoint/<id>`. */
  endpoint: string
  /** Clé du document dans la réponse de création (`quote`, `invoice`, `purchase_order`). */
  entity: string
  buildPayload: (form: DocForm) => Record<string, unknown>
  /** Compte connecté (GET /api/company) ; sans lui, pas de copie locale. */
  owner: string | null
  /** Formulaire vierge (« Effacer et recommencer »). */
  blank: () => DocForm
  /** Premier enregistrement du brouillon (mesure du parcours) : automatique, bouton brouillon ou envoi. */
  onCreated?: (id: string, action: SaveAction) => void
  enabled?: boolean
}) {
  const [status, setStatus] = useState<AutosaveStatus>("idle")
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [documentId, setDocumentId] = useState<string | null>(null)
  const [restoredAt, setRestoredAt] = useState<number | null>(null)
  const [localChecked, setLocalChecked] = useState(false)

  const idRef = useRef<string | null>(null)
  const blocked = useRef(false)
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const latest = useRef({ buildPayload, onCreated, endpoint, entity, kind, owner, doc })
  latest.current = { buildPayload, onCreated, endpoint, entity, kind, owner, doc }

  const run = useCallback(async (form: DocForm, action: SaveAction): Promise<PersistResult> => {
    const auto = action === "autosave"
    const { buildPayload, endpoint, entity, kind, owner, doc, onCreated } = latest.current
    const id = idRef.current
    const payload = buildPayload(form)
    if (id) delete payload.status
    if (auto) setStatus("saving")
    try {
      const res = await fetch(id ? `${endpoint}/${id}` : endpoint, {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (res.status === 402) blocked.current = true
        if (auto) setStatus(res.status === 402 ? "idle" : "error")
        return { ok: false, status: res.status, json, id, created: false }
      }
      const createdId: string | null = id ? null : (json?.[entity]?.id ?? null)
      if (createdId) {
        idRef.current = createdId
        setDocumentId(createdId)
        if (owner) clearLocalDraft(kind, owner)
        onCreated?.(createdId, action)
      }
      doc.markSaved(form)
      setSavedAt(Date.now())
      setStatus("saved")
      return { ok: true, status: res.status, json, id: idRef.current, created: Boolean(createdId) }
    } catch {
      if (auto) setStatus("error")
      return { ok: false, status: 0, json: { error: "Erreur réseau" }, id, created: false }
    }
  }, [])

  /** Enregistre l'état donné : crée le brouillon ou met à jour celui déjà créé. Les appels sont mis en file. */
  const persist = useCallback((form: DocForm, action: SaveAction = "draft"): Promise<PersistResult> => {
    const next = queue.current.then(() => run(form, action))
    queue.current = next.catch(() => undefined)
    return next
  }, [run])

  // Enregistrement automatique dans les documents
  const form = doc.form
  const dirty = doc.dirty
  useEffect(() => {
    if (!enabled || blocked.current) return
    if (!canAutosave(kind, form)) return
    if (idRef.current && !dirty) return
    const t = setTimeout(() => { void persist(form, "autosave") }, AUTOSAVE_DELAY_MS)
    return () => clearTimeout(t)
  }, [enabled, kind, form, dirty, persist])

  // Reprise de la copie locale, une fois le compte connu
  const restore = doc.restore
  useEffect(() => {
    if (!enabled || !owner || localChecked) return
    const hasClientParam = new URLSearchParams(window.location.search).has("client")
    const draft = readLocalDraft(kind, owner)
    if (draft && !hasClientParam && !hasEnteredContent(latest.current.doc.form)) {
      restore(draft.form)
      setRestoredAt(draft.savedAt)
    }
    setLocalChecked(true)
  }, [enabled, owner, kind, localChecked, restore])

  // Copie locale tant que le brouillon n'existe pas sur le serveur
  useEffect(() => {
    if (!enabled || !owner || !localChecked || documentId) return
    const t = setTimeout(() => {
      if (hasEnteredContent(form)) writeLocalDraft(kind, owner, form)
      else clearLocalDraft(kind, owner)
    }, LOCAL_DELAY_MS)
    return () => clearTimeout(t)
  }, [enabled, owner, localChecked, documentId, kind, form])

  /** « Effacer et recommencer » : formulaire vierge, copie locale supprimée. */
  const discardRestored = useCallback(() => {
    if (owner) clearLocalDraft(kind, owner)
    restore(blank())
    setRestoredAt(null)
  }, [owner, kind, restore, blank])

  return { status, savedAt, documentId, restoredAt, discardRestored, persist, hasLocalCopy: Boolean(owner) && !documentId }
}

export type DocumentAutosave = ReturnType<typeof useDocumentAutosave>

/** Heure de Paris « 17 h 22 ». */
export function parisTime(ms: number): string {
  return new Date(ms).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }).replace(":", " h ")
}

/** Ligne d'état sous le titre de l'éditeur. */
export function autosaveStatusText(kind: DocKind, a: Pick<DocumentAutosave, "status" | "savedAt" | "documentId" | "hasLocalCopy">, dirty: boolean, hasContent: boolean): string {
  const docs = kind === "quote" ? "vos devis" : kind === "invoice" ? "vos factures" : "vos bons de commande"
  if (a.status === "saving") return "Enregistrement…"
  if (a.status === "error") return "Enregistrement automatique impossible pour l'instant · utilisez « Enregistrer le brouillon »"
  if (a.documentId && a.savedAt) return `Brouillon enregistré dans ${docs} à ${parisTime(a.savedAt)}${dirty ? " · modifications en cours" : ""}`
  if (hasContent && a.hasLocalCopy) return `Saisie gardée sur cet appareil · enregistrée dans ${docs} dès que le client et les lignes sont complets`
  return `Nouveau brouillon · enregistré automatiquement dès que le client et une ligne sont remplis`
}
