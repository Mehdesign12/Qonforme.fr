import type { Metadata } from "next"
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm"
import AuthLayout from "@/components/auth/AuthLayout"

export const metadata: Metadata = { title: "Mot de passe oublié — Qonforme" }
export const dynamic = "force-dynamic"

export default function ForgotPasswordPage() {
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
                d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
              />
            </svg>
          </div>

          <h1 className="text-xl sm:text-2xl font-bold text-[#0F172A] mb-1 leading-tight">
            Mot de passe oublié ?
          </h1>
          <p className="text-slate-500 text-sm leading-relaxed">
            Saisis ton adresse email et on t&apos;envoie un lien pour le réinitialiser.
          </p>
        </div>

        <ForgotPasswordForm />
      </div>
    </AuthLayout>
  )
}
