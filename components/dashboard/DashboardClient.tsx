'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { hasSeenOnboardingLocally, markOnboardingSeen } from '@/components/dashboard/onboarding'

// Chargement lazy du modal (évite d'alourdir le bundle principal)
const WelcomeModal = dynamic(() => import('@/components/onboarding/WelcomeModal'), {
  ssr: false,
})

interface DashboardClientProps {
  showWelcome: boolean
  /**
   * Compte neuf : les tuiles « Pour commencer » sont dans la page (canevas
   * « Onb-8 ») ; on marque les premiers pas comme vus sans ouvrir la fenêtre.
   */
  inline?: boolean
  children: React.ReactNode
}

export default function DashboardClient({ showWelcome, inline = false, children }: DashboardClientProps) {
  // Source de vérité = onboarding_seen_at en base (via prop serveur showWelcome).
  // Fallback localStorage = filet de sécurité si le POST /api/onboarding/seen échoue.
  const [modalVisible, setModalVisible] = useState(false)

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
      {modalVisible && <WelcomeModal onClose={() => setModalVisible(false)} />}
    </>
  )
}
