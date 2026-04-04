import type { Metadata } from "next"
export const metadata: Metadata = {
  title: "Générateur de numéro de facture conforme | Qonforme",
  description: "Générez un numéro de facture conforme à la réglementation française. Chronologique, sans rupture, personnalisable.",
  keywords: ["numéro facture", "numérotation facture", "générateur numéro facture", "règles numérotation"],
  alternates: { canonical: "/outils/generateur-numero-facture" },
  openGraph: { title: "Générateur numéro de facture | Qonforme", description: "Numérotation conforme et personnalisable.", url: "https://qonforme.fr/outils/generateur-numero-facture", images: [{ url: "/api/og?title=N%C2%B0%20de%20facture&subtitle=G%C3%A9n%C3%A9rateur%20conforme", width: 1200, height: 630 }] },
}
export default function Layout({ children }: { children: React.ReactNode }) { return <>{children}</> }
