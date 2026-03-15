import { Sidebar, MobileBottomNav } from "@/components/layout/Sidebar"
import { HeaderServer } from "@/components/layout/HeaderServer"

export default function PurchaseOrdersLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex overflow-hidden"
      style={{
        height: "100dvh",
        background: "var(--dashboard-bg)",
      }}
    >
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <div style={{ isolation: "isolate", contain: "layout style" }}>
          <HeaderServer />
        </div>
        <main
          className="flex-1 overflow-y-auto p-4 md:p-6"
          style={{
            paddingBottom:      "max(1.5rem, env(safe-area-inset-bottom))",
            overscrollBehavior: "none",
          }}
        >
          {children}
        </main>
        <MobileBottomNav />
      </div>
    </div>
  )
}
