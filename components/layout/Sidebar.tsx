'use client'

/**
 * Coque de l'application — barre latérale (ordinateur), barre flottante du bas
 * et feuilles « Créer » / « Plus » (mobile). Canevas : planches « Tableau de
 * bord » (barre latérale) et « Mobile — accueil / Plus / Création ».
 *
 * Partagée avec la démo : DemoSidebar.tsx rend ces mêmes composants en mode
 * « demo » (règle « Mode démo » de CLAUDE.md : un seul rendu pour les deux).
 *
 * Mobile : aucun backdrop-filter ni will-change (règle iOS de CLAUDE.md) —
 * la barre du bas est en « verre solide » (.q-float, opaque sous 768 px).
 */
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import {
  Plus, Ellipsis, ChevronRight, ShieldCheck, Sparkles, Bug, MessageSquare,
  LogOut, House, CreditCard, Building2, FileCog, FlaskConical, ArrowRight, Search,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { LOGO_LONG_BLUE, LOGO_LONG_LIGHT } from "@/lib/brand"
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { BugReportModal, ContactModal } from "@/components/layout/SupportModals"
import { Initials } from "@/components/app/kit"
import {
  NAV_MAIN, NAV_PILOTAGE, NAV_SETTINGS, CREATE_LINKS, OPEN_SEARCH_EVENT, hrefFor, isActivePath,
  type NavLink, type ShellMode,
} from "@/components/layout/nav"
import { type ShellIdentity, fullNameOf, formatSiren } from "@/components/layout/shell"
import { useLogout } from "@/components/layout/useLogout"

/* ------------------------------------------------------------------ */
/* Logo                                                                */
/* ------------------------------------------------------------------ */

function Logo({ height = 19 }: { height?: number }) {
  const { resolvedTheme } = useTheme()
  // Garde `mounted` : resolvedTheme est indéfini côté serveur (règle next-themes de CLAUDE.md)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return (
    <Image
      src={mounted && resolvedTheme === "dark" ? LOGO_LONG_LIGHT : LOGO_LONG_BLUE}
      alt="Qonforme"
      width={Math.round(height * 5.4)}
      height={height}
      style={{ height, width: "auto" }}
      sizes="110px"
      priority
    />
  )
}

/* ------------------------------------------------------------------ */
/* Entrée de navigation                                                */
/* ------------------------------------------------------------------ */

function NavItem({ link, mode, pathname, onNavigate }: { link: NavLink; mode: ShellMode; pathname: string; onNavigate?: () => void }) {
  const href = hrefFor(link, mode)
  const active = isActivePath(pathname, href)
  const Icon = link.icon
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-9 items-center gap-2.5 rounded-[9px] px-2.5 text-sm transition-colors",
        active
          ? "bg-[var(--q-wash)] font-semibold text-[var(--q-accent-strong)] shadow-[inset_0_0_0_1px_var(--q-wash-line)]"
          : "font-medium text-[var(--q-text-2)] hover:bg-[var(--q-hover)] hover:text-[var(--q-ink)]",
      )}
    >
      <Icon className="size-[17px] shrink-0" strokeWidth={1.75} aria-hidden />
      <span className="flex-1 truncate">{link.label}</span>
    </Link>
  )
}

/** Carte de l'entreprise (initiales, raison sociale, SIREN) — mène aux réglages de l'entreprise. */
function CompanyCard({ identity, onNavigate }: { identity: ShellIdentity; onNavigate?: () => void }) {
  const siren = formatSiren(identity.siren)
  const href = identity.mode === "demo" ? "/demo/settings/company" : "/settings/company"
  const name = identity.companyName || "Votre entreprise"
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-label={`Entreprise : ${name}`}
      className="flex items-center gap-2.5 rounded-xl border border-[var(--q-line)] bg-[var(--q-surface-2)] p-2 text-[var(--q-ink)] transition-colors hover:border-[var(--q-field)]"
    >
      <Initials name={name} ink />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="line-clamp-2 text-[13px] font-semibold leading-snug">{name}</span>
        <span className="truncate text-xs text-[var(--q-text-4)]">{siren ? `SIREN ${siren}` : "SIREN à compléter"}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-[var(--q-text-4)]" aria-hidden />
    </Link>
  )
}

/** Encart du bas de la barre latérale : formule gratuite → formules ; abonné → où en est la réforme. */
function StatusCard({ identity }: { identity: ShellIdentity }) {
  if (identity.mode === "demo") {
    return (
      <div className="rounded-xl border border-[var(--q-warn-line)] bg-[var(--q-warn-bg)] p-3">
        <p className="flex items-center gap-2 text-[13px] font-semibold text-[var(--q-warn)]">
          <FlaskConical className="size-4" aria-hidden />
          Mode démo
        </p>
        <p className="mt-1 text-xs leading-relaxed text-[var(--q-text-3)]">Données fictives : rien n&apos;est enregistré ni envoyé.</p>
      </div>
    )
  }
  if (!identity.planName) {
    return (
      <Link href="/settings/billing" className="block rounded-xl border border-[var(--q-wash-line)] bg-[var(--q-wash)] p-3 text-[var(--q-ink)]">
        <span className="flex items-center gap-2 text-[13px] font-semibold text-[var(--q-accent-strong)]">
          <Sparkles className="size-4" aria-hidden />
          Version gratuite
        </span>
        <span className="mt-1 block text-xs leading-relaxed text-[var(--q-text-3)]">
          Devis, clients et brouillons illimités. L&apos;envoi des factures demande la formule Essentiel.
        </span>
        <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[var(--q-accent-strong)]">
          Voir les formules <ArrowRight className="size-3.5" aria-hidden />
        </span>
      </Link>
    )
  }
  return (
    <Link href="/settings/ppf" className="block rounded-xl border border-[var(--q-line)] bg-[var(--q-surface-2)] p-3 text-[var(--q-ink)]">
      <span className="flex items-center gap-2 text-[13px] font-semibold">
        <ShieldCheck className="size-4 text-[var(--q-ok)]" aria-hidden />
        Réforme 2026-2027
      </span>
      <span className="mt-1 block text-xs leading-relaxed text-[var(--q-text-3)]">
        Mentions obligatoires sur vos modèles. Transmission par plateforme agréée : en préparation.
      </span>
    </Link>
  )
}

/* ------------------------------------------------------------------ */
/* Barre latérale (ordinateur, ≥ 1024 px)                              */
/* ------------------------------------------------------------------ */

export function Sidebar({ identity }: { identity: ShellIdentity }) {
  const pathname = usePathname()
  const logout = useLogout()
  const [bugOpen, setBugOpen] = useState(false)
  const mode = identity.mode
  const home = mode === "demo" ? "/demo" : "/dashboard"

  return (
    <aside
      aria-label="Navigation de l'application"
      className="hidden w-[252px] shrink-0 print:!hidden flex-col gap-[18px] overflow-y-auto border-r border-[var(--q-line)] bg-[var(--q-surface)] px-3.5 py-[18px] lg:flex"
    >
      <div className="flex items-center justify-between px-1.5 py-1">
        <Link href={home} className="flex" aria-label="Qonforme, tableau de bord">
          <Logo />
        </Link>
        {/* Compte sans formule : pas de pastille (l'encart « Version gratuite » du bas suffit) */}
        {mode === "demo" ? (
          <span className="q-tag !border-[var(--q-warn-line)] !bg-[var(--q-warn-bg)] !text-[var(--q-warn)]">Démo</span>
        ) : identity.planName ? (
          <span className="q-tag">{identity.planName}</span>
        ) : null}
      </div>

      <CompanyCard identity={identity} />

      <nav aria-label="Principale" className="flex flex-col gap-0.5">
        {NAV_MAIN.map((link) => (
          <NavItem key={link.key} link={link} mode={mode} pathname={pathname} />
        ))}
      </nav>

      <div className="flex flex-col gap-0.5">
        <span className="px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--q-text-4)]">Pilotage</span>
        {NAV_PILOTAGE.map((link) => (
          <NavItem key={link.key} link={link} mode={mode} pathname={pathname} />
        ))}
      </div>

      <div className="mt-auto flex flex-col gap-2.5">
        <StatusCard identity={identity} />
        <div className="flex flex-col gap-0.5">
          <NavItem link={NAV_SETTINGS} mode={mode} pathname={pathname} />
          {mode === "app" ? (
            <>
              <button type="button" onClick={() => setBugOpen(true)} className="flex h-9 items-center gap-2.5 rounded-[9px] px-2.5 text-sm font-medium text-[var(--q-text-2)] transition-colors hover:bg-[var(--q-hover)] hover:text-[var(--q-ink)]">
                <Bug className="size-[17px]" strokeWidth={1.75} aria-hidden />
                Signaler un problème
              </button>
              <button type="button" onClick={logout} className="flex h-9 items-center gap-2.5 rounded-[9px] px-2.5 text-sm font-medium text-[var(--q-text-2)] transition-colors hover:bg-[var(--q-danger-bg)] hover:text-[var(--q-danger)]">
                <LogOut className="size-[17px]" strokeWidth={1.75} aria-hidden />
                Se déconnecter
              </button>
            </>
          ) : (
            <>
              <Link href="/" className="flex h-9 items-center gap-2.5 rounded-[9px] px-2.5 text-sm font-medium text-[var(--q-text-2)] transition-colors hover:bg-[var(--q-hover)] hover:text-[var(--q-ink)]">
                <House className="size-[17px]" strokeWidth={1.75} aria-hidden />
                Retour à l&apos;accueil
              </Link>
              <Link href="/signup" className="q-btn q-btn-primary mt-1.5 w-full">
                Créer mon compte
                <ArrowRight aria-hidden />
              </Link>
            </>
          )}
        </div>
      </div>

      {mode === "app" && <BugReportModal open={bugOpen} onOpenChange={setBugOpen} />}
    </aside>
  )
}

/* ------------------------------------------------------------------ */
/* Feuilles mobiles                                                    */
/* ------------------------------------------------------------------ */

/** Feuille « Créer » : les mêmes entrées que le menu « Nouveau » de la barre supérieure. */
function CreateSheet({ open, onOpenChange, mode }: { open: boolean; onOpenChange: (open: boolean) => void; mode: ShellMode }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85dvh] gap-0 overflow-y-auto px-4 pb-[max(20px,env(safe-area-inset-bottom))] pt-2">
        <div className="q-sheet-grip" aria-hidden />
        <SheetTitle className="px-1 pb-1 pt-4 font-display text-[22px] font-semibold tracking-[-0.02em] text-[var(--q-ink)]">Créer</SheetTitle>
        <SheetDescription className="sr-only">Choisissez le document à créer.</SheetDescription>
        <div className="q-card q-list mt-3">
          {CREATE_LINKS.map((c) => {
            const Icon = c.icon
            return (
              <Link key={c.key} href={hrefFor(c, mode)} onClick={() => onOpenChange(false)} className="q-list-row">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--q-wash)] text-[var(--q-accent-strong)]">
                  <Icon className="size-[18px]" aria-hidden />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-base font-semibold">{c.label}</span>
                  <span className="truncate text-[13px] text-[var(--q-text-4)]">{c.hint}</span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-[var(--q-text-4)]" aria-hidden />
              </Link>
            )
          })}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function SheetRow({ href, onClick, icon: Icon, label, hint, danger }: {
  href?: string
  onClick?: () => void
  icon: React.ElementType
  label: string
  hint?: string
  danger?: boolean
}) {
  const inner = (
    <>
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-[10px]", danger ? "bg-[var(--q-danger-bg)] text-[var(--q-danger)]" : "bg-[var(--q-sunken)] text-[var(--q-text-2)]")}>
        <Icon className="size-[17px]" strokeWidth={1.75} aria-hidden />
      </span>
      <span className="flex min-w-0 flex-1 flex-col text-left">
        <span className={cn("text-base font-semibold", danger && "text-[var(--q-danger)]")}>{label}</span>
        {hint && <span className="truncate text-[13px] text-[var(--q-text-4)]">{hint}</span>}
      </span>
      {!danger && <ChevronRight className="size-4 shrink-0 text-[var(--q-text-4)]" aria-hidden />}
    </>
  )
  return href ? (
    <Link href={href} onClick={onClick} className="q-list-row">{inner}</Link>
  ) : (
    <button type="button" onClick={onClick} className="q-list-row w-full">{inner}</button>
  )
}

/** Feuille « Plus » : entreprise, gestion, pilotage, compte (planche « Mobile — Plus »). */
function PlusSheet({ open, onOpenChange, identity, onBug, onContact }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  identity: ShellIdentity
  onBug: () => void
  onContact: () => void
}) {
  const mode = identity.mode
  const logout = useLogout()
  const close = () => onOpenChange(false)
  const gestion = NAV_MAIN.filter((l) => l.key !== "dashboard" && l.key !== "invoices")
  const name = identity.companyName || "Votre entreprise"
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92dvh] gap-0 overflow-y-auto bg-[var(--q-bg)] px-4 pb-[max(24px,env(safe-area-inset-bottom))] pt-2">
        <div className="q-sheet-grip" aria-hidden />
        <SheetTitle className="px-1 pb-1 pt-4 font-display text-[30px] font-semibold tracking-[-0.03em] text-[var(--q-ink)]">Plus</SheetTitle>
        <SheetDescription className="sr-only">Toutes les rubriques et votre compte.</SheetDescription>

        <Link href={mode === "demo" ? "/demo/settings/company" : "/settings/company"} onClick={close} className="q-card mt-3 flex items-center gap-3 p-4 text-[var(--q-ink)]">
          <Initials name={name} ink className="!size-11 !rounded-xl !text-sm" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-base font-semibold">{name}</span>
            <span className="truncate text-[13px] text-[var(--q-text-4)]">
              {fullNameOf(identity)} · {identity.planName ? `formule ${identity.planName}` : "version gratuite"}
            </span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-[var(--q-text-4)]" aria-hidden />
        </Link>

        <button
          type="button"
          onClick={() => { close(); window.dispatchEvent(new Event(OPEN_SEARCH_EVENT)) }}
          className="mt-3 flex h-12 w-full items-center gap-2.5 rounded-[14px] border border-[var(--q-field)] bg-[var(--q-surface)] px-4 text-left text-base text-[var(--q-text-4)]"
        >
          <Search className="size-[18px] shrink-0" aria-hidden />
          Rechercher une facture, un client…
        </button>

        <p className="px-1 pb-2 pt-5 text-[15px] font-semibold text-[var(--q-ink)]">Gestion</p>
        <div className="q-card q-list">
          {gestion.map((l) => (
            <SheetRow key={l.key} href={hrefFor(l, mode)} onClick={close} icon={l.icon} label={l.label} hint={l.hint} />
          ))}
        </div>

        <p className="px-1 pb-2 pt-5 text-[15px] font-semibold text-[var(--q-ink)]">Pilotage</p>
        <div className="q-card q-list">
          {NAV_PILOTAGE.map((l) => (
            <SheetRow key={l.key} href={hrefFor(l, mode)} onClick={close} icon={l.icon} label={l.label} hint={l.hint} />
          ))}
        </div>

        <p className="px-1 pb-2 pt-5 text-[15px] font-semibold text-[var(--q-ink)]">Compte</p>
        <div className="q-card q-list">
          {mode === "app" ? (
            <>
              <SheetRow href="/settings/company" onClick={close} icon={Building2} label="Entreprise" hint="Coordonnées, SIREN, logo" />
              <SheetRow href="/settings/invoices" onClick={close} icon={FileCog} label="Modèles de documents" hint="Mentions, couleurs, conditions" />
              <SheetRow href="/settings/billing" onClick={close} icon={CreditCard} label="Abonnement" hint={identity.planName ? `Formule ${identity.planName}` : "Version gratuite"} />
              <SheetRow onClick={() => { close(); onBug() }} icon={Bug} label="Signaler un problème" />
              <SheetRow onClick={() => { close(); onContact() }} icon={MessageSquare} label="Nous écrire" />
              <SheetRow onClick={() => { close(); logout() }} icon={LogOut} label="Se déconnecter" danger />
            </>
          ) : (
            <>
              <SheetRow href="/demo/settings/company" onClick={close} icon={Building2} label="Entreprise" hint="Coordonnées, SIREN, logo" />
              <SheetRow href="/demo/settings/invoices" onClick={close} icon={FileCog} label="Modèles de documents" hint="Mentions, couleurs, conditions" />
              <SheetRow href="/demo/settings/billing" onClick={close} icon={CreditCard} label="Abonnement" hint={identity.planName ? `Formule ${identity.planName}` : "Version gratuite"} />
              <SheetRow href="/" onClick={close} icon={House} label="Retour à l'accueil" />
            </>
          )}
        </div>

        {mode === "demo" && (
          <Link href="/signup" onClick={close} className="q-btn q-btn-primary q-btn-xl mt-5 w-full">
            Créer mon compte
            <ArrowRight aria-hidden />
          </Link>
        )}
      </SheetContent>
    </Sheet>
  )
}

/* ------------------------------------------------------------------ */
/* Barre flottante du bas (mobile, < 1024 px)                          */
/* ------------------------------------------------------------------ */

export function MobileBottomNav({ identity }: { identity: ShellIdentity }) {
  const pathname = usePathname()
  const mode = identity.mode
  const [createOpen, setCreateOpen] = useState(false)
  const [plusOpen, setPlusOpen] = useState(false)
  const [bugOpen, setBugOpen] = useState(false)
  const [contactOpen, setContactOpen] = useState(false)

  // Par clé, pas par position : la liste s'allonge (Chantiers…)
  const byKey = (key: string) => NAV_MAIN.find((l) => l.key === key) ?? NAV_MAIN[0]
  const dashboard = byKey("dashboard")
  const invoices = byKey("invoices")
  const quotes = byKey("quotes")
  const tabs = [
    { link: dashboard, label: "Accueil" },
    { link: invoices, label: "Factures" },
  ]
  const tabsRight = [{ link: quotes, label: "Devis" }]
  const inMain = [dashboard, invoices, quotes].some((l) => isActivePath(pathname, hrefFor(l, mode)))

  // Ferme les feuilles à chaque changement de page (retour arrière du navigateur compris)
  useEffect(() => {
    setCreateOpen(false)
    setPlusOpen(false)
  }, [pathname])

  const Tab = ({ link, label }: { link: NavLink; label: string }) => {
    const href = hrefFor(link, mode)
    const active = isActivePath(pathname, href)
    const Icon = link.icon
    return (
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-semibold touch-manipulation",
          active ? "text-[var(--q-accent-strong)]" : "text-[var(--q-text-3)]",
        )}
      >
        <Icon className="size-[22px]" strokeWidth={1.75} aria-hidden />
        {label}
      </Link>
    )
  }

  return (
    <>
      <nav
        aria-label="Navigation mobile"
        className="q-float fixed inset-x-3 z-40 flex h-[68px] items-stretch rounded-3xl px-1 lg:hidden print:hidden"
        style={{ bottom: "max(16px, env(safe-area-inset-bottom))" }}
      >
        {tabs.map((t) => <Tab key={t.link.key} {...t} />)}
        <div className="flex flex-1 items-center justify-center">
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            aria-label="Créer un document"
            aria-haspopup="dialog"
            className="grid size-[52px] place-items-center rounded-[18px] bg-[var(--q-accent)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.25),0_8px_18px_-6px_rgba(37,99,235,.7)] touch-manipulation active:scale-95"
          >
            <Plus className="size-6" strokeWidth={2.25} aria-hidden />
          </button>
        </div>
        {tabsRight.map((t) => <Tab key={t.link.key} {...t} />)}
        <button
          type="button"
          onClick={() => setPlusOpen(true)}
          aria-haspopup="dialog"
          className={cn(
            "flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-semibold touch-manipulation",
            !inMain && !plusOpen ? "text-[var(--q-accent-strong)]" : "text-[var(--q-text-3)]",
          )}
        >
          <Ellipsis className="size-[22px]" strokeWidth={1.75} aria-hidden />
          Plus
        </button>
      </nav>

      <CreateSheet open={createOpen} onOpenChange={setCreateOpen} mode={mode} />
      <PlusSheet
        open={plusOpen}
        onOpenChange={setPlusOpen}
        identity={identity}
        onBug={() => setBugOpen(true)}
        onContact={() => setContactOpen(true)}
      />
      {mode === "app" && (
        <>
          <BugReportModal open={bugOpen} onOpenChange={setBugOpen} />
          <ContactModal open={contactOpen} onOpenChange={setContactOpen} />
        </>
      )}
    </>
  )
}
