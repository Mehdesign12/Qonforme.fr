import { Sidebar, MobileBottomNav } from "@/components/layout/Sidebar"
import { Header } from "@/components/layout/Header"
import { CrumbProvider } from "@/components/layout/crumb"
import type { ShellIdentity } from "@/components/layout/shell"

/**
 * Coque commune à toutes les pages de l'application et de la démo
 * (canevas « Tableau de bord ») : barre latérale blanche, contenu sur fond
 * #F6F8FB avec halo bleu, barre supérieure flottante collée en haut du
 * défilement, barre flottante du bas sur mobile.
 *
 * Pas de will-change ni de transform sur les enveloppes (règle iOS de CLAUDE.md) :
 * la barre supérieure porte elle-même `isolation: isolate`.
 */
export function AppShellFrame({ identity, children }: { identity: ShellIdentity; children: React.ReactNode }) {
  return (
    <CrumbProvider>
      <div className="flex h-[100dvh] overflow-hidden bg-[var(--q-bg)] print:block print:h-auto print:overflow-visible print:bg-white">
        <Sidebar identity={identity} />
        <div
          className="relative flex min-w-0 flex-1 flex-col overflow-y-auto print:block print:overflow-visible"
          style={{ background: "var(--dashboard-bg)", overscrollBehavior: "none" }}
        >
          <Header identity={identity} />
          <main
            id="contenu"
            className="mx-auto flex w-full max-w-[1240px] flex-1 flex-col gap-5 px-4 pb-[calc(112px+env(safe-area-inset-bottom))] pt-[max(20px,env(safe-area-inset-top))] md:px-6 lg:pb-10 lg:pt-7 print:max-w-none print:p-0"
          >
            {children}
          </main>
        </div>
        <MobileBottomNav identity={identity} />
      </div>
    </CrumbProvider>
  )
}
