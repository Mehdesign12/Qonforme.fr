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

      <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-[#0F172A] mb-1">Parle-nous de ton activité</h1>
        <p className="text-slate-500 text-sm mb-7">
          Ces informations apparaîtront sur tes factures
        </p>
        <CompanyForm />
      </div>
    </AuthLayout>
  )
}
