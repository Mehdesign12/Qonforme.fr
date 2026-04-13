'use client'

import { useEffect, useRef } from 'react'
import { trackEvent } from '@/lib/meta-pixel'

/**
 * Composant invisible qui fire un événement Meta Pixel au mount.
 * À placer dans les pages serveur qui ne peuvent pas appeler fbq directement.
 */
export function MetaPixelEvent({ event, data }: { event: string; data?: Record<string, unknown> }) {
  const fired = useRef(false)
  useEffect(() => {
    if (fired.current) return
    fired.current = true
    trackEvent(event, data)
  // fire une seule fois au mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}
