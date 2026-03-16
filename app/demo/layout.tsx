import { DemoSidebar } from "@/components/layout/DemoSidebar"
import { DemoHeader } from "@/components/layout/DemoHeader"
import { DemoMobileBottomNav } from "@/components/layout/DemoSidebar"

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[100dvh] bg-[#F8FAFC] overflow-hidden">
      {/* Sidebar desktop uniquement */}
      <DemoSidebar />

      <div className="flex flex-col flex-1 min-w-0">
        <DemoHeader />

        <main
          className="flex-1 overflow-y-auto px-4 py-5 md:px-6 md:py-6"
          style={{
            paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom, 1.25rem))',
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'none',
          }}
        >
          {children}
        </main>

        {/* Barre de navigation mobile (bas d'écran) */}
        <DemoMobileBottomNav />
      </div>
    </div>
  )
}
