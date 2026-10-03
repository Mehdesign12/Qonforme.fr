'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Bot, Eye, EyeOff, Loader2, Pencil, RefreshCw, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { EmptyState, Kpi, KpiGrid, PageHeader, Panel, StatusPill, Switch } from '@/components/app/kit'
import { LoadError, fmtDate, plural } from '@/components/admin/ui'

interface AiPost {
  id: string
  slug: string
  title: string
  excerpt: string | null
  is_published: boolean
  published_at: string | null
  ai_keywords: string[] | null
  ai_model: string | null
  created_at: string
}

function PublishPill({ published }: { published: boolean }) {
  return published ? (
    <StatusPill tone="ok" icon={<Eye strokeWidth={2.25} aria-hidden />}>Publié</StatusPill>
  ) : (
    <StatusPill tone="neutral" icon={<EyeOff strokeWidth={2.25} aria-hidden />}>Brouillon</StatusPill>
  )
}

export default function AdminBlogAiPage() {
  const [posts, setPosts] = useState<AiPost[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [generating, setGenerating] = useState(false)

  // Controls
  const [customTopic, setCustomTopic] = useState('')
  const [customKeywords, setCustomKeywords] = useState('')
  const [autoPublish, setAutoPublish] = useState(false)
  const [globalAutoPublish, setGlobalAutoPublish] = useState(false)
  // Tant que le réglage n'est pas lu, l'interrupteur reste inactif (il affichait « désactivé » à tort)
  const [globalLoaded, setGlobalLoaded] = useState(false)
  const [savingGlobal, setSavingGlobal] = useState(false)

  // Load global auto_publish setting from DB
  useEffect(() => {
    fetch('/api/admin/settings?key=blog_auto_publish')
      .then(res => { if (!res.ok) throw new Error(); return res.json() })
      .then(data => {
        const val = data.value === 'true'
        setGlobalAutoPublish(val)
        setAutoPublish(val) // sync the per-generation checkbox
        setGlobalLoaded(true)
      })
      .catch(() => toast.error('Réglage de publication automatique illisible. Rechargez la page.'))
  }, [])

  const handleToggleGlobalAutoPublish = async () => {
    const newValue = !globalAutoPublish
    setSavingGlobal(true)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'blog_auto_publish', value: String(newValue) }),
      })
      if (!res.ok) throw new Error()
      setGlobalAutoPublish(newValue)
      setAutoPublish(newValue)
      toast.success(newValue ? 'Publication automatique activée (tâche quotidienne comprise)' : 'Publication automatique désactivée : les articles restent en brouillon')
    } catch {
      toast.error('Erreur lors de l\'enregistrement')
    } finally {
      setSavingGlobal(false)
    }
  }

  const fetchPosts = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/blog/ai-posts')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setPosts(data.posts ?? [])
      setLoadError(false)
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchPosts() }, [fetchPosts])

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const body: Record<string, unknown> = { auto_publish: autoPublish }
      if (customTopic.trim()) body.topic = customTopic.trim()
      if (customKeywords.trim()) {
        body.keywords = customKeywords.split(',').map(k => k.trim()).filter(Boolean)
      }

      const res = await fetch('/api/admin/blog/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de la génération')
      }

      if (data.has_cover === false) {
        toast.success(`Article généré : « ${data.post.title} »`, { description: 'Image de couverture non générée : vérifiez les journaux Gemini.' })
      } else {
        toast.success(`Article généré : « ${data.post.title} »`)
      }
      setCustomTopic('')
      setCustomKeywords('')
      fetchPosts()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la génération')
    } finally {
      setGenerating(false)
    }
  }

  const handleTogglePublish = async (postId: string, publish: boolean) => {
    try {
      const res = await fetch(`/api/admin/blog/${postId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_published: publish,
          ...(publish ? { published_at: new Date().toISOString() } : {}),
        }),
      })
      if (!res.ok) throw new Error()
      toast.success(publish ? 'Article publié' : 'Article dépublié')
      fetchPosts()
    } catch {
      toast.error('Erreur lors de la mise à jour')
    }
  }

  const handleRegenerate = async (postId: string) => {
    // Find the post and regenerate with same topic
    const post = posts.find(p => p.id === postId)
    if (!post) return

    setGenerating(true)
    try {
      const res = await fetch('/api/admin/blog/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: post.title,
          keywords: post.ai_keywords ?? [],
          auto_publish: post.is_published,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur')

      toast.success(`Article régénéré : « ${data.post.title} »`)
      fetchPosts()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la régénération')
    } finally {
      setGenerating(false)
    }
  }

  // Stats
  const totalAi = posts.length
  const publishedAi = posts.filter(p => p.is_published).length
  const draftsAi = totalAi - publishedAi
  const lastPost = posts[0] ?? null
  const statsReady = !loading && !loadError

  const rowActions = (post: AiPost) => (
    <>
      <Link href={`/admin/blog/${post.id}`} className="q-btn q-btn-ghost q-btn-sm">
        <Pencil aria-hidden />
        Ouvrir
      </Link>
      <button type="button" onClick={() => handleTogglePublish(post.id, !post.is_published)} className="q-btn q-btn-ghost q-btn-sm">
        {post.is_published ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
        {post.is_published ? 'Dépublier' : 'Publier'}
      </button>
      <button type="button" onClick={() => handleRegenerate(post.id)} disabled={generating} className="q-btn q-btn-ghost q-btn-sm">
        <RefreshCw aria-hidden />
        Régénérer
      </button>
    </>
  )

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Génération IA" subtitle="Articles de blog générés avec Gemini, à relire avant publication." />

      <KpiGrid className="sm:!grid-cols-3">
        <Kpi label="Articles générés" value={statsReady ? totalAi : '—'} />
        <Kpi label="Publiés" value={statsReady ? publishedAi : '—'} sub={statsReady ? plural(draftsAi, 'brouillon') : undefined} />
        <Kpi
          className="col-span-2 sm:col-span-1"
          label="Dernier article"
          value={<span className="line-clamp-2 text-base font-semibold leading-snug tracking-normal">{statsReady ? (lastPost?.title ?? 'Aucun') : '—'}</span>}
          sub={statsReady && lastPost ? fmtDate(lastPost.created_at) : undefined}
        />
      </KpiGrid>

      <Panel bodyClassName="flex items-center justify-between gap-4 p-4 sm:p-5">
        <span className="flex min-w-0 flex-col gap-0.5">
          <label htmlFor="ai-auto-publish" className="q-h2">Publication automatique</label>
          <span className="text-[13px] text-[var(--q-text-4)]">
            S&apos;applique à la tâche quotidienne et sert de valeur par défaut pour la génération manuelle.
          </span>
        </span>
        <Switch
          id="ai-auto-publish"
          checked={globalAutoPublish}
          onCheckedChange={handleToggleGlobalAutoPublish}
          disabled={savingGlobal || !globalLoaded}
        />
      </Panel>

      <Panel title="Générer un article" bodyClassName="flex flex-col gap-4 px-5 pb-5 pt-2">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-[7px]">
            <label htmlFor="ai-topic" className="q-label">Sujet <span className="font-normal text-[var(--q-text-4)]">(facultatif)</span></label>
            <input
              id="ai-topic"
              value={customTopic}
              onChange={e => setCustomTopic(e.target.value)}
              placeholder="Vide : sujet choisi automatiquement"
              disabled={generating}
              className="q-input"
            />
          </div>
          <div className="flex flex-col gap-[7px]">
            <label htmlFor="ai-keywords" className="q-label">Mots-clés <span className="font-normal text-[var(--q-text-4)]">(facultatif)</span></label>
            <input
              id="ai-keywords"
              value={customKeywords}
              onChange={e => setCustomKeywords(e.target.value)}
              placeholder="mot-clé 1, mot-clé 2…"
              disabled={generating}
              className="q-input"
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-[var(--q-ink)]">
            <input
              type="checkbox"
              checked={autoPublish}
              onChange={e => setAutoPublish(e.target.checked)}
              disabled={generating}
              className="size-[18px] accent-[var(--q-accent)]"
            />
            Publier dès la génération
          </label>

          <button type="button" onClick={handleGenerate} disabled={generating} className="q-btn q-btn-primary">
            {generating ? <Loader2 className="animate-spin" aria-hidden /> : <Sparkles aria-hidden />}
            {generating ? 'Génération en cours…' : 'Générer maintenant'}
          </button>
        </div>
      </Panel>

      <section aria-labelledby="ai-posts-title" className="flex flex-col gap-3">
        <h2 id="ai-posts-title" className="q-h2">Articles générés</h2>
        {loading ? (
          <div className="q-card grid place-items-center py-16" role="status" aria-label="Chargement des articles">
            <Loader2 className="size-6 animate-spin text-[var(--q-accent)]" aria-hidden />
          </div>
        ) : loadError ? (
          <LoadError
            what="les articles générés"
            action={<button type="button" onClick={() => { setLoading(true); fetchPosts() }} className="q-btn q-btn-secondary">Réessayer</button>}
          />
        ) : posts.length === 0 ? (
          <div className="q-card">
            <EmptyState
              icon={<Bot className="size-5" aria-hidden />}
              title="Aucun article généré"
              text="Lancez une première génération avec le bouton ci-dessus."
            />
          </div>
        ) : (
          <>
            {/* Tableau (ordinateur) */}
            <div className="q-card hidden overflow-hidden md:block">
              <div className="overflow-x-auto">
                <table className="q-table min-w-[800px] [&_th]:border-t-0">
                  <thead>
                    <tr className="bg-[var(--q-surface-2)]">
                      <th scope="col">Article</th>
                      <th scope="col">Mots-clés</th>
                      <th scope="col">Statut</th>
                      <th scope="col">Date</th>
                      <th scope="col"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {posts.map((post) => (
                      <tr key={post.id}>
                        <td className="max-w-[300px] !py-3">
                          <span className="flex min-w-0 flex-col gap-0.5">
                            <span className="line-clamp-2 font-semibold">{post.title}</span>
                            <span className="truncate font-mono text-xs text-[var(--q-text-4)]">/blog/{post.slug}</span>
                          </span>
                        </td>
                        <td className="!py-3">
                          <span className="flex flex-wrap gap-1">
                            {(post.ai_keywords ?? []).slice(0, 3).map((kw, i) => (
                              <span key={i} className="q-tag">{kw}</span>
                            ))}
                          </span>
                        </td>
                        <td className="!py-3"><PublishPill published={post.is_published} /></td>
                        <td className="!py-3 whitespace-nowrap text-[13px] text-[var(--q-text-3)]">{fmtDate(post.created_at)}</td>
                        <td className="w-px !py-3">
                          <span className="flex items-center justify-end gap-0.5">{rowActions(post)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Liste (mobile) */}
            <ul className="q-card q-list overflow-hidden !rounded-[18px] md:hidden" aria-label="Articles générés">
              {posts.map((post) => (
                <li key={post.id} className="flex flex-col gap-2 px-3.5 py-3">
                  <div className="flex items-start gap-3">
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="line-clamp-2 text-[15px] font-semibold text-[var(--q-ink)]">{post.title}</span>
                      <span className="text-[13px] text-[var(--q-text-4)]">{fmtDate(post.created_at)}</span>
                    </span>
                    <PublishPill published={post.is_published} />
                  </div>
                  <div className="-ml-2 flex flex-wrap gap-0.5">{rowActions(post)}</div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  )
}
