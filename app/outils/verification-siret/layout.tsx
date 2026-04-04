import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Vérificateur SIREN SIRET gratuit — Données INSEE | Qonforme",
  description: "Vérifiez l'existence d'une entreprise française à partir de son SIREN ou SIRET. Raison sociale, adresse, n° TVA intracommunautaire. Données INSEE officielles.",
  keywords: ["vérifier siret", "recherche siren", "vérificateur siret", "insee entreprise", "numéro tva intracommunautaire"],
  alternates: { canonical: "/outils/verification-siret" },
  openGraph: {
    title: "Vérificateur SIREN / SIRET gratuit | Qonforme",
    description: "Vérifiez une entreprise française avec les données officielles INSEE.",
    url: "https://qonforme.fr/outils/verification-siret",
    images: [{ url: "/api/og?title=V%C3%A9rificateur%20SIRET&subtitle=Donn%C3%A9es%20officielles%20INSEE", width: 1200, height: 630 }],
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
