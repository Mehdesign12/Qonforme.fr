import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Générateur de devis gratuit en ligne — PDF | Qonforme",
  description: "Créez un devis professionnel en PDF gratuitement. Formulaire en 4 étapes, téléchargement immédiat. Mentions légales incluses, sans inscription requise.",
  keywords: ["générateur devis gratuit", "créer devis en ligne", "devis pdf gratuit", "faire un devis", "modèle devis"],
  alternates: { canonical: "/outils/generateur-devis-gratuit" },
  openGraph: {
    title: "Générateur de devis gratuit en PDF | Qonforme",
    description: "Créez et téléchargez un devis professionnel en PDF. Gratuit, sans inscription.",
    url: "https://qonforme.fr/outils/generateur-devis-gratuit",
    images: [{ url: "/api/og?title=G%C3%A9n%C3%A9rateur%20de%20devis&subtitle=PDF%20gratuit%20en%20ligne", width: 1200, height: 630 }],
  },
}

export default function Layout({ children }: { children: React.ReactNode }) { return <>{children}</> }
