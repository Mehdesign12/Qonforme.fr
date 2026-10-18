"use client"

import type { ReactNode } from "react"
import { openCookieSettings } from "@/lib/consent"

/** Rouvre le bandeau pour modifier son choix (pied de page, politique de confidentialité). */
export function CookieSettingsLink({ className, children }: { className?: string; children?: ReactNode }) {
  return (
    <button type="button" onClick={openCookieSettings} className={className}>
      {children ?? "Gérer les cookies"}
    </button>
  )
}
