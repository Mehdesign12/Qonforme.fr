import type { Metadata } from "next"
import Link from "next/link"
import { Zap } from "lucide-react"
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm"

export const metadata: Metadata = { title: "Mot de passe oublié" }
export const dynamic = "force-dynamic"

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="flex justify-center mb-6 sm:mb-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-[#2563EB] flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-bold text-[#0F172A]">Qonforme</span>
          </Link>
        </div>

        <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-6 sm:p-8">
          <h1 className="text-2xl font-bold text-[#0F172A] mb-1">Mot de passe oublié ?</h1>
          <p className="text-slate-500 text-sm mb-6">
            Saisis ton adresse email et on t&apos;envoie un lien pour le réinitialiser.
          </p>
          <ForgotPasswordForm />
        </div>

      </div>
    </div>
  )
}
