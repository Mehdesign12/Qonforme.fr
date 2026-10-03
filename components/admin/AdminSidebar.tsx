'use client'

/**
 * Coque de l'espace admin — barre latérale (ordinateur, ≥ 1024 px), barre
 * flottante du bas et feuille « Plus » (mobile). Même langage que la coque de
 * l'application (components/layout/Sidebar.tsx) : jetons --q-*, thème sombre
 * compris.
 *
 * Mobile : aucun backdrop-filter ni will-change (règle iOS de CLAUDE.md) —
 * la barre du bas est en « verre solide » (.q-float, opaque sous 768 px).
 */
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { ArrowLeft, ChevronRight, Ellipsis, LogOut } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { LOGO_LONG_BLUE, LOGO_LONG_LIGHT } from '@/lib/brand'
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import {
  ADMIN_HOME, ADMIN_NAV, isAdminActive,
  type AdminBadge, type AdminNavLink,
} from '@/components/admin/nav'

export interface AdminCounts {
  /** Messages de support non lus (null : lecture impossible). */
  unreadSupport: number | null
  /** Erreurs non résolues (null : lecture impossible). */
  unresolvedErrors: number | null
}

/* ------------------------------------------------------------------ */
/* Déconnexion                                                         */
/* ------------------------------------------------------------------ */

export function useAdminLogout() {
  return async () => {
    try {
      const res = await fetch('/api/admin/auth/logout', { method: 'POST' })
      if (!res.ok) throw new Error()
      window.location.href = '/admin/login'
    } catch {
      toast.error('Déconnexion impossible. Vérifiez votre connexion puis réessayez.')
    }
  }
}

/* ------------------------------------------------------------------ */
/* Logo et marque                                                      */
/* ------------------------------------------------------------------ */

export function AdminBrand({ height = 19 }: { height?: number }) {
  const { resolvedTheme } = useTheme()
  // Garde `mounted` : resolvedTheme est indéfini côté serveur (règle next-themes de CLAUDE.md)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return (
    <span className="flex items-center gap-2">
      <Image
        src={mounted && resolvedTheme === 'dark' ? LOGO_LONG_LIGHT : LOGO_LONG_BLUE}
        alt="Qonforme"
        width={Math.round(height * 5.4)}
        height={height}
        style={{ height, width: 'auto' }}
        sizes="110px"
        priority
      />
      <span className="q-tag !border-[var(--q-ink)] !bg-[var(--q-ink)] !text-[var(--q-surface)]">Admin</span>
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* Compteurs                                                           */
/* ------------------------------------------------------------------ */

function countOf(badge: AdminBadge | undefined, counts: AdminCounts): number | null {
  if (badge === 'support') return counts.unreadSupport
  if (badge === 'errors') return counts.unresolvedErrors
  return null
}

/** Pastille de compteur : rien à zéro ou si la lecture a échoué. */
function CountBadge({ badge, counts, className }: { badge?: AdminBadge; counts: AdminCounts; className?: string }) {
  const n = countOf(badge, counts)
  if (!badge || !n) return null
  const label = badge === 'support' ? `${n} message${n > 1 ? 's' : ''} non lu${n > 1 ? 's' : ''}` : `${n} erreur${n > 1 ? 's' : ''} non résolue${n > 1 ? 's' : ''}`
  return (
    <span
      className={cn(
        'q-pill !h-5 !min-w-5 justify-center !px-1.5 !text-[11px] tabular-nums',
        badge === 'errors' ? 'q-pill-danger' : 'q-pill-warn',
        className,
      )}
    >
      <span aria-hidden>{n > 99 ? '99+' : n}</span>
      <span className="sr-only">{label}</span>
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* Barre latérale (ordinateur)                                         */
/* ------------------------------------------------------------------ */

function NavItem({ link, pathname, counts, onNavigate }: { link: AdminNavLink; pathname: string; counts: AdminCounts; onNavigate?: () => void }) {
  const active = isAdminActive(pathname, link.href)
  const Icon = link.icon
  return (
    <Link
      href={link.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex h-9 items-center gap-2.5 rounded-[9px] px-2.5 text-sm transition-colors',
        active
          ? 'bg-[var(--q-wash)] font-semibold text-[var(--q-accent-strong)] shadow-[inset_0_0_0_1px_var(--q-wash-line)]'
          : 'font-medium text-[var(--q-text-2)] hover:bg-[var(--q-hover)] hover:text-[var(--q-ink)]',
      )}
    >
      <Icon className="size-[17px] shrink-0" strokeWidth={1.75} aria-hidden />
      <span className="flex-1 truncate">{link.label}</span>
      <CountBadge badge={link.badge} counts={counts} />
    </Link>
  )
}

export function AdminSidebar({ counts }: { counts: AdminCounts }) {
  const pathname = usePathname()
  const logout = useAdminLogout()

  return (
    <aside
      aria-label="Navigation de l'espace admin"
      className="hidden w-[252px] shrink-0 flex-col gap-[18px] overflow-y-auto border-r border-[var(--q-line)] bg-[var(--q-surface)] px-3.5 py-[18px] print:!hidden lg:flex"
    >
      <Link href="/admin" className="flex px-1.5 py-1" aria-label="Qonforme Admin, vue d'ensemble">
        <AdminBrand />
      </Link>

      <nav aria-label="Rubriques de l'admin" className="flex flex-col gap-4">
        {ADMIN_NAV.map((group) => (
          <div key={group.key} className="flex flex-col gap-0.5">
            {group.label && (
              <span className="flex items-center gap-2 px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--q-text-4)]">
                {group.label}
                {group.tag && <span className="q-tag !h-[18px] !px-1.5 !text-[10px] !normal-case !tracking-normal">{group.tag}</span>}
              </span>
            )}
            {group.links.map((link) => (
              <NavItem key={link.key} link={link} pathname={pathname} counts={counts} />
            ))}
          </div>
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-0.5 border-t border-[var(--q-line-soft)] pt-3">
        <Link href="/dashboard" className="flex h-9 items-center gap-2.5 rounded-[9px] px-2.5 text-sm font-medium text-[var(--q-text-2)] transition-colors hover:bg-[var(--q-hover)] hover:text-[var(--q-ink)]">
          <ArrowLeft className="size-[17px]" strokeWidth={1.75} aria-hidden />
          Retour à l&apos;application
        </Link>
        <button type="button" onClick={logout} className="flex h-9 items-center gap-2.5 rounded-[9px] px-2.5 text-sm font-medium text-[var(--q-text-2)] transition-colors hover:bg-[var(--q-danger-bg)] hover:text-[var(--q-danger)]">
          <LogOut className="size-[17px]" strokeWidth={1.75} aria-hidden />
          Se déconnecter
        </button>
      </div>
    </aside>
  )
}

/* ------------------------------------------------------------------ */
/* Mobile : barre du bas et feuille « Plus »                           */
/* ------------------------------------------------------------------ */

const TABS: { href: string; label: string; key: string }[] = [
  { key: 'overview', href: '/admin', label: 'Accueil' },
  { key: 'users', href: '/admin/users', label: 'Comptes' },
  { key: 'support', href: '/admin/support', label: 'Support' },
  { key: 'errors', href: '/admin/errors', label: 'Erreurs' },
]

function SheetRow({ link, counts, onClick }: { link: AdminNavLink; counts: AdminCounts; onClick: () => void }) {
  const Icon = link.icon
  return (
    <Link href={link.href} onClick={onClick} className="q-list-row">
      <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-[var(--q-sunken)] text-[var(--q-text-2)]">
        <Icon className="size-[17px]" strokeWidth={1.75} aria-hidden />
      </span>
      <span className="flex min-w-0 flex-1 flex-col text-left">
        <span className="text-base font-semibold">{link.label}</span>
        {link.hint && <span className="truncate text-[13px] text-[var(--q-text-4)]">{link.hint}</span>}
      </span>
      <CountBadge badge={link.badge} counts={counts} />
      <ChevronRight className="size-4 shrink-0 text-[var(--q-text-4)]" aria-hidden />
    </Link>
  )
}

function PlusSheet({ open, onOpenChange, counts }: { open: boolean; onOpenChange: (open: boolean) => void; counts: AdminCounts }) {
  const logout = useAdminLogout()
  const close = () => onOpenChange(false)
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92dvh] gap-0 overflow-y-auto bg-[var(--q-bg)] px-4 pb-[max(24px,env(safe-area-inset-bottom))] pt-2">
        <div className="q-sheet-grip" aria-hidden />
        <SheetTitle className="flex items-center gap-2 px-1 pb-1 pt-4 font-display text-[30px] font-semibold tracking-[-0.03em] text-[var(--q-ink)]">
          Admin
        </SheetTitle>
        <SheetDescription className="sr-only">Toutes les rubriques de l&apos;espace admin.</SheetDescription>

        {/* shrink-0 : dans la feuille (colonne flex qui défile), une carte en overflow-hidden se tassait et rognait ses lignes */}
        {ADMIN_NAV.map((group) => (
          <div key={group.key} className="shrink-0">
            <p className="flex items-center gap-2 px-1 pb-2 pt-5 text-[15px] font-semibold text-[var(--q-ink)]">
              {group.label ?? 'Pilotage'}
              {group.tag && <span className="q-tag">{group.tag}</span>}
            </p>
            <div className="q-card q-list overflow-hidden">
              {group.links.map((link) => (
                <SheetRow key={link.key} link={link} counts={counts} onClick={close} />
              ))}
            </div>
          </div>
        ))}

        <div className="shrink-0">
          <p className="px-1 pb-2 pt-5 text-[15px] font-semibold text-[var(--q-ink)]">Session</p>
          <div className="q-card q-list overflow-hidden">
            <Link href="/dashboard" onClick={close} className="q-list-row">
              <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-[var(--q-sunken)] text-[var(--q-text-2)]">
                <ArrowLeft className="size-[17px]" strokeWidth={1.75} aria-hidden />
              </span>
              <span className="flex-1 text-base font-semibold">Retour à l&apos;application</span>
              <ChevronRight className="size-4 shrink-0 text-[var(--q-text-4)]" aria-hidden />
            </Link>
            <button type="button" onClick={() => { close(); logout() }} className="q-list-row w-full">
              <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-[var(--q-danger-bg)] text-[var(--q-danger)]">
                <LogOut className="size-[17px]" strokeWidth={1.75} aria-hidden />
              </span>
              <span className="flex-1 text-left text-base font-semibold text-[var(--q-danger)]">Se déconnecter</span>
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

export function AdminMobileNav({ counts }: { counts: AdminCounts }) {
  const pathname = usePathname()
  const [plusOpen, setPlusOpen] = useState(false)
  const inTabs = TABS.some((t) => isAdminActive(pathname, t.href))

  // Ferme la feuille à chaque changement de page (retour arrière du navigateur compris)
  useEffect(() => { setPlusOpen(false) }, [pathname])

  const linkOf = (key: string): AdminNavLink =>
    key === 'overview' ? ADMIN_HOME : ADMIN_NAV.flatMap((g) => g.links).find((l) => l.key === key)!

  return (
    <>
      <nav
        aria-label="Navigation mobile de l'admin"
        className="q-float fixed inset-x-3 z-40 flex h-[68px] items-stretch rounded-3xl px-1 lg:hidden print:hidden"
        style={{ bottom: 'max(16px, env(safe-area-inset-bottom))' }}
      >
        {TABS.map((t) => {
          const link = linkOf(t.key)
          const Icon = link.icon
          const active = isAdminActive(pathname, t.href)
          return (
            <Link
              key={t.key}
              href={t.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-semibold touch-manipulation',
                active ? 'text-[var(--q-accent-strong)]' : 'text-[var(--q-text-3)]',
              )}
            >
              <span className="relative">
                <Icon className="size-[22px]" strokeWidth={1.75} aria-hidden />
                <CountBadge badge={link.badge} counts={counts} className="absolute -right-3 -top-2" />
              </span>
              {t.label}
            </Link>
          )
        })}
        <button
          type="button"
          onClick={() => setPlusOpen(true)}
          aria-haspopup="dialog"
          className={cn(
            'flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-semibold touch-manipulation',
            !inTabs && !plusOpen ? 'text-[var(--q-accent-strong)]' : 'text-[var(--q-text-3)]',
          )}
        >
          <Ellipsis className="size-[22px]" strokeWidth={1.75} aria-hidden />
          Plus
        </button>
      </nav>
      <PlusSheet open={plusOpen} onOpenChange={setPlusOpen} counts={counts} />
    </>
  )
}
