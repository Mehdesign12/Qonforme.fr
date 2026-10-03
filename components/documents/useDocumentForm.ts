'use client'

/**
 * État d'un éditeur de document (facture, devis, bon de commande).
 * Mêmes règles qu'avant la refonte : lignes contrôlées, totaux recalculés à
 * chaque frappe, erreur d'un champ effacée dès qu'il est modifié.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { ProductSuggestion } from "@/components/products/ProductCombobox"
import {
  computeLines, computeTotals, lineFromProduct, newLine, validateDoc,
  type DocForm, type DocKind, type DocLine, type VatRate,
} from "./model"

type FieldKey = Exclude<keyof DocForm, "lines">

export function useDocumentForm(kind: DocKind, init: () => DocForm) {
  const [form, setForm] = useState<DocForm>(init)
  const [errors, setErrors] = useState<Record<string, string>>({})
  // Dernier état enregistré (modification d'un brouillon) : sert à dire
  // honnêtement « modifications non enregistrées ».
  const saved = useRef<string>(JSON.stringify(stripIds(form)))

  const clearError = useCallback((key: string) => {
    setErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }, [])

  const setValue = useCallback((key: FieldKey, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    clearError(key)
  }, [clearError])

  const setLineValue = useCallback((id: string, key: Exclude<keyof DocLine, "id">, value: string) => {
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.map((l) =>
        l.id === id ? { ...l, [key]: key === "vat_rate" ? (Number(value) as VatRate) : value } : l,
      ),
    }))
  }, [])

  /** Ajoute une ligne vide et renvoie son identifiant (le mobile l'ouvre aussitôt). */
  const addLine = useCallback((): string => {
    const line = newLine()
    setForm((prev) => ({ ...prev, lines: [...prev.lines, prev.autoliquidation ? { ...line, vat_rate: 0 } : line] }))
    return line.id
  }, [])

  // Taux saisis avant de passer en autoliquidation : rendus si la case est décochée
  const ratesBeforeReverseCharge = useRef(new Map<string, VatRate>())
  /** Sous-traitance du BTP (autoliquidation) : toutes les lignes à 0 %, taux d'avant rendus à la décoche. */
  const setAutoliquidation = useCallback((on: boolean) => {
    setForm((prev) => {
      if (on) {
        ratesBeforeReverseCharge.current = new Map(prev.lines.map((l) => [l.id, l.vat_rate]))
        return { ...prev, autoliquidation: true, lines: prev.lines.map((l) => ({ ...l, vat_rate: 0 as VatRate })) }
      }
      const saved = ratesBeforeReverseCharge.current
      return { ...prev, autoliquidation: false, lines: prev.lines.map((l) => ({ ...l, vat_rate: saved.get(l.id) ?? l.vat_rate })) }
    })
  }, [])

  const removeLine = useCallback((id: string) => {
    setForm((prev) => ({ ...prev, lines: prev.lines.filter((l) => l.id !== id) }))
    // Les erreurs de ligne sont indexées : on les recalculera à la prochaine validation
    setErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => !k.startsWith("line_"))))
  }, [])

  /**
   * Produit du catalogue : prend la place de la dernière ligne si elle est
   * restée entièrement vide (la ligne de départ d'un formulaire neuf), sinon
   * s'ajoute à la suite. Aucune saisie n'est jamais écrasée.
   */
  const insertProduct = useCallback((product: ProductSuggestion) => {
    const line = lineFromProduct(product)
    setForm((prev) => {
      const last = prev.lines[prev.lines.length - 1]
      const lastIsBlank = last && !last.description.trim() && last.unit_price_ht === ""
      const added = prev.autoliquidation ? { ...line, vat_rate: 0 as VatRate } : line
      const lines = lastIsBlank ? [...prev.lines.slice(0, -1), added] : [...prev.lines, added]
      return { ...prev, lines }
    })
  }, [])

  const computed = useMemo(() => computeLines(form.lines), [form.lines])
  const totals = useMemo(() => computeTotals(computed), [computed])

  const validate = useCallback((): boolean => {
    const errs = validateDoc(kind, form)
    setErrors(errs)
    return Object.keys(errs).length === 0
  }, [kind, form])

  /** Remplace tout l'état (chargement d'un brouillon) et le marque comme enregistré. */
  const load = useCallback((next: DocForm) => {
    setForm(next)
    setErrors({})
    saved.current = JSON.stringify(stripIds(next))
  }, [])

  const dirty = JSON.stringify(stripIds(form)) !== saved.current

  return {
    kind, form, errors, computed, totals, dirty,
    setValue, setLineValue, addLine, removeLine, insertProduct, setAutoliquidation,
    validate, clearError, load,
  }
}

export type DocumentFormApi = ReturnType<typeof useDocumentForm>

function stripIds(form: DocForm) {
  return { ...form, lines: form.lines.map(({ description, quantity, unit_price_ht, vat_rate }) => ({ description, quantity, unit_price_ht, vat_rate })) }
}

/**
 * Présélectionne le client passé dans l'URL (« ?client=<id> ») : bouton
 * « Nouveau devis » d'une fiche client, retour après la création d'un client.
 * Appliqué une seule fois, quand la liste des clients est chargée ; le
 * paramètre l'emporte sur le client prérempli (démo). Un identifiant inconnu
 * est ignoré.
 */
export function usePreselectedClient(doc: DocumentFormApi, clients: { id: string }[], enabled = true) {
  const done = useRef(false)
  const { setValue } = doc
  useEffect(() => {
    if (!enabled || done.current || clients.length === 0) return
    done.current = true
    const wanted = new URLSearchParams(window.location.search).get("client")
    if (wanted && clients.some((c) => c.id === wanted)) setValue("client_id", wanted)
  }, [enabled, clients, setValue])
}
