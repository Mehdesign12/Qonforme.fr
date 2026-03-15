'use client'

/**
 * ProductCombobox
 * ────────────────
 * • Desktop  : dropdown positionné avec JS (jamais hors-écran)
 * • Mobile   : bottom-sheet plein écran avec backdrop
 */

import { useState, useEffect, useRef, useCallback } from "react"
import { createPortal } from "react-dom"
import { Package, Search, Loader2, ChevronDown, X } from "lucide-react"
import { formatCurrency } from "@/lib/utils/invoice"

export interface ProductSuggestion {
  id:            string
  name:          string
  description:   string | null
  unit_price_ht: number
  vat_rate:      number
  unit:          string | null
  reference:     string | null
}

interface ProductComboboxProps {
  onSelect:   (product: ProductSuggestion) => void
  className?: string
}

/* ─────────────────────────────────────────────────────────────────────────
   Inner list (partagée desktop + mobile)
───────────────────────────────────────────────────────────────────────── */
function ProductList({
  products,
  loading,
  search,
  onSelect,
  onSearchChange,
  onClose,
  inputRef,
}: {
  products:       ProductSuggestion[]
  loading:        boolean
  search:         string
  onSelect:       (p: ProductSuggestion) => void
  onSearchChange: (v: string) => void
  onClose:        () => void
  inputRef:       React.RefObject<HTMLInputElement>
}) {
  return (
    <>
      {/* Recherche */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[#F1F5F9]">
        <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Rechercher un produit…"
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          className="flex-1 text-sm outline-none text-[#0F172A] placeholder:text-slate-400 bg-transparent"
        />
        {search ? (
          <button type="button" onClick={() => onSearchChange("")} className="text-slate-400 hover:text-slate-600 p-0.5">
            <X className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 p-0.5 sm:hidden">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Liste */}
      <div className="overflow-y-auto" style={{ maxHeight: '50vh' }}>
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 text-[#2563EB] animate-spin" />
          </div>
        ) : products.length === 0 ? (
          <div className="py-10 text-center px-4">
            <Package className="w-8 h-8 text-slate-200 mx-auto mb-2" />
            <p className="text-sm text-slate-400 mb-1">
              {search ? "Aucun résultat" : "Catalogue vide"}
            </p>
            {!search && (
              <a
                href="/products"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-[#2563EB] hover:underline inline-block mt-1"
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
              onClick={() => onSelect(product)}
              className="w-full flex items-start gap-3 px-4 py-3 hover:bg-[#F8FAFC] active:bg-[#EFF6FF] transition-colors text-left group"
            >
              <div className="w-8 h-8 rounded-xl bg-[#EFF6FF] flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-[#DBEAFE] transition-colors">
                <Package className="w-3.5 h-3.5 text-[#2563EB]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-[#0F172A] truncate">{product.name}</span>
                  <span className="text-sm font-mono font-bold text-[#0F172A] shrink-0">
                    {formatCurrency(product.unit_price_ht)}
                    <span className="text-slate-400 font-normal text-xs"> HT</span>
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
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
                  <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{product.description}</p>
                )}
              </div>
            </button>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-[#F1F5F9] flex items-center justify-between bg-[#FAFBFC]/60">
        <span className="text-[11px] text-slate-400">
          {products.length} produit{products.length !== 1 ? "s" : ""}
        </span>
        <a
          href="/products"
          target="_blank"
          rel="noreferrer"
          className="text-[11px] text-[#2563EB] hover:underline font-medium"
        >
          Gérer le catalogue →
        </a>
      </div>
    </>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
   Main component
───────────────────────────────────────────────────────────────────────── */
export function ProductCombobox({ onSelect, className = "" }: ProductComboboxProps) {
  const [open,      setOpen]      = useState(false)
  const [search,    setSearch]    = useState("")
  const [products,  setProducts]  = useState<ProductSuggestion[]>([])
  const [loading,   setLoading]   = useState(false)
  const [isMobile,  setIsMobile]  = useState(false)

  // Position du dropdown desktop
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})

  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef     = useRef<HTMLInputElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  // Détecter mobile (< 640px) — même breakpoint que Tailwind `sm`
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  // Fermer en cliquant en dehors (desktop seulement)
  useEffect(() => {
    if (isMobile) return
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isMobile])

  // Fetch produits
  const fetchProducts = useCallback(async (q: string) => {
    setLoading(true)
    try {
      const res  = await fetch(`/api/products?search=${encodeURIComponent(q)}`)
      const json = await res.json()
      if (json.products) setProducts(json.products)
    } catch {
      // silencieux
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => fetchProducts(search), 200)
    return () => clearTimeout(timer)
  }, [open, search, fetchProducts])

  // Calculer la position du dropdown desktop (évite de sortir de l'écran)
  const calculateDropdownPosition = useCallback(() => {
    if (!containerRef.current) return
    const rect    = containerRef.current.getBoundingClientRect()
    const vh      = window.innerHeight
    const dropH   = 360 // hauteur estimée du dropdown
    const spaceB  = vh - rect.bottom
    const showUp  = spaceB < dropH && rect.top > dropH

    const style: React.CSSProperties = {
      position: 'fixed',
      left:     Math.min(rect.left, window.innerWidth - 320 - 8),
      width:    320,
      zIndex:   9999,
    }
    if (showUp) {
      style.bottom = vh - rect.top + 6
    } else {
      style.top = rect.bottom + 6
    }
    setDropdownStyle(style)
  }, [])

  const handleOpen = () => {
    if (!isMobile) calculateDropdownPosition()
    setOpen(true)
    setSearch("")
    setTimeout(() => inputRef.current?.focus(), 60)
  }

  const handleSelect = (product: ProductSuggestion) => {
    onSelect(product)
    setOpen(false)
    setSearch("")
  }

  const handleClose = () => {
    setOpen(false)
    setSearch("")
  }

  /* ── Trigger button ── */
  const trigger = (
    <button
      type="button"
      onClick={handleOpen}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#2563EB] bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl hover:bg-[#DBEAFE] active:bg-[#BFDBFE] transition-colors"
      title="Insérer depuis le catalogue"
    >
      <Package className="w-3.5 h-3.5" />
      <span>Catalogue</span>
      <ChevronDown className="w-3 h-3 opacity-60" />
    </button>
  )

  /* ── Dropdown desktop — portail fixed ── */
  const desktopDropdown = mounted && open && !isMobile ? createPortal(
    <div
      className="bg-white border border-[#E2E8F0] rounded-2xl shadow-[0_8px_32px_rgba(15,23,42,0.12)] overflow-hidden"
      style={dropdownStyle}
    >
      <ProductList
        products={products}
        loading={loading}
        search={search}
        onSelect={handleSelect}
        onSearchChange={setSearch}
        onClose={handleClose}
        inputRef={inputRef}
      />
    </div>,
    document.body
  ) : null

  /* ── Bottom-sheet mobile — portail fixed ── */
  const mobileSheet = mounted && open && isMobile ? createPortal(
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-[9998] bg-black/40"
        style={{  }}
        onClick={handleClose}
      />
      {/* Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-[9999] bg-white rounded-t-2xl overflow-hidden shadow-[0_-4px_32px_rgba(15,23,42,0.15)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {/* Handle */}
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-slate-200 mx-auto" />
        </div>
        <div className="flex items-center justify-between px-4 pb-2">
          <h3 className="text-[15px] font-bold text-[#0F172A]">Catalogue produits</h3>
          <button
            type="button"
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>
        <ProductList
          products={products}
          loading={loading}
          search={search}
          onSelect={handleSelect}
          onSearchChange={setSearch}
          onClose={handleClose}
          inputRef={inputRef}
        />
      </div>
    </>,
    document.body
  ) : null

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      {trigger}
      {desktopDropdown}
      {mobileSheet}
    </div>
  )
}
