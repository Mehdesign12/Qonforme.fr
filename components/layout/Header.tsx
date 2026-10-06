'use client'

/**
 * Barre supérieure flottante (ordinateur, ≥ 1024 px) — canevas « Tableau de bord » :
 * fil d'Ariane, recherche ⌘K, menu « Nouveau », notifications, menu du compte.
 *
 * Verre liquide clair sur ordinateur seulement (.q-float) ; sur mobile la barre
 * n'est pas rendue (titre dans la page, navigation en bas). Partagée avec la
 * démo : DemoHeader.tsx la rend en mode « demo ».
 */
import Link from "next/link"
import dynamic from "next/dynamic"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import {
  Plus, ChevronDown, Search, Building2, FileCog, CreditCard, Sun, Moon,
  LogOut, Bug, MessageSquare, ArrowRight,
} from "lucide-react"
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { BugReportModal, ContactModal } from "@/components/layout/SupportModals"
import { NotificationsButton } from "@/components/layout/NotificationsButton"
import { useCrumbLabel } from "@/components/layout/crumb"
import { CREATE_LINKS, OPEN_SEARCH_EVENT, crumbsFor, hrefFor } from "@/components/layout/nav"
import { type ShellIdentity, fullNameOf } from "@/components/layout/shell"
import { useLogout } from "@/components/layout/useLogout"
import { initialsOf } from "@/components/app/kit"

/** Recherche ⌘K : chargée à sa première ouverture, hors du JavaScript initial de chaque page (PushRank). */
const CommandPalette = dynamic(() => import("@/components/layout/CommandPalette").then((m) => m.CommandPalette), { ssr: false })

/* ------------------------------------------------------------------ */
/* Menu « Nouveau »                                                    */
/* ------------------------------------------------------------------ */

function CreateMenu({ identity }: { identity: ShellIdentity }) {
  const router = useRouter()
  const mode = identity.mode
  const go = (href: string) => router.push(href)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="q-btn q-btn-primary !h-[38px] gap-2 !pl-3.5 !pr-3" aria-label="Nouveau document">
        <Plus strokeWidth={2.25} aria-hidden />
        Nouveau
        <ChevronDown className="!size-3.5 opacity-80" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-[300px]"
        onKeyDown={(e: React.KeyboardEvent) => {
          // Raccourcis affichés dans le menu (D, F, C, B), actifs tant qu'il est ouvert
          if (e.metaKey || e.ctrlKey || e.altKey) return
          const hit = CREATE_LINKS.find((c) => c.shortcut.toLowerCase() === e.key.toLowerCase())
          if (hit) {
            e.preventDefault()
            go(hrefFor(hit, mode))
          }
        }}
      >
        {CREATE_LINKS.map((c) => {
          const Icon = c.icon
          return (
            <DropdownMenuItem key={c.key} onClick={() => go(hrefFor(c, mode))} className="gap-3 py-2">
              <span className="grid size-8 shrink-0 place-items-center rounded-[9px] bg-[var(--q-wash)] text-[var(--q-accent-strong)]">
                <Icon className="!size-4" aria-hidden />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-px">
                <span className="text-sm font-semibold text-[var(--q-ink)]">{c.label}</span>
                <span className="truncate text-xs font-normal text-[var(--q-text-4)]">{c.hint}</span>
              </span>
              <kbd className="q-kbd">{c.shortcut}</kbd>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/* ------------------------------------------------------------------ */
/* Menu du compte                                                      */
/* ------------------------------------------------------------------ */

function AccountMenu({ identity }: { identity: ShellIdentity }) {
  const router = useRouter()
  const logout = useLogout()
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const isDark = mounted && resolvedTheme === "dark"
  const [bugOpen, setBugOpen] = useState(false)
  const [contactOpen, setContactOpen] = useState(false)
  const name = fullNameOf(identity)
  // Sans prénom ni nom (inscription en deux champs) : initiales de l'entreprise,
  // sinon de l'adresse email — jamais « MC » tiré du libellé « Mon compte »
  const hasName = Boolean(identity.firstName || identity.lastName)
  const initials = initialsOf(hasName ? name : identity.companyName || identity.email.split("@")[0] || name)
  const demo = identity.mode === "demo"

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="grid size-8 place-items-center rounded-full bg-[var(--q-sunken)] text-xs font-semibold text-[var(--q-ink)] outline-none ring-offset-2 focus-visible:shadow-[0_0_0_4px_var(--q-focus)]"
          aria-label="Menu du compte"
          title={name}
        >
          {initials}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={10} className="w-[272px]">
          <div className="mb-1 flex items-center gap-3 rounded-[10px] bg-[var(--q-surface-2)] p-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--q-accent)] text-[13px] font-semibold text-white dark:bg-[#2563EB]">
              {initials}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-[13px] font-semibold text-[var(--q-ink)]">{name}</span>
              {identity.email && <span className="truncate text-xs text-[var(--q-text-4)]">{identity.email}</span>}
              <span className="mt-1">
                <span className={identity.planName ? "q-pill q-pill-info !h-5 !text-[11px]" : "q-pill !h-5 !text-[11px]"}>
                  {identity.planName ?? "Version gratuite"}
                </span>
              </span>
            </span>
          </div>
          <DropdownMenuItem onClick={() => router.push(demo ? "/demo/settings/company" : "/settings/company")}>
            <Building2 aria-hidden />
            Entreprise
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push(demo ? "/demo/settings/invoices" : "/settings/invoices")}>
            <FileCog aria-hidden />
            Modèles de documents
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push(demo ? "/demo/settings/billing" : "/settings/billing")}>
            <CreditCard aria-hidden />
            Abonnement
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme(isDark ? "light" : "dark")}>
            {isDark ? <Sun aria-hidden /> : <Moon aria-hidden />}
            {isDark ? "Thème clair" : "Thème sombre"}
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-[var(--q-line-soft)]" />
          {demo ? (
            <DropdownMenuItem onClick={() => router.push("/signup")}>
              <ArrowRight aria-hidden />
              Créer mon compte
            </DropdownMenuItem>
          ) : (
            <>
              <DropdownMenuItem onClick={() => setBugOpen(true)}>
                <Bug aria-hidden />
                Signaler un problème
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setContactOpen(true)}>
                <MessageSquare aria-hidden />
                Nous écrire
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-[var(--q-line-soft)]" />
              <DropdownMenuItem variant="destructive" onClick={logout}>
                <LogOut aria-hidden />
                Se déconnecter
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {!demo && (
        <>
          <BugReportModal open={bugOpen} onOpenChange={setBugOpen} />
          <ContactModal open={contactOpen} onOpenChange={setContactOpen} />
        </>
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Barre supérieure                                                    */
/* ------------------------------------------------------------------ */

export function Header({ identity }: { identity: ShellIdentity }) {
  const pathname = usePathname()
  const crumbs = crumbsFor(pathname)
  const pageLabel = useCrumbLabel()
  const current = crumbs.current ?? pageLabel ?? (pathname.endsWith("/edit") ? "Modifier" : "Détail")
  const [searchOpen, setSearchOpen] = useState(false)
  // Montée à la première ouverture, puis gardée (animation de fermeture, saisie conservée)
  const [searchMounted, setSearchMounted] = useState(false)
  useEffect(() => {
    if (searchOpen) setSearchMounted(true)
  }, [searchOpen])

  // ⌘K / Ctrl+K ouvre la recherche partout dans l'application
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setSearchOpen((v) => !v)
      }
    }
    // La feuille « Plus » (mobile) ouvre la même recherche
    const onOpen = () => setSearchOpen(true)
    window.addEventListener("keydown", onKey)
    window.addEventListener(OPEN_SEARCH_EVENT, onOpen)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener(OPEN_SEARCH_EVENT, onOpen)
    }
  }, [])

  return (
    <>
      {/* shrink-0 : dans la colonne flex qui défile, la barre se tassait à 40 px dès que la page dépassait l'écran */}
      <header
        className="q-float sticky top-3 z-30 mx-6 mt-3 hidden h-14 shrink-0 items-center gap-3 rounded-[14px] pl-4 pr-2.5 lg:flex print:!hidden"
        style={{ isolation: "isolate" }}
      >
        <nav aria-label="Fil d'Ariane" className="flex min-w-0 shrink-0 items-center gap-2 text-sm">
          {crumbs.parent && (
            <>
              <Link href={crumbs.parent.href} className="text-[var(--q-text-4)] transition-colors hover:text-[var(--q-ink)]">
                {crumbs.parent.label}
              </Link>
              <span className="text-[var(--q-placeholder)]" aria-hidden>/</span>
            </>
          )}
          <span className="max-w-[260px] truncate font-semibold text-[var(--q-ink)]" aria-current="page">{current}</span>
          {identity.mode === "demo" && (
            <span className="q-tag !border-[var(--q-warn-line)] !bg-[var(--q-warn-bg)] !text-[var(--q-warn)]">Démo</span>
          )}
        </nav>

        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="mx-auto flex h-[38px] min-w-0 max-w-[460px] flex-1 items-center gap-2.5 rounded-[10px] border border-[rgba(15,23,42,.08)] bg-white/70 px-3 dark:bg-white/5 text-sm text-[var(--q-text-4)] transition-colors hover:border-[var(--q-field)] dark:border-[var(--q-line)]"
          aria-label="Rechercher (⌘K)"
        >
          <Search className="size-4 shrink-0" aria-hidden />
          <span className="flex-1 truncate text-left">Rechercher une facture, un client, une action…</span>
          <kbd className="q-kbd">⌘K</kbd>
        </button>

        <div className="flex shrink-0 items-center gap-1.5">
          <CreateMenu identity={identity} />
          <NotificationsButton identity={identity} />
          <AccountMenu identity={identity} />
        </div>
      </header>
      {searchMounted && <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} identity={identity} />}
    </>
  )
}
