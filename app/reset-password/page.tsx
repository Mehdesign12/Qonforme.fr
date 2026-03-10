import type { Metadata } from "next"
import Link from "next/link"
import { Zap } from "lucide-react"
import { Suspense } from "react"
import ResetPasswordForm from "@/components/auth/ResetPasswordForm"

export const metadata: Metadata = { title: "Nouveau mot de passe" }
export const dynamic = "force-dynamic"

export default function ResetPasswordPage() {
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
          <h1 className="text-2xl font-bold text-[#0F172A] mb-1">Nouveau mot de passe</h1>
          <p className="text-slate-500 text-sm mb-6">
            Choisis un mot de passe sécurisé pour ton compte.
          </p>
          {/* Suspense requis car ResetPasswordForm utilise useSearchParams() */}
          <Suspense fallback={
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
            </div>
          }>
            <ResetPasswordForm />
          </Suspense>
        </div>

      </div>
    </div>
  )
}
