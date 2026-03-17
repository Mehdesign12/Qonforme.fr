import type { Metadata } from "next"
import Link from "next/link"
import LoginForm from "@/components/auth/LoginForm"
import AuthLayout from "@/components/auth/AuthLayout"

export const metadata: Metadata = {
  title: "Connexion — Qonforme",
  description: "Connectez-vous à votre espace Qonforme pour gérer vos factures électroniques, devis et bons de commande en toute conformité.",
  alternates: { canonical: "/login" },
}
export const dynamic = "force-dynamic"

export default function LoginPage() {
  return (
    <AuthLayout>
      {/* ── Carte principale — mobile-first, optimisée Safari/Chrome mobile ── */}
      <div
        className="rounded-2xl border border-white/70 p-5 sm:p-7 md:p-8 md:backdrop-blur-lg"
        style={{
          background: "rgba(255,255,255,0.85)",
          boxShadow: "0 8px 32px rgba(37,99,235,0.10), 0 1px 0 rgba(255,255,255,0.8) inset",
        }}
      >
        <h1 className="text-xl sm:text-2xl font-bold text-[#0F172A] mb-1 leading-tight">
          Content de te revoir
        </h1>
        <p className="text-slate-500 text-sm mb-6">Connecte-toi à ton espace Qonforme</p>

        <LoginForm />

        <p className="text-center text-sm text-slate-500 mt-6">
          Pas encore de compte ?{" "}
          <Link href="/signup" className="text-[#2563EB] hover:underline font-semibold">
            Créer un compte
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}
