import { Sidebar } from "@/components/layout/Sidebar"
import { Header } from "@/components/layout/Header"

export default function PurchaseOrdersLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex overflow-hidden"
      style={{
        height: "100dvh",
        background: "linear-gradient(160deg, #EFF6FF 0%, #DBEAFE 18%, #F0F9FF 40%, #F8FAFC 65%, #ffffff 100%)",
      }}
    >
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header />
        <main
          className="flex-1 overflow-y-auto p-4 md:p-6"
          style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
        >
          {children}
        </main>
      </div>
    </div>
  )
}
