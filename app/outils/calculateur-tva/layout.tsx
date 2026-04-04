import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Calculateur TVA HT TTC gratuit en ligne | Qonforme",
  description: "Convertissez instantanément vos montants HT en TTC et inversement. Tous les taux de TVA français : 20%, 10%, 5,5%, 2,1%. Gratuit, sans inscription.",
  keywords: ["calculateur tva", "calcul tva", "ht ttc", "convertisseur tva", "tva gratuit", "calcul tva en ligne"],
  alternates: { canonical: "/outils/calculateur-tva" },
  openGraph: {
    title: "Calculateur TVA HT ↔ TTC gratuit | Qonforme",
    description: "Conversion instantanée HT/TTC avec les 4 taux de TVA français. 100% gratuit.",
    url: "https://qonforme.fr/outils/calculateur-tva",
    images: [{ url: "/api/og?title=Calculateur%20TVA&subtitle=HT%20%E2%86%94%20TTC%20gratuit", width: 1200, height: 630 }],
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
