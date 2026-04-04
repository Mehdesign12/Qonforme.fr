import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Calculateur pénalités de retard facture gratuit | Qonforme",
  description: "Calculez les intérêts de retard et l'indemnité forfaitaire de recouvrement (40 €) pour vos factures impayées. Taux BCE 2026. Gratuit.",
  keywords: ["pénalités retard facture", "intérêts de retard", "calcul pénalités", "indemnité forfaitaire recouvrement", "facture impayée"],
  alternates: { canonical: "/outils/calculateur-penalites-retard" },
  openGraph: {
    title: "Calculateur pénalités de retard | Qonforme",
    description: "Intérêts de retard + indemnité forfaitaire 40 €. Taux BCE 2026.",
    url: "https://qonforme.fr/outils/calculateur-penalites-retard",
    images: [{ url: "/api/og?title=P%C3%A9nalit%C3%A9s%20de%20retard&subtitle=Calculateur%20gratuit%202026", width: 1200, height: 630 }],
  },
}

export default function Layout({ children }: { children: React.ReactNode }) { return <>{children}</> }
