import { Sidebar } from "@/components/layout/Sidebar"
import { HeaderServer } from "@/components/layout/HeaderServer"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    /*
     * Fond global : dégradé bleu très subtil identique à l'univers pricing.
     * 100dvh + overflow-hidden pour Safari iOS (évite les rebonds de scroll).
     */
    <div
      className="flex h-[100dvh] overflow-hidden"
      style={{
        background: 'linear-gradient(250deg, #EFF6FF 0%, #DBEAFE 20%, #F0F9FF 45%, #F8FAFC 70%, #ffffff 100%)',
      }}
    >
      {/* Tache lumineuse décorative haut-droite */}
      <div
        aria-hidden
        className="pointer-events-none select-none fixed top-0 right-0 w-[600px] h-[600px] z-0"
        style={{ background: 'radial-gradient(circle at 80% 10%, rgba(37,99,235,0.06) 0%, transparent 60%)' }}
      />
      {/* Tache lumineuse bas-gauche */}
      <div
        aria-hidden
        className="pointer-events-none select-none fixed bottom-0 left-0 w-[400px] h-[400px] z-0"
        style={{ background: 'radial-gradient(circle at 20% 90%, rgba(99,102,241,0.05) 0%, transparent 60%)' }}
      />

      <Sidebar />

      <div className="relative z-10 flex flex-col flex-1 min-w-0">
        <HeaderServer />
        <main
          className="flex-1 overflow-y-auto px-4 py-5 md:px-6 md:py-6"
          style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom, 24px))' }}
        >
          {children}
        </main>
      </div>
    </div>
  )
}
