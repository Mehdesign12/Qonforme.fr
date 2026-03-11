import Link from "next/link"
import { CheckCircle2, ArrowRight, Wifi } from "lucide-react"

interface PPFStatusBannerProps {
  connected: boolean
}

export function PPFStatusBanner({ connected }: PPFStatusBannerProps) {
  /* ── Connecté ── */
  if (connected) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-[#6EE7B7] bg-[#D1FAE5] px-4 py-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/60">
          <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-[#065F46]">
            Transmission automatique active
          </p>
          <p className="text-[12px] text-[#10B981]/80 mt-0.5 hidden sm:block">
            Tes factures sont envoyées directement au Portail Public de Facturation.
          </p>
        </div>
        <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-white/60 px-2.5 py-0.5 text-[11px] font-semibold text-[#065F46]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
          Connecté
        </span>
      </div>
    )
  }

  /* ── Non connecté ── */
  return (
    <div className="flex items-start sm:items-center justify-between gap-4 rounded-xl border border-[#FCD34D] bg-[#FFFBEB] px-4 py-3">
      <div className="flex items-start sm:items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#FEF3C7]">
          <Wifi className="w-4 h-4 text-[#D97706]" />
        </div>
        <div>
          <p className="text-[13px] font-semibold text-[#92400E]">
            Transmission automatique non configurée
          </p>
          <p className="text-[12px] text-[#D97706]/80 mt-0.5 hidden sm:block">
            Configure la connexion pour envoyer tes factures légalement via le PPF.
          </p>
        </div>
      </div>
      <Link
        href="/settings/ppf"
        className="shrink-0 inline-flex items-center gap-1 rounded-[8px] bg-[#D97706] hover:bg-[#B45309] text-white text-[12px] font-semibold px-3 py-1.5 transition-colors whitespace-nowrap"
      >
        Configurer
        <ArrowRight className="w-3 h-3" />
      </Link>
    </div>
  )
}
