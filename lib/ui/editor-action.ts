"use client"

/**
 * Action principale d'un écran d'édition (devis, facture, bon de commande),
 * montrée par la barre de navigation mobile à la place du « + » : le bouton
 * central devient « Envoyer ». L'éditeur l'enregistre à l'affichage et la
 * retire au départ ; la barre l'écoute. Un seul éditeur à la fois.
 */
import { useSyncExternalStore } from "react"

export interface EditorAction {
  label: string
  onSend: () => void
  sending: boolean
  disabled: boolean
}

let current: EditorAction | null = null
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((l) => l())
}

function same(a: EditorAction | null, b: EditorAction | null) {
  return a === b || (a !== null && b !== null && a.label === b.label && a.onSend === b.onSend && a.sending === b.sending && a.disabled === b.disabled)
}

export function setEditorAction(next: EditorAction | null) {
  if (same(current, next)) return
  current = next
  emit()
}

export function clearEditorAction(owner: EditorAction | null) {
  if (current === owner) setEditorAction(null)
}

export function useEditorAction(): EditorAction | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => current,
    () => null,
  )
}
