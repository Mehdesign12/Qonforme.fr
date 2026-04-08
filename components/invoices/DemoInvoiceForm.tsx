'use client'

import { useState, useEffect, useRef, useCallback } from "react"
import { toast } from "sonner"
import { Plus, Trash2, Eye, Send, Lock, ChevronRight, Sparkles, X, ArrowRight, Package, Search, ChevronDown } from "lucide-react"
import { calculateLineTotals, calculateInvoiceTotals, formatCurrency, VAT_RATES } from "@/lib/utils/invoice"
import Link from "next/link"
import { createPortal } from "react-dom"

/* ── Types ── */
type VatRate = 0 | 5.5 | 10 | 20
type Line = {
  id: string
  description: string
  quantity: string
  unit_price_ht: string
  vat_rate: VatRate
}
type FormState = {
  client_id:  string
  issue_date: string
  due_date:   string
  notes:      string
  lines:      Line[]
}

/* ── Mock data ── */
const MOCK_CLIENTS = [
  { id: "1", name: "Renovbat SARL" },
  { id: "2", name: "Martin Plomberie" },
  { id: "3", name: "Électricité Dupont" },
  { id: "4", name: "Maçonnerie Bernard" },
]

const MOCK_PRODUCTS = [
  { id: "p1", name: "Travaux de rénovation intérieure", description: "Rénovation complète pièce principale", unit_price_ht: 1500, vat_rate: 20, unit: "forfait", reference: "RENO-001" },
  { id: "p2", name: "Fournitures et matériaux", description: "Lot matériaux standard chantier", unit_price_ht: 250, vat_rate: 20, unit: "lot", reference: "MAT-001" },
  { id: "p3", name: "Main d'œuvre pose carrelage", description: "Pose au m² — carrelage standard", unit_price_ht: 45, vat_rate: 10, unit: "m²", reference: "CARR-001" },
  { id: "p4", name: "Déplacement chantier", description: null, unit_price_ht: 50, vat_rate: 20, unit: null, reference: "DEP-001" },
  { id: "p5", name: "Peinture intérieure", description: "2 couches — peinture acrylique mate", unit_price_ht: 28, vat_rate: 10, unit: "m²", reference: "PEINT-001" },
]

const today    = new Date().toISOString().split("T")[0]
const in30days = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0]
function newLine(): Line {
  return { id: crypto.randomUUID(), description: "", quantity: "1", unit_price_ht: "", vat_rate: 20 }
}

/* ── Styles (identiques au formulaire réel) ── */
const cardStyle: React.CSSProperties = {
  background: 'var(--card-glass-bg)',
  boxShadow:  '0 2px 16px rgba(37,99,235,0.06)',
}
const inputCls = "mt-1 w-full px-3 py-2.5 text-sm border border-[#E2E8F0] rounded-xl bg-white/80 focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent transition-shadow dark:bg-[#162032] dark:border-[#1E3A5F] dark:text-[#E2E8F0]"
const labelCls = "text-[12px] font-semibold text-slate-500 uppercase tracking-wide"

/* ═══════════════════════════════════════════════════════════════════════════
   DemoProductCombobox — catalogue produits fictif (même UI que le vrai)
═══════════════════════════════════════════════════════════════════════════ */
function DemoProductCombobox({ onSelect }: { onSelect: (p: typeof MOCK_PRODUCTS[number]) => void }) {
  const [open,     setOpen]     = useState(false)
  const [search,   setSearch]   = useState("")
  const [isMobile, setIsMobile] = useState(false)
  const [mounted,  setMounted]  = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef     = useRef<HTMLInputElement>(null)
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

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

  const filtered = MOCK_PRODUCTS.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.description?.toLowerCase().includes(search.toLowerCase())) ||
    (p.reference?.toLowerCase().includes(search.toLowerCase()))
  )

  const calculateDropdownPosition = useCallback(() => {
    if (!containerRef.current) return
    const rect   = containerRef.current.getBoundingClientRect()
    const vh     = window.innerHeight
    const dropH  = 360
    const spaceB = vh - rect.bottom
    const showUp = spaceB < dropH && rect.top > dropH
    const style: React.CSSProperties = {
      position: 'fixed',
      left:     Math.min(rect.left, window.innerWidth - 320 - 8),
      width:    320,
      zIndex:   9999,
    }
    if (showUp) { style.bottom = vh - rect.top + 6 }
    else        { style.top = rect.bottom + 6 }
    setDropdownStyle(style)
  }, [])

  const handleOpen = () => {
    if (!isMobile) calculateDropdownPosition()
    setOpen(true)
    setSearch("")
    setTimeout(() => inputRef.current?.focus(), 60)
  }
  const handleSelect = (p: typeof MOCK_PRODUCTS[number]) => { onSelect(p); setOpen(false); setSearch("") }
  const handleClose  = () => { setOpen(false); setSearch("") }

  const listContent = (
    <>
      {/* Search */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[#F1F5F9] dark:border-[#1E3A5F]">
        <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Rechercher un produit…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 text-sm outline-none text-[#0F172A] dark:text-[#E2E8F0] placeholder:text-slate-400 bg-transparent"
        />
        {search ? (
          <button type="button" onClick={() => setSearch("")} className="text-slate-400 hover:text-slate-600 p-0.5">
            <X className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button type="button" onClick={handleClose} className="text-slate-400 hover:text-slate-600 p-0.5 sm:hidden">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {/* List */}
      <div className="overflow-y-auto" style={{ maxHeight: '50vh' }}>
        {filtered.length === 0 ? (
          <div className="py-10 text-center px-4">
            <Package className="w-8 h-8 text-slate-200 mx-auto mb-2" />
            <p className="text-sm text-slate-400 mb-1">{search ? "Aucun résultat" : "Catalogue vide"}</p>
          </div>
        ) : (
          filtered.map(product => (
            <button
              key={product.id}
              type="button"
              onClick={() => handleSelect(product)}
              className="w-full flex items-start gap-3 px-4 py-3 hover:bg-[#F8FAFC] dark:hover:bg-[#162032] active:bg-[#EFF6FF] transition-colors text-left group"
            >
              <div className="w-8 h-8 rounded-xl bg-[#EFF6FF] dark:bg-[#162032] flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-[#DBEAFE] transition-colors">
                <Package className="w-3.5 h-3.5 text-[#2563EB]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-[#0F172A] dark:text-[#E2E8F0] truncate">{product.name}</span>
                  <span className="text-sm font-mono font-bold text-[#0F172A] dark:text-[#E2E8F0] shrink-0">
                    {formatCurrency(product.unit_price_ht)}
                    <span className="text-slate-400 font-normal text-xs"> HT</span>
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {product.reference && (
                    <span className="text-[10px] font-mono text-slate-400 bg-[#F8FAFC] dark:bg-[#162032] border border-[#E2E8F0] dark:border-[#1E3A5F] px-1.5 py-0.5 rounded">
                      {product.reference}
                    </span>
                  )}
                  <span className="text-[10px] text-slate-400 font-mono">{product.vat_rate}% TVA</span>
                  {product.unit && <span className="text-[10px] text-slate-400 capitalize">&middot; {product.unit}</span>}
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
      <div className="px-4 py-2.5 border-t border-[#F1F5F9] dark:border-[#1E3A5F] flex items-center justify-between bg-[#FAFBFC]/60 dark:bg-[#0F1E35]/60">
        <span className="text-[11px] text-slate-400">{filtered.length} produit{filtered.length !== 1 ? "s" : ""}</span>
        <Link href="/demo/products" className="text-[11px] text-[#2563EB] hover:underline font-medium">
          Voir le catalogue &rarr;
        </Link>
      </div>
    </>
  )

  const desktopDropdown = mounted && open && !isMobile ? createPortal(
    <div className="bg-white dark:bg-[#0F1E35] border border-[#E2E8F0] dark:border-[#1E3A5F] rounded-2xl shadow-[0_8px_32px_rgba(15,23,42,0.12)] overflow-hidden" style={dropdownStyle}>
      {listContent}
    </div>,
    document.body
  ) : null

  const mobileSheet = mounted && open && isMobile ? createPortal(
    <>
      <div className="fixed inset-0 z-[9998] bg-black/40" onClick={handleClose} />
      <div
        className="fixed bottom-0 left-0 right-0 z-[9999] bg-white dark:bg-[#0F1E35] rounded-t-2xl overflow-hidden shadow-[0_-4px_32px_rgba(15,23,42,0.15)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-slate-200 dark:bg-slate-700 mx-auto" />
        </div>
        <div className="flex items-center justify-between px-4 pb-2">
          <h3 className="text-[15px] font-bold text-[#0F172A] dark:text-[#E2E8F0]">Catalogue produits</h3>
          <button type="button" onClick={handleClose} className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
            <X className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          </button>
        </div>
        {listContent}
      </div>
    </>,
    document.body
  ) : null

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={handleOpen}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#2563EB] bg-[#EFF6FF] dark:bg-[#162032] border border-[#BFDBFE] dark:border-[#1E3A5F] rounded-xl hover:bg-[#DBEAFE] dark:hover:bg-[#1E3A5F] active:bg-[#BFDBFE] transition-colors"
        title="Insérer depuis le catalogue"
      >
        <Package className="w-3.5 h-3.5" />
        <span>Catalogue</span>
        <ChevronDown className="w-3 h-3 opacity-60" />
      </button>
      {desktopDropdown}
      {mobileSheet}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   DemoInvoiceForm — formulaire principal
   Architecture identique au vrai NewInvoiceForm (useState + inputs contrôlés)
═══════════════════════════════════════════════════════════════════════════ */
export default function DemoInvoiceForm() {
  const [tipDismissed, setTipDismissed] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [form, setForm] = useState<FormState>({
    client_id: "1",
    issue_date: today,
    due_date: in30days,
    notes: "Paiement par virement bancaire sous 30 jours.\nPénalités de retard : 3 fois le taux légal en vigueur.",
    lines: [newLine()],
  })

  /* ── Setters ── */
  const setField = (key: keyof Omit<FormState, "lines">) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm(prev => ({ ...prev, [key]: e.target.value }))
      if (errors[key]) setErrors(prev => { const n = { ...prev }; delete n[key]; return n })
    }

  const setLine = (id: string, key: keyof Line) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setForm(prev => ({
        ...prev,
        lines: prev.lines.map(l => l.id === id
          ? { ...l, [key]: key === "vat_rate" ? Number(e.target.value) as VatRate : e.target.value }
          : l)
      }))
    }

  const addLine = () => setForm(prev => ({ ...prev, lines: [...prev.lines, newLine()] }))
  const removeLine = (id: string) => setForm(prev => ({ ...prev, lines: prev.lines.filter(l => l.id !== id) }))

  const insertFromProduct = (product: typeof MOCK_PRODUCTS[number]) => {
    const newL: Line = {
      id:            crypto.randomUUID(),
      description:   product.name + (product.description ? ` — ${product.description}` : ""),
      quantity:      "1",
      unit_price_ht: String(product.unit_price_ht),
      vat_rate:      product.vat_rate as VatRate,
    }
    setForm(prev => ({ ...prev, lines: [...prev.lines, newL] }))
  }

  /* ── Calculs en temps réel ── */
  const computedLines = form.lines.map(line => {
    const qty   = parseFloat(line.quantity) || 0
    const price = parseFloat(line.unit_price_ht) || 0
    return calculateLineTotals(qty, price, line.vat_rate)
  })

  const totals = calculateInvoiceTotals(
    computedLines.map(l => ({ total_ht: l.totalHT, total_vat: l.totalVAT, total_ttc: l.totalTTC }))
  )

  /* ── Validation (identique au vrai formulaire) ── */
  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!form.client_id)  errs.client_id  = "Client requis"
    if (!form.issue_date) errs.issue_date = "Date d\u2019\u00e9mission requise"
    if (!form.due_date)   errs.due_date   = "Date d\u2019\u00e9ch\u00e9ance requise"
    form.lines.forEach((line, i) => {
      if (!line.description.trim()) errs[`line_${i}_desc`]  = "Description requise"
      if (!line.quantity || parseFloat(line.quantity) <= 0)  errs[`line_${i}_qty`]   = "Quantit\u00e9 invalide"
      if (line.unit_price_ht === "" || parseFloat(line.unit_price_ht) < 0) errs[`line_${i}_price`] = "Prix invalide"
    })
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  /* ── Actions démo ── */
  const handleDemoAction = (action: string) => {
    if (action === "send" || action === "preview") {
      if (!validate()) {
        toast.error("Corrigez les erreurs avant de continuer")
        return
      }
    }
    toast.info("Fonctionnalit\u00e9 disponible apr\u00e8s inscription", {
      description: "Cr\u00e9e ton compte pour envoyer de vraies factures.",
      action: { label: "Cr\u00e9er mon compte", onClick: () => window.location.href = "/signup" },
    })
  }

  return (
    <div className="space-y-4 pb-8">

      {/* ── Tip identité — bannière horizontale ── */}
      {!tipDismissed && (
        <div className="flex items-center gap-4 px-5 py-3.5 rounded-2xl bg-gradient-to-r from-blue-50 via-blue-50/80 to-transparent dark:from-blue-950/40 dark:via-blue-950/20 dark:to-transparent border border-blue-100 dark:border-blue-900/40">
          <div className="w-9 h-9 rounded-xl bg-[#2563EB]/10 dark:bg-[#2563EB]/20 flex items-center justify-center shrink-0">
            <Sparkles className="w-[18px] h-[18px] text-[#2563EB] dark:text-[#60A5FA]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-[#0F172A] dark:text-[#E2E8F0]">
              Personnalisez vos factures
            </p>
            <p className="text-[12px] text-slate-500 dark:text-slate-400 hidden sm:block">
              Cr&eacute;ez votre compte pour ajouter votre logo et votre identit&eacute; visuelle.
            </p>
          </div>
          <Link
            href="/signup"
            className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold text-[#2563EB] dark:text-[#60A5FA] bg-white dark:bg-[#162032] border border-blue-200 dark:border-blue-800 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors shrink-0"
          >
            Cr&eacute;er mon compte
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <button onClick={() => setTipDismissed(true)} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Bandeau démo ── */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl text-sm">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span className="text-amber-700 dark:text-amber-300">
            <span className="font-semibold">Mode d&eacute;mo</span> — Tu peux explorer le formulaire mais l&apos;envoi est d&eacute;sactiv&eacute;.
          </span>
        </div>
        <Link href="/signup" className="text-xs font-semibold text-[#2563EB] hover:underline whitespace-nowrap">
          Cr&eacute;er mon compte &rarr;
        </Link>
      </div>

      {/* ── Section 1 : Infos de facturation ── */}
      <div className="rounded-2xl border border-white/60 p-5 space-y-4 dark:border-[#1E3A5F]" style={cardStyle}>
        <h2 className="text-[15px] font-bold text-[#0F172A] dark:text-[#E2E8F0] flex items-center gap-2">
          <span className="w-6 h-6 rounded-lg bg-[#EFF6FF] dark:bg-[#162032] flex items-center justify-center text-[#2563EB] text-xs font-bold">1</span>
          Informations de facturation
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Client */}
          <div className="sm:col-span-1">
            <label className={labelCls}>Client *</label>
            <select
              value={form.client_id}
              onChange={setField("client_id")}
              className={`${inputCls} ${errors.client_id ? "border-red-400 ring-1 ring-red-400" : ""}`}
            >
              <option value="">S&eacute;lectionner un client&hellip;</option>
              {MOCK_CLIENTS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {errors.client_id && <p className="text-xs text-red-500 mt-1">{errors.client_id}</p>}
          </div>

          {/* Date émission */}
          <div>
            <label className={labelCls}>Date d&apos;&eacute;mission *</label>
            <input
              type="date"
              className={`${inputCls} font-mono ${errors.issue_date ? "border-red-400" : ""}`}
              value={form.issue_date}
              onChange={setField("issue_date")}
            />
            {errors.issue_date && <p className="text-xs text-red-500 mt-1">{errors.issue_date}</p>}
          </div>

          {/* Date échéance */}
          <div>
            <label className={labelCls}>Date d&apos;&eacute;ch&eacute;ance *</label>
            <input
              type="date"
              className={`${inputCls} font-mono ${errors.due_date ? "border-red-400" : ""}`}
              value={form.due_date}
              onChange={setField("due_date")}
            />
            {errors.due_date && <p className="text-xs text-red-500 mt-1">{errors.due_date}</p>}
          </div>
        </div>
      </div>

      {/* ── Section 2 : Prestations ── */}
      <div className="rounded-2xl border border-white/60 p-5 space-y-4 dark:border-[#1E3A5F]" style={cardStyle}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[15px] font-bold text-[#0F172A] dark:text-[#E2E8F0] flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-[#EFF6FF] dark:bg-[#162032] flex items-center justify-center text-[#2563EB] text-xs font-bold">2</span>
            Prestations
          </h2>
          <div className="flex items-center gap-2">
            <DemoProductCombobox onSelect={insertFromProduct} />
            <button
              type="button"
              onClick={addLine}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-[#E2E8F0] bg-white dark:bg-[#162032] border border-[#E2E8F0] dark:border-[#1E3A5F] rounded-xl hover:bg-[#F8FAFC] dark:hover:bg-[#162032]/60 hover:border-[#2563EB] hover:text-[#2563EB] transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Ajouter une ligne
            </button>
          </div>
        </div>

        {/* En-têtes desktop */}
        <div className="hidden sm:grid grid-cols-12 gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 pb-1 border-b border-[#F1F5F9] dark:border-[#162032]">
          <div className="col-span-5">Description</div>
          <div className="col-span-2 text-right">Qt&eacute;</div>
          <div className="col-span-2 text-right">Prix HT (&euro;)</div>
          <div className="col-span-2 text-center">TVA</div>
          <div className="col-span-1" />
        </div>

        <div className="space-y-3">
          {form.lines.map((line, index) => {
            const calc      = computedLines[index]
            const hasValues = (parseFloat(line.quantity) > 0) && (parseFloat(line.unit_price_ht) > 0)
            return (
              <div
                key={line.id}
                className="rounded-xl border border-[#F1F5F9] p-3 sm:p-0 sm:border-0 sm:rounded-none bg-[#FAFBFC]/60 sm:bg-transparent dark:border-[#162032] dark:bg-[#162032]/40 sm:dark:bg-transparent"
              >
                <div className="grid grid-cols-12 gap-2 items-start">
                  {/* Description */}
                  <div className="col-span-12 sm:col-span-5">
                    <input
                      placeholder="Description de la prestation"
                      className={`${inputCls} ${errors[`line_${index}_desc`] ? "border-red-400" : ""}`}
                      value={line.description}
                      onChange={setLine(line.id, "description")}
                    />
                    {errors[`line_${index}_desc`] && (
                      <p className="text-xs text-red-500 mt-0.5">{errors[`line_${index}_desc`]}</p>
                    )}
                  </div>

                  {/* Qté */}
                  <div className="col-span-4 sm:col-span-2">
                    <label className="text-[10px] text-slate-400 sm:hidden block mb-0.5">Qt&eacute;</label>
                    <input
                      type="number" min="0" step="0.01" placeholder="1"
                      className={`${inputCls} text-right font-mono ${errors[`line_${index}_qty`] ? "border-red-400" : ""}`}
                      value={line.quantity}
                      onChange={setLine(line.id, "quantity")}
                    />
                  </div>

                  {/* Prix HT */}
                  <div className="col-span-4 sm:col-span-2">
                    <label className="text-[10px] text-slate-400 sm:hidden block mb-0.5">Prix HT</label>
                    <input
                      type="number" min="0" step="0.01" placeholder="0.00"
                      className={`${inputCls} text-right font-mono ${errors[`line_${index}_price`] ? "border-red-400" : ""}`}
                      value={line.unit_price_ht}
                      onChange={setLine(line.id, "unit_price_ht")}
                    />
                  </div>

                  {/* TVA */}
                  <div className="col-span-3 sm:col-span-2">
                    <label className="text-[10px] text-slate-400 sm:hidden block mb-0.5">TVA</label>
                    <select
                      value={line.vat_rate}
                      onChange={setLine(line.id, "vat_rate")}
                      className={`${inputCls} font-mono`}
                    >
                      {VAT_RATES.map(rate => (
                        <option key={rate} value={rate}>{rate}%</option>
                      ))}
                    </select>
                  </div>

                  {/* Supprimer */}
                  <div className="col-span-1 flex items-center justify-center pt-1">
                    {form.lines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeLine(line.id)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Sous-total ligne */}
                {hasValues && (
                  <div className="flex justify-end text-xs text-slate-400 mt-2 gap-2 flex-wrap">
                    <span>HT : <span className="font-mono font-semibold text-[#0F172A] dark:text-[#E2E8F0]">{formatCurrency(calc.totalHT)}</span></span>
                    <span className="text-slate-200 dark:text-slate-700">&middot;</span>
                    <span>TVA : <span className="font-mono">{formatCurrency(calc.totalVAT)}</span></span>
                    <span className="text-slate-200 dark:text-slate-700">&middot;</span>
                    <span className="font-semibold text-[#0F172A] dark:text-[#E2E8F0]">TTC : <span className="font-mono">{formatCurrency(calc.totalTTC)}</span></span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Section 3 + 4 : Notes + Récap ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Notes */}
        <div className="rounded-2xl border border-white/60 p-5 dark:border-[#1E3A5F]" style={cardStyle}>
          <h2 className="text-[15px] font-bold text-[#0F172A] dark:text-[#E2E8F0] mb-3 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-[#EFF6FF] dark:bg-[#162032] flex items-center justify-center text-[#2563EB] text-xs font-bold">3</span>
            Notes
          </h2>
          <textarea
            placeholder="Paiement par virement bancaire sous 30 jours. P&eacute;nalit&eacute;s de retard : 3 fois le taux l&eacute;gal."
            rows={4}
            value={form.notes}
            onChange={setField("notes")}
            className="w-full px-3 py-2.5 text-sm border border-[#E2E8F0] dark:border-[#1E3A5F] rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-[#2563EB] text-slate-600 dark:text-[#E2E8F0] bg-white/80 dark:bg-[#162032] transition-shadow"
          />
        </div>

        {/* Récap */}
        <div className="rounded-2xl border border-white/60 p-5 dark:border-[#1E3A5F]" style={cardStyle}>
          <h2 className="text-[15px] font-bold text-[#0F172A] dark:text-[#E2E8F0] mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-[#EFF6FF] dark:bg-[#162032] flex items-center justify-center text-[#2563EB] text-xs font-bold">4</span>
            R&eacute;capitulatif
          </h2>
          <div className="space-y-2.5">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Sous-total HT</span>
              <span className="font-mono font-semibold text-[#0F172A] dark:text-[#E2E8F0]">{formatCurrency(totals.subtotal_ht)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">TVA</span>
              <span className="font-mono text-slate-600 dark:text-slate-400">{formatCurrency(totals.total_vat)}</span>
            </div>
            <div className="h-px bg-[#E2E8F0] dark:bg-[#1E3A5F] my-1" />
            <div className="flex justify-between">
              <span className="font-bold text-[#0F172A] dark:text-[#E2E8F0]">Total TTC</span>
              <span className="font-mono text-2xl font-extrabold text-[#2563EB]">{formatCurrency(totals.total_ttc)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Actions — démo ── */}
      <div
        className="rounded-2xl border border-white/60 p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 dark:border-[#1E3A5F]"
        style={cardStyle}
      >
        <button
          type="button"
          onClick={() => handleDemoAction("draft")}
          className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-[#E2E8F0] bg-white dark:bg-[#162032] border border-[#E2E8F0] dark:border-[#1E3A5F] rounded-xl hover:bg-[#F8FAFC] dark:hover:bg-[#162032]/60 hover:border-slate-300 transition-colors w-full sm:w-auto"
        >
          Sauvegarder en brouillon
        </button>

        <button
          type="button"
          onClick={() => handleDemoAction("preview")}
          className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-[#E2E8F0] bg-white dark:bg-[#162032] border border-[#E2E8F0] dark:border-[#1E3A5F] rounded-xl hover:bg-[#F8FAFC] dark:hover:bg-[#162032]/60 hover:border-slate-300 transition-colors w-full sm:w-auto"
        >
          <Eye className="w-4 h-4" />
          Aper&ccedil;u PDF
        </button>

        <button
          type="button"
          onClick={() => handleDemoAction("send")}
          className="flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-[#2563EB] hover:bg-[#1D4ED8] active:bg-[#1E40AF] rounded-xl transition-colors w-full sm:w-auto sm:ml-auto shadow-sm"
        >
          <Send className="w-4 h-4" />
          Envoyer la facture
          <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
        </button>
      </div>

    </div>
  )
}
