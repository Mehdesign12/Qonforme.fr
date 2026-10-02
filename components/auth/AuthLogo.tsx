'use client'

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useTheme } from "next-themes"
import { LOGO_LONG_BLUE, LOGO_LONG_LIGHT } from "@/lib/brand"

/** Logo long des pages d'accès, version claire en thème sombre. */
export default function AuthLogo({ height = 20, href = "/" }: { height?: number; href?: string }) {
  const { resolvedTheme } = useTheme()
  // Garde `mounted` : resolvedTheme est indéfini côté serveur (règle next-themes de CLAUDE.md)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <Link href={href} className="inline-flex" aria-label="Qonforme, retour à l'accueil">
      <Image
        src={mounted && resolvedTheme === "dark" ? LOGO_LONG_LIGHT : LOGO_LONG_BLUE}
        alt="Qonforme"
        width={Math.round(height * 5.4)}
        height={height}
        style={{ height, width: "auto" }}
        sizes="140px"
        priority
      />
    </Link>
  )
}
