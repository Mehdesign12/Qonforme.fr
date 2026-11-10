"use client"

/**
 * Marque vus les événements de l'affiliation affichés sur la page (cookie de
 * l'admin, lib/affiliation/news.ts). Les repères « Nouveau » de la page restent
 * affichés (rendus avant l'écriture) ; la barre latérale recompte aussitôt
 * (événement `aff-seen`, AdminSidebar).
 */
import { useEffect } from "react"
import { AFF_SEEN_EVENT, SEEN_COOKIE, markSeen, parseSeen, serializeSeen, type MarkSeen } from "@/lib/affiliation/news"

function readCookie(): string | null {
  const hit = document.cookie.split("; ").find((c) => c.startsWith(SEEN_COOKIE + "="))
  return hit ? hit.slice(SEEN_COOKIE.length + 1) : null
}

export function MarkAffSeen({ commissions, signups, partnerCommissions, partnerSignups }: MarkSeen) {
  const key = `${(commissions ?? []).join(",")}|${signups ? 1 : 0}|${partnerCommissions ?? ""}|${partnerSignups ?? ""}`

  useEffect(() => {
    try {
      const next = markSeen(parseSeen(readCookie()), { commissions, signups, partnerCommissions, partnerSignups }, Date.now())
      document.cookie = `${SEEN_COOKIE}=${serializeSeen(next)}; Path=/admin; Max-Age=${60 * 60 * 24 * 400}; SameSite=Lax; Secure`
      window.dispatchEvent(new Event(AFF_SEEN_EVENT))
    } catch {
      /* cookie refusé : les repères resteront, rien de grave */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return null
}
