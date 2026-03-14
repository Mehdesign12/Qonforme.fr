import Link from "next/link"
import { CheckCircle2, ArrowRight, FileCheck, BookOpen } from "lucide-react"

interface PPFStatusBannerProps {
  connected: boolean
}

export function PPFStatusBanner({ connected }: PPFStatusBannerProps) {

  /* ── Connecté (réservé pour usage futur IOPOLE) ── */
  if (connected) {
    return (
      <div
        className="relative overflow-hidden flex items-center gap-3 rounded-2xl px-4 py-3 border"
        style={{
          background:  "linear-gradient(135deg, rgba(209,250,229,0.97) 0%, rgba(167,243,208,0.90) 100%)",
          borderColor: "rgba(110,231,183,0.5)",
          boxShadow:   "0 2px 12px rgba(16,185,129,0.08)",
        }}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/70">
          <CheckCircle2 className="w-4 h-4 text-[#059669]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-[#065F46]">
            Factur-X certifié EN 16931 — prêt sur chaque facture
          </p>
          <p className="text-[11px] text-[#10B981]/80 mt-0.5 hidden sm:block">
            Télécharge ton fichier XML en un clic depuis n&apos;importe quelle facture.
          </p>
        </div>
        <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-white/60 px-2.5 py-1 text-[11px] font-bold text-[#065F46]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
          Actif
        </span>
      </div>
    )
  }

  /* ── État standard ── */
  return (
    <div
      className="relative overflow-hidden flex items-start sm:items-center justify-between gap-3 rounded-2xl px-4 py-3 border"
      style={{
        background:  "linear-gradient(135deg, rgba(239,246,255,0.98) 0%, rgba(219,234,254,0.92) 100%)",
        borderColor: "rgba(147,197,253,0.5)",
        boxShadow:   "0 2px 12px rgba(37,99,235,0.07)",
      }}
    >
      {/* Déco */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-6 -top-6 w-24 h-24 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(147,197,253,0.25) 0%, transparent 70%)" }}
      />

      <div className="flex items-start sm:items-center gap-3 relative z-10">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#EFF6FF]/80">
          <FileCheck className="w-4 h-4 text-[#2563EB]" />
        </div>
        <div>
          <p className="text-[13px] font-bold text-[#1E40AF]">
            Factur-X certifié prêt sur chaque facture
          </p>
          <p className="text-[11px] text-[#2563EB]/70 mt-0.5 hidden sm:block">
            Télécharge le fichier XML EN 16931 en un clic — guide de transmission disponible.
          </p>
        </div>
      </div>

      <Link
        href="/settings/ppf"
        className="relative z-10 shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] active:bg-[#1E40AF] text-white text-[12px] font-bold px-3.5 py-2 transition-colors whitespace-nowrap shadow-sm touch-manipulation"
      >
        <BookOpen className="w-3 h-3" />
        Guide PPF
        <ArrowRight className="w-3 h-3" />
      </Link>
    </div>
  )
}
