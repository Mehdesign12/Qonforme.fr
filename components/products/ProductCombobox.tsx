'use client'

/**
 * ProductCombobox — insérer une prestation du catalogue dans un document.
 * ────────────────
 * • Ordinateur : liste déroulante positionnée en JS (jamais hors de l'écran)
 * • Mobile     : feuille du bas avec voile
 * • `products` fourni (démo) : liste locale filtrée, aucun appel réseau ;
 *   sinon recherche via GET /api/products.
 */

import { useState, useEffect, useRef, useCallback } from "react"
import { createPortal } from "react-dom"
import { Package, Search, Loader2, ChevronDown, X } from "lucide-react"
import { formatCurrency } from "@/lib/utils/invoice"
import { cn } from "@/lib/utils"

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
  /** Catalogue fourni par la page (démo) : pas de requête, filtre local. */
  products?:  ProductSuggestion[]
  /** Lien « Gérer le catalogue ». */
  manageHref?: string
  /** toolbar : bouton compact d'en-tête de carte ; block : bouton pleine largeur (mobile). */
  variant?:   "toolbar" | "block"
}

/* ─────────────────────────────────────────────────────────────────────────
   Liste (partagée ordinateur + mobile)
───────────────────────────────────────────────────────────────────────── */
function ProductList({
  products,
  loading,
  search,
  onSelect,
  onSearchChange,
  inputRef,
  manageHref,
}: {
  products:       ProductSuggestion[]
  loading:        boolean
  search:         string
  onSelect:       (p: ProductSuggestion) => void
  onSearchChange: (v: string) => void
  inputRef:       React.RefObject<HTMLInputElement>
  manageHref:     string
}) {
  return (
    <>
      {/* Recherche */}
      <div className="q-fw mx-3 mt-3 flex h-[42px] items-center gap-2 rounded-[10px] border border-[var(--q-field)] bg-[var(--q-surface)] px-3">
        <Search className="size-4 shrink-0 text-[var(--q-text-4)]" aria-hidden />
        <input
          ref={inputRef}
          type="text"
          placeholder="Rechercher une prestation…"
          aria-label="Rechercher une prestation du catalogue"
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          className="h-full min-w-0 flex-1 bg-transparent text-base text-[var(--q-ink)] outline-none placeholder:text-[var(--q-placeholder)] md:text-sm"
        />
        {search && (
          <button type="button" onClick={() => onSearchChange("")} aria-label="Effacer la recherche" className="grid size-7 place-items-center rounded-lg text-[var(--q-text-4)] hover:bg-[var(--q-hover)]">
            <X className="size-3.5" aria-hidden />
          </button>
        )}
      </div>

      {/* Liste */}
      <div className="mt-2 overflow-y-auto px-1.5 pb-1.5" style={{ maxHeight: "50vh" }}>
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="size-5 animate-spin text-[var(--q-accent)]" aria-label="Chargement" />
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <span className="q-empty-icon !size-10 !rounded-xl"><Package className="size-4" aria-hidden /></span>
            <p className="text-sm text-[var(--q-text-4)]">
              {search ? "Aucune prestation ne correspond." : "Votre catalogue est vide."}
            </p>
            {!search && (
              <a href={manageHref} target="_blank" rel="noreferrer" className="q-link text-sm">Ajouter des prestations</a>
            )}
          </div>
        ) : (
          products.map(product => (
            <button
              key={product.id}
              type="button"
              onClick={() => onSelect(product)}
              className="flex w-full items-start gap-3 rounded-[10px] px-2.5 py-2.5 text-left transition-colors hover:bg-[var(--q-hover)] focus-visible:bg-[var(--q-hover)] focus-visible:outline-none"
            >
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-[9px] bg-[var(--q-wash)] text-[var(--q-accent-strong)]">
                <Package className="size-3.5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0 text-sm font-semibold text-[var(--q-ink)]">{product.name}</span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--q-ink)]">
                    {formatCurrency(product.unit_price_ht)}
                    <span className="text-xs font-normal text-[var(--q-text-4)]"> HT</span>
                  </span>
                </span>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--q-text-4)]">
                  {product.reference && <span className="font-mono">{product.reference}</span>}
                  <span className="tabular-nums">TVA {String(product.vat_rate).replace(".", ",")}&nbsp;%</span>
                  {product.unit && <span>· {product.unit}</span>}
                </span>
                {product.description && (
                  <span className="mt-0.5 line-clamp-1 block text-xs text-[var(--q-text-4)]">{product.description}</span>
                )}
              </span>
            </button>
          ))
        )}
      </div>

      {/* Pied */}
      <div className="flex items-center justify-between border-t border-[var(--q-line-soft)] px-4 py-2.5">
        <span className="text-xs tabular-nums text-[var(--q-text-4)]">
          {products.length} prestation{products.length !== 1 ? "s" : ""}
        </span>
        {/* Nouvel onglet : le document en cours de saisie n'est pas perdu */}
        <a href={manageHref} target="_blank" rel="noreferrer" className="q-link text-xs">
          Gérer le catalogue
        </a>
      </div>
    </>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
   Composant principal
───────────────────────────────────────────────────────────────────────── */
export function ProductCombobox({
  onSelect,
  className = "",
  products: staticProducts,
  manageHref = "/products",
  variant = "toolbar",
}: ProductComboboxProps) {
  const [open,      setOpen]      = useState(false)
  const [search,    setSearch]    = useState("")
  const [products,  setProducts]  = useState<ProductSuggestion[]>([])
  const [loading,   setLoading]   = useState(false)
  const [isMobile,  setIsMobile]  = useState(false)

  // Position de la liste sur ordinateur
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})

  const containerRef = useRef<HTMLDivElement>(null)
  const dropdownRef  = useRef<HTMLDivElement>(null)
  const inputRef     = useRef<HTMLInputElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  // Mobile (< 768 px) — même seuil que `md` et que l'éditeur de lignes
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  // Fermer en cliquant en dehors (ordinateur). La liste vit dans un portail :
  // un clic dedans ne doit pas la fermer avant que la sélection ne parte.
  useEffect(() => {
    if (isMobile || !open) return
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node
      if (containerRef.current?.contains(target) || dropdownRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isMobile, open])

  // Échap ferme la liste
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); setSearch("") } }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open])

  // Recherche des produits (API) — sauf catalogue fourni par la page
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
    if (!open || staticProducts) return
    const timer = setTimeout(() => fetchProducts(search), 200)
    return () => clearTimeout(timer)
  }, [open, search, fetchProducts, staticProducts])

  const q = search.trim().toLowerCase()
  const visible = staticProducts
    ? staticProducts.filter(p =>
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.description?.toLowerCase().includes(q) ?? false) ||
        (p.reference?.toLowerCase().includes(q) ?? false))
    : products

  // Position de la liste sur ordinateur (évite de sortir de l'écran)
  const calculateDropdownPosition = useCallback(() => {
    if (!containerRef.current) return
    const rect    = containerRef.current.getBoundingClientRect()
    const vh      = window.innerHeight
    const dropH   = 380 // hauteur estimée de la liste
    const width   = 360
    const spaceB  = vh - rect.bottom
    const showUp  = spaceB < dropH && rect.top > dropH

    const style: React.CSSProperties = {
      position: "fixed",
      left:     Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8)),
      width,
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
    if (open) { setOpen(false); return }
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

  /* ── Bouton ── */
  const trigger = (
    <button
      type="button"
      onClick={handleOpen}
      aria-haspopup="dialog"
      aria-expanded={open}
      className={cn(
        "q-btn q-btn-secondary",
        variant === "toolbar" ? "q-btn-sm" : "!h-11 w-full !rounded-[14px] !text-[15px]",
      )}
      title="Insérer depuis le catalogue"
    >
      <Package aria-hidden strokeWidth={1.75} />
      <span>{variant === "toolbar" ? "Depuis le catalogue" : "Catalogue"}</span>
      {variant === "toolbar" && <ChevronDown className="!size-3.5 text-[var(--q-text-4)]" aria-hidden />}
    </button>
  )

  const list = (
    <ProductList
      products={visible}
      loading={!staticProducts && loading}
      search={search}
      onSelect={handleSelect}
      onSearchChange={setSearch}
      inputRef={inputRef}
      manageHref={manageHref}
    />
  )

  /* ── Liste ordinateur — portail fixe ── */
  const desktopDropdown = mounted && open && !isMobile ? createPortal(
    <div
      ref={dropdownRef}
      role="dialog"
      aria-label="Catalogue"
      className="overflow-hidden rounded-[14px] border border-[var(--q-line)] bg-[var(--q-surface)] shadow-[var(--q-shadow-pop)]"
      style={dropdownStyle}
    >
      {list}
    </div>,
    document.body
  ) : null

  /* ── Feuille du bas mobile — portail fixe, sans backdrop-filter ── */
  const mobileSheet = mounted && open && isMobile ? createPortal(
    <>
      <div className="q-veil fixed inset-0 z-[9998]" onClick={handleClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Depuis le catalogue"
        className="q-sheet fixed inset-x-0 bottom-0 z-[9999] overflow-hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="q-sheet-grip" aria-hidden />
        <div className="flex items-start justify-between gap-3 px-4 pt-3">
          <div className="flex flex-col gap-0.5">
            <h2 className="q-display text-[22px] text-[var(--q-ink)]">Depuis le catalogue</h2>
            <p className="text-sm text-[var(--q-text-4)]">Touchez une prestation pour l&apos;ajouter.</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Fermer"
            className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--q-sunken)] text-[var(--q-text-3)]"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
        {list}
      </div>
    </>,
    document.body
  ) : null

  return (
    <div ref={containerRef} className={cn("relative", variant === "block" ? "block w-full" : "inline-block", className)}>
      {trigger}
      {desktopDropdown}
      {mobileSheet}
    </div>
  )
}
