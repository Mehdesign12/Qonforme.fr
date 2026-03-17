import type { Metadata } from "next"
import Link from "next/link"
import SignupForm from "@/components/auth/SignupForm"
import AuthLayout from "@/components/auth/AuthLayout"
import StepIndicator from "@/components/auth/StepIndicator"

export const metadata: Metadata = {
  title: "Créer un compte — Qonforme",
  description: "Créez votre compte Qonforme en 5 minutes. Factures électroniques Factur-X conformes EN 16931, prêtes à transmettre via Chorus Pro.",
  alternates: { canonical: "/signup" },
  openGraph: {
    images: [{ url: "/api/og?title=Cr%C3%A9ez%20votre%20compte%20en%205%20minutes&subtitle=Factures%20Factur-X%20conformes%20EN%2016931%20%E2%80%94%20pr%C3%AAtes%20%C3%A0%20transmettre", width: 1200, height: 630 }],
  },
}
export const dynamic = "force-dynamic"

const STEPS = [
  { label: "Ton compte" },
  { label: "Ton entreprise" },
  { label: "Ton plan" },
]

export default function SignupPage() {
  return (
    <AuthLayout>
      <StepIndicator steps={STEPS} current={0} />

      {/* ── Carte principale — mobile-first, optimisée Safari/Chrome mobile ── */}
      <div
        className="rounded-2xl border border-white/70 p-5 sm:p-7 md:p-8 md:backdrop-blur-lg"
        style={{
          background: "rgba(255,255,255,0.85)",
          boxShadow: "0 8px 32px rgba(37,99,235,0.10), 0 1px 0 rgba(255,255,255,0.8) inset",
        }}
      >
        <h1 className="text-xl sm:text-2xl font-bold text-[#0F172A] mb-1 leading-tight">
          Crée ton compte
        </h1>
        <p className="text-slate-500 text-sm mb-6">
          Accès immédiat · Sans engagement
        </p>

        <SignupForm />

        <p className="text-center text-sm text-slate-500 mt-6">
          Déjà un compte ?{" "}
          <Link href="/login" className="text-[#2563EB] hover:underline font-semibold">
            Se connecter
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}
