import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Vérificateur de conformité facture 2026 gratuit | Qonforme",
  description: "Analysez votre facture et identifiez les éléments manquants ou non conformes à la réglementation 2026. Score de conformité instantané.",
  keywords: ["conformité facture", "vérifier facture", "facture conforme", "réglementation facture 2026", "Factur-X"],
  alternates: { canonical: "/outils/verificateur-conformite-facture" },
  openGraph: {
    title: "Vérificateur conformité facture 2026 | Qonforme",
    description: "Score de conformité instantané pour votre facture.",
    url: "https://qonforme.fr/outils/verificateur-conformite-facture",
    images: [{ url: "/api/og?title=Conformit%C3%A9%20facture&subtitle=Score%20instantan%C3%A9%202026", width: 1200, height: 630 }],
  },
}

export default function Layout({ children }: { children: React.ReactNode }) { return <>{children}</> }
