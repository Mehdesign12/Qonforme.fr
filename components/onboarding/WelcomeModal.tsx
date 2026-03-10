'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Zap, UserPlus, FileText, Building2, Loader2 } from 'lucide-react'

interface WelcomeModalProps {
  onClose: () => void
}

const ACTIONS = [
  {
    id: 'company',
    icon: Building2,
    label: 'Compléter mon profil entreprise',
    description: 'Logo, SIREN, IBAN, coordonnées',
    href: '/settings/company',
    color: 'bg-[#EFF6FF] text-[#2563EB]',
    border: 'hover:border-[#2563EB]',
  },
  {
    id: 'client',
    icon: UserPlus,
    label: 'Ajouter mon premier client',
    description: 'Nom, email, SIREN, adresse',
    href: '/clients/new',
    color: 'bg-[#F0FDF4] text-[#16A34A]',
    border: 'hover:border-[#16A34A]',
  },
  {
    id: 'invoice',
    icon: FileText,
    label: 'Créer ma première facture',
    description: 'Prête à envoyer en 2 minutes',
    href: '/invoices/new',
    color: 'bg-[#FFF7ED] text-[#EA580C]',
    border: 'hover:border-[#EA580C]',
  },
] as const

export default function WelcomeModal({ onClose }: WelcomeModalProps) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)

  async function markSeen() {
    try {
      await fetch('/api/onboarding/seen', { method: 'POST' })
    } catch {
      // Non bloquant — on continue même si l'API échoue
    }
  }

  async function handleAction(href: string, id: string) {
    setLoading(id)
    await markSeen()
    onClose()
    router.push(href)
  }

  async function handleLater() {
    setLoading('later')
    await markSeen()
    onClose()
  }

  return (
    // Overlay — non cliquable pour fermer (spec)
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Fond assombri */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-br from-[#2563EB] to-[#1D4ED8] px-6 pt-7 pb-6 text-white text-center">
          <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center mx-auto mb-3">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-xl font-bold mb-1">Bienvenue sur Qonforme 👋</h2>
          <p className="text-blue-100 text-sm">
            Par où voulez-vous commencer ?
          </p>
        </div>

        {/* Actions */}
        <div className="p-5 space-y-3">
          {ACTIONS.map((action) => {
            const Icon = action.icon
            const isLoading = loading === action.id

            return (
              <button
                key={action.id}
                onClick={() => handleAction(action.href, action.id)}
                disabled={loading !== null}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 border-[#E2E8F0] ${action.border} bg-white transition-all text-left disabled:opacity-60 disabled:cursor-not-allowed group`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${action.color}`}>
                  {isLoading
                    ? <Loader2 className="w-5 h-5 animate-spin" />
                    : <Icon className="w-5 h-5" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#0F172A] leading-tight">
                    {action.label}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {action.description}
                  </p>
                </div>
                <svg
                  className="w-4 h-4 text-slate-300 group-hover:text-slate-500 shrink-0 transition-colors"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )
          })}
        </div>

        {/* Lien "Plus tard" */}
        <div className="pb-5 text-center">
          <button
            onClick={handleLater}
            disabled={loading !== null}
            className="text-sm text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50"
          >
            {loading === 'later' ? (
              <span className="flex items-center gap-1.5 justify-center">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Fermeture…
              </span>
            ) : (
              'Je ferai ça plus tard'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
