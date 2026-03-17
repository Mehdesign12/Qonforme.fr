'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save, Eye, EyeOff, Trash2, Loader2, Bot, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

interface Post {
  id:           string
  slug:         string
  title:        string
  excerpt?:     string | null
  content:      string
  cover_url?:   string | null
  is_published: boolean
  ai_generated?: boolean
  ai_keywords?:  string[] | null
}

interface BlogEditorProps {
  mode: 'create' | 'edit'
  post?: Post
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

export function BlogEditor({ mode, post }: BlogEditorProps) {
  const router = useRouter()

  const [title,     setTitle]     = useState(post?.title     ?? '')
  const [slug,      setSlug]      = useState(post?.slug      ?? '')
  const [excerpt,   setExcerpt]   = useState(post?.excerpt   ?? '')
  const [content,   setContent]   = useState(post?.content   ?? '')
  const [coverUrl,  setCoverUrl]  = useState(post?.cover_url ?? '')
  const [published, setPublished] = useState(post?.is_published ?? false)
  const [saving,    setSaving]    = useState(false)
  const [deleting,  setDeleting]  = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [slugEdited, setSlugEdited] = useState(mode === 'edit')

  const handleTitleChange = (val: string) => {
    setTitle(val)
    if (!slugEdited) setSlug(slugify(val))
  }

  const handleSave = async () => {
    if (!title.trim() || !content.trim() || !slug.trim()) {
      toast.error('Titre, slug et contenu sont obligatoires')
      return
    }
    setSaving(true)
    try {
      const url    = mode === 'create' ? '/api/admin/blog' : `/api/admin/blog/${post!.id}`
      const method = mode === 'create' ? 'POST' : 'PATCH'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, slug, excerpt, content, cover_url: coverUrl, is_published: published }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data?.error ?? 'Erreur lors de la sauvegarde')
      }

      toast.success(mode === 'create' ? 'Article créé !' : 'Article mis à jour !')
      router.push('/admin/blog')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Supprimer cet article définitivement ?')) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/blog/${post!.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Article supprimé')
      router.push('/admin/blog')
      router.refresh()
    } catch {
      toast.error('Impossible de supprimer l\'article')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <Link href="/admin/blog" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Retour
        </Link>
        <div className="flex items-center gap-2">
          {mode === 'edit' && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium text-red-600 border border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Supprimer
            </button>
          )}
          <button
            onClick={() => setPublished(v => !v)}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium border border-border text-foreground hover:bg-muted transition-colors"
          >
            {published ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {published ? 'Dépublier' : 'Publier'}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-sm font-medium bg-[#2563EB] text-white hover:bg-[#1d4ed8] transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>

      {/* Statut + AI badge */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium ${
          published
            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
        }`}>
          {published ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          {published ? 'Publié' : 'Brouillon'}
        </div>

        {post?.ai_generated && (
          <div className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
            <Bot className="w-4 h-4" />
            Généré par IA
          </div>
        )}

        {mode === 'edit' && post?.ai_generated && (
          <button
            onClick={async () => {
              setRegenerating(true)
              try {
                const res = await fetch('/api/admin/blog/generate', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ topic: title, keywords: post.ai_keywords ?? [] }),
                })
                const data = await res.json()
                if (!res.ok) throw new Error(data.error || 'Erreur')
                toast.success(`Nouvel article généré : "${data.post.title}"`)
                router.push(`/admin/blog/${data.post.id}`)
              } catch (err) {
                toast.error(err instanceof Error ? err.message : 'Erreur de régénération')
              } finally {
                setRegenerating(false)
              }
            }}
            disabled={regenerating}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-amber-600 border border-amber-200 hover:bg-amber-50 dark:border-amber-800 dark:hover:bg-amber-900/30 transition-colors disabled:opacity-50"
          >
            {regenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Régénérer
          </button>
        )}
      </div>

      {/* AI Keywords */}
      {post?.ai_keywords && post.ai_keywords.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">SEO</span>
          {post.ai_keywords.map((kw, i) => (
            <span key={i} className="inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
              {kw}
            </span>
          ))}
        </div>
      )}

      {/* Formulaire */}
      <div className="rounded-2xl border border-slate-100 dark:border-[#1E3A5F] bg-white/95 dark:bg-[#0F1E35] p-5 space-y-4">

        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Titre *</label>
          <input
            value={title}
            onChange={e => handleTitleChange(e.target.value)}
            placeholder="Titre de l'article…"
            className="w-full h-10 px-3 text-base font-semibold rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Slug *</label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400">/blog/</span>
            <input
              value={slug}
              onChange={e => { setSlug(e.target.value); setSlugEdited(true) }}
              placeholder="mon-article"
              className="flex-1 h-9 px-3 text-sm font-mono rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Extrait</label>
          <input
            value={excerpt}
            onChange={e => setExcerpt(e.target.value)}
            placeholder="Courte description pour les aperçus…"
            className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">URL de couverture</label>
          <input
            value={coverUrl}
            onChange={e => setCoverUrl(e.target.value)}
            placeholder="https://…"
            type="url"
            className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
            Contenu (Markdown) *
          </label>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={20}
            placeholder={`# Titre\n\nIntroduction…\n\n## Section\n\nContenu en **Markdown**…`}
            className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y"
          />
          <p className="text-[11px] text-slate-400 mt-1">{content.length} caractères</p>
        </div>
      </div>
    </div>
  )
}
