import { DemoFrame } from "@/components/layout/DemoFrame"

/**
 * Démo : même coque que l'application réelle, identité fictive (règle « Mode démo » de CLAUDE.md).
 * Seule la page de règlement du client (/demo/regler/…) s'affiche sans la coque, comme la vraie.
 */
export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return <DemoFrame>{children}</DemoFrame>
}
