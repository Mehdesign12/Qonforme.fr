import type { Metadata } from "next"
import Link from "next/link"
import AuthLayout from "@/components/auth/AuthLayout"
import { StartScreen, type StartPanel } from "@/components/onboarding/StartScreen"
import { DEMO_IDENTITY } from "@/components/layout/shell"
import { dashboardHref } from "@/lib/onboarding/links"

export const metadata: Metadata = {
  title: "Par quoi commencer ? — Démo Qonforme",
  robots: { index: false, follow: true },
}

const STEPS = [{ label: "Compte" }, { label: "Entreprise" }, { label: "Démarrer" }]

/**
 * Démo de l'écran de démarrage d'un compte neuf : même composant que /demarrer,
 * identité fictive ; rien n'est envoyé ni programmé. Sans la coque de
 * l'application, comme le vrai (components/layout/DemoFrame.tsx).
 */
export default function DemoStartPage({ searchParams }: { searchParams: { choix?: string } }) {
  const initialPanel: StartPanel | null =
    searchParams?.choix === "essai" ? "essai" : searchParams?.choix === "plus-tard" ? "plus-tard" : null

  return (
    <AuthLayout
      maxWidth="2xl"
      bar={{
        steps: STEPS,
        current: 2,
        logoHref: dashboardHref("demo"),
        right: (
          <Link href={dashboardHref("demo")} className="q-link text-[14px]">
            Passer au tableau de bord
          </Link>
        ),
      }}
    >
      <StartScreen
        mode="demo"
        firstName={DEMO_IDENTITY.firstName}
        email={DEMO_IDENTITY.email}
        available
        initialPanel={initialPanel}
      />
    </AuthLayout>
  )
}
