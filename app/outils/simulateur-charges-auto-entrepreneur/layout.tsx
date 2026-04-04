import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Simulateur charges auto-entrepreneur 2026 gratuit | Qonforme",
  description: "Calculez vos cotisations URSSAF, CFP et versement libératoire selon votre CA et activité. Barèmes 2026 à jour. Gratuit, sans inscription.",
  keywords: ["simulateur charges auto-entrepreneur", "cotisations urssaf", "charges micro-entrepreneur", "calcul charges 2026"],
  alternates: { canonical: "/outils/simulateur-charges-auto-entrepreneur" },
  openGraph: {
    title: "Simulateur charges auto-entrepreneur 2026 | Qonforme",
    description: "Calculez vos cotisations URSSAF et votre revenu net. Barèmes 2026.",
    url: "https://qonforme.fr/outils/simulateur-charges-auto-entrepreneur",
    images: [{ url: "/api/og?title=Simulateur%20charges&subtitle=Auto-entrepreneur%202026", width: 1200, height: 630 }],
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
