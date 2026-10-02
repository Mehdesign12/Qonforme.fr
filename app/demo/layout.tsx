import { AppShellFrame } from "@/components/layout/AppShell"
import { DEMO_IDENTITY } from "@/components/layout/shell"

/** Démo : même coque que l'application réelle, identité fictive (règle « Mode démo » de CLAUDE.md). */
export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return <AppShellFrame identity={DEMO_IDENTITY}>{children}</AppShellFrame>
}
