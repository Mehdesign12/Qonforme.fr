"use client"

/**
 * Comportements de page de l'éditeur d'articles (admin › Blog) :
 *
 * - `useLocalDraft` : copie de l'article sur l'appareil (localStorage, une clé
 *   par article), écrite 2 s après la dernière modification, et aussitôt à la
 *   fermeture de l'onglet comme au démontage de l'éditeur (bouton Retour du
 *   navigateur : la page change sans être déchargée) ; effacée dès que tout
 *   est enregistré. Au retour, une copie plus récente que l'enregistrement et
 *   différente de lui est proposée (jamais appliquée d'office). Stockage
 *   indisponible (navigation privée, quota) : l'éditeur marche sans.
 * - Relais après la création (`offerCreationHandoff`…) : l'éditeur de
 *   /admin/blog/new laisse à celui de /admin/blog/<id> le texte du moment,
 *   l'onglet, le défilement et le curseur.
 * - `useLeaveGuard` : modifications non enregistrées → alerte du navigateur à
 *   la fermeture ou au rechargement, et confirmation avant de suivre un lien
 *   interne (retour, fil d'Ariane, barre latérale, navigation du bas). Les
 *   liens de la zone d'écriture, ceux qui ouvrent un nouvel onglet et les
 *   clics avec une touche de modification ne sont pas interceptés.
 * - `usePageDropGuard` : un fichier lâché ailleurs que sur une zone de dépôt
 *   (couverture, studio d'images) ne fait jamais quitter la page (sans cela,
 *   le navigateur ouvrirait l'image à la place de l'éditeur).
 * - `useSaveShortcut` : Ctrl+S (⌘S sur Mac) enregistre au lieu d'ouvrir la
 *   fenêtre « Enregistrer la page » du navigateur.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { draftToOffer, isDirty, localDraftKey, parseLocalDraft, serializeLocalDraft, type ArticleDraft, type EditorTab, type LocalDraft } from "@/components/admin/blog/shell/model"
import type { EditorSelection, RichEditorHandle } from "@/components/admin/blog/editor/RichEditor"
import type { EditorMode } from "@/components/admin/blog/editor/Toolbar"

/* ------------------------------------------------------------------ */
/* Brouillon local                                                     */
/* ------------------------------------------------------------------ */

export const LOCAL_DRAFT_DELAY_MS = 2000

function storageGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function storageSet(key: string, value: string): boolean {
  try {
    window.localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

function storageRemove(key: string): void {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // Stockage indisponible : rien à effacer
  }
}

export function useLocalDraft({
  id,
  draft,
  saved,
  savedAt,
  dirty,
}: {
  /** Identifiant de l'article ; null avant sa création. */
  id: string | null
  draft: ArticleDraft
  /** Dernier état enregistré (comparaison du brouillon proposé). */
  saved: ArticleDraft
  /** Instant du dernier enregistrement connu (ms) ; null : jamais enregistré. */
  savedAt: number | null
  dirty: boolean
}) {
  const key = localDraftKey(id)
  const [offer, setOffer] = useState<LocalDraft | null>(null)
  // Une copie proposée reste dans le stockage tant que l'admin n'a pas choisi
  const pending = useRef(false)
  // Plus aucune copie après la suppression de l'article
  const stopped = useRef(false)
  const latest = useRef(draft)
  latest.current = draft
  const dirtyRef = useRef(dirty)
  dirtyRef.current = dirty
  const savedRef = useRef({ saved, savedAt })
  savedRef.current = { saved, savedAt }
  // Clé du moment : l'identifiant arrive à la création, la copie suit l'article
  const keyRef = useRef(key)
  keyRef.current = key

  // Lecture à l'ouverture de l'article
  useEffect(() => {
    const raw = storageGet(key)
    if (raw === null) return
    const parsed = parseLocalDraft(raw)
    const local = draftToOffer(parsed, savedRef.current.saved, savedRef.current.savedAt)
    if (!local) {
      storageRemove(key)
      return
    }
    // Copie identique à ce qui est déjà à l'écran (texte repris après la création) : rien à proposer
    if (!isDirty(local.draft, latest.current)) return
    pending.current = true
    setOffer(local)
  }, [key])

  /** `base` : version enregistrée dont la copie part (par défaut, celle du dernier rendu). */
  const write = useCallback((base?: ArticleDraft) => {
    if (!dirtyRef.current || stopped.current) return
    storageSet(keyRef.current, serializeLocalDraft(latest.current, Date.now(), base ?? savedRef.current.saved))
  }, [])

  /** Tout est enregistré : la copie disparaît, et la proposition (désormais plus ancienne que l'enregistrement) avec elle. */
  const clear = useCallback(() => {
    pending.current = false
    setOffer(null)
    storageRemove(keyRef.current)
  }, [])

  /** Article supprimé : copie effacée, plus aucune écriture (fermeture, démontage). */
  const stop = useCallback(() => {
    stopped.current = true
    pending.current = false
    setOffer(null)
    storageRemove(keyRef.current)
  }, [])

  // 2 s après la dernière modification ; tout est enregistré : la copie disparaît
  useEffect(() => {
    if (!dirty) {
      if (!pending.current) storageRemove(key)
      return
    }
    const timer = window.setTimeout(() => write(), LOCAL_DRAFT_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [draft, dirty, key, write])

  // Onglet fermé ou mis en arrière-plan (téléphone) : copie immédiate. Page quittée sans
  // rechargement (bouton Retour du navigateur, lien non intercepté, changement de page
  // après la création) : copie au démontage, sans attendre les 2 s
  useEffect(() => {
    const flush = () => write()
    const onHidden = () => {
      if (document.visibilityState === "hidden") write()
    }
    window.addEventListener("pagehide", flush)
    document.addEventListener("visibilitychange", onHidden)
    return () => {
      window.removeEventListener("pagehide", flush)
      document.removeEventListener("visibilitychange", onHidden)
      write()
    }
  }, [write])

  /** Copie gardée : la proposition disparaît, la copie sera réécrite avec le texte restauré. */
  const accept = useCallback(() => {
    pending.current = false
    setOffer(null)
  }, [])

  /** Copie écartée : effacée ; ce qui a été tapé depuis l'ouverture la remplace aussitôt. */
  const dismiss = useCallback(() => {
    setOffer(null)
    clear()
    write()
  }, [clear, write])

  return { offer, accept, dismiss, flush: write, clear, stop }
}

/* ------------------------------------------------------------------ */
/* Sortie de la page                                                   */
/* ------------------------------------------------------------------ */

/** Lien que l'on peut intercepter (navigation interne dans le même onglet) ; null sinon. */
export function internalHrefOf(event: MouseEvent, location: Location): string | null {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null
  const start = event.target instanceof Element ? event.target : null
  const anchor = start?.closest<HTMLAnchorElement>("a[href]")
  if (!anchor) return null
  if ((anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) return null
  // Liens de la zone d'écriture (jamais suivis au clic) et zones exclues
  if (anchor.closest("[contenteditable='true'], .ProseMirror, [data-leave-guard='off']")) return null
  let url: URL
  try {
    url = new URL(anchor.getAttribute("href") ?? "", location.href)
  } catch {
    return null
  }
  if (url.origin !== location.origin) return null
  // Même page (ancre) : rien ne se perd
  if (url.pathname === location.pathname && url.search === location.search) return null
  return `${url.pathname}${url.search}${url.hash}`
}

export function useLeaveGuard({ when, onAttempt }: { when: boolean; onAttempt: (href: string) => void }) {
  const whenRef = useRef(when)
  whenRef.current = when
  const attemptRef = useRef(onAttempt)
  attemptRef.current = onAttempt

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!whenRef.current) return
      e.preventDefault()
      // Navigateurs plus anciens : la chaîne vide déclenche aussi l'alerte
      e.returnValue = ""
    }
    // Phase de capture sur window : avant le gestionnaire des liens de Next (qui ignore un clic déjà annulé)
    const onClick = (e: MouseEvent) => {
      if (!whenRef.current) return
      const href = internalHrefOf(e, window.location)
      if (!href) return
      e.preventDefault()
      e.stopPropagation()
      attemptRef.current(href)
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    window.addEventListener("click", onClick, true)
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload)
      window.removeEventListener("click", onClick, true)
    }
  }, [])
}

/* ------------------------------------------------------------------ */
/* Glisser-déposer hors des zones prévues                              */
/* ------------------------------------------------------------------ */

function carriesFiles(e: DragEvent): boolean {
  return Array.from(e.dataTransfer?.types ?? []).includes("Files")
}

/**
 * Les zones de dépôt (couverture, studio d'images) annulent elles-mêmes
 * l'événement ; ici, en dernier (phase de bouillonnement sur window), tout
 * fichier que personne n'a pris est refusé : curseur « interdit » pendant le
 * survol, rien d'ouvert au lâcher. `onStray` reçoit l'endroit du lâcher.
 */
export function usePageDropGuard(onStray?: (where: "editor" | "page") => void) {
  const strayRef = useRef(onStray)
  strayRef.current = onStray

  useEffect(() => {
    const onDragOver = (e: DragEvent) => {
      if (!carriesFiles(e) || e.defaultPrevented) return
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = "none"
    }
    const onDrop = (e: DragEvent) => {
      if (!carriesFiles(e) || e.defaultPrevented) return
      e.preventDefault()
      const inEditor = e.target instanceof Element && e.target.closest(".q-editor") !== null
      strayRef.current?.(inEditor ? "editor" : "page")
    }
    window.addEventListener("dragover", onDragOver)
    window.addEventListener("drop", onDrop)
    return () => {
      window.removeEventListener("dragover", onDragOver)
      window.removeEventListener("drop", onDrop)
    }
  }, [])
}

/* ------------------------------------------------------------------ */
/* Raccourci d'enregistrement                                          */
/* ------------------------------------------------------------------ */

export function useSaveShortcut(onSave: () => void) {
  const saveRef = useRef(onSave)
  saveRef.current = onSave

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return
      if (e.key.toLowerCase() !== "s") return
      e.preventDefault()
      if (!e.repeat) saveRef.current()
    }
    window.addEventListener("keydown", onKeyDown, true)
    return () => window.removeEventListener("keydown", onKeyDown, true)
  }, [])
}

/* ------------------------------------------------------------------ */
/* Relais après la création                                            */
/* ------------------------------------------------------------------ */

/** Champ actif d'une page de l'éditeur : un champ (identifiant et sélection) ou la zone d'écriture. */
export type FocusMemo = { kind: "field"; id: string; start: number | null; end: number | null } | { kind: "editor"; selection: EditorSelection | null }

/** Ce que l'on voyait : défilement de la coque admin et champ actif. */
export interface ViewMemo {
  scrollTop: number | null
  focus: FocusMemo | null
}

/**
 * Relevé de la page de l'éditeur (`root` : élément racine de l'éditeur) au
 * moment où elle disparaît. Seuls les champs de l'éditeur portant un
 * identifiant sont repris.
 */
export function captureEditorView(root: Element | null, editor: Pick<RichEditorHandle, "getSelection"> | null): ViewMemo {
  const scroller = document.querySelector<HTMLElement>("[data-admin-scroll]")
  const active = document.activeElement
  let focus: FocusMemo | null = null
  if (active instanceof HTMLElement && root?.contains(active)) {
    if (active.closest(".ProseMirror")) {
      focus = { kind: "editor", selection: editor?.getSelection() ?? null }
    } else if ((active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) && active.id) {
      let start: number | null = null
      let end: number | null = null
      try {
        start = active.selectionStart
        end = active.selectionEnd
      } catch {
        // Champ sans sélection de texte (date) : le focus seul
      }
      focus = { kind: "field", id: active.id, start, end }
    }
  }
  return { scrollTop: scroller ? scroller.scrollTop : null, focus }
}

/**
 * Rend la vue relevée, une fois la zone d'écriture prête (visuelle ou
 * Markdown). Rend faux tant qu'elle ne l'est pas : on réessaie à l'image
 * suivante.
 */
export function restoreEditorView(view: ViewMemo, editor: Pick<RichEditorHandle, "focus" | "getSelection"> | null): boolean {
  const ready = editor !== null && (editor.getSelection() !== null || document.getElementById("q-editor-markdown") !== null)
  if (!ready) return false
  const scroller = document.querySelector<HTMLElement>("[data-admin-scroll]")
  if (scroller && view.scrollTop !== null) scroller.scrollTop = view.scrollTop
  const f = view.focus
  if (f?.kind === "editor") {
    editor.focus(f.selection ?? undefined)
  } else if (f?.kind === "field") {
    const el = document.getElementById(f.id)
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      el.focus({ preventScroll: true })
      try {
        if (f.start !== null) el.setSelectionRange(f.start, f.end ?? f.start)
      } catch {
        // Champ sans sélection de texte : le focus suffit
      }
    }
  }
  return true
}

/**
 * Relais entre l'éditeur qui vient de créer l'article (/admin/blog/new) et
 * celui de sa page (/admin/blog/<id>) : router.replace change de page, et
 * l'éditeur est démonté puis remonté. Sans relais, le texte tapé pendant
 * l'envoi et le changement de page disparaîtrait, comme l'onglet ouvert, les
 * mots-clés surlignés et le curseur.
 */
export interface CreationHandoff {
  id: string
  /** Article tel qu'il a été créé : le relais ne sert que si la base l'a encore tel quel. */
  saved: ArticleDraft
  /** Article tel qu'il est à l'écran dans l'éditeur qui l'a créé (lu au remontage). */
  latest: () => ArticleDraft
  tab: EditorTab
  highlighted: string[]
  /** Mots-clés secondaires ajoutés à la main (Proposition IA). */
  extraSecondary?: { keyword: string; volume: number | null }[]
  lastSaveAt: string
  fromCalendar: boolean
  /** Mode de la zone d'écriture (visuel ou Markdown). */
  editorMode: EditorMode
  /** Relevée au démontage de l'éditeur qui a créé l'article. */
  view: ViewMemo | null
  /** Instant du relais (ms). */
  at: number
}

/** Un relais qui n'a pas servi dans ce délai est oublié (page jamais affichée, autre navigation). */
export const HANDOFF_TTL_MS = 30_000

let creationHandoff: CreationHandoff | null = null

export function offerCreationHandoff(handoff: CreationHandoff | null): void {
  creationHandoff = handoff
}

/** Relais destiné à cet article, encore valable ; sans le consommer (rendu en double du mode strict). */
export function peekCreationHandoff(id: string | null | undefined, now: number = Date.now()): CreationHandoff | null {
  const h = creationHandoff
  if (!h || !id || h.id !== id) return null
  if (now - h.at > HANDOFF_TTL_MS) {
    creationHandoff = null
    return null
  }
  return h
}

/** Relais consommé : rendu, puis oublié. */
export function takeCreationHandoff(id: string | null | undefined, now: number = Date.now()): CreationHandoff | null {
  const h = peekCreationHandoff(id, now)
  if (h) creationHandoff = null
  return h
}

/** Relève la vue de l'éditeur qui a créé l'article, au moment de son démontage. */
export function noteCreationHandoffView(id: string | null | undefined, view: () => ViewMemo): void {
  const h = creationHandoff
  if (h && id && h.id === id && h.view === null) h.view = view()
}

/* ------------------------------------------------------------------ */
/* Raccourci affiché                                                   */
/* ------------------------------------------------------------------ */

/** « ⌘ » sur Mac, « Ctrl » ailleurs ; null avant le montage (même rendu serveur et client). */
export function useModKey(): string | null {
  const [mod, setMod] = useState<string | null>(null)
  useEffect(() => {
    const platform = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform || navigator.platform || navigator.userAgent
    setMod(/Mac|iPhone|iPad|iPod/i.test(platform) ? "⌘" : "Ctrl")
  }, [])
  return mod
}
