import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Générateur de facture gratuit en ligne — PDF | Qonforme",
  description: "Créez une facture professionnelle en PDF en quelques minutes. Remplissez le formulaire, téléchargez votre facture. 100% gratuit, sans inscription.",
  keywords: ["générateur facture gratuit", "créer facture en ligne", "facture pdf gratuit", "faire une facture", "modèle facture"],
  alternates: { canonical: "/outils/generateur-facture-gratuite" },
  openGraph: {
    title: "Générateur de facture gratuit en PDF | Qonforme",
    description: "Créez et téléchargez une facture professionnelle en PDF. Gratuit, sans inscription.",
    url: "https://qonforme.fr/outils/generateur-facture-gratuite",
    images: [{ url: "/api/og?title=G%C3%A9n%C3%A9rateur%20de%20facture&subtitle=PDF%20gratuit%20en%20ligne", width: 1200, height: 630 }],
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
