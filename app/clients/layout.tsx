import { Sidebar } from "@/components/layout/Sidebar"
import { HeaderServer } from "@/components/layout/HeaderServer"

export default function ClientsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex overflow-hidden"
      style={{
        height: "100dvh",
        background: "linear-gradient(250deg, #EFF6FF 0%, #DBEAFE 20%, #F0F9FF 45%, #F8FAFC 70%, #ffffff 100%)",
      }}
    >
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <HeaderServer />
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
