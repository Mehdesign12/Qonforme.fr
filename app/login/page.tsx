import type { Metadata } from "next"
import Link from "next/link"
import LoginForm from "@/components/auth/LoginForm"
import AuthLayout from "@/components/auth/AuthLayout"
import AuthBenefits from "@/components/auth/AuthBenefits"
import { safeNextPath } from "@/lib/stripe/access"
import { AuthLead, AuthTitle, Serif } from "@/components/auth/AuthHeading"

export const metadata: Metadata = {
  title: "Connexion — Qonforme",
  description: "Connectez-vous à votre espace Qonforme pour retrouver vos devis, vos factures, vos clients et vos relances, depuis un ordinateur ou un téléphone.",
  alternates: { canonical: "/login" },
  openGraph: {
    images: [{ url: "/api/og?title=Connexion&subtitle=Acc%C3%A9dez%20%C3%A0%20votre%20espace%20facturation%20%C3%A9lectronique", width: 1200, height: 630 }],
  },
}
export const dynamic = "force-dynamic"

export default function LoginPage({ searchParams }: { searchParams?: { next?: string } }) {
  // Retour après connexion (LoginForm), gardé si l'on passe par l'inscription
  const next = safeNextPath(searchParams?.next)
  return (
    <AuthLayout aside={<AuthBenefits />}>
      <AuthTitle>Content de vous <Serif>revoir</Serif>.</AuthTitle>
      <AuthLead>Retrouvez vos devis, vos factures et vos clients.</AuthLead>

      <LoginForm />

      <p className="mt-7 text-[14px] text-q-text-3">
        Pas encore de compte ?{" "}
        <Link href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"} className="q-link">Créer un compte<span className="hidden sm:inline"> gratuitement</span></Link>
      </p>
    </AuthLayout>
  )
}
