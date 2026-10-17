"use client"

/**
 * Maillage interne automatique de l'éditeur : demande les liens à poser
 * (POST /api/admin/blog/auto-links), les applique au texte par le même chemin
 * qu'une modification du parent (l'éditeur recharge le texte, Ctrl+Z revient en
 * arrière) et garde le texte d'avant pour « Annuler ».
 *
 * Le texte peut changer pendant la demande : la réponse est alors écartée
 * (jamais de liens posés sur un texte que la personne a déjà modifié).
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { api } from "@/components/admin/seo/articles/api"
import type { AutoLinkProposal, AutoLinksResponse } from "@/lib/seo/articles/editor-types"

export interface AutoLinksState {
  busy: boolean
  error: string | null
  /** Dernière pose : liens ajoutés, et le texte d'avant (annulation). */
  last: { added: AutoLinkProposal[]; previous: string } | null
  /** Pourquoi rien n'a été ajouté (objectif atteint, aucune expression à lier). */
  note: string | null
  /** Bloc « Pour aller plus loin » proposé quand le texte ne se prête pas à assez de liens. */
  relatedBlock: string | null
}

const IDLE: AutoLinksState = { busy: false, error: null, last: null, note: null, relatedBlock: null }

export interface ArticleSnapshot {
  markdown: string
  title: string
  keyword: string | null
  slug: string
}

export function useAutoLinks(opts: { getArticle: () => ArticleSnapshot; onApply: (markdown: string) => void }): {
  state: AutoLinksState
  run: () => Promise<void>
  undo: () => void
  addRelatedBlock: () => void
  dismiss: () => void
} {
  const [state, setState] = useState<AutoLinksState>(IDLE)
  // Copie lue par les actions : un effet de bord n'a pas sa place dans une mise à jour d'état
  const stateRef = useRef(state)
  stateRef.current = state
  const optsRef = useRef(opts)
  optsRef.current = opts
  const alive = useRef(true)
  const request = useRef(0)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const run = useCallback(async () => {
    const article = optsRef.current.getArticle()
    if (!article.markdown.trim()) {
      setState({ ...IDLE, error: "Écrivez d'abord le texte de l'article : les liens se posent sur ses phrases." })
      return
    }
    const id = ++request.current
    setState((s) => ({ ...s, busy: true, error: null, note: null }))
    const res = await api<AutoLinksResponse>("/api/admin/blog/auto-links", "POST", {
      markdown: article.markdown,
      title: article.title || undefined,
      keyword: article.keyword,
      slug: article.slug || undefined,
    })
    if (!alive.current || id !== request.current) return
    if (!res.ok || !res.data) {
      setState((s) => ({ ...s, busy: false, error: res.error ?? "Les liens n'ont pas pu être calculés. Réessayez." }))
      return
    }
    const data = res.data
    // Texte modifié pendant la demande : rien n'est posé
    if (optsRef.current.getArticle().markdown !== article.markdown) {
      setState((s) => ({ ...s, busy: false, error: "Le texte a changé pendant la recherche : relancez-la." }))
      return
    }
    if (data.proposals.length === 0) {
      const note =
        data.after >= data.goal.goal
          ? `Le maillage est complet : ${data.after} lien${data.after > 1 ? "s" : ""} internes pour environ ${data.words.toLocaleString("fr-FR")} mots.`
          : "Aucune expression du texte ne correspond à une page du site. Ajoutez des liens à la main (Ctrl+K), ou le bloc « Pour aller plus loin »."
      setState({ busy: false, error: null, last: null, note, relatedBlock: data.relatedBlock })
      return
    }
    optsRef.current.onApply(data.markdown)
    setState({ busy: false, error: null, last: { added: data.proposals, previous: article.markdown }, note: null, relatedBlock: data.relatedBlock })
  }, [])

  const undo = useCallback(() => {
    const last = stateRef.current.last
    if (!last) return
    optsRef.current.onApply(last.previous)
    setState((s) => ({ ...s, last: null }))
  }, [])

  const addRelatedBlock = useCallback(() => {
    const { relatedBlock, last } = stateRef.current
    if (!relatedBlock) return
    const current = optsRef.current.getArticle().markdown
    optsRef.current.onApply(`${current.replace(/\s+$/, "")}\n\n${relatedBlock}\n`)
    setState((s) => ({ ...s, relatedBlock: null, note: null, last: last ?? { added: [], previous: current } }))
  }, [])

  const dismiss = useCallback(() => setState(IDLE), [])

  return { state, run, undo, addRelatedBlock, dismiss }
}
