import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Vérificateur mentions obligatoires facture 2026 | Qonforme",
  description: "Vérifiez que votre facture contient toutes les mentions obligatoires exigées par la loi en 2026. Checklist interactive gratuite.",
  keywords: ["mentions obligatoires facture", "vérificateur facture", "facture conforme 2026", "mentions légales facture"],
  alternates: { canonical: "/outils/verificateur-mentions-facture" },
  openGraph: {
    title: "Vérificateur mentions obligatoires facture | Qonforme",
    description: "Checklist interactive des mentions obligatoires sur une facture en 2026.",
    url: "https://qonforme.fr/outils/verificateur-mentions-facture",
    images: [{ url: "/api/og?title=Mentions%20obligatoires&subtitle=V%C3%A9rificateur%20facture%202026", width: 1200, height: 630 }],
  },
}

export default function Layout({ children }: { children: React.ReactNode }) { return <>{children}</> }
