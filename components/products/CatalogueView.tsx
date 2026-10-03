"use client"

/**
 * Catalogue des prestations (planches « Catalogue », « Catalogue-neuf », « Mobile-catalogue »).
 * Présentation partagée par /products (données de l'API) et /demo/products
 * (lib/demo/data.ts) : la page fournit les lignes, la recherche et les actions.
 *
 * Écarts avec la planche : pas de catégories ni de « Utilisée dans N devis »
 * (le produit n'a pas ces champs). « Importer » propose les prestations
 * courantes du métier, cochées par l'artisan, sans prix
 * (components/products/TradeImportDialog.tsx) ; une prestation à 0 € est
 * signalée « Prix à compléter ».
 */
import { useState } from "react"
import Link from "next/link"
import { Archive, ArchiveRestore, Check, FileCheck2, ListPlus, Loader2, Package, Pencil, Plus, X } from "lucide-react"
import { EmptyState, PageHeader, SearchField } from "@/components/app/kit"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { formatCurrency, VAT_RATES } from "@/lib/utils/invoice"
import { cn } from "@/lib/utils"
import type { TradeId, VatRegime } from "@/lib/legal/profile"
import { TradeImportDialog, type TradeImportRequest } from "@/components/products/TradeImportDialog"

export interface CatalogueProduct {
  id: string
  name: string
  description: string | null
  unit_price_ht: number
  vat_rate: number
  unit: string | null
  reference: string | null
  is_active: boolean
}

/** Champs envoyés à l'API à l'enregistrement. */
export interface ProductInput {
  name: string
  description: string | null
  unit_price_ht: number
  vat_rate: number
  unit: string | null
  reference: string | null
}

type Tab = "active" | "inactive"

/** Unités proposées (la colonne est libre : une unité déjà saisie hors liste reste proposée). */
const UNIT_OPTIONS = ["m²", "ml", "m³", "unité", "pièce", "heure", "jour", "mois", "forfait", "km"]

/** TVA du plus courant au plus rare, comme la planche. */
const VAT_OPTIONS = [...VAT_RATES].reverse()

export const formatVat = (rate: number) => `${String(rate).replace(".", ",")} %`

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`


/** Prix d'une prestation : « Prix à compléter » à 0 € (prestation importée sans prix). */
function PriceCell({ value, className }: { value: number; className?: string }) {
  if (Number(value) > 0) return <span className={className}>{formatCurrency(value)}</span>
  return <span className="q-pill q-pill-warn">Prix à compléter</span>
}

/** Prix saisi à la française (« 1 250,50 ») → nombre, ou NaN. */
function parsePrice(raw: string): number {
  const clean = raw.replace(/[\s  €]/g, "").replace(",", ".")
  if (!/^-?\d+(\.\d+)?$|^-?\.\d+$/.test(clean)) return NaN
  return Number(clean)
}

/** Prix stocké → champ (« 22,00 ») sans perdre de décimales au-delà du centime. */
function priceToField(n: number): string {
  const cents = Math.abs(Math.round(n * 100) - n * 100) < 1e-6
  return (cents ? n.toFixed(2) : String(n)).replace(".", ",")
}

export function CatalogueView({
  products,
  totals,
  query,
  onQueryChange,
  onSave,
  onToggleActive,
  quoteHref,
  error,
  onRetry,
  importer,
}: {
  /** null pendant le premier chargement. Déjà filtrées par la recherche. */
  products: CatalogueProduct[] | null
  /** Effectifs du catalogue entier (hors recherche), pour le sous-titre. */
  totals: { active: number; inactive: number } | null
  query: string
  onQueryChange: (value: string) => void
  /** Crée (product = null) ou met à jour ; renvoie true si c'est enregistré. */
  onSave: (input: ProductInput, product: CatalogueProduct | null) => Promise<boolean> | boolean
  /** Désactive ou réactive ; renvoie true si c'est fait. */
  onToggleActive: (product: CatalogueProduct) => Promise<boolean> | boolean
  /** « Faire un devis » de l'état vide. */
  quoteHref: string
  error?: string | null
  onRetry?: () => void
  /** Import des prestations courantes du métier (profil de Paramètres › Entreprise). */
  importer?: {
    trade: TradeId | null
    vatRegime: VatRegime | null
    onImport: (request: TradeImportRequest) => Promise<boolean> | boolean
  }
}) {
  const [tab, setTab] = useState<Tab>("active")
  /** Fenêtre de saisie : "new", une prestation, ou fermée. */
  const [editing, setEditing] = useState<CatalogueProduct | "new" | null>(null)
  const [confirming, setConfirming] = useState<CatalogueProduct | null>(null)
  const [toggling, setToggling] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  async function runToggle(p: CatalogueProduct) {
    setToggling(true)
    try {
      await onToggleActive(p)
      setConfirming(null)
    } finally {
      setToggling(false)
    }
  }

  /** Désactiver demande confirmation ; réactiver est immédiat. */
  function requestToggle(p: CatalogueProduct) {
    setEditing(null)
    if (p.is_active) setConfirming(p)
    else void runToggle(p)
  }

  const subtitleCount = totals ? plural(totals.active, "prestation", "prestations") : null
  const subtitle = subtitleCount ? (
    <>
      {subtitleCount} · prix nets HT<span className="hidden md:inline">, TVA par ligne</span>
    </>
  ) : "Chargement…"

  const headerActions = (
    <>
      {importer && (
        <>
          <Button variant="outline" className="hidden md:inline-flex" onClick={() => setImportOpen(true)}>
            <ListPlus aria-hidden />
            Importer
          </Button>
          <button
            type="button"
            aria-label="Importer les prestations de votre métier"
            onClick={() => setImportOpen(true)}
            className="q-btn q-btn-secondary q-btn-icon !size-11 !rounded-[14px] md:hidden"
          >
            <ListPlus className="!size-5" strokeWidth={2} aria-hidden />
          </button>
        </>
      )}
      <Button className="hidden md:inline-flex" onClick={() => setEditing("new")}>
        <Plus strokeWidth={2.25} aria-hidden />
        Nouvelle prestation
      </Button>
      <button
        type="button"
        aria-label="Nouvelle prestation"
        onClick={() => setEditing("new")}
        className="q-btn q-btn-secondary q-btn-icon !size-11 !rounded-[14px] md:hidden"
      >
        <Plus className="!size-5" strokeWidth={2} aria-hidden />
      </button>
    </>
  )

  const dialogs = (
    <>
      {importer && (
        <TradeImportDialog
          key={importOpen ? `import-${importer.trade ?? ""}-${importer.vatRegime ?? ""}` : "import-closed"}
          open={importOpen}
          onClose={() => setImportOpen(false)}
          trade={importer.trade}
          vatRegime={importer.vatRegime}
          existingNames={(products ?? []).map((p) => p.name)}
          onImport={importer.onImport}
        />
      )}
      <ProductDialog
        key={editing === null ? "closed" : editing === "new" ? "new" : editing.id}
        product={editing}
        onClose={() => setEditing(null)}
        onSave={onSave}
        onToggle={requestToggle}
      />
      <Dialog open={confirming !== null} onOpenChange={(open) => { if (!open && !toggling) setConfirming(null) }}>
        <DialogContent showCloseButton={false} className="gap-3 sm:max-w-md">
          <DialogTitle className="q-display text-[22px] font-semibold leading-tight">
            Désactiver «&nbsp;{confirming?.name}&nbsp;»&nbsp;?
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-[var(--q-text-3)]">
            Elle n&apos;est plus proposée dans vos devis et factures. Les documents qui la contiennent
            ne changent pas, et vous pouvez la réactiver à tout moment depuis l&apos;onglet «&nbsp;Inactives&nbsp;».
          </DialogDescription>
          <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setConfirming(null)} disabled={toggling}>Annuler</Button>
            <Button onClick={() => confirming && void runToggle(confirming)} disabled={toggling}>
              {toggling ? <Loader2 className="animate-spin" aria-hidden /> : <Archive aria-hidden />}
              Désactiver
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )

  /* ── Chargement, erreur ─────────────────────────────────────────── */
  if (products === null) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="Catalogue" subtitle={error ? "Catalogue indisponible" : "Chargement…"} actions={headerActions} />
        <div className="q-card">
          {error ? (
            <EmptyState
              title="Le catalogue n'a pas pu être chargé"
              text={error}
              action={onRetry && <Button variant="outline" onClick={onRetry}>Réessayer</Button>}
            />
          ) : (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="size-6 animate-spin text-[var(--q-accent)]" aria-label="Chargement" />
            </div>
          )}
        </div>
        {dialogs}
      </div>
    )
  }

  /* ── Catalogue vide (compte neuf) ───────────────────────────────── */
  if (products.length === 0 && !query.trim() && (totals?.active ?? 0) + (totals?.inactive ?? 0) === 0) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="Catalogue" subtitle="Aucune prestation pour l'instant · prix nets HT" actions={headerActions} />
        <div className="q-banner flex-wrap items-center">
          <Package className="size-5 shrink-0" strokeWidth={1.75} aria-hidden />
          <p className="min-w-[220px] flex-1 text-[15px] leading-snug">
            <strong className="font-semibold">Saisissez vos prix une fois.</strong>{" "}
            Vous les retrouvez dans chaque devis et chaque facture, et vous les ajustez à tout moment.
          </p>
          <Link href={quoteHref} className="q-btn q-btn-secondary w-full sm:w-auto">
            <FileCheck2 aria-hidden />
            Faire un devis
          </Link>
        </div>
        <section aria-label="Liste des prestations" className="q-card">
          <EmptyState
            icon={<Package className="size-6" strokeWidth={1.75} />}
            title="Votre catalogue est vide"
            text={importer
              ? "Partez des prestations courantes de votre métier : désignation, unité et taux de TVA proposés, vos prix à compléter. Ou ajoutez les vôtres une à une."
              : "Ajoutez vos prestations et fournitures courantes avec leur unité, leur prix net HT et leur taux de TVA."}
            action={
              <div className="flex flex-col items-center gap-2 sm:flex-row">
                {importer && (
                  <Button onClick={() => setImportOpen(true)}>
                    <ListPlus aria-hidden />
                    Importer les prestations de votre métier
                  </Button>
                )}
                <Button variant={importer ? "outline" : "default"} onClick={() => setEditing("new")}>
                  <Plus strokeWidth={2.25} aria-hidden />
                  Nouvelle prestation
                </Button>
              </div>
            }
          />
        </section>
        {dialogs}
      </div>
    )
  }

  const active = products.filter((p) => p.is_active)
  const inactive = products.filter((p) => !p.is_active)
  const visible = tab === "active" ? active : inactive
  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "active", label: "Actives", count: active.length },
    { key: "inactive", label: "Inactives", count: inactive.length },
  ]
  const noMatch = (
    <p className="px-5 py-10 text-center text-[15px] text-[var(--q-text-3)]">
      {query.trim()
        ? "Aucune prestation ne correspond à cette recherche."
        : tab === "inactive" ? "Aucune prestation désactivée." : "Aucune prestation active."}
    </p>
  )

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Catalogue" subtitle={subtitle} actions={headerActions} />

      {error && (
        <div role="alert" className="q-banner q-banner-warn items-center">
          <p className="flex-1">La liste n&apos;a pas pu être actualisée. {error}</p>
          {onRetry && <Button variant="outline" size="sm" onClick={onRetry}>Réessayer</Button>}
        </div>
      )}

      <div className="flex flex-col gap-3 md:gap-4">
        {/* Filtres : pastilles sur mobile, onglets soulignés sur ordinateur */}
        <div className="order-2 md:order-1">
          <div role="tablist" aria-label="Filtrer les prestations" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] md:hidden">
            {tabs.map((t) => {
              const on = tab === t.key
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    "inline-flex h-[38px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-sm",
                    on
                      ? "border-[var(--q-ink-strong)] bg-[var(--q-ink-strong)] font-semibold text-[var(--q-surface)]"
                      : "border-[var(--q-field)] bg-[var(--q-surface)] font-medium text-[var(--q-text-2)]",
                  )}
                >
                  {t.label}
                  <span className={cn("text-xs tabular-nums", on ? "opacity-70" : "text-[var(--q-text-4)]")}>{t.count}</span>
                </button>
              )
            })}
          </div>
          <div role="tablist" aria-label="Filtrer les prestations" className="q-tabs hidden md:flex">
            {tabs.map((t) => {
              const on = tab === t.key
              return (
                <button key={t.key} type="button" role="tab" aria-selected={on} onClick={() => setTab(t.key)}>
                  {t.label}
                  <span className={cn("q-count", on && "rounded-md bg-[var(--q-wash)] px-[7px] py-px font-semibold")}>{t.count}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="order-1 md:order-2">
          <SearchField
            value={query}
            onChange={onQueryChange}
            placeholder="Prestation, référence…"
            aria-label="Rechercher une prestation"
            className="h-12 rounded-2xl md:h-9 md:max-w-[300px] md:rounded-[9px]"
          />
        </div>
      </div>

      {/* Tableau (ordinateur) */}
      <section aria-label="Liste des prestations" className="q-card hidden overflow-hidden md:block">
        {visible.length === 0 ? noMatch : (
          <div className="overflow-x-auto">
            <table className="q-table min-w-[760px] [&_th]:border-t-0">
              <thead>
                <tr className="bg-[var(--q-surface-2)]">
                  <th scope="col">Prestation</th>
                  <th scope="col">Référence</th>
                  <th scope="col">Unité</th>
                  <th scope="col" className="is-num">Prix net HT</th>
                  <th scope="col">TVA</th>
                  <th scope="col" className="w-[96px]"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((p) => (
                  <tr key={p.id}>
                    <td className="max-w-[460px]">
                      <span className="block font-semibold">{p.name}</span>
                      {p.description && (
                        <span className="mt-0.5 block truncate text-[13px] text-[var(--q-text-4)]">{p.description}</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap font-mono text-[13px] text-[var(--q-text-3)]">{p.reference || "—"}</td>
                    <td className="whitespace-nowrap text-[var(--q-text-3)]">{p.unit || "—"}</td>
                    <td className="is-num whitespace-nowrap font-semibold"><PriceCell value={p.unit_price_ht} /></td>
                    <td className="whitespace-nowrap tabular-nums text-[var(--q-text-3)]">{formatVat(p.vat_rate)}</td>
                    <td>
                      <div className="flex items-center justify-end gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-[var(--q-text-4)]"
                          aria-label={`Modifier ${p.name}`}
                          title="Modifier"
                          onClick={() => setEditing(p)}
                        >
                          <Pencil aria-hidden />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-[var(--q-text-4)]"
                          aria-label={`${p.is_active ? "Désactiver" : "Réactiver"} ${p.name}`}
                          title={p.is_active ? "Désactiver" : "Réactiver"}
                          onClick={() => requestToggle(p)}
                          disabled={toggling}
                        >
                          {p.is_active ? <Archive aria-hidden /> : <ArchiveRestore aria-hidden />}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[var(--q-surface-2)] text-[13px] [&>td]:border-t [&>td]:border-[var(--q-line-soft)]">
                  <td colSpan={6} className="text-[var(--q-text-3)]">
                    {plural(visible.length, "prestation", "prestations")}
                    {tab === "inactive" && " désactivée" + (visible.length > 1 ? "s" : "")}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      {/* Liste (mobile) : un appui ouvre la fiche */}
      <section aria-label="Liste des prestations" className="q-card q-list overflow-hidden !rounded-[18px] md:hidden">
        {visible.length === 0 ? noMatch : visible.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setEditing(p)}
            className="q-list-row w-full !gap-3 !px-3.5 !py-2.5 text-left"
          >
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-[15px] font-semibold">{p.name}</span>
              <span className="truncate text-[13px] text-[var(--q-text-4)]">
                {[p.unit, p.reference].filter(Boolean).join(" · ") || "Sans unité"}
              </span>
            </span>
            <span className="flex shrink-0 flex-col items-end gap-1">
              <PriceCell value={p.unit_price_ht} className="text-[15px] font-semibold tabular-nums" />
              <span className="text-[11px] tabular-nums text-[var(--q-text-4)]">TVA {formatVat(p.vat_rate)}</span>
            </span>
          </button>
        ))}
      </section>

      {dialogs}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Fenêtre de saisie : centrée sur ordinateur, feuille du bas sur mobile */
/* ------------------------------------------------------------------ */

type FormState = { name: string; description: string; reference: string; unit: string; price: string; vat: string }
type FormErrors = Partial<Record<"name" | "price", string>>

function ProductDialog({
  product,
  onClose,
  onSave,
  onToggle,
}: {
  product: CatalogueProduct | "new" | null
  onClose: () => void
  onSave: (input: ProductInput, product: CatalogueProduct | null) => Promise<boolean> | boolean
  onToggle: (product: CatalogueProduct) => void
}) {
  const existing = product && product !== "new" ? product : null
  const [form, setForm] = useState<FormState>(() => existing
    ? {
        name: existing.name,
        description: existing.description ?? "",
        reference: existing.reference ?? "",
        unit: existing.unit ?? "",
        price: priceToField(existing.unit_price_ht),
        vat: String(existing.vat_rate),
      }
    : { name: "", description: "", reference: "", unit: "", price: "", vat: "20" })
  const [errors, setErrors] = useState<FormErrors>({})
  const [saving, setSaving] = useState(false)

  const set = (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const value = e.target.value
      setForm((f) => ({ ...f, [key]: value }))
      if (key in errors) setErrors((prev) => { const n = { ...prev }; delete n[key as keyof FormErrors]; return n })
    }

  const unitOptions = form.unit && !UNIT_OPTIONS.includes(form.unit) ? [form.unit, ...UNIT_OPTIONS] : UNIT_OPTIONS
  const price = parsePrice(form.price)
  const ttc = Number.isFinite(price) && price > 0 ? price * (1 + Number(form.vat) / 100) : null

  function validate(): boolean {
    const errs: FormErrors = {}
    if (!form.name.trim()) errs.name = "Indiquez la désignation de la prestation."
    if (form.price.trim() === "" || Number.isNaN(price)) errs.price = "Prix invalide."
    else if (price < 0) errs.price = "Le prix ne peut pas être négatif."
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (saving || !validate()) return
    setSaving(true)
    try {
      const done = await onSave({
        name: form.name.trim(),
        description: form.description.trim() || null,
        unit_price_ht: price,
        vat_rate: Number(form.vat),
        unit: form.unit.trim() || null,
        reference: form.reference.trim() || null,
      }, existing)
      if (done) onClose()
    } finally {
      setSaving(false)
    }
  }

  const fieldBox = "max-md:!h-12 max-md:!rounded-[14px]"

  return (
    <Dialog open={product !== null} onOpenChange={(open) => { if (!open && !saving) onClose() }}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "flex max-h-[calc(100dvh-112px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-none md:max-w-[540px]",
          // Mobile : feuille du bas (planche « Mobile-catalogue »)
          "max-md:inset-x-0 max-md:bottom-0 max-md:top-auto max-md:left-0 max-md:max-h-[88dvh] max-md:w-full max-md:max-w-none",
          "max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-b-none max-md:rounded-t-[24px] max-md:border-x-0 max-md:border-b-0",
        )}
      >
        <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
          <span className="q-sheet-grip md:hidden" aria-hidden />
          <div className="flex items-start justify-between gap-3 px-4 pt-3 md:px-[22px] md:pt-5">
            <div className="flex flex-col gap-1">
              <DialogTitle className="q-display text-[22px] font-semibold leading-tight tracking-[-0.02em]">
                {existing ? "Modifier la prestation" : "Nouvelle prestation"}
              </DialogTitle>
              <DialogDescription className="text-sm text-[var(--q-text-4)]">
                Le prix net est repris dans vos prochains devis et factures.
              </DialogDescription>
            </div>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Fermer" className="hidden shrink-0 md:inline-flex" onClick={onClose} disabled={saving}>
              <X className="!size-[18px]" aria-hidden />
            </Button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-4 pb-4 pt-4 md:px-[22px] md:pb-5 md:pt-[18px]">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="pr-name" className="q-label">Désignation</label>
              <input
                id="pr-name"
                type="text"
                value={form.name}
                onChange={set("name")}
                placeholder="Ex. : Pose de plaques de plâtre BA13"
                aria-invalid={errors.name ? true : undefined}
                aria-describedby={errors.name ? "pr-name-err" : undefined}
                className={cn("q-input", fieldBox)}
              />
              {errors.name && <span id="pr-name-err" className="q-field-error">{errors.name}</span>}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="pr-desc" className="q-label">
                Description <span className="font-normal text-[var(--q-text-4)]">(facultatif)</span>
              </label>
              <textarea
                id="pr-desc"
                rows={2}
                value={form.description}
                onChange={set("description")}
                placeholder="Détail repris sous la ligne du devis"
                className="q-input !min-h-[68px] max-md:!rounded-[14px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-3">
              <div className="flex min-w-0 flex-col gap-1.5">
                <label htmlFor="pr-unit" className="q-label">Unité</label>
                <select id="pr-unit" value={form.unit} onChange={set("unit")} className={cn("q-input pr-2", fieldBox)}>
                  <option value="">Aucune</option>
                  {unitOptions.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div className="flex min-w-0 flex-col gap-1.5">
                <label htmlFor="pr-price" className="q-label">Prix net HT</label>
                <div
                  className={cn(
                    "q-fw flex h-[42px] items-center gap-2 rounded-[10px] border bg-[var(--q-surface)] px-3 max-md:h-12 max-md:rounded-[14px]",
                    errors.price ? "border-[var(--q-danger)]" : "border-[var(--q-field)]",
                  )}
                >
                  <input
                    id="pr-price"
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={form.price}
                    onChange={set("price")}
                    placeholder="0,00"
                    aria-invalid={errors.price ? true : undefined}
                    aria-describedby={errors.price ? "pr-price-err" : undefined}
                    className="h-full w-full min-w-0 bg-transparent text-base tabular-nums text-[var(--q-ink)] outline-none placeholder:text-[var(--q-placeholder)] md:text-[15px]"
                  />
                  <span className="text-[13px] text-[var(--q-text-4)]" aria-hidden>€</span>
                </div>
              </div>
              <div className="flex min-w-0 flex-col gap-1.5">
                <label htmlFor="pr-vat" className="q-label">TVA</label>
                <select id="pr-vat" value={form.vat} onChange={set("vat")} className={cn("q-input pr-2 tabular-nums", fieldBox)}>
                  {VAT_OPTIONS.map((r) => <option key={r} value={String(r)}>{formatVat(r)}</option>)}
                </select>
              </div>
              <div className="flex min-w-0 flex-col gap-1.5">
                <label htmlFor="pr-ref" className="q-label">Référence</label>
                <input
                  id="pr-ref"
                  type="text"
                  value={form.reference}
                  onChange={set("reference")}
                  placeholder="PL-01"
                  autoComplete="off"
                  className={cn("q-input font-mono", fieldBox)}
                />
              </div>
            </div>
            {errors.price ? (
              <span id="pr-price-err" className="q-field-error -mt-1.5">{errors.price}</span>
            ) : ttc !== null && (
              <span className="q-field-hint -mt-1.5 tabular-nums">Soit {formatCurrency(ttc)} TTC l&apos;unité.</span>
            )}
          </div>

          <div
            className="flex flex-col-reverse gap-2 border-t border-[var(--q-line-soft)] bg-[var(--q-surface)] px-4 pt-3 md:flex-row md:items-center md:bg-[var(--q-surface-2)] md:px-[22px] md:py-4"
            style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
          >
            {existing && (
              <Button
                type="button"
                variant="ghost"
                className="max-md:h-11 md:mr-auto"
                onClick={() => onToggle(existing)}
                disabled={saving}
              >
                {existing.is_active ? <Archive aria-hidden /> : <ArchiveRestore aria-hidden />}
                {existing.is_active ? "Désactiver" : "Réactiver"}
              </Button>
            )}
            <Button type="button" variant="ghost" className="hidden md:inline-flex" onClick={onClose} disabled={saving}>
              Annuler
            </Button>
            <Button type="submit" className="max-md:h-[52px] max-md:rounded-2xl max-md:text-base" disabled={saving}>
              {saving ? <Loader2 className="animate-spin" aria-hidden /> : <Check strokeWidth={2.25} aria-hidden />}
              Enregistrer
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
