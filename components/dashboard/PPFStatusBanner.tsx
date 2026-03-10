import { CheckCircle2, AlertCircle } from "lucide-react"

interface PPFStatusBannerProps {
  connected: boolean
}

export function PPFStatusBanner({ connected }: PPFStatusBannerProps) {
  if (connected) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-[#D1FAE5] border border-[#6EE7B7] rounded-lg text-sm">
        <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
        <span className="text-[#065F46] font-medium">
          Connexion au Portail de Facturation active — tes factures sont transmises automatiquement
        </span>
      </div>
    )
  }

  return (
    <div className="flex items-start sm:items-center justify-between gap-3 px-4 py-3 bg-[#FEF3C7] border border-[#FCD34D] rounded-lg text-sm">
      <div className="flex items-start sm:items-center gap-3">
        <AlertCircle className="w-4 h-4 text-[#D97706] shrink-0 mt-0.5 sm:mt-0" />
        <span className="text-[#92400E]">
          <span className="font-medium">Transmission automatique non configurée.</span>{" "}
          <span className="hidden sm:inline">Configure la connexion pour envoyer tes factures légalement.</span>
        </span>
      </div>
      <a href="/settings/ppf" className="text-xs font-medium text-[#92400E] underline whitespace-nowrap hover:text-[#D97706] shrink-0">
        Configurer →
      </a>
    </div>
  )
}
