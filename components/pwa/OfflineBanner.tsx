'use client'

import { WifiOff } from 'lucide-react'
import { useOnline } from '@/lib/pwa/hooks'

/**
 * Bandeau signalant la perte de connexion.
 *
 * En PWA plein écran, l'utilisateur n'a plus la barre du navigateur pour
 * comprendre pourquoi une action échoue : sans ce repère, une facture qui ne
 * s'enregistre pas passe pour un bug de l'app.
 */
export function OfflineBanner() {
  const online = useOnline()

  if (online) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-0 z-[70] flex items-center justify-center gap-2 bg-[#0F172A] px-4 py-2 text-[13px] font-medium text-white"
      style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top, 0px))' }}
    >
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>Hors connexion — vos modifications ne seront pas enregistrées</span>
    </div>
  )
}
