"use client"

/**
 * Contexte du panneau Référencement de l'éditeur d'articles
 * (GET /api/admin/blog/seo-context) : mots-clés proposés, requêtes de Search
 * Console de l'article, autres articles, pages qui ressortent déjà sur le
 * mot-clé choisi, concurrents, préférences.
 *
 * - Premier chargement tout de suite ; après un changement de mot-clé,
 *   400 ms d'attente (la saisie continue), l'appel précédent est annulé, et
 *   seules les pages du mot-clé sont relues (`only=keyword`) : le reste du
 *   contexte ne dépend pas du mot-clé.
 * - Les données précédentes restent affichées pendant un rechargement
 *   (`loading` vrai) et après une erreur (`error` renseigné).
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { canonicalKeyword } from "@/lib/seo/keywords/normalize"
import type { SeoContext } from "@/lib/seo/articles/editor-types"

export const SEO_CONTEXT_DEBOUNCE_MS = 400

export interface SeoContextState {
  data: SeoContext | null
  loading: boolean
  error: string | null
  reload: () => void
}

export function seoContextUrl(id: string | null | undefined, keyword: string | null | undefined): string {
  const params = new URLSearchParams()
  if (id) params.set("id", id)
  const k = keyword ? canonicalKeyword(keyword) : ""
  if (k) params.set("keyword", k)
  const qs = params.toString()
  return `/api/admin/blog/seo-context${qs ? `?${qs}` : ""}`
}

export function useSeoContext({ id, keyword }: { id: string | null | undefined; keyword: string | null | undefined }): SeoContextState {
  const [data, setData] = useState<SeoContext | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  const key = keyword ? canonicalKeyword(keyword) : ""
  const previous = useRef<{ id: string | null | undefined; key: string; nonce: number } | null>(null)
  const dataRef = useRef<SeoContext | null>(null)
  dataRef.current = data

  useEffect(() => {
    const last = previous.current
    // Seul un changement de mot-clé attend : premier chargement, autre article ou « Réessayer » partent tout de suite
    const debounce = last !== null && last.id === id && last.nonce === nonce && last.key !== key
    previous.current = { id, key, nonce }
    // Mot-clé changé, contexte déjà lu : seules les pages du mot-clé sont relues
    const onlyKeyword = debounce && dataRef.current !== null

    const controller = new AbortController()
    setLoading(true)
    const timer = window.setTimeout(
      async () => {
        try {
          const url = seoContextUrl(id, key)
          const res = await fetch(onlyKeyword ? `${url}${url.includes("?") ? "&" : "?"}only=keyword` : url, { cache: "no-store", signal: controller.signal })
          const json = (await res.json().catch(() => null)) as (SeoContext & { error?: string }) | null
          if (controller.signal.aborted) return
          if (!res.ok || !json) {
            setError(json?.error ?? (res.status === 401 ? "Session expirée : reconnectez-vous." : "Les données de référencement sont indisponibles pour le moment."))
          } else {
            setData((current) => (onlyKeyword && current ? { ...current, keywordPages: json.keywordPages ?? null } : json))
            setError(null)
          }
        } catch {
          if (controller.signal.aborted) return
          setError("Connexion impossible. Vérifiez votre réseau puis réessayez.")
        } finally {
          if (!controller.signal.aborted) setLoading(false)
        }
      },
      debounce ? SEO_CONTEXT_DEBOUNCE_MS : 0,
    )
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [id, key, nonce])

  const reload = useCallback(() => setNonce((n) => n + 1), [])

  return { data, loading, error, reload }
}
