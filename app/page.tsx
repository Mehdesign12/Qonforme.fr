import Link from "next/link";
import { CheckCircle2, Zap, Shield, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Navbar */}
      <nav className="border-b border-[#E2E8F0] bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#2563EB] flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-[#0F172A] tracking-tight">Qonforme</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">Se connecter</Button>
            </Link>
            <Link href="/signup">
              <Button size="sm" className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white">
                Essai gratuit 7 jours
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-20 pb-16 text-center">
        <Badge className="mb-6 bg-[#DBEAFE] text-[#1E40AF] border-0 hover:bg-[#DBEAFE]">
          ✅ Conforme réglementation 2026/2027
        </Badge>
        <h1 className="text-4xl sm:text-5xl font-bold text-[#0F172A] leading-tight mb-6">
          En 3 clics,{" "}
          <span className="text-[#2563EB]">ta facture est envoyée.</span>
          <br />
          On s&apos;occupe du reste.
        </h1>
        <p className="text-lg text-slate-500 max-w-2xl mx-auto mb-8">
          Facturation électronique conforme pour artisans, micro-entrepreneurs et TPE.
          Transmission légale automatique, archivage 10 ans, zéro jargon.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/signup">
            <Button size="lg" className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-8">
              Commencer gratuitement
            </Button>
          </Link>
          <Button size="lg" variant="outline">
            Voir une démo →
          </Button>
        </div>
        <p className="text-sm text-slate-400 mt-4">7 jours d&apos;essai · Sans carte bancaire · Sans engagement</p>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: <Zap className="w-6 h-6 text-[#2563EB]" />,
              title: "3 clics, c'est tout",
              desc: "Sélectionne ton client, ajoute tes prestations, envoie. On génère tout : PDF, XML, transmission légale.",
            },
            {
              icon: <Shield className="w-6 h-6 text-[#10B981]" />,
              title: "100% conforme",
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
      </section>

      {/* Pricing */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
        <h2 className="text-3xl font-bold text-center text-[#0F172A] mb-12">
          Tarifs simples, sans surprise
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {/* Starter */}
          <div className="bg-white rounded-xl p-8 border border-[#E2E8F0] shadow-sm">
            <p className="text-sm font-medium text-slate-500 mb-1">Starter</p>
            <div className="flex items-baseline gap-1 mb-6">
              <span className="text-4xl font-bold text-[#0F172A] font-mono">9€</span>
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
          <div className="bg-[#2563EB] rounded-xl p-8 border border-[#1D4ED8] shadow-lg relative overflow-hidden">
            <Badge className="absolute top-4 right-4 bg-white/20 text-white border-0 text-xs">
              Populaire
            </Badge>
            <p className="text-sm font-medium text-blue-200 mb-1">Pro</p>
            <div className="flex items-baseline gap-1 mb-6">
              <span className="text-4xl font-bold text-white font-mono">19€</span>
              <span className="text-blue-200">/mois HT</span>
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
                <li key={item} className="flex items-start gap-2 text-sm text-blue-100">
                  <CheckCircle2 className="w-4 h-4 text-white mt-0.5 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <Link href="/signup">
              <Button className="w-full bg-white text-[#2563EB] hover:bg-blue-50">
                Commencer l&apos;essai gratuit
              </Button>
            </Link>
          </div>
        </div>
        <p className="text-center text-sm text-slate-400 mt-6">
          Option annuelle disponible : 2 mois offerts (-16,7%)
        </p>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#E2E8F0] py-8 mt-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-[#2563EB] flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-[#0F172A]">Qonforme</span>
          </div>
          <p className="text-sm text-slate-400">
            © 2026 Qonforme. Conforme à la réglementation française de facturation électronique.
          </p>
        </div>
      </footer>
    </div>
  );
}
