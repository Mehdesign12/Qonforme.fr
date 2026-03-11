import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Zap } from "lucide-react";
import SignupForm from "@/components/auth/SignupForm";

const PICTO_Q = "https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Logo%20bleu%20Qonforme%20PNG.webp";

export const metadata: Metadata = { title: "Créer un compte" };
export const dynamic = "force-dynamic"

export default function SignupPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#F8FAFC] flex items-center justify-center p-4">
      {/* Q filigrane côté droit */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 top-1/2 -translate-y-1/2 select-none hidden lg:block"
        style={{ opacity: 0.08, zIndex: 0 }}
      >
        <Image src={PICTO_Q} alt="" width={420} height={420} className="w-[380px]" unoptimized />
      </div>
      <div className="relative z-10 w-full max-w-md">
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
