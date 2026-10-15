import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Calculateur de béton : volume, sacs de ciment et dosage",
  description: "Calculez le volume de béton d'une dalle, d'une semelle ou d'un poteau avec marge de perte, puis les sacs de ciment, le sable et les gravillons. Gratuit.",
  keywords: ["calcul béton", "calculateur béton", "calcul m3 béton", "calcul béton dalle", "dosage béton", "volume béton", "sacs de ciment"],
  alternates: { canonical: "/outils/calculateur-beton" },
  openGraph: {
    title: "Calculateur de béton : volume et dosage | Qonforme",
    description: "Volume de béton d'une dalle ou d'un poteau, marge de perte, sacs de ciment, sable, gravillons et eau. Gratuit, sans inscription.",
    url: "https://qonforme.fr/outils/calculateur-beton",
    images: [{ url: "/api/og?title=Calculateur%20de%20b%C3%A9ton&subtitle=Volume%2C%20sacs%20de%20ciment%20et%20dosage", width: 1200, height: 630 }],
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
