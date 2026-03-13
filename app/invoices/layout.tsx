import { Sidebar } from "@/components/layout/Sidebar"
import { HeaderServer } from "@/components/layout/HeaderServer"

export default function AppLayout({ children }: { children: React.ReactNode }) {
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
        {/*
         * Solution D – isolation: isolate isole le blur du header du scroll de <main>.
         * contain: layout style empêche la propagation du recalcul.
         * translateZ(0) promeut le header sur une couche GPU dès le premier rendu.
         */}
        <div
          style={{
            isolation:  "isolate",
            contain:    "layout style",
            transform:  "translateZ(0)",
            willChange: "transform",
          }}
        >
          <HeaderServer />
        </div>
        <main
          className="flex-1 overflow-y-auto p-4 md:p-6"
          style={{
            paddingBottom:           "max(1.5rem, env(safe-area-inset-bottom))",
            willChange:              "transform",
            transform:               "translateZ(0)",
            overscrollBehavior:      "none",
          }}
        >
          {children}
        </main>
      </div>
    </div>
  )
}
