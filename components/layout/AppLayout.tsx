import { AppShellFrame } from "@/components/layout/AppShell"
import { getShellIdentity } from "@/components/layout/HeaderServer"

/** Mise en page des rubriques de l'application (tableau de bord, factures, devis…). */
export async function AppLayout({ children }: { children: React.ReactNode }) {
  const identity = await getShellIdentity()
  return <AppShellFrame identity={identity}>{children}</AppShellFrame>
}
