'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { UserPlus, FileText, Building2, Loader2, ArrowRight } from 'lucide-react'

/* ── Assets ── */
const LOGO_LONG = 'https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Logo%20long%20bleu.webp'
const PICTO_Q   = 'https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Logo%20bleu%20Qonforme%20PNG.webp'

/* ── Actions ── */
const ACTIONS = [
  {
    id: 'company',
    icon: Building2,
    label: 'Compléter mon profil entreprise',
    description: 'Logo, SIREN, IBAN, coordonnées',
    href: '/settings/company',
    iconBg: 'bg-[#EFF6FF] dark:bg-[#1E3A5F]',
    iconColor: 'text-[#2563EB]',
    hoverBorder: 'hover:border-[#93C5FD] dark:hover:border-[#2563EB]',
    hoverBg: 'hover:bg-[#F8FAFF] dark:hover:bg-[#0F2040]',
  },
  {
    id: 'client',
    icon: UserPlus,
    label: 'Ajouter mon premier client',
    description: 'Nom, email, SIREN, adresse',
    href: '/clients/new',
    iconBg: 'bg-[#F0FDF4] dark:bg-[#052E16]',
    iconColor: 'text-[#16A34A]',
    hoverBorder: 'hover:border-[#86EFAC] dark:hover:border-[#16A34A]',
    hoverBg: 'hover:bg-[#F7FFF8] dark:hover:bg-[#052E16]/60',
  },
  {
    id: 'invoice',
    icon: FileText,
    label: 'Créer ma première facture',
    description: 'Conforme EN 16931, prête en 2 min',
    href: '/invoices/new',
    iconBg: 'bg-[#FFF7ED] dark:bg-[#431407]',
    iconColor: 'text-[#EA580C]',
    hoverBorder: 'hover:border-[#FDBA74] dark:hover:border-[#EA580C]',
    hoverBg: 'hover:bg-[#FFFAF7] dark:hover:bg-[#431407]/60',
  },
] as const

/* ── Props ── */
interface WelcomeModalProps {
  onClose: () => void
}

/* ════════════════════════════════════════════════════════════════════ */

export default function WelcomeModal({ onClose }: WelcomeModalProps) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)

  // Marquer "vu" dès l'affichage.
  // 1. localStorage immédiat (filet de sécurité si l'API échoue)
  // 2. DB via POST /api/onboarding/seen (source de vérité durable)
  // Retry avec backoff exponentiel (4 tentatives : 1s, 2s, 4s, 8s).
  useEffect(() => {
    // Écriture localStorage immédiate — empêche le modal de réapparaître
    // même si tous les appels API échouent
    try {
      localStorage.setItem('qonforme_onboarding_seen', '1')
    } catch {
      // navigation privée, etc.
    }

    async function markSeenInDB() {
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          const res = await fetch('/api/onboarding/seen', { method: 'POST' })
          if (res.ok) return
          // 404 = company pas encore créée, on retente
          if (res.status !== 404) return // autre erreur (401, 500) : inutile de retenter
        } catch {
          // erreur réseau : on retente
        }
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)))
      }
    }
    markSeenInDB()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleAction(href: string, id: string) {
    setLoading(id)
    onClose()
    router.push(href)
  }

  async function handleLater() {
    setLoading('later')
    onClose()
  }

  return (
    /*
     * Overlay :
     * - bg-black/60 sans backdrop-blur sur mobile (règle CLAUDE.md — crash GPU iOS Safari)
     * - md:backdrop-blur-sm uniquement sur desktop
     * - overscroll-contain bloque le scroll du fond sur iOS Safari
     */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overscroll-contain"
      style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
    >
      {/* Fond assombri */}
      <div className="absolute inset-0 bg-black/60 md:backdrop-blur-sm" />

      {/* Picto Q filigrane — décoratif, derrière la card */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center justify-center select-none z-[1]"
        style={{ opacity: 0.04 }}
      >
        <Image src={PICTO_Q} alt="" width={400} height={400} className="w-[320px]" unoptimized />
      </div>

      {/* ── Card principale ── */}
      <div
        className={[
          'relative z-10 flex flex-col',
          'w-[calc(100%-32px)] max-w-sm',
          'rounded-3xl overflow-hidden',
          'bg-white dark:bg-[#0F1E35]',
          'border border-[#E2E8F0] dark:border-[#1E3A5F]',
          'shadow-[0_24px_64px_-12px_rgba(15,23,42,0.22)]',
        ].join(' ')}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >

        {/* ── Header ── */}
        <div className="flex flex-col items-center gap-3 px-6 pt-7 pb-6 bg-[#F8FAFC] dark:bg-[#162032] border-b border-[#E2E8F0] dark:border-[#1E3A5F]">

          {/* Logo long Qonforme */}
          <Image
            src={LOGO_LONG}
            alt="Qonforme"
            width={140}
            height={34}
            className="h-8 w-auto"
            unoptimized
            priority
          />

          {/* Titre */}
          <div className="text-center">
            <h2 className="text-[18px] font-bold text-[#0F172A] dark:text-[#E2E8F0] leading-tight">
              Bienvenue sur Qonforme 👋
            </h2>
            <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-1">
              Par où voulez-vous commencer ?
            </p>
          </div>

          {/* Badge conformité */}
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#BFDBFE] bg-[#EFF6FF] dark:bg-[#1E3A5F] dark:border-[#2563EB]/30 px-3 py-1 text-[11px] font-medium text-[#2563EB]">
            <span className="relative flex h-1.5 w-1.5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#2563EB] opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#2563EB]" />
            </span>
            Conforme réglementation 2026
          </span>
        </div>

        {/* ── Actions ── */}
        <div className="flex flex-col gap-2.5 p-4">
          {ACTIONS.map((action) => {
            const Icon = action.icon
            const isLoading = loading === action.id

            return (
              <button
                key={action.id}
                onClick={() => handleAction(action.href, action.id)}
                disabled={loading !== null}
                touch-action="manipulation"
                className={[
                  'group w-full flex items-center gap-3.5 p-3.5 rounded-2xl text-left',
                  'border border-[#E2E8F0] dark:border-[#1E3A5F]',
                  'bg-white dark:bg-[#0F1E35]',
                  action.hoverBorder,
                  action.hoverBg,
                  'transition-all duration-150',
                  'active:scale-[0.98]',
                  'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
                  'touch-manipulation',
                  'shadow-sm hover:shadow-md',
                ].join(' ')}
              >
                {/* Icône */}
                <div
                  className={[
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                    action.iconBg,
                    action.iconColor,
                  ].join(' ')}
                >
                  {isLoading
                    ? <Loader2 className="w-5 h-5 animate-spin" />
                    : <Icon className="w-5 h-5" />
                  }
                </div>

                {/* Texte */}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-[#0F172A] dark:text-[#E2E8F0] leading-tight">
                    {action.label}
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                    {action.description}
                  </p>
                </div>

                {/* Chevron */}
                <ArrowRight
                  className={[
                    'w-4 h-4 shrink-0 transition-colors',
                    'text-slate-300 dark:text-slate-600',
                    'group-hover:text-slate-500 dark:group-hover:text-slate-400',
                  ].join(' ')}
                />
              </button>
            )
          })}
        </div>

        {/* ── Lien "Plus tard" ── */}
        <div className="pb-5 pt-1 text-center">
          <button
            onClick={handleLater}
            disabled={loading !== null}
            className="text-[13px] text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors disabled:opacity-40 touch-manipulation"
          >
            {loading === 'later' ? (
              <span className="inline-flex items-center gap-1.5">
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
