import type { Metadata } from "next"
import CompanyForm from "@/components/auth/CompanyForm"
import AuthLayout from "@/components/auth/AuthLayout"
import StepIndicator from "@/components/auth/StepIndicator"

export const metadata: Metadata = { title: "Ton entreprise — Qonforme" }
export const dynamic = "force-dynamic"

const STEPS = [
  { label: "Ton compte" },
  { label: "Ton entreprise" },
  { label: "Ton plan" },
]

export default function SignupCompanyPage() {
  return (
    <AuthLayout maxWidth="lg">
      <StepIndicator steps={STEPS} current={1} />

      <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-white/70 shadow-[0_8px_32px_rgba(37,99,235,0.10)] p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-[#0F172A] mb-1">Parle-nous de ton activité</h1>
        <p className="text-slate-500 text-sm mb-7">
          Ces informations apparaîtront sur tes factures
        </p>
        <CompanyForm />
      </div>
    </AuthLayout>
  )
}
