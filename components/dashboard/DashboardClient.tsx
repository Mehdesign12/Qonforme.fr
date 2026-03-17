'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'

// Chargement lazy du modal (évite d'alourdir le bundle principal)
const WelcomeModal = dynamic(() => import('@/components/onboarding/WelcomeModal'), {
  ssr: false,
})

const ONBOARDING_SEEN_KEY = 'qonforme_onboarding_seen'

interface DashboardClientProps {
  showWelcome: boolean
  children: React.ReactNode
}

export default function DashboardClient({ showWelcome, children }: DashboardClientProps) {
  // Source de vérité = onboarding_seen_at en base (via prop serveur showWelcome).
  // Fallback localStorage = filet de sécurité si le POST /api/onboarding/seen échoue.
  const [modalVisible, setModalVisible] = useState(false)

  useEffect(() => {
    if (!showWelcome) return
    // Même si la DB dit "pas vu", le localStorage peut rattraper un échec API précédent
    try {
      if (localStorage.getItem(ONBOARDING_SEEN_KEY) === '1') return
    } catch {
      // localStorage indisponible (navigation privée, etc.) → on continue normalement
    }
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
