"use client"

import Link from "next/link"
import { requestResumeInscription } from "@/components/dashboard/resume-inscription"

/**
 * Lien de la tuile « Terminer votre inscription » : ouvre la fenêtre tout de
 * suite, sans navigation ; son adresse reste le repli (clic droit, sans JavaScript,
 * ou si la fenêtre ne répond pas).
 */
export function ResumeTileLink({ href, className, children }: { href: string; className: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={className}
      onClick={(e) => {
        // Clic modifié (nouvel onglet) : le lien reste un lien
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
        if (requestResumeInscription()) e.preventDefault()
      }}
    >
      {children}
    </Link>
  )
}
