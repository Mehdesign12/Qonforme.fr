import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Vérificateur SIREN et SIRET gratuit — répertoire Sirene",
  description: "Vérifiez une entreprise à partir de son SIREN ou de son SIRET : raison sociale, adresse, entreprise active ou fermée, d'après le répertoire Sirene de l'INSEE.",
  keywords: ["vérifier siret", "recherche siren", "vérificateur siret", "répertoire sirene", "entreprise fermée"],
  alternates: { canonical: "/outils/verification-siret" },
  openGraph: {
    title: "Vérificateur SIREN / SIRET gratuit | Qonforme",
    description: "Vérifiez une entreprise française d'après le répertoire Sirene de l'INSEE.",
    url: "https://qonforme.fr/outils/verification-siret",
    images: [{ url: "/api/og?title=V%C3%A9rificateur%20SIRET&subtitle=R%C3%A9pertoire%20Sirene", width: 1200, height: 630 }],
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
