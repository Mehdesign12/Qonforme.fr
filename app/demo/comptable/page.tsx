import type { Metadata } from "next"
import { AccountantShell } from "@/components/accountant/AccountantShell"
import { DossierList } from "@/components/accountant/DossierList"
import { DEMO_ACCOUNTANT, DEMO_DOSSIERS } from "@/lib/demo/accountant"

export const metadata: Metadata = {
  title: "Espace comptable — Démo Qonforme",
  robots: { index: false, follow: false },
}

/**
 * Démo de l'espace comptable : ce que voit le comptable invité par l'artisan
 * de démo. Hors de la coque de l'application (voir DemoFrame), comme le vrai.
 */
export default function DemoComptablePage() {
  return (
    <AccountantShell mode="demo" email={DEMO_ACCOUNTANT.email}>
      <DossierList dossiers={DEMO_DOSSIERS} hrefFor={(id) => `/demo/comptable/${id}`} />
    </AccountantShell>
  )
}
