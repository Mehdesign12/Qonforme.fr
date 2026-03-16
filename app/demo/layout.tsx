import { DemoSidebar } from "@/components/layout/DemoSidebar"
import { DemoHeader } from "@/components/layout/DemoHeader"
import { DemoMobileBottomNav } from "@/components/layout/DemoSidebar"

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex h-[100dvh] overflow-hidden bg-[#EFF6FF] dark:bg-[#0B1628]"
      style={{ background: 'var(--dashboard-bg)' }}
    >
      {/* Blob décoratif haut-droite — identique au vrai dashboard */}
      <div
        aria-hidden
        className="pointer-events-none select-none fixed top-0 right-0 w-[600px] h-[600px] z-0"
        style={{ background: 'var(--dashboard-blob1)' }}
      />
      {/* Blob décoratif bas-gauche */}
      <div
        aria-hidden
        className="pointer-events-none select-none fixed bottom-0 left-0 w-[400px] h-[400px] z-0"
        style={{ background: 'var(--dashboard-blob2)' }}
      />

      {/* Sidebar desktop uniquement */}
      <DemoSidebar />

      <div className="relative z-10 flex flex-col flex-1 min-w-0">
        <div style={{ isolation: 'isolate' }}>
          <DemoHeader />
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

        <DemoMobileBottomNav />
      </div>
    </div>
  )
}
