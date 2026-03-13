'use client'

import { useState, useEffect, useRef } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import {
  Loader2, Upload, Trash2, ImageIcon,
  Info, CheckCircle2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { createClient } from "@/lib/supabase/client"

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

interface InvoiceForm {
  legal_notice: string
  accent_color: string
}

/* Couleurs prédéfinies */
const PRESET_COLORS = [
  { label: "Bleu Qonforme",  value: "#2563EB" },
  { label: "Bleu marine",    value: "#1E3A5F" },
  { label: "Vert forêt",     value: "#15803D" },
  { label: "Violet",         value: "#7C3AED" },
  { label: "Orange",         value: "#EA580C" },
  { label: "Gris anthracite",value: "#374151" },
  { label: "Rouge grenat",   value: "#B91C1C" },
  { label: "Sarcelle",       value: "#0E7490" },
]

/* Mentions légales suggérées selon le statut */
const LEGAL_TEMPLATES = [
  {
    label: "Auto-entrepreneur",
    text: "Dispensé d'immatriculation au registre du commerce et des sociétés (RCS) et au répertoire des métiers (RM).\nTVA non applicable, art. 293 B du CGI.",
  },
  {
    label: "SARL / SAS",
    text: "En cas de retard de paiement, une pénalité égale à 3 fois le taux d'intérêt légal sera exigible (art. L. 441-10 C. com.).\nIndemnité forfaitaire pour frais de recouvrement : 40 € (art. D. 441-5 C. com.).",
  },
  {
    label: "Artisan BTP",
    text: "Artisan inscrit au répertoire des métiers.\nAssurance décennale : [Nom assureur], police n° [XXXXXXXX], valable pour les travaux réalisés en France.",
  },
]

/* ------------------------------------------------------------------ */
/* Composant                                                            */
/* ------------------------------------------------------------------ */

export function InvoiceSettingsForm() {
  const [loading, setLoading]           = useState(true)
  const [saving, setSaving]             = useState(false)
  const [logoUrl, setLogoUrl]           = useState<string | null>(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoPreview, setLogoPreview]   = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    register, handleSubmit, reset, watch, setValue,
    formState: { isDirty }
  } = useForm<InvoiceForm>({
    defaultValues: { legal_notice: "", accent_color: "#2563EB" },
  })

  const accentColor = watch("accent_color")

  /* Chargement des données existantes */
  useEffect(() => {
    fetch("/api/company")
      .then(r => r.json())
      .then(json => {
        if (json.company) {
          reset({
            legal_notice: json.company.legal_notice ?? "",
            accent_color: json.company.accent_color ?? "#2563EB",
          })
          setLogoUrl(json.company.logo_url ?? null)
          setLogoPreview(json.company.logo_url ?? null)
        }
      })
      .finally(() => setLoading(false))
  }, [reset])

  /* Récupère le Bearer token de la session active */
  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) {
      return { Authorization: `Bearer ${session.access_token}` }
    }
    return {}
  }

  /* Upload logo */
  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Prévisualisation locale immédiate
    const reader = new FileReader()
    reader.onload = ev => setLogoPreview(ev.target?.result as string)
    reader.readAsDataURL(file)

    setLogoUploading(true)
    try {
      const authHeaders = await getAuthHeaders()
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/company/logo", {
        method: "POST",
        headers: authHeaders,
        body: fd,
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error); setLogoPreview(logoUrl); return }
      setLogoUrl(json.logo_url)
      toast.success("Logo uploadé ✓")
    } catch { toast.error("Erreur lors de l'upload") }
    finally { setLogoUploading(false) }
  }

  /* Suppression logo */
  const deleteLogo = async () => {
    if (!confirm("Supprimer le logo ?")) return
    setLogoUploading(true)
    try {
      const authHeaders = await getAuthHeaders()
      await fetch("/api/company/logo", { method: "DELETE", headers: authHeaders })
      setLogoUrl(null)
      setLogoPreview(null)
      toast.success("Logo supprimé")
    } catch { toast.error("Erreur lors de la suppression") }
    finally { setLogoUploading(false) }
  }

  /* Sauvegarde mentions + couleur */
  const onSubmit = async (data: InvoiceForm) => {
    setSaving(true)
    try {
      const res = await fetch("/api/company", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error || "Erreur lors de la sauvegarde"); return }
      reset(data)
      toast.success("Paramètres sauvegardés ✓")
    } catch { toast.error("Erreur réseau") }
    finally { setSaving(false) }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-6 h-6 text-[#2563EB] animate-spin" />
    </div>
  )

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

      {/* ---- Logo ---- */}
      <div className="bg-white dark:bg-[#0F1E35] rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] p-5 shadow-sm space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-[#0F172A] dark:text-[#E2E8F0]">Logo de l&apos;entreprise</h2>
          <p className="text-xs text-slate-400 mt-0.5">Affiché en haut à gauche de chaque facture. PNG, JPG ou SVG, max 2 Mo.</p>
        </div>

        <div className="flex items-center gap-4">
          {/* Zone de prévisualisation */}
          <div
            className="w-24 h-24 rounded-xl border-2 border-dashed border-[#E2E8F0] dark:border-[#1E3A5F] flex items-center justify-center bg-[#F8FAFC] dark:bg-[#162032] overflow-hidden shrink-0 cursor-pointer hover:border-[#2563EB] transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            {logoUploading ? (
              <Loader2 className="w-6 h-6 text-[#2563EB] animate-spin" />
            ) : logoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoPreview} alt="Logo" className="w-full h-full object-contain p-2" />
            ) : (
              <div className="text-center">
                <ImageIcon className="w-8 h-8 text-slate-200 mx-auto mb-1" />
                <p className="text-xs text-slate-300">Cliquer</p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              onChange={handleLogoChange}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 w-full"
              onClick={() => fileInputRef.current?.click()}
              disabled={logoUploading}
            >
              <Upload className="w-3.5 h-3.5" />
              {logoPreview ? "Changer le logo" : "Uploader un logo"}
            </Button>
            {logoPreview && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1.5 w-full text-[#991B1B] hover:bg-[#FEE2E2]"
                onClick={deleteLogo}
                disabled={logoUploading}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Supprimer le logo
              </Button>
            )}
          </div>
        </div>


      </div>

      {/* ---- Couleur d'accentuation ---- */}
      <div className="bg-white dark:bg-[#0F1E35] rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] p-5 shadow-sm space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-[#0F172A] dark:text-[#E2E8F0]">Couleur des factures</h2>
          <p className="text-xs text-slate-400 mt-0.5">Utilisée pour l&apos;en-tête, les totaux et les accents dans le PDF.</p>
        </div>

        {/* Presets */}
        <div className="flex flex-wrap gap-2">
          {PRESET_COLORS.map(c => (
            <button
              key={c.value}
              type="button"
              title={c.label}
              onClick={() => setValue("accent_color", c.value, { shouldDirty: true })}
              className={`w-8 h-8 rounded-lg border-2 transition-all ${
                accentColor === c.value
                  ? "border-[#0F172A] dark:border-[#E2E8F0] scale-110 shadow-md"
                  : "border-transparent hover:border-[#94A3B8] hover:scale-105"
              }`}
              style={{ backgroundColor: c.value }}
            />
          ))}
        </div>

        {/* Couleur personnalisée */}
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg border border-[#E2E8F0] dark:border-[#1E3A5F] overflow-hidden cursor-pointer"
            onClick={() => document.getElementById("color-picker")?.click()}
          >
            <input
              id="color-picker"
              type="color"
              {...register("accent_color")}
              className="w-14 h-14 -ml-2 -mt-2 cursor-pointer border-none outline-none"
            />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-600">Couleur personnalisée</p>
            <p className="text-xs text-slate-400 font-mono">{accentColor}</p>
          </div>
          {/* Aperçu */}
          <div
            className="ml-auto px-4 py-1.5 rounded-lg text-white text-xs font-medium shrink-0"
            style={{ backgroundColor: accentColor }}
          >
            Aperçu
          </div>
        </div>
      </div>

      {/* ---- Mentions légales ---- */}
      <div className="bg-white dark:bg-[#0F1E35] rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] p-5 shadow-sm space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-[#0F172A] dark:text-[#E2E8F0]">Mentions légales</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Affichées en bas de chaque facture. Obligatoires selon votre statut juridique.
          </p>
        </div>

        {/* Templates suggérés */}
        <div>
          <p className="text-xs font-medium text-slate-500 mb-2">Modèles suggérés :</p>
          <div className="flex flex-wrap gap-2">
            {LEGAL_TEMPLATES.map(t => (
              <button
                key={t.label}
                type="button"
                onClick={() => setValue("legal_notice", t.text, { shouldDirty: true })}
                className="px-3 py-1.5 rounded-full text-xs font-medium border border-[#E2E8F0] dark:border-[#1E3A5F] bg-[#F8FAFC] dark:bg-[#162032] text-slate-600 dark:text-[#E2E8F0] hover:border-[#2563EB] hover:text-[#2563EB] transition-colors"
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <textarea
          {...register("legal_notice")}
          rows={5}
          placeholder={`Ex : Dispensé d'immatriculation au RCS. TVA non applicable, art. 293 B du CGI.\n\nEn cas de retard de paiement, une pénalité de 3× le taux légal sera exigible.`}
          className="w-full px-3 py-2.5 text-sm border border-[#E2E8F0] dark:border-[#1E3A5F] rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#2563EB] text-slate-600 dark:bg-[#162032] dark:text-[#E2E8F0] font-sans"
        />

        {/* Exemples des mentions obligatoires */}
        <div className="bg-[#EFF6FF] dark:bg-[#162032] border border-[#BFDBFE] dark:border-[#1E3A5F] rounded-lg p-3 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Info className="w-4 h-4 text-[#2563EB] shrink-0" />
            <p className="text-xs font-medium text-[#1E40AF]">Mentions légales obligatoires (droit français)</p>
          </div>
          {[
            "Pénalités de retard : taux et date d'exigibilité",
            "Indemnité forfaitaire de recouvrement : 40 €",
            "Conditions d'escompte (si applicable)",
            "Pour auto-entrepreneurs : mention TVA art. 293 B",
          ].map(item => (
            <div key={item} className="flex items-start gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#3B82F6] shrink-0 mt-0.5" />
              <p className="text-xs text-[#1E40AF]">{item}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ---- Aperçu facture (miniature) ---- */}
      <div className="bg-white dark:bg-[#0F1E35] rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-[#0F172A] dark:text-[#E2E8F0] mb-4">Aperçu de l&apos;en-tête</h2>
        <div className="border border-[#E2E8F0] dark:border-[#1E3A5F] rounded-lg overflow-hidden">
          {/* Bande couleur */}
          <div className="h-1.5" style={{ backgroundColor: accentColor }} />
          <div className="p-4 flex justify-between items-start">
            <div>
              {logoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoPreview} alt="Logo" className="h-12 object-contain mb-2" />
              ) : (
                <div className="h-12 w-32 bg-[#F1F5F9] rounded-md mb-2 flex items-center justify-center">
                  <p className="text-xs text-slate-300">Votre logo</p>
                </div>
              )}
              <p className="text-sm font-bold text-[#0F172A] dark:text-[#E2E8F0]">Mon Entreprise</p>
              <p className="text-xs text-slate-400">123456789 • Paris</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400">FACTURE</p>
              <p className="text-sm font-bold font-mono" style={{ color: accentColor }}>F-2026-001</p>
              <p className="text-xs text-slate-400 mt-1">01/06/2026</p>
            </div>
          </div>
          <div className="px-4 pb-3 border-t border-[#F1F5F9] dark:border-[#162032] pt-2">
            <div className="h-2" style={{ backgroundColor: accentColor, opacity: 0.15, borderRadius: 2 }} />
            <div className="mt-1.5 space-y-1">
              {[100, 80, 90].map((w, i) => (
                <div key={i} className="h-1.5 bg-[#F1F5F9] rounded" style={{ width: `${w}%` }} />
              ))}
            </div>
          </div>
        </div>
      </div>

      <Separator />

      {/* ---- Actions ---- */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {isDirty && (
          <p className="text-xs text-[#D97706] flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-[#D97706] rounded-full inline-block" />
            Modifications non sauvegardées
          </p>
        )}
        <Button
          type="submit"
          className="sm:ml-auto w-full sm:w-auto bg-[#2563EB] hover:bg-[#1D4ED8] text-white gap-2"
          disabled={saving || !isDirty}
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving ? "Sauvegarde…" : "Sauvegarder les modifications"}
        </Button>
      </div>
    </form>
  )
}
