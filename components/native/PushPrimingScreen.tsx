'use client'

import { useState } from 'react'
import { Bell, Loader2 } from 'lucide-react'

interface PushPrimingScreenProps {
  /** L'utilisateur a choisi d'activer — déclenche la vraie popup système iOS. */
  onActivate: () => void
  /** L'utilisateur a choisi de passer — l'écran ne sera plus reproposé automatiquement. */
  onSkip: () => void
}

/**
 * Écran d'amorçage avant la demande d'autorisation de notifications.
 *
 * Montré une seule fois par appareil (voir `hasSeenPushPriming` /
 * `markPushPrimingSeen` dans `lib/native/push.ts`), juste avant le premier
 * appel à `PushNotifications.requestPermissions()`.
 *
 * Sans lui, iOS affiche sa popup système générique ("Qonforme aimerait vous
 * envoyer des notifications") sans le moindre contexte — la manière la plus
 * sûre de se faire refuser. Expliquer le bénéfice concret juste avant change
 * nettement le taux d'acceptation, et un refus iOS est quasi définitif
 * jusqu'à un passage manuel dans les Réglages.
 *
 * Même famille visuelle que `WelcomeModal` (overlay, carte arrondie, lien
 * "plus tard") — sans backdrop-filter sur mobile, règle CLAUDE.md.
 */
export function PushPrimingScreen({ onActivate, onSkip }: PushPrimingScreenProps) {
  const [loading, setLoading] = useState<'activate' | 'skip' | null>(null)

  const handleActivate = () => {
    setLoading('activate')
    onActivate()
  }

  const handleSkip = () => {
    setLoading('skip')
    onSkip()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overscroll-contain"
      style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
    >
      {/* Fond assombri — bg-black/60 sans blur sur mobile (règle CLAUDE.md), desktop uniquement. */}
      <div className="absolute inset-0 bg-black/60 md:backdrop-blur-sm" />

      <div
        className={[
          'relative z-10 flex flex-col items-center',
          'w-[calc(100%-32px)] max-w-sm',
          'rounded-3xl overflow-hidden',
          'bg-white dark:bg-[#0F1E35]',
          'border border-[#E2E8F0] dark:border-[#1E3A5F]',
          'shadow-[0_24px_64px_-12px_rgba(15,23,42,0.22)]',
          'px-6 pt-8 pb-5',
        ].join(' ')}
        style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom, 0px))' }}
      >
        {/* Icône */}
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EFF6FF] dark:bg-[#1E3A5F]">
          <Bell className="h-7 w-7 text-[#2563EB] dark:text-[#60A5FA]" />
        </div>

        <h2 className="mt-5 text-center text-[19px] font-bold leading-tight text-[#0F172A] dark:text-[#E2E8F0]">
          Ne ratez plus une échéance
        </h2>
        <p className="mt-2.5 text-center text-[14px] leading-relaxed text-slate-500 dark:text-slate-400">
          Activez les notifications pour être alerté dès qu’une facture arrive
          à échéance ou qu’un client tarde à payer — sans avoir à rouvrir
          l’app pour le savoir.
        </p>

        <button
          type="button"
          onClick={handleActivate}
          disabled={loading !== null}
          className={[
            'mt-6 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl',
            'bg-[#2563EB] text-[15px] font-semibold text-white',
            'transition-colors hover:bg-[#1D4ED8]',
            'active:scale-[0.98] transition-transform',
            'disabled:opacity-60 disabled:active:scale-100',
            'touch-manipulation',
          ].join(' ')}
        >
          {loading === 'activate' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Bell className="h-4 w-4" />
          )}
          Activer les notifications
        </button>

        <button
          type="button"
          onClick={handleSkip}
          disabled={loading !== null}
          className="mt-3.5 text-[13px] text-slate-400 dark:text-slate-500 transition-colors hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-40 touch-manipulation"
        >
          {loading === 'skip' ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Fermeture…
            </span>
          ) : (
            'Plus tard'
          )}
        </button>
      </div>
    </div>
  )
}
