import Link from "next/link";
import Image from "next/image";
import { CheckCircle2, Zap, Shield, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LandingHero } from "@/components/landing/LandingHero";

const LOGO_URL =
  "https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Logo%20long%20simple%20bleu%20avec%20fond.webp";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* ── Header + Hero (Acme style) ─────────────────────────────── */}
      <LandingHero />

      {/* ── Features ──────────────────────────────────────────────── */}
      <section id="features" className="bg-[#F8FAFC] py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-[#0F172A] mb-3">
              Tout ce dont tu as besoin, rien de plus
            </h2>
            <p className="text-slate-500 max-w-xl mx-auto">
              On a éliminé la complexité pour que tu te concentres sur ton métier.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: <Zap className="w-6 h-6 text-[#2563EB]" />,
                title: "3 clics, c'est tout",
                desc: "Sélectionne ton client, ajoute tes prestations, envoie. On génère tout : PDF, XML, transmission légale.",
              },
              {
                icon: <Shield className="w-6 h-6 text-[#10B981]" />,
                title: "100 % conforme",
                desc: "Transmission automatique au Portail Public de Facturation. Archivage légal 10 ans. Zéro démarche de ta part.",
              },
              {
                icon: <Clock className="w-6 h-6 text-[#D97706]" />,
                title: "Statuts en temps réel",
                desc: "Sache immédiatement si ta facture est reçue, acceptée ou rejetée. Relances automatiques pour les impayés.",
              },
            ].map((f, i) => (
              <div
                key={i}
                className="bg-white rounded-xl p-6 border border-[#E2E8F0] shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="w-12 h-12 rounded-lg bg-slate-50 flex items-center justify-center mb-4">
                  {f.icon}
                </div>
                <h3 className="font-semibold text-[#0F172A] mb-2">{f.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ───────────────────────────────────────────────── */}
      <section id="pricing" className="bg-white py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-[#0F172A] mb-3">
              Tarifs simples, sans surprise
            </h2>
            <p className="text-slate-500">
              Option annuelle disponible — 2 mois offerts (−16 %)
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {/* Starter */}
            <div className="bg-white rounded-xl p-8 border border-[#E2E8F0] shadow-sm">
              <p className="text-sm font-medium text-slate-500 mb-1">Starter</p>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-bold text-[#0F172A] font-mono">9 €</span>
                <span className="text-slate-400">/mois HT</span>
              </div>
              <ul className="space-y-3 mb-8">
                {[
                  "10 factures par mois",
                  "Création de devis",
                  "Transmission automatique PPF",
                  "Archivage légal 10 ans",
                  "Support email 48h",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-slate-600">
                    <CheckCircle2 className="w-4 h-4 text-[#10B981] mt-0.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/signup">
                <Button className="w-full" variant="outline">
                  Commencer l&apos;essai gratuit
                </Button>
              </Link>
            </div>

            {/* Pro */}
            <div className="bg-[#0F172A] rounded-xl p-8 border border-[#1E293B] shadow-lg relative overflow-hidden">
              <Badge className="absolute top-4 right-4 bg-white/10 text-white border-0 text-xs">
                Populaire
              </Badge>
              <p className="text-sm font-medium text-slate-400 mb-1">Pro</p>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-bold text-white font-mono">19 €</span>
                <span className="text-slate-400">/mois HT</span>
              </div>
              <ul className="space-y-3 mb-8">
                {[
                  "Factures illimitées",
                  "Création de devis",
                  "Transmission PPF/PDP",
                  "Archivage légal 10 ans",
                  "Relances automatiques J+30/45",
                  "Tableau de bord CA complet",
                  "Support email 24h",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-slate-300">
                    <CheckCircle2 className="w-4 h-4 text-[#10B981] mt-0.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/signup">
                <Button className="w-full bg-white text-[#0F172A] hover:bg-slate-100">
                  Commencer l&apos;essai gratuit
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────── */}
      <footer className="border-t border-[#E2E8F0] bg-[#F8FAFC] py-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link href="/" className="flex items-center">
            <Image
              src={LOGO_URL}
              alt="Qonforme"
              width={120}
              height={30}
              className="h-7 w-auto object-contain"
              unoptimized
            />
          </Link>
          <p className="text-sm text-slate-400 text-center">
            © 2026 Qonforme — Conforme à la réglementation française de facturation électronique.
          </p>
          <div className="flex items-center gap-4 text-sm text-slate-400">
            <Link href="/mentions-legales" className="hover:text-[#0F172A] transition-colors">
              Mentions légales
            </Link>
            <Link href="/cgu" className="hover:text-[#0F172A] transition-colors">
              CGU
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
