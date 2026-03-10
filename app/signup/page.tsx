import type { Metadata } from "next";
import Link from "next/link";
import { Zap } from "lucide-react";
import SignupForm from "@/components/auth/SignupForm";

export const metadata: Metadata = { title: "Créer un compte" };
export const dynamic = "force-dynamic"

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-6 sm:mb-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-[#2563EB] flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-bold text-[#0F172A]">Qonforme</span>
          </Link>
        </div>

        {/* Étapes */}
        <div className="flex items-center gap-2 mb-6 justify-center">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[#2563EB] text-white text-xs font-bold flex items-center justify-center">1</div>
            <span className="text-sm font-medium text-[#0F172A]">Ton compte</span>
          </div>
          <div className="w-8 h-px bg-[#E2E8F0]" />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[#E2E8F0] text-slate-400 text-xs font-bold flex items-center justify-center">2</div>
            <span className="text-sm text-slate-400">Ton entreprise</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-6 sm:p-8">
          <h1 className="text-2xl font-bold text-[#0F172A] mb-1">Crée ton compte</h1>
          <p className="text-slate-500 text-sm mb-6">7 jours gratuits · Sans carte bancaire</p>
          <SignupForm />
          <p className="text-center text-sm text-slate-500 mt-6">
            Déjà un compte ?{" "}
            <Link href="/login" className="text-[#2563EB] hover:underline font-medium">
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
