"use client"

/**
 * Arrivée par un lien de partenaire (`?ref=code`) : signale la visite au serveur,
 * qui la compte et pose le cookie `q_ref` (lib/affiliation/model.ts). Une fois par
 * code et par page dans l'onglet. Rien d'autre : ni identifiant, ni traceur tiers.
 * Jamais sur les pages sans traceur (règlement, signature, admin…).
 */
import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { isTrackingPage } from "@/lib/consent"
import { REF_PARAM, refFromParam } from "@/lib/affiliation/model"

export function RefTracker() {
  const pathname = usePathname()
  useEffect(() => {
    if (typeof window === "undefined" || !pathname || !isTrackingPage(pathname)) return
    const code = refFromParam(new URLSearchParams(window.location.search).get(REF_PARAM))
    if (!code) return
    const key = `q_ref_sent:${code}:${pathname}`
    try {
      if (window.sessionStorage.getItem(key)) return
      window.sessionStorage.setItem(key, "1")
    } catch {
      /* stockage indisponible : on envoie quand même, le serveur déduplique */
    }
    fetch("/api/affiliation/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, path: pathname }),
      keepalive: true,
      credentials: "same-origin",
    }).catch(() => undefined)
  }, [pathname])
  return null
}
