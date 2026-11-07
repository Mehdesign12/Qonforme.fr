import type { Metadata } from "next"

const LECTEUR_DESCRIPTION =
  "Lecteur Factur-X gratuit : déposez une facture électronique Factur-X, UBL ou CII et lisez vendeur, lignes, TVA et totaux. Rien ne quitte votre appareil."

export const metadata: Metadata = {
  title: "Lecteur Factur-X gratuit : lire une facture électronique",
  description: LECTEUR_DESCRIPTION,
  keywords: ["factur-x", "lecteur factur-x", "lire une facture factur-x", "format facture électronique", "facture électronique pdf", "facture ubl", "facture cii"],
  alternates: { canonical: "/outils/lecteur-factur-x" },
  openGraph: {
    title: "Lecteur Factur-X gratuit | Qonforme",
    description: "Lisez les données d'une facture électronique Factur-X, UBL ou CII, sans rien envoyer.",
    url: "https://qonforme.fr/outils/lecteur-factur-x",
    images: [{ url: "/api/og?title=Lecteur%20Factur-X&subtitle=Lire%20une%20facture%20%C3%A9lectronique", width: 1200, height: 630 }],
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
