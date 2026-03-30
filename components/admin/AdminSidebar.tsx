'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  CreditCard,
  MessageSquare,
  FileText,
  ArrowLeft,
  Shield,
  AlertTriangle,
  LogOut,
  Activity,
  Bot,
  Palette,
  BarChart3,
  UserSearch,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/admin',               icon: LayoutDashboard, label: 'Vue d\'ensemble', exact: true },
  { href: '/admin/users',         icon: Users,           label: 'Utilisateurs' },
  { href: '/admin/subscriptions', icon: CreditCard,      label: 'Abonnements' },
  { href: '/admin/support',       icon: MessageSquare,   label: 'Support' },
  { href: '/admin/errors',        icon: AlertTriangle,   label: 'Erreurs' },
  { href: '/admin/blog',          icon: FileText,        label: 'Blog', exact: true },
  { href: '/admin/blog/ai',      icon: Bot,             label: 'Blog IA' },
  { href: '/admin/brand-studio',  icon: Palette,         label: 'Brand Studio' },
  { href: '/admin/prospects',      icon: UserSearch,      label: 'Prospects' },
  { href: '/admin/analytics',     icon: BarChart3,       label: 'Analytics' },
  { href: '/admin/health',        icon: Activity,        label: 'Santé système' },
]

interface AdminSidebarProps {
  unreadSupport?:    number
  unresolvedErrors?: number
}

export function AdminSidebar({ unreadSupport = 0, unresolvedErrors = 0 }: AdminSidebarProps) {
  const pathname = usePathname()

  return (
    <aside
      className="hidden md:flex flex-col w-56 shrink-0 h-full border-r"
      style={{
        background:   'var(--sidebar-bg)',
        borderColor:  'var(--sidebar-border)',
      }}
    >
      {/* Logo + badge */}
      <div className="flex items-center gap-2.5 px-4 py-5 border-b" style={{ borderColor: 'var(--sidebar-inner-border)' }}>
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#2563EB] shrink-0">
          <Shield className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground leading-tight">Qonforme</p>
          <span className="inline-block text-[10px] font-bold uppercase tracking-widest text-white bg-red-500 rounded px-1.5 py-0.5 leading-none">ADMIN</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, icon: Icon, label, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-100',
                active
                  ? 'bg-[#EFF6FF] dark:bg-[#162032] text-[#2563EB] dark:text-[#3B82F6]'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-[#F8FAFC] dark:hover:bg-[#162032] hover:text-[#0F172A] dark:hover:text-[#E2E8F0]',
              )}
            >
              <Icon className={cn('w-4 h-4 shrink-0', active ? 'text-[#2563EB] dark:text-[#3B82F6]' : 'text-slate-400 dark:text-slate-500')} />
              <span className="flex-1">{label}</span>
              {label === 'Support' && unreadSupport > 0 && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold">
                  {unreadSupport > 99 ? '99+' : unreadSupport}
                </span>
              )}
              {label === 'Erreurs' && unresolvedErrors > 0 && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold">
                  {unresolvedErrors > 99 ? '99+' : unresolvedErrors}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer : retour à l'app + déconnexion */}
      <div className="px-2 py-3 border-t space-y-0.5" style={{ borderColor: 'var(--sidebar-inner-border)' }}>
        <Link
          href="/dashboard"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-500 dark:text-slate-400 hover:bg-[#F8FAFC] dark:hover:bg-[#162032] hover:text-[#0F172A] dark:hover:text-[#E2E8F0] transition-colors duration-100"
        >
          <ArrowLeft className="w-4 h-4 shrink-0 text-slate-400" />
          <span>Retour à l&apos;app</span>
        </Link>
        <button
          onClick={async () => {
            await fetch('/api/admin/auth/logout', { method: 'POST' })
            window.location.href = '/admin/login'
          }}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors duration-100"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span>Se déconnecter</span>
        </button>
      </div>
    </aside>
  )
}
