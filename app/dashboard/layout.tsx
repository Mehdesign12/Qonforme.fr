import { Sidebar } from "@/components/layout/Sidebar"
import { MobileBottomNav } from "@/components/layout/Sidebar"
import { HeaderServer } from "@/components/layout/HeaderServer"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    /*
     * Fond global : dégradé bleu très subtil identique à l'univers pricing.
     * 100dvh + overflow-hidden pour Safari iOS (évite les rebonds de scroll).
     */
    <div
      className="flex h-[100dvh] overflow-hidden"
      style={{ background: 'var(--dashboard-bg)' }}
    >
      {/* Tache lumineuse décorative haut-droite */}
      <div
        aria-hidden
        className="pointer-events-none select-none fixed top-0 right-0 w-[600px] h-[600px] z-0"
        style={{ background: 'var(--dashboard-blob1)' }}
      />
      {/* Tache lumineuse bas-gauche */}
      <div
        aria-hidden
        className="pointer-events-none select-none fixed bottom-0 left-0 w-[400px] h-[400px] z-0"
        style={{ background: 'var(--dashboard-blob2)' }}
      />

      <Sidebar />

      <div className="relative z-10 flex flex-col flex-1 min-w-0">
        {/*
         * isolation: isolate uniquement — crée un stacking-context dédié pour
         * le header (les backdrop-filter des pilules ne recomposent pas à chaque
         * frame de scroll), SANS contain ni transform qui piégeraient les
         * éléments position:fixed du MobileBottomNav/MobileSidebar.
         */}
        <div style={{ isolation: 'isolate' }}>
          <HeaderServer />
        </div>

        <main
          className="flex-1 overflow-y-auto px-4 py-5 md:px-6 md:py-6"
          style={{
            paddingBottom: 'max(24px, env(safe-area-inset-bottom, 24px))',
            WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'],
            overscrollBehavior: 'none',
          } as React.CSSProperties}
        >
          {children}
        </main>

        {/* Barre de navigation mobile — uniquement sur mobile (md:hidden interne) */}
        <MobileBottomNav />
      </div>
    </div>
  )
}
