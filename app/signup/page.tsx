import type { Metadata } from "next"
import Link from "next/link"
import SignupForm from "@/components/auth/SignupForm"
import AuthLayout from "@/components/auth/AuthLayout"
import QuotePreview from "@/components/auth/QuotePreview"
import { AuthLead, AuthTitle, Serif } from "@/components/auth/AuthHeading"

export const metadata: Metadata = {
  title: "Créer un compte — Qonforme",
  description: "Créez votre compte Qonforme gratuitement : devis illimités pour les artisans du bâtiment. La formule ne se choisit qu’à l’envoi de votre première facture.",
  alternates: { canonical: "/signup" },
  openGraph: {
    images: [{ url: "/api/og?title=Cr%C3%A9ez%20votre%20compte&subtitle=Devis%20gratuits%20et%20illimit%C3%A9s%2C%20formule%20%C3%A0%20la%20premi%C3%A8re%20facture", width: 1200, height: 630 }],
  },
}
export const dynamic = "force-dynamic"

export default function SignupPage() {
  return (
    <AuthLayout aside={<QuotePreview />}>
      <AuthTitle>Votre premier <Serif>devis</Serif>, sans attendre.</AuthTitle>
      <AuthLead>
        Devis gratuits et illimités. Vous ne choisissez une formule qu’à l’envoi de votre première facture.
      </AuthLead>

      <SignupForm />

      <p className="mt-6 text-[14px] text-q-text-3">
        Déjà un compte ?{" "}
        <Link href="/login" className="q-link">Se connecter</Link>
      </p>
    </AuthLayout>
  )
}
