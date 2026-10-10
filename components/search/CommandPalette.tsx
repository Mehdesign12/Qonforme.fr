'use client'

/**
 * Palette de commandes (⌘K / Ctrl+K) : rechercher un client, une facture, un
 * devis, ou lancer une action. Montée par l'en-tête (réel et démo) ; la source
 * des résultats est injectée (`search`), le reste est identique.
 *
 * Ouverture : raccourci clavier, bouton loupe de l'en-tête, ou l'événement
 * window « qonforme:open-palette ».
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Command } from "cmdk"
import {
  BellRing, FileCheck2, FileText, HardHat, LayoutDashboard, Loader2, Package, Plus, Search,
  Settings, ShoppingCart, Users, Wallet, CreditCard, RotateCcw,
} from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { formatCurrency, INVOICE_STATUS_LABELS, QUOTE_STATUS_LABELS } from "@/lib/utils/invoice"
import { EMPTY_RESULTS, fold, type SearchResults } from "@/lib/search/types"
import { FEATURES } from "@/lib/features"
import type { InvoiceStatus, QuoteStatus } from "@/types"

export const OPEN_PALETTE_EVENT = "qonforme:open-palette"

export function openPalette() {
  window.dispatchEvent(new Event(OPEN_PALETTE_EVENT))
}

interface Props {
  /** Préfixe des liens : "" (tableau de bord) ou "/demo" */
  base:   "" | "/demo"
  search: (q: string) => Promise<SearchResults>
}

type Entry = { id: string; label: string; hint?: string; icon: React.ElementType; href: string; keywords: string }

export function CommandPalette({ base, search }: Props) {
  const router = useRouter()
  const [open, setOpen]       = useState(false)
  const [q, setQ]             = useState("")
  const [res, setRes]         = useState<SearchResults>(EMPTY_RESULTS)
  const [loading, setLoading] = useState(false)
  const reqId = useRef(0)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    const onOpen = () => setOpen(true)
    window.addEventListener("keydown", onKey)
    window.addEventListener(OPEN_PALETTE_EVENT, onOpen)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener(OPEN_PALETTE_EVENT, onOpen)
    }
  }, [])

  // recherche distante, la dernière requête l'emporte
  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) { setRes(EMPTY_RESULTS); setLoading(false); return }
    const id = ++reqId.current
    setLoading(true)
    const t = setTimeout(async () => {
      try {
        const r = await search(term)
        if (id === reqId.current) setRes(r)
      } catch {
        if (id === reqId.current) setRes(EMPTY_RESULTS)
      } finally {
        if (id === reqId.current) setLoading(false)
      }
    }, 180)
    return () => clearTimeout(t)
  }, [q, search])

  const actions: Entry[] = useMemo(() => [
    { id: "new-invoice", label: "Nouvelle facture", icon: Plus, href: `${base}/invoices/new`, keywords: "creer facture" },
    { id: "new-quote", label: "Nouveau devis", icon: Plus, href: `${base}/quotes/new`, keywords: "creer devis" },
    { id: "new-client", label: "Nouveau client", icon: Plus, href: `${base}/clients/new`, keywords: "creer client siren" },
    ...(FEATURES.chantiers ? [{ id: "new-chantier", label: "Nouveau chantier", icon: Plus, href: `${base}/chantiers/new`, keywords: "creer chantier" }] : []),
  ], [base])

  const pages: Entry[] = useMemo(() => [
    { id: "p-home", label: "Tableau de bord", icon: LayoutDashboard, href: base || "/dashboard", keywords: "accueil" },
    { id: "p-invoices", label: "Factures", icon: FileText, href: `${base}/invoices`, keywords: "factures" },
    { id: "p-quotes", label: "Devis", icon: FileCheck2, href: `${base}/quotes`, keywords: "devis" },
    { id: "p-clients", label: "Clients", icon: Users, href: `${base}/clients`, keywords: "clients" },
    ...(FEATURES.chantiers ? [{ id: "p-chantiers", label: "Chantiers", icon: HardHat, href: `${base}/chantiers`, keywords: "chantiers marche lots" }] : []),
    { id: "p-po", label: "Bons de commande", icon: ShoppingCart, href: `${base}/purchase-orders`, keywords: "bdc bons commande" },
    { id: "p-credit", label: "Avoirs", icon: RotateCcw, href: `${base}/credit-notes`, keywords: "avoirs" },
    { id: "p-products", label: "Catalogue produits", icon: Package, href: `${base}/products`, keywords: "catalogue prestations produits" },
    { id: "p-treso", label: "Trésorerie", icon: Wallet, href: `${base}/tresorerie`, keywords: "tresorerie prevision encaissements" },
    { id: "p-relances", label: "Relances", icon: BellRing, href: `${base}/relances`, keywords: "relances impayes retard" },
    { id: "p-settings", label: "Paramètres", icon: Settings, href: `${base}/settings`, keywords: "parametres reglages entreprise" },
    ...(base ? [] : [{ id: "p-billing", label: "Abonnement", icon: CreditCard, href: "/settings/billing", keywords: "abonnement formule facturation" }]),
  ], [base])

  const term = fold(q)
  const match = (e: Entry) => !term || fold(e.label).includes(term) || e.keywords.includes(term)
  const shownActions = actions.filter(match)
  const shownPages = pages.filter(match)
  const hasDocs = res.clients.length + res.invoices.length + res.quotes.length > 0

  const go = useCallback((href: string) => {
    setOpen(false)
    setQ("")
    router.push(href)
  }, [router])

  const item = "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] text-[#0F172A] dark:text-[#E2E8F0] cursor-pointer select-none data-[selected=true]:bg-[#EEF3FF] dark:data-[selected=true]:bg-[#1E3A5F]"
  const heading = "[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-slate-400"

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setQ("") }}>
      <DialogContent
        showCloseButton={false}
        className="top-[12vh] translate-y-0 sm:max-w-[600px] p-0 gap-0 overflow-hidden rounded-2xl bg-white dark:bg-[#0F1E35] ring-[#E2E8F0] dark:ring-[#1E3A5F]"
      >
        <DialogTitle className="sr-only">Rechercher ou lancer une action</DialogTitle>
        <DialogDescription className="sr-only">Clients, factures, devis et pages de Qonforme</DialogDescription>
        <Command shouldFilter={false} label="Rechercher ou lancer une action" className={heading}>
          <div className="flex items-center gap-3 px-4 border-b border-[#EEF1F5] dark:border-[#1E3A5F]">
            {loading ? <Loader2 className="w-4 h-4 text-[#2563EB] animate-spin shrink-0" /> : <Search className="w-4 h-4 text-slate-400 shrink-0" />}
            <Command.Input
              value={q}
              onValueChange={setQ}
              placeholder="Rechercher un client, une facture, un devis…"
              className="flex-1 h-14 bg-transparent outline-none text-base md:text-[15px] text-[#0F172A] dark:text-[#E2E8F0] placeholder:text-slate-400"
            />
            <kbd className="hidden md:inline-flex items-center rounded-md border border-[#E2E8F0] dark:border-[#1E3A5F] px-1.5 py-0.5 text-[11px] font-mono text-slate-400">Échap</kbd>
          </div>
          <Command.List className="max-h-[min(60vh,440px)] overflow-y-auto p-2">
            {!shownActions.length && !shownPages.length && !hasDocs && !loading && (
              <Command.Empty className="px-3 py-10 text-center text-sm text-slate-500">
                {term.length < 2 ? "Tapez au moins deux lettres" : `Aucun résultat pour « ${q.trim()} »`}
              </Command.Empty>
            )}

            {res.clients.length > 0 && (
              <Command.Group heading="Clients">
                {res.clients.map((c) => (
                  <Command.Item key={c.id} value={`client-${c.id}`} onSelect={() => go(`${base}/clients/${c.id}`)} className={item}>
                    <span className="w-8 h-8 rounded-lg bg-[#F1F5F9] dark:bg-[#162032] grid place-items-center text-[11px] font-bold text-[#475569] dark:text-slate-300 shrink-0">
                      {c.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                    </span>
                    <span className="flex-1 min-w-0"><span className="block font-semibold truncate">{c.name}</span>{c.sub && <span className="block text-[12px] text-slate-500 truncate">{c.sub}</span>}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {res.invoices.length > 0 && (
              <Command.Group heading="Factures">
                {res.invoices.map((d) => (
                  <Command.Item key={d.id} value={`invoice-${d.id}`} onSelect={() => go(`${base}/invoices/${d.id}`)} className={item}>
                    <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="flex-1 min-w-0"><span className="font-mono font-bold text-[#2563EB]">{d.number}</span> <span className="text-slate-500">· {d.client}</span></span>
                    <span className="hidden sm:block text-[12px] text-slate-500">{INVOICE_STATUS_LABELS[d.status as InvoiceStatus] ?? d.status}</span>
                    <span className="font-mono text-[13px] font-bold">{formatCurrency(d.amount)}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {res.quotes.length > 0 && (
              <Command.Group heading="Devis">
                {res.quotes.map((d) => (
                  <Command.Item key={d.id} value={`quote-${d.id}`} onSelect={() => go(`${base}/quotes/${d.id}`)} className={item}>
                    <FileCheck2 className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="flex-1 min-w-0"><span className="font-mono font-bold text-[#2563EB]">{d.number}</span> <span className="text-slate-500">· {d.client}</span></span>
                    <span className="hidden sm:block text-[12px] text-slate-500">{QUOTE_STATUS_LABELS[d.status as QuoteStatus] ?? d.status}</span>
                    <span className="font-mono text-[13px] font-bold">{formatCurrency(d.amount)}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {shownActions.length > 0 && (
              <Command.Group heading="Actions">
                {shownActions.map((a) => (
                  <Command.Item key={a.id} value={a.id} onSelect={() => go(a.href)} className={item}>
                    <span className="w-8 h-8 rounded-lg bg-[#EEF3FF] dark:bg-[#1E3A5F] grid place-items-center shrink-0"><a.icon className="w-4 h-4 text-[#2563EB]" /></span>
                    <span className="font-semibold">{a.label}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {shownPages.length > 0 && (
              <Command.Group heading="Aller à">
                {shownPages.map((p) => (
                  <Command.Item key={p.id} value={p.id} onSelect={() => go(p.href)} className={item}>
                    <p.icon className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>{p.label}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>
          <div className="hidden md:flex items-center gap-4 px-4 py-2.5 border-t border-[#EEF1F5] dark:border-[#1E3A5F] text-[11px] text-slate-400">
            <span><kbd className="font-mono">↑↓</kbd> naviguer</span>
            <span><kbd className="font-mono">↵</kbd> ouvrir</span>
            <span className="ml-auto"><kbd className="font-mono">⌘K</kbd> ou <kbd className="font-mono">Ctrl K</kbd> pour rouvrir</span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
