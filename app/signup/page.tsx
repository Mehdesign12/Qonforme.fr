import type { Metadata } from "next"
import Link from "next/link"
import SignupForm from "@/components/auth/SignupForm"
import AuthLayout from "@/components/auth/AuthLayout"
import StepIndicator from "@/components/auth/StepIndicator"

export const metadata: Metadata = { title: "Créer un compte — Qonforme" }
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

      <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-[#0F172A] mb-1">Crée ton compte</h1>
        <p className="text-slate-500 text-sm mb-7">
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
