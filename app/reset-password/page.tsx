import type { Metadata } from "next"
import { Suspense } from "react"
import ResetPasswordForm from "@/components/auth/ResetPasswordForm"
import AuthLayout from "@/components/auth/AuthLayout"

export const metadata: Metadata = { title: "Nouveau mot de passe — Qonforme" }
export const dynamic = "force-dynamic"

export default function ResetPasswordPage() {
  return (
    <AuthLayout>
      <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-6 sm:p-8">
        <div className="mb-6">
          {/* Icône */}
          <div className="w-12 h-12 rounded-xl bg-[#EFF6FF] flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-[#2563EB]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-[#0F172A] mb-1">Nouveau mot de passe</h1>
          <p className="text-slate-500 text-sm">
            Choisis un mot de passe sécurisé pour ton compte.
          </p>
        </div>

        {/* Suspense requis — ResetPasswordForm utilise useSearchParams() */}
        <Suspense fallback={
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
          </div>
        }>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </AuthLayout>
  )
}
