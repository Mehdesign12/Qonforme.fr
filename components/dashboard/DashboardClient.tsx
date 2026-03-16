'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'

// Chargement lazy du modal (évite d'alourdir le bundle principal)
const WelcomeModal = dynamic(() => import('@/components/onboarding/WelcomeModal'), {
  ssr: false,
})

interface DashboardClientProps {
  showWelcome: boolean
  children: React.ReactNode
}

export default function DashboardClient({ showWelcome, children }: DashboardClientProps) {
  // La prop serveur showWelcome est dérivée de onboarding_seen_at en base.
  // C'est la seule source de vérité — pas de localStorage.
  const [modalVisible, setModalVisible] = useState(false)

  useEffect(() => {
    if (showWelcome) setModalVisible(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      {children}
      {modalVisible && <WelcomeModal onClose={() => setModalVisible(false)} />}
    </>
  )
}
