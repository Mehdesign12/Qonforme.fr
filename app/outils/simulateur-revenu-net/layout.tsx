import type { Metadata } from "next"
export const metadata: Metadata = {
  title: "Simulateur revenus net auto-entrepreneur 2026 | Qonforme",
  description: "Calculez votre revenu net réel d'auto-entrepreneur après cotisations URSSAF et impôt sur le revenu. De votre CA brut à ce qui reste sur votre compte en 2026.",
  keywords: ["revenu net auto-entrepreneur", "simulateur revenu", "combien gagne auto-entrepreneur", "salaire auto-entrepreneur"],
  alternates: { canonical: "/outils/simulateur-revenu-net" },
  openGraph: { title: "Simulateur revenus net auto-entrepreneur | Qonforme", description: "De votre CA à votre revenu net réel.", url: "https://qonforme.fr/outils/simulateur-revenu-net", images: [{ url: "/api/og?title=Revenus%20net&subtitle=Simulateur%20auto-entrepreneur", width: 1200, height: 630 }] },
}
export default function Layout({ children }: { children: React.ReactNode }) { return <>{children}</> }
