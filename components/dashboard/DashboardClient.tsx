'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { hasSeenOnboardingLocally, markOnboardingSeen } from '@/components/dashboard/onboarding'
import type { InscriptionDialogProps } from '@/components/onboarding/InscriptionDialog'

// Chargement lazy du modal (évite d'alourdir le bundle principal)
const WelcomeModal = dynamic(() => import('@/components/onboarding/WelcomeModal'), {
  ssr: false,
})

// Fenêtre « Bienvenue » de l'inscription en deux champs, chargée seulement à son ouverture
const InscriptionDialog = dynamic(() => import('@/components/onboarding/InscriptionDialog'), {
  ssr: false,
})

/**
 * Fenêtre « Bienvenue » telle que la page la calcule (app/dashboard/page.tsx,
 * démo : app/demo/bienvenue/page.tsx) : `open` à l'ouverture automatique ou sur
 * `?inscription=reprendre`, `resume` pour rouvrir même si `open` n'a pas changé.
 */
export type InscriptionLaunch = Omit<InscriptionDialogProps, 'open' | 'onClose'> & {
  open: boolean
  resume?: boolean
}

interface DashboardClientProps {
  showWelcome: boolean
  /**
   * Compte neuf : les tuiles « Pour commencer » sont dans la page (canevas
   * « Onb-8 ») ; on marque les premiers pas comme vus sans ouvrir la fenêtre.
   */
  inline?: boolean
  /** Inscription à terminer (compte sans entreprise, ou étape restante). */
  inscription?: InscriptionLaunch | null
  children: React.ReactNode
}

export default function DashboardClient({ showWelcome, inline = false, inscription = null, children }: DashboardClientProps) {
  // Source de vérité = onboarding_seen_at en base (via prop serveur showWelcome).
  // Fallback localStorage = filet de sécurité si le POST /api/onboarding/seen échoue.
  const [modalVisible, setModalVisible] = useState(false)

  // Données figées à l'ouverture : les rafraîchissements de la page après chaque
  // étape (router.refresh) ne referment ni ne réinitialisent la fenêtre
  const [launch, setLaunch] = useState<InscriptionLaunch | null>(inscription?.open ? inscription : null)
  const wantsOpen = !!inscription?.open
  const resume = !!inscription?.resume

  useEffect(() => {
    if (wantsOpen && inscription) setLaunch(inscription)
  // Rouvre seulement quand la page le demande (ouverture, ou tuile « Reprendre »)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantsOpen, resume])

  useEffect(() => {
    if (!showWelcome) return
    if (inline) {
      void markOnboardingSeen()
      return
    }
    // Même si la DB dit "pas vu", le localStorage peut rattraper un échec API précédent
    if (hasSeenOnboardingLocally()) return
    setModalVisible(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      {children}
      {modalVisible && !launch && <WelcomeModal onClose={() => setModalVisible(false)} />}
      {launch && (
        <InscriptionDialog
          {...launch}
          open
          onClose={() => setLaunch(null)}
        />
      )}
    </>
  )
}
