import { DemoSidebar } from "@/components/layout/DemoSidebar"
import { DemoHeader } from "@/components/layout/DemoHeader"

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden">
      <DemoSidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <DemoHeader />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
