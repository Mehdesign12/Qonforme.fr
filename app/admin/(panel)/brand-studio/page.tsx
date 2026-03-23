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
  ZoomIn,
  Copy,
  Check,
  Trash2,
  Settings,
  ChevronDown,
  Save,
} from 'lucide-react'
import { toast } from 'sonner'
import Image from 'next/image'

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

export default function BrandStudioPage() {
  // Upload state
  const [inspirationSrc, setInspirationSrc] = useState<string | null>(null)
  const [inspirationBase64, setInspirationBase64] = useState<string | null>(null)
  const [inspirationMime, setInspirationMime] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)

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
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null)
  const [deletingImage, setDeletingImage] = useState<string | null>(null)

  // Brand guidelines state
  const [guidelinesOpen, setGuidelinesOpen] = useState(false)
  const [guidelinesLoading, setGuidelinesLoading] = useState(false)
  const [guidelinesSaving, setGuidelinesSaving] = useState(false)
  const [guidelines, setGuidelines] = useState({
    primary_color: '#2563EB',
    secondary_color: '#0F172A',
    accent_colors: ['#3B82F6', '#EFF6FF'],
    mood: 'Professional yet approachable. Modern, clean, trustworthy.',
    target: 'French artisans, craftsmen, small business owners.',
    visual_identity: 'Clean lines, blue gradients, warm human touches, French business aesthetic.',
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
        const data = await res.json()
        throw new Error(data.error || 'Erreur')
      }
      setGallery((prev) => prev.filter((img) => img.file_name !== fileName))
      if (previewImage) {
        const deletedImg = gallery.find((img) => img.file_name === fileName)
        if (deletedImg && previewImage === deletedImg.url) {
          setPreviewImage(null)
        }
      }
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
      if (res.ok) {
        const data = await res.json()
        setGallery(data.images ?? [])
      }
    } catch {
      // silent
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
      toast.success('Brand guidelines sauvegardées')
    } catch {
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setGuidelinesSaving(false)
    }
  }

  // ── File upload ──────────────────────────────────────────────────────────
  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Fichier non supporté — envoyez une image (PNG, JPG, WebP)')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image trop volumineuse (max 10 Mo)')
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
          toast.success('Image collée depuis le presse-papier')
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
      toast.success('Image analysée avec succès')
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
        toast.success('Image brandée générée !')
        fetchGallery()
      } else if (data.base64) {
        // Fallback: create a data URL
        setGeneratedUrl(`data:${data.mimeType};base64,${data.base64}`)
        toast.success('Image générée (sauvegarde locale uniquement)')
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
      toast.success('URL copiée')
      setTimeout(() => setCopiedUrl(null), 2000)
    } catch {
      toast.error('Impossible de copier')
    }
  }

  return (
    <div className="space-y-6 max-w-[960px] mx-auto">

      {/* Header */}
      <div>
        <h1 className="text-[22px] font-extrabold text-[#0F172A] dark:text-[#E2E8F0] leading-tight flex items-center gap-2">
          <Palette className="w-6 h-6 text-[#2563EB]" />
          Brand Studio
        </h1>
        <p className="text-[13px] text-slate-400 mt-0.5">
          Uploadez une image d&apos;inspiration, l&apos;IA la recrée avec le branding Qonforme
        </p>
      </div>

      {/* Main workflow area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* LEFT — Inspiration upload */}
        <div className="rounded-2xl border border-slate-100 dark:border-[#1E3A5F] bg-white/95 dark:bg-[#0F1E35] p-5 space-y-4">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Upload className="w-4 h-4 text-[#2563EB]" />
            Image d&apos;inspiration
          </h2>

          {!inspirationSrc ? (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-200 dark:border-[#1E3A5F] rounded-xl p-8 text-center cursor-pointer hover:border-[#2563EB] hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors"
            >
              <ImageIcon className="w-10 h-10 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
              <p className="text-sm font-medium text-foreground mb-1">
                Glissez une image ici ou cliquez pour uploader
              </p>
              <p className="text-[12px] text-slate-400">
                PNG, JPG, WebP — max 10 Mo — ou collez depuis le presse-papier (Ctrl+V)
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleFileSelect(file)
                }}
              />
            </div>
          ) : (
            <div className="relative">
              <div className="relative rounded-xl overflow-hidden border border-slate-100 dark:border-[#1E3A5F]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={inspirationSrc}
                  alt="Image d'inspiration"
                  className="w-full h-auto max-h-[300px] object-contain bg-slate-50 dark:bg-[#0A1628]"
                />
              </div>
              <button
                onClick={clearInspiration}
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors"
                title="Supprimer"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Analyze button */}
              {!analysis && (
                <button
                  onClick={handleAnalyze}
                  disabled={analyzing}
                  className="mt-3 w-full inline-flex items-center justify-center gap-2 h-10 px-5 rounded-lg bg-[#2563EB] text-white text-sm font-medium hover:bg-[#1d4ed8] transition-colors disabled:opacity-50"
                >
                  {analyzing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Analyse en cours…
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Analyser l&apos;image
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {/* Analysis results */}
          {analysis && (
            <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Analyse de l&apos;image
                </h3>
                <button
                  onClick={handleAnalyze}
                  disabled={analyzing}
                  className="text-[11px] text-[#2563EB] hover:underline flex items-center gap-1"
                >
                  <RefreshCw className={`w-3 h-3 ${analyzing ? 'animate-spin' : ''}`} />
                  Re-analyser
                </button>
              </div>

              <div className="rounded-xl bg-slate-50 dark:bg-[#0A1628] p-3 space-y-2 text-[13px]">
                <div>
                  <span className="font-semibold text-foreground">Style : </span>
                  <span className="text-slate-600 dark:text-slate-400">{analysis.style}</span>
                </div>
                <div>
                  <span className="font-semibold text-foreground">Ambiance : </span>
                  <span className="text-slate-600 dark:text-slate-400">{analysis.mood}</span>
                </div>
                <div>
                  <span className="font-semibold text-foreground">Composition : </span>
                  <span className="text-slate-600 dark:text-slate-400">{analysis.composition}</span>
                </div>
                <div>
                  <span className="font-semibold text-foreground">Description : </span>
                  <span className="text-slate-600 dark:text-slate-400">{analysis.description}</span>
                </div>
                <div>
                  <span className="font-semibold text-foreground">Couleurs : </span>
                  <div className="inline-flex gap-1.5 ml-1 align-middle">
                    {analysis.colors.map((c, i) => (
                      <span key={i} className="inline-block rounded-full px-2 py-0.5 text-[10px] font-medium bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="font-semibold text-foreground">Éléments clés : </span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {analysis.elements.map((el, i) => (
                      <span key={i} className="inline-block rounded-full px-2 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                        {el}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — Generation controls + result */}
        <div className="rounded-2xl border border-slate-100 dark:border-[#1E3A5F] bg-white/95 dark:bg-[#0F1E35] p-5 space-y-4">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#2563EB]" />
            Génération brandée
          </h2>

          {!analysis ? (
            <div className="py-12 text-center">
              <Palette className="w-10 h-10 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
              <p className="text-sm font-medium text-foreground mb-1">
                En attente d&apos;analyse
              </p>
              <p className="text-[12px] text-slate-400">
                Uploadez et analysez une image d&apos;inspiration pour commencer la génération.
              </p>
            </div>
          ) : (
            <>
              {/* Instructions */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Instructions supplémentaires (optionnel)
                </label>
                <textarea
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value.slice(0, 500))}
                  placeholder="Ex: Mettre en avant un artisan plombier, ajouter des outils en arrière-plan…"
                  disabled={generating}
                  rows={3}
                  maxLength={500}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 resize-none"
                />
                <p className={`text-[11px] mt-1 text-right ${instructions.length > 450 ? 'text-amber-500' : 'text-slate-400'}`}>
                  {instructions.length}/500
                </p>
              </div>

              {/* Aspect ratio */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Format
                </label>
                <div className="flex flex-wrap gap-2">
                  {ASPECT_RATIOS.map((ar) => (
                    <button
                      key={ar.value}
                      onClick={() => setAspectRatio(ar.value)}
                      disabled={generating}
                      className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-colors ${
                        aspectRatio === ar.value
                          ? 'bg-[#2563EB] text-white border-[#2563EB]'
                          : 'bg-background text-foreground border-border hover:border-[#2563EB] hover:text-[#2563EB]'
                      } disabled:opacity-50`}
                      title={ar.desc}
                    >
                      {ar.label}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  {ASPECT_RATIOS.find((ar) => ar.value === aspectRatio)?.desc}
                </p>
              </div>

              {/* Generate button */}
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="w-full inline-flex items-center justify-center gap-2 h-10 px-5 rounded-lg bg-[#2563EB] text-white text-sm font-medium hover:bg-[#1d4ed8] transition-colors disabled:opacity-50"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Génération en cours…
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Générer l&apos;image brandée
                  </>
                )}
              </button>

              {/* Result */}
              {generatedUrl && (
                <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="relative rounded-xl overflow-hidden border border-slate-100 dark:border-[#1E3A5F]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={generatedUrl}
                      alt="Image brandée générée"
                      className="w-full h-auto bg-slate-50 dark:bg-[#0A1628]"
                    />
                  </div>
                  <div className="flex gap-2">
                    <a
                      href={generatedUrl}
                      download={`qonforme-brand-${Date.now()}.png`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 inline-flex items-center justify-center gap-2 h-9 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-slate-50 dark:hover:bg-[#162032] transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Télécharger
                    </a>
                    {generatedUrl.startsWith('http') && (
                      <button
                        onClick={() => handleCopyUrl(generatedUrl)}
                        className="flex-1 inline-flex items-center justify-center gap-2 h-9 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-slate-50 dark:hover:bg-[#162032] transition-colors"
                      >
                        {copiedUrl === generatedUrl ? (
                          <><Check className="w-4 h-4 text-green-500" /> Copié !</>
                        ) : (
                          <><Copy className="w-4 h-4" /> Copier l&apos;URL</>
                        )}
                      </button>
                    )}
                    <button
                      onClick={handleGenerate}
                      disabled={generating}
                      className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-slate-50 dark:hover:bg-[#162032] transition-colors disabled:opacity-50"
                      title="Régénérer"
                    >
                      <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Brand Guidelines Editor (collapsible) */}
      <div className="rounded-2xl border border-slate-100 dark:border-[#1E3A5F] bg-white/95 dark:bg-[#0F1E35] overflow-hidden">
        <button
          onClick={() => setGuidelinesOpen(!guidelinesOpen)}
          className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-50 dark:hover:bg-[#162032] transition-colors"
        >
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Settings className="w-4 h-4 text-[#2563EB]" />
            Brand Guidelines
          </h2>
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${guidelinesOpen ? 'rotate-180' : ''}`} />
        </button>

        {guidelinesOpen && (
          <div className="px-5 pb-5 pt-2 border-t border-slate-100 dark:border-[#1E3A5F] space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
            {guidelinesLoading ? (
              <div className="py-6 text-center">
                <Loader2 className="w-5 h-5 mx-auto animate-spin text-slate-300" />
              </div>
            ) : (
              <>
                {/* Colors row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Couleur primaire</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={guidelines.primary_color}
                        onChange={(e) => setGuidelines({ ...guidelines, primary_color: e.target.value })}
                        className="w-8 h-8 rounded border border-border cursor-pointer"
                      />
                      <input
                        type="text"
                        value={guidelines.primary_color}
                        onChange={(e) => setGuidelines({ ...guidelines, primary_color: e.target.value })}
                        className="flex-1 px-2 py-1.5 text-xs font-mono border border-border rounded-lg bg-background text-foreground"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Couleur secondaire</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={guidelines.secondary_color}
                        onChange={(e) => setGuidelines({ ...guidelines, secondary_color: e.target.value })}
                        className="w-8 h-8 rounded border border-border cursor-pointer"
                      />
                      <input
                        type="text"
                        value={guidelines.secondary_color}
                        onChange={(e) => setGuidelines({ ...guidelines, secondary_color: e.target.value })}
                        className="flex-1 px-2 py-1.5 text-xs font-mono border border-border rounded-lg bg-background text-foreground"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Accent 1</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={guidelines.accent_colors[0] || '#3B82F6'}
                        onChange={(e) => {
                          const newAccents = [...guidelines.accent_colors]
                          newAccents[0] = e.target.value
                          setGuidelines({ ...guidelines, accent_colors: newAccents })
                        }}
                        className="w-8 h-8 rounded border border-border cursor-pointer"
                      />
                      <input
                        type="text"
                        value={guidelines.accent_colors[0] || '#3B82F6'}
                        onChange={(e) => {
                          const newAccents = [...guidelines.accent_colors]
                          newAccents[0] = e.target.value
                          setGuidelines({ ...guidelines, accent_colors: newAccents })
                        }}
                        className="flex-1 px-2 py-1.5 text-xs font-mono border border-border rounded-lg bg-background text-foreground"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Accent 2</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={guidelines.accent_colors[1] || '#EFF6FF'}
                        onChange={(e) => {
                          const newAccents = [...guidelines.accent_colors]
                          newAccents[1] = e.target.value
                          setGuidelines({ ...guidelines, accent_colors: newAccents })
                        }}
                        className="w-8 h-8 rounded border border-border cursor-pointer"
                      />
                      <input
                        type="text"
                        value={guidelines.accent_colors[1] || '#EFF6FF'}
                        onChange={(e) => {
                          const newAccents = [...guidelines.accent_colors]
                          newAccents[1] = e.target.value
                          setGuidelines({ ...guidelines, accent_colors: newAccents })
                        }}
                        className="flex-1 px-2 py-1.5 text-xs font-mono border border-border rounded-lg bg-background text-foreground"
                      />
                    </div>
                  </div>
                </div>

                {/* Text fields */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Ambiance / Mood</label>
                    <textarea
                      value={guidelines.mood}
                      onChange={(e) => setGuidelines({ ...guidelines, mood: e.target.value })}
                      rows={2}
                      className="w-full px-2 py-1.5 text-xs border border-border rounded-lg bg-background text-foreground resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Audience cible</label>
                    <textarea
                      value={guidelines.target}
                      onChange={(e) => setGuidelines({ ...guidelines, target: e.target.value })}
                      rows={2}
                      className="w-full px-2 py-1.5 text-xs border border-border rounded-lg bg-background text-foreground resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Identité visuelle</label>
                    <textarea
                      value={guidelines.visual_identity}
                      onChange={(e) => setGuidelines({ ...guidelines, visual_identity: e.target.value })}
                      rows={2}
                      className="w-full px-2 py-1.5 text-xs border border-border rounded-lg bg-background text-foreground resize-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={saveGuidelines}
                    disabled={guidelinesSaving}
                    className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-[#2563EB] text-white text-sm font-medium hover:bg-[#1d4ed8] transition-colors disabled:opacity-50"
                  >
                    {guidelinesSaving ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Sauvegarde…</>
                    ) : (
                      <><Save className="w-4 h-4" /> Sauvegarder</>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Gallery */}
      <div className="rounded-2xl border border-slate-100 dark:border-[#1E3A5F] bg-white/95 dark:bg-[#0F1E35] overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 dark:border-[#1E3A5F]">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-[#2563EB]" />
            Galerie des images générées
          </h2>
        </div>

        {loadingGallery ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-xl overflow-hidden border border-slate-100 dark:border-[#1E3A5F]">
                <div className="w-full h-32 bg-slate-100 dark:bg-[#162032] animate-pulse" />
                <div className="px-2 py-1.5 space-y-1">
                  <div className="h-2.5 w-16 bg-slate-100 dark:bg-[#162032] rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : gallery.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <ImageIcon className="w-10 h-10 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
            <p className="text-sm font-medium text-foreground mb-1">Aucune image</p>
            <p className="text-[13px] text-slate-400">
              Les images générées apparaîtront ici.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 p-4">
            {gallery.map((img) => (
              <div
                key={img.file_name}
                className="group relative rounded-xl overflow-hidden border border-slate-100 dark:border-[#1E3A5F] cursor-pointer hover:ring-2 hover:ring-[#2563EB] transition-all"
                onClick={() => setPreviewImage(img.url)}
              >
                <Image
                  src={img.url}
                  alt={img.file_name}
                  width={300}
                  height={200}
                  className="w-full h-32 object-cover"
                  sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                  <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                {/* Delete button */}
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteImage(img.file_name) }}
                  disabled={deletingImage === img.file_name}
                  className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-red-500/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-600 transition-all disabled:opacity-50"
                  title="Supprimer"
                >
                  {deletingImage === img.file_name ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Trash2 className="w-3 h-3" />
                  )}
                </button>
                {/* Bottom info */}
                <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 bg-gradient-to-t from-black/60 to-transparent">
                  <p className="text-[10px] text-white/80 truncate">
                    {img.created_at
                      ? new Date(img.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                      : img.file_name}
                  </p>
                  {(img.aspect_ratio || img.instructions) && (
                    <div className="flex items-center gap-1 mt-0.5">
                      {img.aspect_ratio && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/20 text-white/90">{img.aspect_ratio}</span>
                      )}
                      {img.instructions && (
                        <span className="text-[9px] text-white/70 truncate" title={img.instructions}>
                          {img.instructions.length > 25 ? img.instructions.slice(0, 25) + '…' : img.instructions}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Full-screen preview modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <button
            onClick={() => setPreviewImage(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex gap-3 absolute bottom-6 left-1/2 -translate-x-1/2">
            <a
              href={previewImage}
              download
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition-colors"
            >
              <Download className="w-4 h-4" />
              Télécharger
            </a>
            <button
              onClick={(e) => { e.stopPropagation(); handleCopyUrl(previewImage) }}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition-colors"
            >
              {copiedUrl === previewImage ? (
                <><Check className="w-4 h-4 text-green-400" /> Copié</>
              ) : (
                <><Copy className="w-4 h-4" /> Copier l&apos;URL</>
              )}
            </button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewImage}
            alt="Aperçu"
            className="max-w-full max-h-[80vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}
