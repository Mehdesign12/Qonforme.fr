'use client'

import { useEffect, useState } from 'react'
import { PLANS } from '@/lib/stripe/plans'

// Une seule lecture par chargement de page, partagée par tous les composants
let pending: Promise<boolean> | null = null

function readArtisanOnSale(): Promise<boolean> {
  if (!pending) {
    pending = fetch('/api/subscription/status')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => (typeof data?.artisanOnSale === 'boolean' ? data.artisanOnSale : PLANS.pro.available))
      .catch(() => PLANS.pro.available)
  }
  return pending
}

/**
 * La formule Artisan est-elle en vente pour ce compte ? Le réglage public tant que
 * la réponse du serveur n'est pas là ; un compte d'essai la voit en vente dès que
 * ses prix d'essai existent (lib/stripe/availability.ts).
 */
export function useArtisanOnSale(): boolean {
  const [onSale, setOnSale] = useState<boolean>(PLANS.pro.available)
  useEffect(() => {
    let active = true
    readArtisanOnSale().then((value) => { if (active) setOnSale(value) })
    return () => { active = false }
  }, [])
  return onSale
}
