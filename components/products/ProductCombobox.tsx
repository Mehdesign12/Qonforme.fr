'use client'

/**
 * ProductCombobox
 * ----------------
 * Bouton "Insérer depuis le catalogue" qui ouvre une liste déroulante
 * avec recherche instantanée des produits du catalogue.
 * Quand l'utilisateur choisit un produit, le callback onSelect est appelé
 * avec les données du produit pour pré-remplir la ligne.
 */

import { useState, useEffect, useRef, useCallback } from "react"
import { Package, Search, Loader2, ChevronDown, X } from "lucide-react"
import { formatCurrency } from "@/lib/utils/invoice"

export interface ProductSuggestion {
  id: string
  name: string
  description: string | null
  unit_price_ht: number
  vat_rate: number
  unit: string | null
  reference: string | null
}

interface ProductComboboxProps {
  onSelect: (product: ProductSuggestion) => void
  className?: string
}

export function ProductCombobox({ onSelect, className = "" }: ProductComboboxProps) {
  const [open, setOpen]         = useState(false)
  const [search, setSearch]     = useState("")
  const [products, setProducts] = useState<ProductSuggestion[]>([])
  const [loading, setLoading]   = useState(false)
  const containerRef            = useRef<HTMLDivElement>(null)
  const inputRef                = useRef<HTMLInputElement>(null)

  // Fermer en cliquant en dehors
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Charger les produits à l'ouverture ou au changement de recherche
  const fetchProducts = useCallback(async (q: string) => {
    setLoading(true)
    try {
      const res  = await fetch(`/api/products?search=${encodeURIComponent(q)}`)
      const json = await res.json()
      if (json.products) setProducts(json.products)
    } catch {
      // silencieux — l'utilisateur peut réessayer
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => fetchProducts(search), 200)
    return () => clearTimeout(timer)
  }, [open, search, fetchProducts])

  const handleOpen = () => {
    setOpen(true)
    setSearch("")
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const handleSelect = (product: ProductSuggestion) => {
    onSelect(product)
    setOpen(false)
    setSearch("")
  }

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      {/* Déclencheur */}
      <button
        type="button"
        onClick={handleOpen}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#2563EB] bg-[#EFF6FF] border border-[#BFDBFE] rounded-lg hover:bg-[#DBEAFE] transition-colors"
        title="Insérer depuis le catalogue"
      >
        <Package className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Catalogue</span>
        <ChevronDown className="w-3 h-3 opacity-60" />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 top-full mt-1.5 right-0 w-80 bg-white border border-[#E2E8F0] rounded-xl shadow-xl overflow-hidden">
          {/* Recherche */}
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[#F1F5F9]">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Rechercher un produit…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 text-sm outline-none text-[#0F172A] placeholder:text-slate-400"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Liste */}
          <div className="max-h-64 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-4 h-4 text-[#2563EB] animate-spin" />
              </div>
            ) : products.length === 0 ? (
              <div className="py-8 text-center">
                <Package className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-xs text-slate-400">
                  {search ? "Aucun résultat" : "Catalogue vide"}
                </p>
                {!search && (
                  <a
                    href="/products"
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-[#2563EB] hover:underline mt-1 inline-block"
                  >
                    Gérer le catalogue →
                  </a>
                )}
              </div>
            ) : (
              products.map(product => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => handleSelect(product)}
                  className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-[#F8FAFC] transition-colors text-left group"
                >
                  <div className="w-7 h-7 rounded-md bg-[#EFF6FF] flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-[#DBEAFE]">
                    <Package className="w-3.5 h-3.5 text-[#2563EB]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-[#0F172A] truncate">
                        {product.name}
                      </span>
                      <span className="text-xs font-mono font-semibold text-[#0F172A] shrink-0">
                        {formatCurrency(product.unit_price_ht)}
                        <span className="text-slate-400 font-normal"> HT</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {product.reference && (
                        <span className="text-[10px] font-mono text-slate-400 bg-[#F8FAFC] border border-[#E2E8F0] px-1.5 py-0.5 rounded">
                          {product.reference}
                        </span>
                      )}
                      <span className="text-[10px] text-slate-400 font-mono">{product.vat_rate}% TVA</span>
                      {product.unit && (
                        <span className="text-[10px] text-slate-400 capitalize">· {product.unit}</span>
                      )}
                    </div>
                    {product.description && (
                      <p className="text-xs text-slate-400 mt-0.5 truncate">{product.description}</p>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-3 py-2 border-t border-[#F1F5F9] flex items-center justify-between">
            <span className="text-[10px] text-slate-400">
              {products.length} produit{products.length > 1 ? "s" : ""}
            </span>
            <a
              href="/products"
              target="_blank"
              rel="noreferrer"
              className="text-[10px] text-[#2563EB] hover:underline"
            >
              Gérer le catalogue →
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
