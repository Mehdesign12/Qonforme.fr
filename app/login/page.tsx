import type { Metadata } from "next"
import Link from "next/link"
import LoginForm from "@/components/auth/LoginForm"
import AuthLayout from "@/components/auth/AuthLayout"
import { AuthPhotoPanel } from "@/components/auth/AuthPhotoPanel"
import { LOGIN_PHOTO } from "@/components/auth/photos"
import { safeNextPath } from "@/lib/stripe/access"
import { AuthLead, AuthTitle, Serif } from "@/components/auth/AuthHeading"

export const metadata: Metadata = {
  title: "Connexion",
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
  const signupHref = next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"
  return (
    <AuthLayout
      aside={<AuthPhotoPanel {...LOGIN_PHOTO} />}
      asideVariant="photo"
      mobileCard
      topRight={<Link href={signupHref} className="q-link text-[14px] lg:hidden">Créer un compte</Link>}
    >
      <AuthTitle>Content de vous <Serif>revoir</Serif>.</AuthTitle>
      <AuthLead>Retrouvez vos devis, vos factures et vos clients.</AuthLead>

      <LoginForm />

      {/* Sur téléphone, « Créer un compte » est en haut à droite */}
      <p className="mt-7 hidden text-[14px] text-q-text-3 lg:block">
        Pas encore de compte ?{" "}
        <Link href={signupHref} className="q-link">Créer un compte gratuitement</Link>
      </p>
    </AuthLayout>
  )
}
