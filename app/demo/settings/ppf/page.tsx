export const dynamic = "force-dynamic"

import { AlertCircle, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function DemoPPFSettingsPage() {
  return (
    <div className="max-w-2xl space-y-6 animate-fade-in">
      <div className="flex items-start gap-4 p-5 rounded-xl border bg-[#FEF3C7] border-[#FCD34D]">
        <AlertCircle className="w-5 h-5 text-[#D97706] mt-0.5 shrink-0" />
        <div>
          <p className="font-semibold text-sm text-[#92400E]">Transmission non configurée</p>
          <p className="text-xs mt-1 text-[#92400E]">
            Configure les identifiants pour activer la transmission automatique légale de tes factures.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm space-y-4">
        <h2 className="font-semibold text-[#0F172A]">Identifiants de connexion</h2>
        <p className="text-sm text-slate-500">
          Ces identifiants sont fournis lors de ton inscription au Portail Public de Facturation (Chorus Pro).
        </p>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-[#0F172A]">Client ID</label>
            <input
              type="text"
              defaultValue="demo-client-id-placeholder"
              disabled
              className="mt-1 w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg bg-slate-50 font-mono text-slate-400 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-[#0F172A]">Client Secret</label>
            <input
              type="password"
              defaultValue="demo-secret"
              disabled
              className="mt-1 w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg bg-slate-50 font-mono text-slate-400 cursor-not-allowed"
            />
          </div>
        </div>
        <div className="flex items-center gap-3 pt-2">
          <Button className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white" disabled>
            Tester et sauvegarder
          </Button>
          <a
            href="https://developer.chorus-pro.gouv.fr"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm text-[#2563EB] hover:underline"
          >
            Documentation Chorus Pro <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  )
}
