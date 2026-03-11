import Link from "next/link"
import { CheckCircle2, ArrowRight, Wifi, Zap } from "lucide-react"

interface PPFStatusBannerProps {
  connected: boolean
}

export function PPFStatusBanner({ connected }: PPFStatusBannerProps) {

  /* ── Connecté ── */
  if (connected) {
    return (
      <div
        className="relative overflow-hidden flex items-center gap-3 rounded-2xl px-4 py-3 border"
        style={{
          background:          'linear-gradient(135deg, rgba(209,250,229,0.9) 0%, rgba(167,243,208,0.7) 100%)',
          borderColor:         'rgba(110,231,183,0.5)',
          backdropFilter:      'blur(8px)',
          WebkitBackdropFilter:'blur(8px)',
          boxShadow:           '0 2px 12px rgba(16,185,129,0.08)',
        }}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/60 backdrop-blur-sm">
          <CheckCircle2 className="w-4 h-4 text-[#059669]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-[#065F46]">
            Transmission PPF active
          </p>
          <p className="text-[11px] text-[#10B981]/80 mt-0.5 hidden sm:block">
            Tes factures sont envoyées directement au Portail Public de Facturation.
          </p>
        </div>
        <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-white/60 px-2.5 py-1 text-[11px] font-bold text-[#065F46]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
          Connecté
        </span>
      </div>
    )
  }

  /* ── Non connecté ── */
  return (
    <div
      className="relative overflow-hidden flex items-start sm:items-center justify-between gap-3 rounded-2xl px-4 py-3 border"
      style={{
        background:          'linear-gradient(135deg, rgba(255,251,235,0.95) 0%, rgba(254,243,199,0.80) 100%)',
        borderColor:         'rgba(252,211,77,0.5)',
        backdropFilter:      'blur(8px)',
        WebkitBackdropFilter:'blur(8px)',
        boxShadow:           '0 2px 12px rgba(217,119,6,0.07)',
      }}
    >
      {/* Déco */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-6 -top-6 w-24 h-24 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(252,211,77,0.25) 0%, transparent 70%)' }}
      />

      <div className="flex items-start sm:items-center gap-3 relative z-10">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#FEF3C7]/80">
          <Wifi className="w-4 h-4 text-[#D97706]" />
        </div>
        <div>
          <p className="text-[13px] font-bold text-[#92400E]">
            Transmission automatique non configurée
          </p>
          <p className="text-[11px] text-[#D97706]/80 mt-0.5 hidden sm:block">
            Configure la connexion pour envoyer tes factures légalement via le PPF.
          </p>
        </div>
      </div>

      <Link
        href="/settings/ppf"
        className="relative z-10 shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-[#D97706] hover:bg-[#B45309] active:bg-[#92400E] text-white text-[12px] font-bold px-3.5 py-2 transition-colors whitespace-nowrap shadow-sm"
      >
        <Zap className="w-3 h-3" />
        Configurer
        <ArrowRight className="w-3 h-3" />
      </Link>
    </div>
  )
}
