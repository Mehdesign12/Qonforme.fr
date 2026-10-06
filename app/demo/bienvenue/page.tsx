import type { Metadata } from "next"
import DashboardClient from "@/components/dashboard/DashboardClient"
import { DashboardBody } from "@/components/dashboard/DashboardBody"
import { buildNewDemoDashboardView } from "@/components/dashboard/demo-data"
import { inscriptionTile, type InscriptionFacts } from "@/components/dashboard/model"
import { DEMO_NEW_IDENTITY } from "@/components/layout/shell"

export const metadata: Metadata = {
  title: "Démo de la fenêtre de bienvenue d'un compte neuf",
  robots: { index: false, follow: true },
}

/** Compte neuf de la démo : rien n'est encore renseigné. */
const NEW_ACCOUNT: InscriptionFacts = {
  company: false,
  trade: false,
  firstName: false,
  profileAvailable: true,
  wizard: true,
  windowClosed: false,
  resume: false,
}

/**
 * Démo de l'inscription en deux champs : le tableau de bord d'un compte neuf
 * (mêmes composants que /dashboard) et, par-dessus, la fenêtre « Bienvenue »
 * en mode démo (components/onboarding/InscriptionDialog.tsx) : recherche
 * d'entreprise sur des résultats fictifs, rien n'est enregistré ; la fermer
 * laisse le tableau de bord du compte neuf (`?ferme=1`), dont la tuile
 * « Terminer votre inscription » la rouvre (`?inscription=reprendre`).
 */
export default function DemoWelcomePage({ searchParams }: { searchParams: { inscription?: string; ferme?: string } }) {
  const tile = inscriptionTile(NEW_ACCOUNT)
  const view = buildNewDemoDashboardView(tile)

  return (
    <DashboardClient
      showWelcome={false}
      inline
      inscription={{
        mode: "demo",
        open: searchParams?.ferme !== "1" || searchParams?.inscription === "reprendre",
        resume: searchParams?.inscription === "reprendre",
        justCreated: !searchParams?.inscription && searchParams?.ferme !== "1",
        initialStep: tile?.step ?? "company",
        profileAvailable: true,
        startAvailable: true,
        email: DEMO_NEW_IDENTITY.email,
        firstName: DEMO_NEW_IDENTITY.firstName,
        company: null,
        trade: null,
        vatRegime: null,
      }}
    >
      <DashboardBody view={view} />
    </DashboardClient>
  )
}
