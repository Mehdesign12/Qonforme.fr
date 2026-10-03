'use client'

/**
 * Barre supérieure flottante de l'admin (ordinateur, ≥ 1024 px) : fil d'Ariane,
 * retour à l'application, menu de session (thème, déconnexion). Verre liquide
 * sur ordinateur seulement (.q-float) ; sur mobile, le titre est dans la page
 * et la navigation en bas (AdminMobileNav).
 */
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { ArrowLeft, LogOut, Moon, Sun, ShieldCheck } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { useCrumbLabel } from '@/components/layout/crumb'
import { adminCrumbsFor } from '@/components/admin/nav'
import { useAdminLogout } from '@/components/admin/AdminSidebar'

function SessionMenu() {
  const router = useRouter()
  const logout = useAdminLogout()
  const { resolvedTheme, setTheme } = useTheme()
  // Garde `mounted` : resolvedTheme est indéfini côté serveur (règle next-themes de CLAUDE.md)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const isDark = mounted && resolvedTheme === 'dark'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="grid size-8 place-items-center rounded-full bg-[var(--q-ink)] text-[var(--q-surface)] outline-none focus-visible:shadow-[0_0_0_4px_var(--q-focus)]"
        aria-label="Menu de la session admin"
      >
        <ShieldCheck className="size-4" strokeWidth={2} aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={10} className="w-[248px]">
        <div className="mb-1 rounded-[10px] bg-[var(--q-surface-2)] p-3">
          <p className="text-[13px] font-semibold text-[var(--q-ink)]">Session administrateur</p>
          <p className="mt-0.5 text-xs text-[var(--q-text-4)]">Valable 24 heures sur cet appareil.</p>
        </div>
        <DropdownMenuItem onClick={() => setTheme(isDark ? 'light' : 'dark')}>
          {isDark ? <Sun aria-hidden /> : <Moon aria-hidden />}
          {isDark ? 'Thème clair' : 'Thème sombre'}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push('/dashboard')}>
          <ArrowLeft aria-hidden />
          Retour à l&apos;application
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-[var(--q-line-soft)]" />
        <DropdownMenuItem variant="destructive" onClick={logout}>
          <LogOut aria-hidden />
          Se déconnecter
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function AdminHeader() {
  const pathname = usePathname()
  const crumbs = adminCrumbsFor(pathname)
  const pageLabel = useCrumbLabel()
  const current = crumbs.current ?? pageLabel ?? 'Fiche'

  return (
    // shrink-0 : dans la colonne flex qui défile, la barre se tassait dès que la page dépassait l'écran
    <header
      className="q-float sticky top-3 z-30 mx-6 mt-3 hidden h-14 shrink-0 items-center gap-3 rounded-[14px] pl-4 pr-2.5 print:!hidden lg:flex"
      style={{ isolation: 'isolate' }}
    >
      <nav aria-label="Fil d'Ariane" className="flex min-w-0 flex-1 items-center gap-2 text-sm">
        <Link href="/admin" className="text-[var(--q-text-4)] transition-colors hover:text-[var(--q-ink)]">Admin</Link>
        <span className="text-[var(--q-placeholder)]" aria-hidden>/</span>
        {crumbs.parent && (
          <>
            <Link href={crumbs.parent.href} className="text-[var(--q-text-4)] transition-colors hover:text-[var(--q-ink)]">
              {crumbs.parent.label}
            </Link>
            <span className="text-[var(--q-placeholder)]" aria-hidden>/</span>
          </>
        )}
        <span className="max-w-[320px] truncate font-semibold text-[var(--q-ink)]" aria-current="page">{current}</span>
      </nav>

      <div className="flex shrink-0 items-center gap-1.5">
        <Link href="/dashboard" className="q-btn q-btn-ghost q-btn-sm">
          <ArrowLeft aria-hidden />
          Application
        </Link>
        <SessionMenu />
      </div>
    </header>
  )
}
