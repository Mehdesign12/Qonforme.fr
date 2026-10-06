'use client'

import { useEffect, useState } from "react"
import Image from "next/image"
import { useTheme } from "next-themes"
import { LOGO_LONG_BLUE, LOGO_LONG_LIGHT } from "@/lib/brand"

/**
 * Logo long Qonforme, centré en tête du tableau de bord d'un compte neuf sur
 * téléphone (la barre supérieure n'apparaît qu'à partir de 1024 px). Même
 * motif que components/auth/AuthLogo.tsx : version claire en thème sombre.
 */
export function BrandLogo({ height = 22 }: { height?: number }) {
  const { resolvedTheme } = useTheme()
  // Garde `mounted` : resolvedTheme est indéfini côté serveur (règle next-themes de CLAUDE.md)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <Image
      src={mounted && resolvedTheme === "dark" ? LOGO_LONG_LIGHT : LOGO_LONG_BLUE}
      alt="Qonforme"
      width={Math.round(height * 5.4)}
      height={height}
      style={{ height, width: "auto" }}
      sizes="140px"
      priority
    />
  )
}
