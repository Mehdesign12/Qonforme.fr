'use client'

export const dynamic = "force-dynamic"

import { useState, useEffect, useCallback, useRef } from "react"
import { Plus, Search, Package, Loader2, Pencil, PowerOff, Power, X, Check, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { formatCurrency, VAT_RATES } from "@/lib/utils/invoice"

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

interface Product {
  id: string
  name: string
  description: string | null
  unit_price_ht: number
  vat_rate: number
  unit: string | null
  reference: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

type FormData = {
  name: string
  description: string
  unit_price_ht: string
  vat_rate: string
  unit: string
  reference: string
}

type FormErrors = Partial<Record<keyof FormData, string>>

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

const UNIT_OPTIONS = [
  { value: "",         label: "— Aucune —" },
  { value: "heure",   label: "Heure" },
  { value: "jour",    label: "Jour" },
  { value: "forfait", label: "Forfait" },
  { value: "pièce",   label: "Pièce" },
  { value: "mois",    label: "Mois" },
  { value: "km",      label: "Kilomètre" },
]

function emptyForm(): FormData {
  return { name: "", description: "", unit_price_ht: "", vat_rate: "20", unit: "", reference: "" }
}

/* ------------------------------------------------------------------ */
/* Formulaire produit (création / édition) — panneau latéral           */
/* ------------------------------------------------------------------ */

function ProductPanel({
  product,
  onClose,
  onSaved,
}: {
  product: Product | null  // null = création
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm]     = useState<FormData>(
    product
      ? {
          name:          product.name,
          description:   product.description ?? "",
          unit_price_ht: String(product.unit_price_ht),
          vat_rate:      String(product.vat_rate),
          unit:          product.unit ?? "",
          reference:     product.reference ?? "",
        }
      : emptyForm()
  )
  const [errors, setErrors] = useState<FormErrors>({})
  const [saving, setSaving] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    nameRef.current?.focus()
  }, [])

  const setField = (key: keyof FormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm(prev => ({ ...prev, [key]: e.target.value }))
      if (errors[key]) setErrors(prev => { const n = { ...prev }; delete n[key]; return n })
    }

  function validate(): boolean {
    const errs: FormErrors = {}
    if (!form.name.trim())                              errs.name          = "Le nom est requis"
    if (form.unit_price_ht === "" || isNaN(Number(form.unit_price_ht)))
                                                         errs.unit_price_ht = "Prix invalide"
    if (Number(form.unit_price_ht) < 0)                 errs.unit_price_ht = "Le prix ne peut pas être négatif"
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)

    const payload = {
      name:          form.name.trim(),
      description:   form.description.trim() || null,
      unit_price_ht: Number(form.unit_price_ht),
      vat_rate:      Number(form.vat_rate),
      unit:          form.unit.trim() || null,
      reference:     form.reference.trim() || null,
    }

    try {
      const url    = product ? `/api/products/${product.id}` : "/api/products"
      const method = product ? "PATCH" : "POST"
      const res    = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await res.json()

      if (!res.ok) {
        toast.error(json.error || "Erreur lors de la sauvegarde")
        return
      }

      toast.success(product ? "Produit mis à jour" : "Produit créé")
      onSaved()
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setSaving(false)
    }
  }

  const unitPriceHT  = parseFloat(form.unit_price_ht) || 0
  const vatRate      = parseFloat(form.vat_rate) || 0
  const unitPriceTTC = unitPriceHT * (1 + vatRate / 100)

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Overlay */}
      <div
        className="flex-1 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Panel */}
      <div className="w-full max-w-md bg-white dark:bg-[#0F1E35] flex flex-col shadow-2xl animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#E2E8F0] dark:border-[#1E3A5F]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#EFF6FF] flex items-center justify-center">
              <Package className="w-4.5 h-4.5 text-[#2563EB]" />
            </div>
            <div>
              <h2 className="font-semibold text-[#0F172A] dark:text-[#E2E8F0] text-sm">
                {product ? "Modifier le produit" : "Nouveau produit / service"}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {product ? product.name : "Ajoutez un article à votre catalogue"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Nom */}
          <div>
            <Label className="text-xs font-medium text-slate-600">Nom *</Label>
            <Input
              ref={nameRef}
              placeholder="Ex : Développement web, Consultation horaire…"
              value={form.name}
              onChange={setField("name")}
              className={`mt-1.5 ${errors.name ? "border-red-400 focus:ring-red-400" : ""}`}
            />
            {errors.name && (
              <p className="flex items-center gap-1 text-xs text-red-500 mt-1">
                <AlertCircle className="w-3 h-3" /> {errors.name}
              </p>
            )}
          </div>

          {/* Description */}
          <div>
            <Label className="text-xs font-medium text-slate-600">Description</Label>
            <textarea
              placeholder="Décrivez brièvement ce produit ou service (optionnel)…"
              rows={3}
              value={form.description}
              onChange={setField("description")}
              className="mt-1.5 w-full px-3 py-2 text-sm border border-[#E2E8F0] dark:border-[#1E3A5F] rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#2563EB] text-slate-700 dark:text-[#E2E8F0] placeholder:text-slate-400 bg-white dark:bg-[#162032]"
            />
          </div>

          {/* Référence */}
          <div>
            <Label className="text-xs font-medium text-slate-600">Référence / SKU</Label>
            <Input
              placeholder="Ex : PROD-001, REF-WEB…"
              value={form.reference}
              onChange={setField("reference")}
              className="mt-1.5 font-mono text-sm"
            />
          </div>

          {/* Prix + TVA */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-medium text-slate-600">Prix HT (€) *</Label>
              <div className="relative mt-1.5">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.unit_price_ht}
                  onChange={setField("unit_price_ht")}
                  className={`font-mono text-right pr-7 ${errors.unit_price_ht ? "border-red-400 focus:ring-red-400" : ""}`}
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">€</span>
              </div>
              {errors.unit_price_ht && (
                <p className="flex items-center gap-1 text-xs text-red-500 mt-1">
                  <AlertCircle className="w-3 h-3" /> {errors.unit_price_ht}
                </p>
              )}
            </div>

            <div>
              <Label className="text-xs font-medium text-slate-600">TVA</Label>
              <select
                value={form.vat_rate}
                onChange={setField("vat_rate")}
                className="mt-1.5 w-full px-3 py-2 text-sm border border-[#E2E8F0] dark:border-[#1E3A5F] rounded-lg bg-white dark:bg-[#162032] dark:text-[#E2E8F0] focus:outline-none focus:ring-2 focus:ring-[#2563EB] font-mono"
              >
                {VAT_RATES.map(r => (
                  <option key={r} value={r}>{r}%</option>
                ))}
              </select>
            </div>
          </div>

          {/* Prix TTC calculé */}
          {unitPriceHT > 0 && (
            <div className="flex items-center justify-between bg-[#F8FAFC] dark:bg-[#162032] border border-[#E2E8F0] dark:border-[#1E3A5F] rounded-lg px-4 py-3">
              <span className="text-xs text-slate-500">Prix TTC</span>
              <span className="font-mono font-semibold text-[#0F172A] dark:text-[#E2E8F0]">
                {formatCurrency(unitPriceTTC)}
              </span>
            </div>
          )}

          {/* Unité */}
          <div>
            <Label className="text-xs font-medium text-slate-600">Unité de facturation</Label>
            <select
              value={form.unit}
              onChange={setField("unit")}
              className="mt-1.5 w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            >
              {UNIT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <p className="text-xs text-slate-400 mt-1">
              Apparaîtra dans les lignes de devis et de factures
            </p>
          </div>

        </form>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-[#E2E8F0] dark:border-[#1E3A5F] flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="flex-1"
            disabled={saving}
          >
            Annuler
          </Button>
          <Button
            type="submit"
            onClick={handleSubmit}
            className="flex-1 bg-[#2563EB] hover:bg-[#1D4ED8] text-white gap-2"
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            {product ? "Mettre à jour" : "Créer le produit"}
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Page principale catalogue                                            */
/* ------------------------------------------------------------------ */

export default function ProductsPage() {
  const [products, setProducts]     = useState<Product[]>([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState("")
  const [showInactive, setShowInactive] = useState(false)
  const [panel, setPanel]           = useState<"create" | Product | null>(null)

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ search })
    if (showInactive) params.set("include_inactive", "true")
    const res  = await fetch(`/api/products?${params}`)
    const json = await res.json()
    if (json.products) setProducts(json.products)
    setLoading(false)
  }, [search, showInactive])

  useEffect(() => {
    const timer = setTimeout(fetchProducts, 250)
    return () => clearTimeout(timer)
  }, [fetchProducts])

  const handleToggleActive = async (product: Product) => {
    const action = product.is_active ? "désactiver" : "activer"
    if (!confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} "${product.name}" ?`)) return

    const res  = await fetch(`/api/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !product.is_active }),
    })
    if (res.ok) {
      toast.success(`Produit ${product.is_active ? "désactivé" : "activé"}`)
      fetchProducts()
    } else {
      toast.error("Erreur lors de la mise à jour")
    }
  }

  const handleSaved = () => {
    setPanel(null)
    fetchProducts()
    // Petit délai pour laisser le panel se fermer avant le refresh
    setTimeout(fetchProducts, 100)
  }

  const activeProducts   = products.filter(p => p.is_active)
  const inactiveProducts = products.filter(p => !p.is_active)
  const displayed        = showInactive ? products : activeProducts

  return (
    <div className="space-y-5 animate-fade-in">

      {/* Panel latéral — pleine largeur sur mobile */}
      {panel !== null && (
        <ProductPanel
          product={panel === "create" ? null : panel}
          onClose={() => setPanel(null)}
          onSaved={handleSaved}
        />
      )}

      {/* En-tête */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Rechercher un produit, une référence…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Toggle inactifs */}
        {inactiveProducts.length > 0 && (
          <button
            onClick={() => setShowInactive(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              showInactive
                ? "bg-slate-100 text-slate-700 border-slate-300"
                : "bg-white text-slate-500 border-[#E2E8F0] hover:border-slate-300"
            }`}
          >
            {showInactive ? <Power className="w-3.5 h-3.5" /> : <PowerOff className="w-3.5 h-3.5" />}
            {showInactive ? "Masquer les inactifs" : `Voir les inactifs (${inactiveProducts.length})`}
          </button>
        )}

        <Button
          onClick={() => setPanel("create")}
          className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white gap-2 ml-auto shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Nouveau produit</span>
        </Button>
      </div>

      {/* Tableau — avec cards mobile */}
      <div className="rounded-xl border border-[#E2E8F0] dark:border-[#1E3A5F] overflow-hidden shadow-sm" style={{ background: 'var(--card-glass-bg)' }}>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-[#2563EB] animate-spin" />
          </div>
        ) : displayed.length === 0 ? (
          <div className="py-16 text-center">
            <Package className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <p className="text-sm font-medium text-slate-600 mb-1">
              {search ? "Aucun produit trouvé" : "Votre catalogue est vide"}
            </p>
            <p className="text-xs text-slate-400 mb-4">
              {search
                ? "Essayez une autre recherche"
                : "Ajoutez vos produits et services pour les insérer rapidement dans vos devis et factures"}
            </p>
            {!search && (
              <Button
                size="sm"
                className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
                onClick={() => setPanel("create")}
              >
                Ajouter un produit
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* ── Mobile : cards ── */}
            <div className="sm:hidden divide-y divide-[#F1F5F9] dark:divide-[#162032]">
              {displayed.map(product => (
                <div
                  key={product.id}
                  className={`flex items-center gap-3 px-4 py-3.5 ${!product.is_active ? "opacity-50" : ""}`}
                >
                  <div className="w-8 h-8 rounded-lg bg-[#EFF6FF] flex items-center justify-center shrink-0">
                    <Package className="w-4 h-4 text-[#2563EB]" />
                  </div>
                  <div className="flex-1 min-w-0" onClick={() => setPanel(product)}>
                    <p className="text-sm font-medium text-[#0F172A] dark:text-[#E2E8F0] truncate">{product.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-mono text-xs font-semibold text-[#0F172A] dark:text-[#E2E8F0]">{formatCurrency(product.unit_price_ht)} HT</span>
                      <span className="text-xs text-slate-400">· TVA {product.vat_rate}%</span>
                      {product.unit && <span className="text-xs text-slate-400">· {product.unit}</span>}
                    </div>
                    {!product.is_active && (
                      <span className="inline-flex items-center gap-1 text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded mt-1 font-medium">
                        <PowerOff className="w-2.5 h-2.5" /> Inactif
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost" size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => setPanel(product)}
                    >
                      <Pencil className="w-3.5 h-3.5 text-slate-400" />
                    </Button>
                    <Button
                      variant="ghost" size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => handleToggleActive(product)}
                    >
                      {product.is_active
                        ? <PowerOff className="w-3.5 h-3.5 text-slate-400" />
                        : <Power    className="w-3.5 h-3.5 text-slate-400" />
                      }
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Desktop : table ── */}
            <table className="hidden sm:table w-full">
              <thead>
                <tr className="border-b border-[#E2E8F0] dark:border-[#1E3A5F] bg-[#F8FAFC] dark:bg-[#162032]/40">
                  <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Produit / Service</th>
                  <th className="text-left text-xs font-medium text-slate-400 px-5 py-3 hidden sm:table-cell">Référence</th>
                  <th className="text-left text-xs font-medium text-slate-400 px-5 py-3 hidden md:table-cell">Unité</th>
                  <th className="text-right text-xs font-medium text-slate-400 px-5 py-3">Prix HT</th>
                  <th className="text-center text-xs font-medium text-slate-400 px-5 py-3 hidden sm:table-cell">TVA</th>
                  <th className="text-right text-xs font-medium text-slate-400 px-5 py-3 hidden md:table-cell">Prix TTC</th>
                  <th className="text-right text-xs font-medium text-slate-400 px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayed.map(product => (
                  <tr
                    key={product.id}
                    className={`border-b border-[#F1F5F9] dark:border-[#162032] hover:bg-[#F8FAFC] dark:hover:bg-[#162032]/60 transition-colors last:border-0 ${
                      !product.is_active ? "opacity-50" : ""
                    }`}
                  >
                    {/* Nom + description */}
                    <td className="px-5 py-4">
                      <div className="flex items-start gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-[#EFF6FF] flex items-center justify-center shrink-0 mt-0.5">
                          <Package className="w-4 h-4 text-[#2563EB]" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-[#0F172A] dark:text-[#E2E8F0]">{product.name}</p>
                          {product.description && (
                            <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{product.description}</p>
                          )}
                          {!product.is_active && (
                            <span className="inline-flex items-center gap-1 text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded mt-1 font-medium">
                              <PowerOff className="w-2.5 h-2.5" /> Inactif
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    {/* Référence */}
                    <td className="px-5 py-4 hidden sm:table-cell">
                      <span className="font-mono text-xs text-slate-500 bg-[#F8FAFC] border border-[#E2E8F0] px-2 py-1 rounded">
                        {product.reference || "—"}
                      </span>
                    </td>
                    {/* Unité */}
                    <td className="px-5 py-4 text-sm text-slate-500 hidden md:table-cell capitalize">
                      {product.unit || "—"}
                    </td>
                    {/* Prix HT */}
                    <td className="px-5 py-4 text-right font-mono text-sm font-medium text-[#0F172A] dark:text-[#E2E8F0]">
                      {formatCurrency(product.unit_price_ht)}
                    </td>
                    {/* TVA */}
                    <td className="px-5 py-4 text-center hidden sm:table-cell">
                      <span className="text-xs font-mono bg-[#F8FAFC] border border-[#E2E8F0] px-2 py-1 rounded text-slate-600">
                        {product.vat_rate}%
                      </span>
                    </td>
                    {/* Prix TTC */}
                    <td className="px-5 py-4 text-right font-mono text-sm text-slate-600 hidden md:table-cell">
                      {formatCurrency(product.unit_price_ht * (1 + product.vat_rate / 100))}
                    </td>
                    {/* Actions */}
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => setPanel(product)}
                          title="Modifier"
                        >
                          <Pencil className="w-3.5 h-3.5 text-slate-400" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => handleToggleActive(product)}
                          title={product.is_active ? "Désactiver" : "Activer"}
                        >
                          {product.is_active
                            ? <PowerOff className="w-3.5 h-3.5 text-slate-400 hover:text-red-400" />
                            : <Power    className="w-3.5 h-3.5 text-slate-400 hover:text-green-500" />
                          }
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      {/* Stats bas de page */}
      {!loading && products.length > 0 && (
        <p className="text-xs text-slate-400 text-right">
          {activeProducts.length} produit{activeProducts.length > 1 ? "s" : ""} actif{activeProducts.length > 1 ? "s" : ""}
          {inactiveProducts.length > 0 && ` · ${inactiveProducts.length} inactif${inactiveProducts.length > 1 ? "s" : ""}`}
        </p>
      )}
    </div>
  )
}
