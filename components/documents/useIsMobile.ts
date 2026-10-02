'use client'

import { useEffect, useState } from "react"

/**
 * Vrai sous 768 px (seuil `md`). Faux au premier rendu (serveur compris) pour
 * éviter tout écart d'hydratation ; mis à jour après le montage.
 */
export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)")
    const update = () => setMobile(mq.matches)
    update()
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [])
  return mobile
}
