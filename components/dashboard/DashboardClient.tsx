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

// Clé localStorage : une fois vue, ne plus jamais montrer même si le DB
// échoue à enregistrer onboarding_seen_at (race condition webhook Stripe).
const STORAGE_KEY = 'qonforme_onboarding_seen'

export default function DashboardClient({ showWelcome, children }: DashboardClientProps) {
  // Démarre à false — l'effet vérifie localStorage avant d'afficher.
  // Évite tout flash si le serveur dit showWelcome=true mais localStorage dit déjà vu.
  const [modalVisible, setModalVisible] = useState(false)

  useEffect(() => {
    if (!showWelcome) return
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setModalVisible(true)
    } catch {
      // localStorage indisponible (mode privé strict) → se fier au serveur
      setModalVisible(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleClose() {
    try { localStorage.setItem(STORAGE_KEY, '1') } catch { /* ignore */ }
    setModalVisible(false)
  }

  return (
    <>
      {children}
      {modalVisible && <WelcomeModal onClose={handleClose} />}
    </>
  )
}
