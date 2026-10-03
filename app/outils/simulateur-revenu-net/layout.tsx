import type { Metadata } from "next"
export const metadata: Metadata = {
  title: "Simulateur de revenu net auto-entrepreneur 2026",
  description: "Du chiffre d'affaires au revenu net : cotisations sociales 2026, abattement, impôt sur le revenu au barème avec décote. Estimation gratuite pour une part.",
  keywords: ["revenu net auto-entrepreneur", "simulateur revenu", "combien gagne auto-entrepreneur", "salaire auto-entrepreneur"],
  alternates: { canonical: "/outils/simulateur-revenu-net" },
  openGraph: { title: "Simulateur revenus net auto-entrepreneur | Qonforme", description: "De votre CA à votre revenu net réel.", url: "https://qonforme.fr/outils/simulateur-revenu-net", images: [{ url: "/api/og?title=Revenus%20net&subtitle=Simulateur%20auto-entrepreneur", width: 1200, height: 630 }] },
}
export default function Layout({ children }: { children: React.ReactNode }) { return <>{children}</> }
