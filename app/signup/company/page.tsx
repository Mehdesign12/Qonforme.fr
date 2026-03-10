import type { Metadata } from "next";
import Link from "next/link";
import { Zap } from "lucide-react";
import CompanyForm from "@/components/auth/CompanyForm";

export const metadata: Metadata = { title: "Ton entreprise" };
export const dynamic = "force-dynamic"

export default function SignupCompanyPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
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
            <div className="w-7 h-7 rounded-full bg-[#10B981] text-white text-xs font-bold flex items-center justify-center">✓</div>
            <span className="text-sm text-slate-400 line-through">Ton compte</span>
          </div>
          <div className="w-8 h-px bg-[#2563EB]" />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[#2563EB] text-white text-xs font-bold flex items-center justify-center">2</div>
            <span className="text-sm font-medium text-[#0F172A]">Ton entreprise</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-6 sm:p-8">
          <h1 className="text-2xl font-bold text-[#0F172A] mb-1">Parle-nous de ton activité</h1>
          <p className="text-slate-500 text-sm mb-6">Ces informations apparaîtront sur tes factures</p>
          <CompanyForm />
        </div>
      </div>
    </div>
  );
}
