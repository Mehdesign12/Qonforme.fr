import { createAdminClient } from '@/lib/supabase/server'
import { AdminSidebar } from '@/components/admin/AdminSidebar'

export const metadata = {
  title: 'Admin — Qonforme',
  robots: { index: false, follow: false },
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Le middleware vérifie déjà le cookie admin_session — pas de check ici

  // ── Badges sidebar ────────────────────────────────────────────────────
  let unreadSupport    = 0
  let unresolvedErrors = 0
  try {
    const admin = createAdminClient()
    const [supportRes, errorsRes] = await Promise.all([
      admin.from('support_messages').select('id', { count: 'exact', head: true }).eq('status', 'new'),
      admin.from('error_logs').select('id', { count: 'exact', head: true }).is('resolved_at', null),
    ])
    unreadSupport    = supportRes.count ?? 0
    unresolvedErrors = errorsRes.count  ?? 0
  } catch { /* non bloquant */ }

  return (
    <div
      className="flex h-[100dvh] overflow-hidden"
      style={{ background: 'var(--dashboard-bg)' }}
    >
      {/* Blobs décoratifs identiques au dashboard */}
      <div
        aria-hidden
        className="pointer-events-none select-none fixed top-0 right-0 w-[600px] h-[600px] z-0"
        style={{ background: 'var(--dashboard-blob1)' }}
      />
      <div
        aria-hidden
        className="pointer-events-none select-none fixed bottom-0 left-0 w-[400px] h-[400px] z-0"
        style={{ background: 'var(--dashboard-blob2)' }}
      />

      <AdminSidebar unreadSupport={unreadSupport} unresolvedErrors={unresolvedErrors} />

      <div className="relative z-10 flex flex-col flex-1 min-w-0 overflow-hidden">
        <main className="flex-1 overflow-y-auto px-4 py-5 md:px-6 md:py-6">
          {children}
        </main>
      </div>
    </div>
  )
}
