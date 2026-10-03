'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bot, Loader2, RefreshCw, Save, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader, Panel, StatusPill, Switch } from '@/components/app/kit'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'

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
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

function Field({ id, label, hint, children }: { id: string; label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-[7px]">
      <label htmlFor={id} className="q-label">{label}</label>
      {children}
      {hint && <div className="q-field-hint">{hint}</div>}
    </div>
  )
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
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [slugEdited, setSlugEdited] = useState(mode === 'edit')

  const handleTitleChange = (val: string) => {
    setTitle(val)
    if (!slugEdited) setSlug(slugify(val))
  }

  const handleSave = async () => {
    if (!title.trim() || !content.trim() || !slug.trim()) {
      toast.error('Titre, adresse et contenu sont obligatoires')
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
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? 'Erreur lors de l\'enregistrement')
      }

      toast.success(mode === 'create' ? 'Article créé' : 'Article mis à jour')
      router.push('/admin/blog')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de l\'enregistrement')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/blog/${post!.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Article supprimé')
      setConfirmDelete(false)
      router.push('/admin/blog')
      router.refresh()
    } catch {
      toast.error('Impossible de supprimer l\'article')
    } finally {
      setDeleting(false)
    }
  }

  const handleRegenerate = async () => {
    if (!post) return
    setRegenerating(true)
    try {
      const res = await fetch('/api/admin/blog/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: title, keywords: post.ai_keywords ?? [] }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur')
      toast.success(`Nouvel article généré : « ${data.post.title} »`)
      router.push(`/admin/blog/${data.post.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur de régénération')
    } finally {
      setRegenerating(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-col gap-5">
      <PageHeader
        backHref="/admin/blog"
        backLabel="Blog"
        title={mode === 'create' ? 'Nouvel article' : 'Modifier l\'article'}
        subtitle={
          <span className="mt-1 flex flex-wrap items-center gap-2">
            <StatusPill tone={published ? 'ok' : 'neutral'}>{published ? 'Publié' : 'Brouillon'}</StatusPill>
            {post?.ai_generated && (
              <StatusPill tone="info" icon={<Bot strokeWidth={2.25} aria-hidden />}>Généré par IA</StatusPill>
            )}
          </span>
        }
        actions={
          <>
            {mode === 'edit' && (
              <button type="button" onClick={() => setConfirmDelete(true)} disabled={deleting} className="q-btn q-btn-danger">
                <Trash2 aria-hidden />
                Supprimer
              </button>
            )}
            <button type="button" onClick={handleSave} disabled={saving} className="q-btn q-btn-primary">
              {saving ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </>
        }
      />

      {post?.ai_generated && (
        <Panel bodyClassName="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex min-w-0 flex-col gap-2">
            <p className="text-sm text-[var(--q-text-2)]">Article généré par l&apos;IA. Relisez-le avant publication.</p>
            {post.ai_keywords && post.ai_keywords.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-semibold text-[var(--q-text-4)]">Mots-clés :</span>
                {post.ai_keywords.map((kw, i) => (
                  <span key={i} className="q-tag">{kw}</span>
                ))}
              </div>
            )}
          </div>
          {mode === 'edit' && (
            <button type="button" onClick={handleRegenerate} disabled={regenerating} className="q-btn q-btn-secondary q-btn-sm shrink-0 self-start sm:self-center">
              {regenerating ? <Loader2 className="animate-spin" aria-hidden /> : <RefreshCw aria-hidden />}
              Régénérer
            </button>
          )}
        </Panel>
      )}

      <Panel bodyClassName="flex flex-col gap-5 p-4 sm:p-5">
        <Field id="blog-title" label="Titre">
          <input
            id="blog-title"
            value={title}
            onChange={e => handleTitleChange(e.target.value)}
            placeholder="Titre de l'article…"
            required
            className="q-input font-semibold"
          />
        </Field>

        <Field id="blog-slug" label="Adresse de l'article" hint="Lettres minuscules, chiffres et tirets ; remplie à partir du titre.">
          <div className="q-fw flex h-[42px] items-center rounded-[10px] border border-[var(--q-field)] bg-[var(--q-surface)] pl-3">
            <span className="shrink-0 font-mono text-sm text-[var(--q-text-4)]">/blog/</span>
            <input
              id="blog-slug"
              value={slug}
              onChange={e => { setSlug(e.target.value); setSlugEdited(true) }}
              placeholder="mon-article"
              required
              className="h-full min-w-0 flex-1 bg-transparent pr-3 font-mono text-base text-[var(--q-ink)] outline-none placeholder:text-[var(--q-placeholder)] md:text-sm"
            />
          </div>
        </Field>

        <Field id="blog-excerpt" label="Extrait" hint="Une ou deux phrases pour les aperçus et les moteurs de recherche.">
          <input
            id="blog-excerpt"
            value={excerpt}
            onChange={e => setExcerpt(e.target.value)}
            placeholder="Courte description…"
            className="q-input"
          />
        </Field>

        <Field id="blog-cover" label="Image de couverture (adresse)">
          <input
            id="blog-cover"
            value={coverUrl}
            onChange={e => setCoverUrl(e.target.value)}
            placeholder="https://…"
            type="url"
            inputMode="url"
            className="q-input"
          />
        </Field>

        <Field id="blog-content" label="Contenu (Markdown)" hint={`${content.length.toLocaleString('fr-FR')} caractères`}>
          <textarea
            id="blog-content"
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={20}
            required
            placeholder={`# Titre\n\nIntroduction…\n\n## Section\n\nContenu en **Markdown**…`}
            className="q-input !min-h-[360px] font-mono leading-relaxed"
          />
        </Field>

        <div className="flex items-center justify-between gap-4 rounded-xl border border-[var(--q-line)] bg-[var(--q-surface-2)] px-4 py-3">
          <span className="flex min-w-0 flex-col">
            <label htmlFor="blog-published" className="q-label">Publié sur le blog</label>
            <span className="text-xs text-[var(--q-text-4)]">Pris en compte à l&apos;enregistrement.</span>
          </span>
          <Switch id="blog-published" checked={published} onCheckedChange={setPublished} />
        </div>
      </Panel>

      <Dialog open={confirmDelete} onOpenChange={(o) => { if (!deleting) setConfirmDelete(o) }}>
        <DialogContent showCloseButton={false} className="gap-3 sm:max-w-md">
          <DialogTitle className="q-display text-[22px] font-semibold leading-tight">Supprimer cet article ?</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed !text-[var(--q-text-3)]">
            L&apos;article « {title || 'sans titre'} » sera supprimé définitivement{published ? ' et retiré du blog' : ''}.
          </DialogDescription>
          <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setConfirmDelete(false)} disabled={deleting} className="q-btn q-btn-ghost">Annuler</button>
            <button type="button" onClick={handleDelete} disabled={deleting} className="q-btn q-btn-danger">
              {deleting ? <Loader2 className="animate-spin" aria-hidden /> : <Trash2 aria-hidden />}
              Supprimer
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
