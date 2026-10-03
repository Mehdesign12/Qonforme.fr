import { createAdminClient } from '@/lib/supabase/server'
import { AdminSidebar, AdminMobileNav, type AdminCounts } from '@/components/admin/AdminSidebar'
import { AdminHeader } from '@/components/admin/AdminHeader'
import { CrumbProvider } from '@/components/layout/crumb'

export const metadata = {
  title: 'Admin',
  robots: { index: false, follow: false },
}

/** Compteurs de la barre latérale ; null si la lecture échoue (on n'affiche pas « 0 » à tort). */
async function getCounts(): Promise<AdminCounts> {
  try {
    const admin = createAdminClient()
    const [supportRes, errorsRes] = await Promise.all([
      admin.from('support_messages').select('id', { count: 'exact', head: true }).eq('status', 'new'),
      admin.from('error_logs').select('id', { count: 'exact', head: true }).is('resolved_at', null),
    ])
    return {
      unreadSupport: supportRes.error ? null : supportRes.count ?? 0,
      unresolvedErrors: errorsRes.error ? null : errorsRes.count ?? 0,
    }
  } catch {
    return { unreadSupport: null, unresolvedErrors: null }
  }
}

/**
 * Coque de l'espace admin, sur le modèle de celle de l'application
 * (components/layout/AppShell.tsx) : barre latérale blanche, fond #F6F8FB avec
 * halo, barre supérieure flottante, barre flottante du bas sur mobile.
 * Pas de will-change ni de transform sur les enveloppes (règle iOS de CLAUDE.md).
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Le middleware vérifie déjà le cookie admin_session — pas de vérification ici
  const counts = await getCounts()

  return (
    <CrumbProvider>
      <div data-admin-shell className="flex h-[100dvh] overflow-hidden bg-[var(--q-bg)] print:block print:h-auto print:overflow-visible">
        <AdminSidebar counts={counts} />
        <div
          data-admin-scroll
          className="relative flex min-w-0 flex-1 flex-col overflow-y-auto print:block print:overflow-visible"
          style={{ background: 'var(--dashboard-bg)', overscrollBehavior: 'none' }}
        >
          <AdminHeader />
          <main
            id="contenu"
            className="mx-auto flex w-full max-w-[1240px] flex-1 flex-col gap-5 px-4 pb-[calc(112px+env(safe-area-inset-bottom))] pt-[max(20px,env(safe-area-inset-top))] md:px-6 lg:pb-10 lg:pt-7"
          >
            {children}
          </main>
        </div>
        <AdminMobileNav counts={counts} />
      </div>
    </CrumbProvider>
  )
}
