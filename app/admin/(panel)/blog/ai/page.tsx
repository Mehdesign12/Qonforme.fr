'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Bot,
  Play,
  Loader2,
  Eye,
  EyeOff,
  RefreshCw,
  BarChart3,
  FileText,
  Sparkles,
  ExternalLink,
} from 'lucide-react'
import { toast } from 'sonner'

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

export default function AdminBlogAiPage() {
  const [posts, setPosts] = useState<AiPost[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  // Controls
  const [customTopic, setCustomTopic] = useState('')
  const [customKeywords, setCustomKeywords] = useState('')
  const [autoPublish, setAutoPublish] = useState(false)

  const fetchPosts = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/blog/ai-posts')
      if (res.ok) {
        const data = await res.json()
        setPosts(data.posts ?? [])
      }
    } catch {
      // silent
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
        toast.success(`Article généré : "${data.post.title}"`, { description: 'Image de couverture non générée — vérifiez les logs Gemini.' })
      } else {
        toast.success(`Article généré : "${data.post.title}"`)
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

      toast.success(`Article régénéré : "${data.post.title}"`)
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

  return (
    <div className="space-y-6 max-w-[960px] mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-extrabold text-[#0F172A] dark:text-[#E2E8F0] leading-tight flex items-center gap-2">
            <Bot className="w-6 h-6 text-[#2563EB]" />
            Génération IA
          </h1>
          <p className="text-[13px] text-slate-400 mt-0.5">
            Générez des articles de blog optimisés SEO avec Gemini
          </p>
        </div>
        <Link
          href="/admin/blog"
          className="text-sm text-slate-500 hover:text-foreground transition-colors"
        >
          ← Tous les articles
        </Link>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-slate-100 dark:border-[#1E3A5F] bg-white/95 dark:bg-[#0F1E35] p-4">
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="w-4 h-4 text-[#2563EB]" />
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total IA</span>
          </div>
          <p className="text-2xl font-extrabold text-foreground">{totalAi}</p>
        </div>
        <div className="rounded-2xl border border-slate-100 dark:border-[#1E3A5F] bg-white/95 dark:bg-[#0F1E35] p-4">
          <div className="flex items-center gap-2 mb-1">
            <Eye className="w-4 h-4 text-green-500" />
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Publiés</span>
          </div>
          <p className="text-2xl font-extrabold text-foreground">{publishedAi}</p>
          <p className="text-[11px] text-slate-400">{draftsAi} brouillon(s)</p>
        </div>
        <div className="rounded-2xl border border-slate-100 dark:border-[#1E3A5F] bg-white/95 dark:bg-[#0F1E35] p-4">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Dernier article</span>
          </div>
          {lastPost ? (
            <>
              <p className="text-sm font-medium text-foreground line-clamp-1">{lastPost.title}</p>
              <p className="text-[11px] text-slate-400">
                {new Date(lastPost.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-400">Aucun article</p>
          )}
        </div>
      </div>

      {/* Generate controls */}
      <div className="rounded-2xl border border-slate-100 dark:border-[#1E3A5F] bg-white/95 dark:bg-[#0F1E35] p-5 space-y-4">
        <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Play className="w-4 h-4 text-[#2563EB]" />
          Générer un article
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Sujet (optionnel)
            </label>
            <input
              value={customTopic}
              onChange={e => setCustomTopic(e.target.value)}
              placeholder="Laisser vide pour sélection auto…"
              disabled={generating}
              className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Mots-clés SEO (optionnel)
            </label>
            <input
              value={customKeywords}
              onChange={e => setCustomKeywords(e.target.value)}
              placeholder="mot-clé 1, mot-clé 2, …"
              disabled={generating}
              className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoPublish}
              onChange={e => setAutoPublish(e.target.checked)}
              disabled={generating}
              className="w-4 h-4 rounded border-slate-300 text-[#2563EB] focus:ring-[#2563EB]"
            />
            <span className="text-sm text-foreground">Publier automatiquement</span>
          </label>

          <button
            onClick={handleGenerate}
            disabled={generating}
            className="inline-flex items-center gap-2 h-9 px-5 rounded-lg bg-[#2563EB] text-white text-sm font-medium hover:bg-[#1d4ed8] transition-colors disabled:opacity-50"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Génération en cours…
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Générer maintenant
              </>
            )}
          </button>
        </div>
      </div>

      {/* AI posts table */}
      <div className="rounded-2xl border border-slate-100 dark:border-[#1E3A5F] bg-white/95 dark:bg-[#0F1E35] overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 dark:border-[#1E3A5F]">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#2563EB]" />
            Articles générés par l&apos;IA
          </h2>
        </div>

        {loading ? (
          <div className="px-4 py-12 text-center">
            <Loader2 className="w-6 h-6 mx-auto mb-2 animate-spin text-slate-300" />
            <p className="text-sm text-slate-400">Chargement…</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <Bot className="w-10 h-10 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
            <p className="text-sm font-medium text-foreground mb-1">Aucun article IA</p>
            <p className="text-[13px] text-slate-400">Utilisez le bouton ci-dessus pour générer votre premier article.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-[#1E3A5F] bg-slate-50/80 dark:bg-[#162032]/60">
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Titre</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Mots-clés</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Statut</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Date</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-[#1E3A5F]">
              {posts.map((post) => (
                <tr key={post.id} className="hover:bg-slate-50/60 dark:hover:bg-[#162032]/40 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground line-clamp-1">{post.title}</p>
                    <p className="text-[11px] font-mono text-slate-300 dark:text-slate-600 mt-0.5">/{post.slug}</p>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {(post.ai_keywords ?? []).slice(0, 3).map((kw, i) => (
                        <span key={i} className="inline-block rounded-full px-2 py-0.5 text-[10px] font-medium bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                          {kw}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {post.is_published ? (
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        <Eye className="w-3 h-3" /> Publié
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                        <EyeOff className="w-3 h-3" /> Brouillon
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[12px] text-slate-400 hidden sm:table-cell">
                    {new Date(post.created_at).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <Link
                        href={`/admin/blog/${post.id}`}
                        className="inline-flex items-center gap-1 h-7 px-2 rounded text-[11px] font-medium text-[#2563EB] hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                        title="Éditer"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Voir
                      </Link>
                      <button
                        onClick={() => handleTogglePublish(post.id, !post.is_published)}
                        className="inline-flex items-center gap-1 h-7 px-2 rounded text-[11px] font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title={post.is_published ? 'Dépublier' : 'Publier'}
                      >
                        {post.is_published ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        {post.is_published ? 'Dépublier' : 'Publier'}
                      </button>
                      <button
                        onClick={() => handleRegenerate(post.id)}
                        disabled={generating}
                        className="inline-flex items-center gap-1 h-7 px-2 rounded text-[11px] font-medium text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors disabled:opacity-50"
                        title="Régénérer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Régénérer
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
