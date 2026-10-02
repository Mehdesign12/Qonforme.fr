'use client'

/**
 * Fenêtre de bienvenue « Par où voulez-vous commencer ? », au premier passage
 * sur le tableau de bord d'un compte qui a déjà des documents (un compte neuf
 * voit les tuiles « Pour commencer » dans la page, canevas « Onb-8 »).
 *
 * Styles du kit (jetons --q-*, thème sombre compris). Voile sans flou sur
 * mobile (.q-veil : flou seulement ≥ 768 px, règle iOS de CLAUDE.md).
 * Aucune promesse de conformité : la transmission n'est pas encore livrée.
 */
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { UserPlus, FileText, FileCheck2, Building2, Loader2, ArrowRight } from 'lucide-react'
import { LOGO_Q } from '@/lib/brand'
import { markOnboardingSeen } from '@/components/dashboard/onboarding'

/* ── Actions ── */
const ACTIONS = [
  {
    id: 'company',
    icon: Building2,
    label: 'Compléter votre entreprise',
    description: 'SIREN, adresse, IBAN : repris sur vos documents',
    href: '/settings/company',
  },
  {
    id: 'client',
    icon: UserPlus,
    label: 'Ajouter votre premier client',
    description: 'Par son SIREN ou à la main',
    href: '/clients/new',
  },
  {
    id: 'quote',
    icon: FileCheck2,
    label: 'Faire un devis',
    description: 'Gratuit et sans limite de nombre',
    href: '/quotes/new',
  },
  {
    id: 'invoice',
    icon: FileText,
    label: 'Créer une facture',
    description: 'Directe, sans passer par un devis',
    href: '/invoices/new',
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

  // Marquer « vu » dès l'affichage (localStorage puis base, avec nouvelles tentatives)
  useEffect(() => {
    void markOnboardingSeen()
  }, [])

  // Échap ferme la fenêtre, comme « Je ferai ça plus tard »
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

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
     * - .q-veil : voile sans backdrop-filter sur mobile (crash GPU iOS Safari), flou léger ≥ 768 px
     * - overscroll-contain bloque le scroll du fond sur iOS Safari
     */
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overscroll-contain sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-title"
      aria-describedby="welcome-desc"
    >
      <div className="q-veil absolute inset-0" aria-hidden />

      {/* ── Carte ── */}
      <div
        className={[
          'relative z-10 flex w-full flex-col overflow-hidden',
          'max-sm:rounded-t-[24px] sm:w-[calc(100%-32px)] sm:max-w-[440px] sm:rounded-[20px]',
          'border border-[var(--q-line)] bg-[var(--q-surface)] shadow-[var(--q-shadow-pop)]',
        ].join(' ')}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="q-sheet-grip sm:hidden" aria-hidden />

        {/* ── En-tête ── */}
        <div className="flex flex-col gap-3 px-6 pb-2 pt-6">
          <Image src={LOGO_Q} alt="Qonforme" width={32} height={32} className="size-8" sizes="32px" priority />
          <div className="flex flex-col gap-1">
            <h2 id="welcome-title" className="q-display text-[22px] leading-tight text-[var(--q-ink)]">
              Bienvenue sur Qonforme
            </h2>
            <p id="welcome-desc" className="text-[15px] text-[var(--q-text-3)]">
              Par où voulez-vous commencer&nbsp;? Rien ne part sans vous.
            </p>
          </div>
        </div>

        {/* ── Actions ── */}
        <div className="flex flex-col gap-2 p-4">
          {ACTIONS.map((action) => {
            const Icon = action.icon
            const isLoading = loading === action.id

            return (
              <button
                key={action.id}
                type="button"
                onClick={() => handleAction(action.href, action.id)}
                disabled={loading !== null}
                className={[
                  'group flex w-full items-center gap-3.5 rounded-[14px] p-3.5 text-left',
                  'border border-[var(--q-line)] bg-[var(--q-surface)]',
                  'transition-[border-color,background-color,transform] duration-150',
                  'hover:border-[var(--q-field)] hover:bg-[var(--q-surface-2)]',
                  'active:scale-[0.99] motion-reduce:active:scale-100',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--q-accent)]',
                  'disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100',
                  'touch-manipulation',
                ].join(' ')}
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--q-wash)] text-[var(--q-accent-strong)]">
                  {isLoading
                    ? <Loader2 className="size-5 animate-spin" aria-hidden />
                    : <Icon className="size-[22px]" strokeWidth={1.5} aria-hidden />
                  }
                </span>

                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[15px] font-semibold leading-tight text-[var(--q-ink)]">{action.label}</span>
                  <span className="text-[13px] text-[var(--q-text-3)]">{action.description}</span>
                </span>

                <ArrowRight
                  className="size-[18px] shrink-0 text-[var(--q-placeholder)] transition-colors group-hover:text-[var(--q-accent-strong)]"
                  strokeWidth={1.5}
                  aria-hidden
                />
              </button>
            )
          })}
        </div>

        {/* ── « Plus tard » ── */}
        <div className="flex justify-center px-4 pb-5">
          <button
            type="button"
            onClick={handleLater}
            disabled={loading !== null}
            className="q-btn q-btn-ghost touch-manipulation"
          >
            {loading === 'later' ? (
              <>
                <Loader2 className="animate-spin" aria-hidden />
                Fermeture…
              </>
            ) : (
              'Je ferai ça plus tard'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
