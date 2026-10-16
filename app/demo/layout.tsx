import type { Metadata } from "next"
import { DemoFrame } from "@/components/layout/DemoFrame"

/*
 * Sous-pages de la démo hors de Google : ce sont des écrans de l'application remplis de
 * données d'exemple, sans valeur de recherche (aucune n'a été affichée dans la Search
 * Console en 16 mois, relevé du 16/10/2026). « follow » laisse Google suivre leurs liens.
 * Seule la page d'entrée /demo reste indexable : elle le redéclare dans app/demo/page.tsx.
 */
export const metadata: Metadata = {
  title: "Démo",
  description: "Démo de Qonforme avec des données d'exemple : devis, factures, relances et clients d'un artisan du bâtiment, sans inscription.",
  robots: { index: false, follow: true },
}

/**
 * Démo : même coque que l'application réelle, identité fictive (règle « Mode démo » de CLAUDE.md).
 * Seule la page de règlement du client (/demo/regler/…) s'affiche sans la coque, comme la vraie.
 */
export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return <DemoFrame>{children}</DemoFrame>
}
