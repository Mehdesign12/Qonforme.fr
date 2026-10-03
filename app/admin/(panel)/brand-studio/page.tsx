'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Palette,
  Upload,
  Sparkles,
  Loader2,
  Download,
  RefreshCw,
  Image as ImageIcon,
  X,
  Copy,
  Check,
  Trash2,
  ChevronDown,
  Save,
} from 'lucide-react'
import { toast } from 'sonner'
import Image from 'next/image'
import { EmptyState, PageHeader, Panel } from '@/components/app/kit'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { LoadError, fmtDateTime } from '@/components/admin/ui'
import { cn } from '@/lib/utils'

interface ImageAnalysis {
  description: string
  style: string
  colors: string[]
  composition: string
  mood: string
  elements: string[]
}

interface GalleryImage {
  id: string | null
  file_name: string
  url: string
  aspect_ratio: string | null
  instructions: string | null
  analysis: ImageAnalysis | null
  created_at: string
}

const ASPECT_RATIOS = [
  { value: '16:9', label: '16:9', desc: 'Paysage (bannière)' },
  { value: '1:1', label: '1:1', desc: 'Carré (réseaux sociaux)' },
  { value: '4:3', label: '4:3', desc: 'Standard' },
  { value: '9:16', label: '9:16', desc: 'Portrait (story)' },
  { value: '3:4', label: '3:4', desc: 'Portrait classique' },
] as const

type Guidelines = {
  primary_color: string
  secondary_color: string
  accent_colors: string[]
  mood: string
  target: string
  visual_identity: string
}

/** Couleur : pastille native + code hexadécimal (16 px sur mobile, règle iOS de CLAUDE.md). */
function ColorField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-[7px]">
      <label htmlFor={id} className="q-label">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`${label} (sélecteur)`}
          className="size-[42px] shrink-0 cursor-pointer rounded-[10px] border border-[var(--q-field)] bg-[var(--q-surface)] p-1"
        />
        <input id={id} type="text" value={value} onChange={(e) => onChange(e.target.value)} className="q-input font-mono" spellCheck={false} />
      </div>
    </div>
  )
}

export default function BrandStudioPage() {
  // Upload state
  const [inspirationSrc, setInspirationSrc] = useState<string | null>(null)
  const [inspirationBase64, setInspirationBase64] = useState<string | null>(null)
  const [inspirationMime, setInspirationMime] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  // Analysis state
  const [analysis, setAnalysis] = useState<ImageAnalysis | null>(null)
  const [analyzing, setAnalyzing] = useState(false)

  // Generation state
  const [generating, setGenerating] = useState(false)
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null)
  const [instructions, setInstructions] = useState('')
  const [aspectRatio, setAspectRatio] = useState<string>('16:9')

  // Gallery state
  const [gallery, setGallery] = useState<GalleryImage[]>([])
  const [loadingGallery, setLoadingGallery] = useState(true)
  const [galleryError, setGalleryError] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null)
  const [deletingImage, setDeletingImage] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<GalleryImage | null>(null)

  // Brand guidelines state
  const [guidelinesOpen, setGuidelinesOpen] = useState(false)
  const [guidelinesLoading, setGuidelinesLoading] = useState(false)
  const [guidelinesSaving, setGuidelinesSaving] = useState(false)
  const [guidelines, setGuidelines] = useState<Guidelines>({
    primary_color: '#2563EB',
    secondary_color: '#0F172A',
    accent_colors: ['#3B82F6', '#EFF6FF'],
    mood: 'Professional yet approachable. Modern, clean, trustworthy.',
    target: 'French artisans, craftsmen, small business owners.',
    visual_identity: 'Clean lines, light neutral backgrounds with blue accents (no blue gradient backgrounds), warm human touches, French business aesthetic.',
  })

  // ── Delete image ───────────────────────────────────────────────────────
  const handleDeleteImage = async (fileName: string) => {
    if (deletingImage) return
    setDeletingImage(fileName)
    try {
      const res = await fetch(`/api/admin/brand-studio?name=${encodeURIComponent(fileName)}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Erreur')
      }
      setGallery((prev) => prev.filter((img) => img.file_name !== fileName))
      if (previewImage) {
        const deletedImg = gallery.find((img) => img.file_name === fileName)
        if (deletedImg && previewImage === deletedImg.url) {
          setPreviewImage(null)
        }
      }
      setPendingDelete(null)
      toast.success('Image supprimée')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la suppression')
    } finally {
      setDeletingImage(null)
    }
  }

  // ── Gallery ──────────────────────────────────────────────────────────────
  const fetchGallery = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/brand-studio')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setGallery(data.images ?? [])
      setGalleryError(false)
    } catch {
      setGalleryError(true)
    } finally {
      setLoadingGallery(false)
    }
  }, [])

  useEffect(() => { fetchGallery() }, [fetchGallery])

  // ── Brand guidelines ───────────────────────────────────────────────────
  const fetchGuidelines = useCallback(async () => {
    setGuidelinesLoading(true)
    try {
      const res = await fetch('/api/admin/settings?key=brand_guidelines')
      if (res.ok) {
        const data = await res.json()
        if (data.value) {
          const parsed = JSON.parse(data.value)
          setGuidelines((prev) => ({ ...prev, ...parsed }))
        }
      }
    } catch {
      // use defaults
    } finally {
      setGuidelinesLoading(false)
    }
  }, [])

  useEffect(() => { fetchGuidelines() }, [fetchGuidelines])

  const saveGuidelines = async () => {
    setGuidelinesSaving(true)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'brand_guidelines', value: JSON.stringify(guidelines) }),
      })
      if (!res.ok) throw new Error('Erreur')
      toast.success('Charte enregistrée')
    } catch {
      toast.error('Erreur lors de l\'enregistrement')
    } finally {
      setGuidelinesSaving(false)
    }
  }

  const setAccent = (index: number, value: string) => {
    const next = [...guidelines.accent_colors]
    next[index] = value
    setGuidelines({ ...guidelines, accent_colors: next })
  }

  // ── File upload ──────────────────────────────────────────────────────────
  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Fichier non pris en charge : envoyez une image (PNG, JPG, WebP)')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image trop volumineuse (10 Mo au maximum)')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      setInspirationSrc(dataUrl)
      // Extract base64 and mime from data URL
      const [header, base64] = dataUrl.split(',')
      const mime = header.match(/data:(.*?);/)?.[1] || 'image/png'
      setInspirationBase64(base64)
      setInspirationMime(mime)
      // Reset previous results
      setAnalysis(null)
      setGeneratedUrl(null)
    }
    reader.readAsDataURL(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFileSelect(file)
  }

  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (file) {
          e.preventDefault()
          handleFileSelect(file)
          toast.success('Image collée depuis le presse-papiers')
          break
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [handlePaste])

  const clearInspiration = () => {
    setInspirationSrc(null)
    setInspirationBase64(null)
    setInspirationMime('')
    setAnalysis(null)
    setGeneratedUrl(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── Analyze ──────────────────────────────────────────────────────────────
  const handleAnalyze = async () => {
    if (!inspirationBase64 || !inspirationMime) return
    setAnalyzing(true)
    setAnalysis(null)
    try {
      const res = await fetch('/api/admin/brand-studio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'analyze',
          image: inspirationBase64,
          mimeType: inspirationMime,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur')
      setAnalysis(data.analysis)
      toast.success('Image analysée')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'analyse")
    } finally {
      setAnalyzing(false)
    }
  }

  // ── Generate ─────────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!analysis) return
    setGenerating(true)
    setGeneratedUrl(null)
    try {
      const res = await fetch('/api/admin/brand-studio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate',
          analysis,
          instructions: instructions.trim() || undefined,
          aspectRatio,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur')

      if (data.url) {
        setGeneratedUrl(data.url)
        toast.success('Image générée')
        fetchGallery()
      } else if (data.base64) {
        // Fallback: create a data URL
        setGeneratedUrl(`data:${data.mimeType};base64,${data.base64}`)
        toast.success('Image générée (non enregistrée dans la galerie)')
      } else {
        throw new Error('Aucune image dans la réponse')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la génération')
    } finally {
      setGenerating(false)
    }
  }

  // ── Copy URL ─────────────────────────────────────────────────────────────
  const handleCopyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopiedUrl(url)
      toast.success('Adresse copiée')
      setTimeout(() => setCopiedUrl(null), 2000)
    } catch {
      toast.error('Impossible de copier')
    }
  }

  const analysisRows: [string, string][] = analysis
    ? [
        ['Style', analysis.style],
        ['Ambiance', analysis.mood],
        ['Composition', analysis.composition],
        ['Description', analysis.description],
      ]
    : []

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Brand Studio"
        subtitle="Importez une image d'inspiration : l'IA la recrée aux couleurs de Qonforme."
      />

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Image d'inspiration */}
        <Panel title="1. Image d'inspiration" bodyClassName="flex flex-col gap-4 px-5 pb-5 pt-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFileSelect(file)
            }}
          />
          {!inspirationSrc ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={cn(
                'flex flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-10 text-center transition-colors focus-visible:shadow-[0_0_0_4px_var(--q-focus)] focus-visible:outline-none',
                dragOver ? 'border-[var(--q-accent)] bg-[var(--q-wash)]' : 'border-[var(--q-field)] hover:border-[var(--q-accent)] hover:bg-[var(--q-wash)]',
              )}
            >
              <span className="q-empty-icon"><Upload className="size-5" aria-hidden /></span>
              <span className="text-sm font-semibold text-[var(--q-ink)]">Glissez une image ici ou choisissez un fichier</span>
              <span className="text-[13px] text-[var(--q-text-4)]">PNG, JPG ou WebP, 10 Mo au maximum. Vous pouvez aussi la coller (Ctrl+V).</span>
            </button>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="relative overflow-hidden rounded-xl border border-[var(--q-line)] bg-[var(--q-sunken)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={inspirationSrc} alt="Image d'inspiration" className="h-auto max-h-[300px] w-full object-contain" />
                <button
                  type="button"
                  onClick={clearInspiration}
                  aria-label="Retirer l'image d'inspiration"
                  className="q-btn q-btn-secondary q-btn-sm q-btn-icon absolute right-2 top-2"
                >
                  <X aria-hidden />
                </button>
              </div>

              {!analysis && (
                <button type="button" onClick={handleAnalyze} disabled={analyzing} className="q-btn q-btn-primary w-full">
                  {analyzing ? <Loader2 className="animate-spin" aria-hidden /> : <Sparkles aria-hidden />}
                  {analyzing ? 'Analyse en cours…' : 'Analyser l\'image'}
                </button>
              )}
            </div>
          )}

          {analysis && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="q-label">Analyse de l&apos;image</h3>
                <button type="button" onClick={handleAnalyze} disabled={analyzing} className="q-btn q-btn-ghost q-btn-sm">
                  <RefreshCw className={analyzing ? 'animate-spin' : undefined} aria-hidden />
                  Analyser à nouveau
                </button>
              </div>
              <dl className="q-inset flex flex-col gap-2.5 p-3.5 text-[13px] leading-relaxed">
                {analysisRows.map(([label, value]) => (
                  <div key={label}>
                    <dt className="inline font-semibold text-[var(--q-ink)]">{label} : </dt>
                    <dd className="inline text-[var(--q-text-2)]">{value}</dd>
                  </div>
                ))}
                <div>
                  <dt className="font-semibold text-[var(--q-ink)]">Couleurs</dt>
                  <dd className="mt-1 flex flex-wrap gap-1">
                    {analysis.colors.map((c, i) => <span key={i} className="q-tag font-mono">{c}</span>)}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-[var(--q-ink)]">Éléments clés</dt>
                  <dd className="mt-1 flex flex-wrap gap-1">
                    {analysis.elements.map((el, i) => <span key={i} className="q-tag">{el}</span>)}
                  </dd>
                </div>
              </dl>
            </div>
          )}
        </Panel>

        {/* Génération */}
        <Panel title="2. Image aux couleurs de Qonforme" bodyClassName="flex flex-col gap-4 px-5 pb-5 pt-2">
          {!analysis ? (
            <EmptyState
              className="py-10"
              icon={<Palette className="size-5" aria-hidden />}
              title="En attente d'une analyse"
              text="Importez puis analysez une image d'inspiration pour lancer la génération."
            />
          ) : (
            <>
              <div className="flex flex-col gap-[7px]">
                <label htmlFor="bs-instructions" className="q-label">
                  Consignes <span className="font-normal text-[var(--q-text-4)]">(facultatif)</span>
                </label>
                <textarea
                  id="bs-instructions"
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value.slice(0, 500))}
                  placeholder="Ex. : mettre en avant un artisan plombier, des outils en arrière-plan…"
                  disabled={generating}
                  rows={3}
                  maxLength={500}
                  className="q-input !min-h-[96px] resize-none"
                />
                <p className={cn('q-field-hint text-right tabular-nums', instructions.length > 450 && '!text-[var(--q-warn)]')}>
                  {instructions.length}/500
                </p>
              </div>

              <div className="flex flex-col gap-[7px]">
                <span id="bs-format" className="q-label">Format</span>
                <div role="group" aria-labelledby="bs-format" className="q-seg flex-wrap self-start">
                  {ASPECT_RATIOS.map((ar) => (
                    <button
                      key={ar.value}
                      type="button"
                      onClick={() => setAspectRatio(ar.value)}
                      disabled={generating}
                      aria-pressed={aspectRatio === ar.value}
                      title={ar.desc}
                    >
                      {ar.label}
                    </button>
                  ))}
                </div>
                <p className="q-field-hint">{ASPECT_RATIOS.find((ar) => ar.value === aspectRatio)?.desc}</p>
              </div>

              <button type="button" onClick={handleGenerate} disabled={generating} className="q-btn q-btn-primary w-full">
                {generating ? <Loader2 className="animate-spin" aria-hidden /> : <Sparkles aria-hidden />}
                {generating ? 'Génération en cours…' : 'Générer l\'image'}
              </button>

              {generatedUrl && (
                <div className="flex flex-col gap-3">
                  <div className="overflow-hidden rounded-xl border border-[var(--q-line)] bg-[var(--q-sunken)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={generatedUrl} alt="Image générée" className="h-auto w-full" />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={generatedUrl}
                      download={`qonforme-brand-${Date.now()}.png`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="q-btn q-btn-secondary q-btn-sm flex-1"
                    >
                      <Download aria-hidden />
                      Télécharger
                    </a>
                    {generatedUrl.startsWith('http') && (
                      <button type="button" onClick={() => handleCopyUrl(generatedUrl)} className="q-btn q-btn-secondary q-btn-sm flex-1">
                        {copiedUrl === generatedUrl ? <Check aria-hidden /> : <Copy aria-hidden />}
                        {copiedUrl === generatedUrl ? 'Copiée' : 'Copier l\'adresse'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleGenerate}
                      disabled={generating}
                      aria-label="Générer à nouveau"
                      title="Générer à nouveau"
                      className="q-btn q-btn-secondary q-btn-sm q-btn-icon"
                    >
                      <RefreshCw className={generating ? 'animate-spin' : undefined} aria-hidden />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </Panel>
      </div>

      {/* Charte graphique (repliable) */}
      <section className="q-card overflow-hidden" aria-labelledby="bs-guidelines-title">
        <button
          type="button"
          onClick={() => setGuidelinesOpen(!guidelinesOpen)}
          aria-expanded={guidelinesOpen}
          aria-controls="bs-guidelines"
          className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left transition-colors hover:bg-[var(--q-row-hover)] sm:px-5"
        >
          <span className="flex min-w-0 flex-col gap-0.5">
            <span id="bs-guidelines-title" className="q-h2">Charte graphique</span>
            <span className="text-[13px] text-[var(--q-text-4)]">Couleurs et consignes envoyées à l&apos;IA pour chaque génération.</span>
          </span>
          <ChevronDown className={cn('size-4 shrink-0 text-[var(--q-text-4)] transition-transform', guidelinesOpen && 'rotate-180')} aria-hidden />
        </button>

        {guidelinesOpen && (
          <div id="bs-guidelines" className="flex flex-col gap-4 border-t border-[var(--q-line-soft)] px-4 pb-5 pt-4 sm:px-5">
            {guidelinesLoading ? (
              <div className="grid place-items-center py-6" role="status" aria-label="Chargement de la charte">
                <Loader2 className="size-5 animate-spin text-[var(--q-accent)]" aria-hidden />
              </div>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <ColorField id="bs-primary" label="Couleur principale" value={guidelines.primary_color} onChange={(v) => setGuidelines({ ...guidelines, primary_color: v })} />
                  <ColorField id="bs-secondary" label="Couleur secondaire" value={guidelines.secondary_color} onChange={(v) => setGuidelines({ ...guidelines, secondary_color: v })} />
                  <ColorField id="bs-accent-1" label="Accent 1" value={guidelines.accent_colors[0] || '#3B82F6'} onChange={(v) => setAccent(0, v)} />
                  <ColorField id="bs-accent-2" label="Accent 2" value={guidelines.accent_colors[1] || '#EFF6FF'} onChange={(v) => setAccent(1, v)} />
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  {([
                    ['bs-mood', 'Ambiance', 'mood'],
                    ['bs-target', 'Public visé', 'target'],
                    ['bs-identity', 'Identité visuelle', 'visual_identity'],
                  ] as const).map(([id, label, key]) => (
                    <div key={id} className="flex flex-col gap-[7px]">
                      <label htmlFor={id} className="q-label">{label}</label>
                      <textarea
                        id={id}
                        value={guidelines[key]}
                        onChange={(e) => setGuidelines({ ...guidelines, [key]: e.target.value })}
                        rows={3}
                        className="q-input !min-h-[88px] resize-none"
                      />
                    </div>
                  ))}
                </div>

                <div className="flex justify-end">
                  <button type="button" onClick={saveGuidelines} disabled={guidelinesSaving} className="q-btn q-btn-primary">
                    {guidelinesSaving ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
                    {guidelinesSaving ? 'Enregistrement…' : 'Enregistrer la charte'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </section>

      {/* Galerie */}
      <section aria-labelledby="bs-gallery-title" className="flex flex-col gap-3">
        <h2 id="bs-gallery-title" className="q-h2">Images générées</h2>
        {loadingGallery ? (
          <div className="q-card grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 md:grid-cols-4" role="status" aria-label="Chargement de la galerie">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-32 animate-pulse rounded-xl bg-[var(--q-sunken)]" />
            ))}
          </div>
        ) : galleryError ? (
          <LoadError
            what="la galerie"
            action={<button type="button" onClick={() => { setLoadingGallery(true); fetchGallery() }} className="q-btn q-btn-secondary">Réessayer</button>}
          />
        ) : gallery.length === 0 ? (
          <div className="q-card">
            <EmptyState
              icon={<ImageIcon className="size-5" aria-hidden />}
              title="Aucune image"
              text="Les images générées apparaîtront ici."
            />
          </div>
        ) : (
          <ul className="q-card grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 sm:p-4 md:grid-cols-4">
            {gallery.map((img) => (
              <li key={img.file_name} className="group relative overflow-hidden rounded-xl border border-[var(--q-line)] bg-[var(--q-sunken)]">
                <button
                  type="button"
                  onClick={() => setPreviewImage(img.url)}
                  className="block w-full focus-visible:shadow-[inset_0_0_0_3px_var(--q-accent)] focus-visible:outline-none"
                  aria-label={`Agrandir l'image du ${fmtDateTime(img.created_at)}`}
                >
                  <Image
                    src={img.url}
                    alt=""
                    width={300}
                    height={200}
                    className="h-32 w-full object-cover"
                    sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                  />
                  <span className="absolute inset-x-0 bottom-0 flex flex-col gap-0.5 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-4 text-left">
                    <span className="truncate text-[11px] text-white/90">
                      {img.created_at ? fmtDateTime(img.created_at) : img.file_name}
                    </span>
                    {(img.aspect_ratio || img.instructions) && (
                      <span className="flex items-center gap-1">
                        {img.aspect_ratio && <span className="rounded bg-white/20 px-1.5 py-0.5 text-[10px] text-white">{img.aspect_ratio}</span>}
                        {img.instructions && <span className="truncate text-[10px] text-white/75" title={img.instructions}>{img.instructions}</span>}
                      </span>
                    )}
                  </span>
                </button>
                {/* Toujours visible au doigt ; au survol ou au clavier sur ordinateur */}
                <button
                  type="button"
                  onClick={() => setPendingDelete(img)}
                  disabled={deletingImage === img.file_name}
                  aria-label="Supprimer cette image"
                  className="q-btn q-btn-secondary q-btn-sm q-btn-icon absolute right-1.5 top-1.5 !size-8 !text-[var(--q-danger)] md:opacity-0 md:focus-visible:opacity-100 md:group-hover:opacity-100"
                >
                  {deletingImage === img.file_name ? <Loader2 className="animate-spin" aria-hidden /> : <Trash2 aria-hidden />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Aperçu en grand */}
      <Dialog open={previewImage !== null} onOpenChange={(o) => { if (!o) setPreviewImage(null) }}>
        <DialogContent className="gap-3 p-3 sm:max-w-[min(960px,calc(100%-2rem))]">
          <DialogTitle className="sr-only">Aperçu de l&apos;image</DialogTitle>
          <DialogDescription className="sr-only">Image générée par Brand Studio, en grand.</DialogDescription>
          {previewImage && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewImage} alt="Aperçu de l'image générée" className="max-h-[70vh] w-full rounded-xl bg-[var(--q-sunken)] object-contain" />
              <div className="flex flex-wrap gap-2 pr-1">
                <a href={previewImage} download target="_blank" rel="noopener noreferrer" className="q-btn q-btn-secondary q-btn-sm">
                  <Download aria-hidden />
                  Télécharger
                </a>
                <button type="button" onClick={() => handleCopyUrl(previewImage)} className="q-btn q-btn-secondary q-btn-sm">
                  {copiedUrl === previewImage ? <Check aria-hidden /> : <Copy aria-hidden />}
                  {copiedUrl === previewImage ? 'Copiée' : 'Copier l\'adresse'}
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmation de suppression (le bouton est désormais visible au doigt) */}
      <Dialog open={pendingDelete !== null} onOpenChange={(o) => { if (!o && !deletingImage) setPendingDelete(null) }}>
        <DialogContent showCloseButton={false} className="gap-3 sm:max-w-md">
          <DialogTitle className="q-display text-[22px] font-semibold leading-tight">Supprimer cette image ?</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed !text-[var(--q-text-3)]">
            Elle sera retirée de la galerie et du stockage. Les pages qui l&apos;utilisent n&apos;afficheront plus rien.
          </DialogDescription>
          <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setPendingDelete(null)} disabled={!!deletingImage} className="q-btn q-btn-ghost">Annuler</button>
            <button
              type="button"
              onClick={() => pendingDelete && handleDeleteImage(pendingDelete.file_name)}
              disabled={!!deletingImage}
              className="q-btn q-btn-danger"
            >
              {deletingImage ? <Loader2 className="animate-spin" aria-hidden /> : <Trash2 aria-hidden />}
              Supprimer
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
