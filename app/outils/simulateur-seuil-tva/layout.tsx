import type { Metadata } from "next"
export const metadata: Metadata = {
  title: "Simulateur de seuil de franchise de TVA 2026",
  description: "Votre chiffre d'affaires de l'an dernier et de cette année vous laisse-t-il en franchise de TVA ? Seuils 2026, seuil majoré, année de création. Gratuit.",
  keywords: ["seuil tva auto-entrepreneur", "franchise tva", "dépassement seuil tva", "tva auto-entrepreneur 2026"],
  alternates: { canonical: "/outils/simulateur-seuil-tva" },
  openGraph: { title: "Simulateur seuil TVA auto-entrepreneur | Qonforme", description: "Franchise TVA dépassée ? Vérifiez en 1 clic.", url: "https://qonforme.fr/outils/simulateur-seuil-tva", images: [{ url: "/api/og?title=Seuil%20TVA&subtitle=Simulateur%20auto-entrepreneur%202026", width: 1200, height: 630 }] },
}
export default function Layout({ children }: { children: React.ReactNode }) { return <>{children}</> }
