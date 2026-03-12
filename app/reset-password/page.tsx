import type { Metadata } from "next"
import { Suspense } from "react"
import ResetPasswordForm from "@/components/auth/ResetPasswordForm"
import AuthLayout from "@/components/auth/AuthLayout"

export const metadata: Metadata = { title: "Nouveau mot de passe — Qonforme" }
export const dynamic = "force-dynamic"

export default function ResetPasswordPage() {
  return (
    <AuthLayout>
      {/* ── Carte principale — mobile-first, optimisée Safari/Chrome mobile ── */}
      <div
        className="rounded-2xl border border-white/70 p-5 sm:p-7 md:p-8"
        style={{
          background: "rgba(255,255,255,0.85)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          boxShadow: "0 8px 32px rgba(37,99,235,0.10), 0 1px 0 rgba(255,255,255,0.8) inset",
        }}
      >
        {/* ── En-tête ────────────────────────────────────────────── */}
        <div className="mb-5 sm:mb-6">
          {/* Icône */}
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-[#EFF6FF] flex items-center justify-center mb-4">
            <svg
              className="w-5 h-5 sm:w-6 sm:h-6 text-[#2563EB]"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}
            >
              <path
                strokeLinecap="round" strokeLinejoin="round"
                d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z"
              />
            </svg>
          </div>

          <h1 className="text-xl sm:text-2xl font-bold text-[#0F172A] mb-1 leading-tight">
            Nouveau mot de passe
          </h1>
          <p className="text-slate-500 text-sm leading-relaxed">
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
