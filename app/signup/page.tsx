import type { Metadata } from "next"
import Link from "next/link"
import SignupForm from "@/components/auth/SignupForm"
import AuthLayout from "@/components/auth/AuthLayout"
import { safeNextPath } from "@/lib/stripe/access"
import { AuthLead, AuthTitle, Serif } from "@/components/auth/AuthHeading"

export const metadata: Metadata = {
  title: "Créer un compte",
  description: "Créez votre compte Qonforme gratuitement : devis illimités pour les artisans du bâtiment. La formule ne se choisit qu’à l’envoi de votre première facture.",
  alternates: { canonical: "/signup" },
  openGraph: {
    images: [{ url: "/api/og?title=Cr%C3%A9ez%20votre%20compte&subtitle=Devis%20gratuits%20et%20illimit%C3%A9s%2C%20formule%20%C3%A0%20la%20premi%C3%A8re%20facture", width: 1200, height: 630 }],
  },
}
export const dynamic = "force-dynamic"

/**
 * Inscription en deux champs (maquettes « Main » et « Mobile-Inscription »,
 * validées le 06/10/2026) : adresse email et mot de passe, dans une carte
 * centrée sans photo (20/10/2026). Le reste de
 * l'inscription se fait dans la fenêtre « Bienvenue » du tableau de bord.
 */
export default function SignupPage({ searchParams }: { searchParams?: { next?: string } }) {
  // Retour après inscription (SignupForm) ; l'invitation d'un comptable a son propre titre
  const next = safeNextPath(searchParams?.next)
  const loginHref = next ? `/login?next=${encodeURIComponent(next)}` : "/login"

  if (next?.startsWith("/invitation-comptable")) {
    return (
      <AuthLayout>
        <AuthTitle>Votre accès <Serif>comptable</Serif>, gratuit.</AuthTitle>
        <AuthLead>Créez votre compte pour accepter l&apos;invitation de votre client. Aucune entreprise à renseigner.</AuthLead>
        <SignupForm />
        <p className="mt-6 text-[14px] text-q-text-3">
          Déjà un compte ?{" "}
          <Link href={loginHref} className="q-link">Se connecter</Link>
        </p>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      card
      topRight={
        <p className="m-0 text-[14px] text-q-text-3">
          <span className="hidden sm:inline">Déjà un compte ? </span>
          <Link href={loginHref} className="q-link">Se connecter</Link>
        </p>
      }
    >
      <div className="text-center">
        <AuthTitle className="lg:text-[38px]">On commence <Serif>quand vous voulez</Serif>.</AuthTitle>
        <AuthLead className="!mt-2.5 !text-[15.5px]">Créez votre compte en quelques secondes.</AuthLead>
      </div>

      <SignupForm />
    </AuthLayout>
  )
}
