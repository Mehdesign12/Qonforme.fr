import type { Metadata } from "next"
export const metadata: Metadata = {
  title: "Générateur de conditions de paiement de facture",
  description: "Générez les mentions de paiement de vos factures : délai, pénalités de retard, indemnité forfaitaire de 40 € et escompte. Texte prêt à copier, gratuit.",
  keywords: ["conditions paiement facture", "mentions légales facture", "pénalités retard mention", "escompte facture"],
  alternates: { canonical: "/outils/generateur-conditions-paiement" },
  openGraph: { title: "Générateur conditions de paiement | Qonforme", description: "Mentions légales à copier-coller sur vos factures.", url: "https://qonforme.fr/outils/generateur-conditions-paiement", images: [{ url: "/api/og?title=Conditions%20de%20paiement&subtitle=G%C3%A9n%C3%A9rateur%20mentions%20l%C3%A9gales", width: 1200, height: 630 }] },
}
export default function Layout({ children }: { children: React.ReactNode }) { return <>{children}</> }
