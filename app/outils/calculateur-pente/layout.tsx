import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Calculateur de pente : pourcentage, degrés et dénivelé",
  description: "Calculez une pente en % et en degrés d'après le dénivelé et la distance, ou le dénivelé d'une pente connue. Rampe, toiture, terrassement. Gratuit.",
  keywords: ["calcul pente", "calculateur pente", "calcul pente pourcentage", "pente en degrés", "calcul dénivelé", "pente rampe", "pente toiture"],
  alternates: { canonical: "/outils/calculateur-pente" },
  openGraph: {
    title: "Calculateur de pente : % et degrés | Qonforme",
    description: "Pente en pourcentage, en degrés et en rapport 1 pour n, d'après le dénivelé et la distance. Gratuit, sans inscription.",
    url: "https://qonforme.fr/outils/calculateur-pente",
    images: [{ url: "/api/og?title=Calculateur%20de%20pente&subtitle=Pourcentage%2C%20degr%C3%A9s%20et%20d%C3%A9nivel%C3%A9", width: 1200, height: 630 }],
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
