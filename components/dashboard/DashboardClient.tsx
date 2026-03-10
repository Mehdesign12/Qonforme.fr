'use client'

import { useState } from 'react'
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
  const [modalVisible, setModalVisible] = useState(showWelcome)

  return (
    <>
      {children}
      {modalVisible && (
        <WelcomeModal onClose={() => setModalVisible(false)} />
      )}
    </>
  )
}
