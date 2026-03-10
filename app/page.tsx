import Link from "next/link";
import Image from "next/image";
import { CheckCircle2, Zap, Shield, ArrowRight, FileText, Send, Archive, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LandingHero } from "@/components/landing/LandingHero";

const LOGO_URL =
  "https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Logo%20long%20simple%20bleu%20avec%20fond.webp";

/* ─── Section logos / marques ──────────────────────────── */
function TrustedBySection() {
  const logos = [
    { name: "Batimat", abbr: "BAT", color: "#FF6B35" },
    { name: "Qualibat", abbr: "QLB", color: "#1D4ED8" },
    { name: "Artisans de France", abbr: "ADF", color: "#059669" },
    { name: "CMA France", abbr: "CMA", color: "#7C3AED" },
    { name: "BTP Banque", abbr: "BTP", color: "#0F172A" },
    { name: "Chorus Pro", abbr: "CHO", color: "#2563EB" },
  ];

  return (
    <section className="border-y border-[#E2E8F0] bg-white py-12">
      <div className="mx-auto max-w-5xl px-5">
        <p className="mb-8 text-center text-[13px] font-medium uppercase tracking-[0.2em] text-slate-400">
          Ils nous font confiance
        </p>

        {/* Piste défilante */}
        <div className="relative overflow-hidden">
          {/* Fondu gauche */}
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-20 bg-gradient-to-r from-white to-transparent" />
          {/* Fondu droit */}
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-20 bg-gradient-to-l from-white to-transparent" />

          <div className="flex gap-12 animate-marquee whitespace-nowrap">
            {[...logos, ...logos].map((logo, i) => (
              <div
                key={i}
                className="inline-flex shrink-0 items-center gap-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-5 py-3"
              >
                {/* Avatar initiales */}
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold text-white"
                  style={{ backgroundColor: logo.color }}
                >
                  {logo.abbr}
                </span>
                <span className="text-sm font-semibold text-slate-600">
                  {logo.name}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="mt-10 grid grid-cols-3 gap-4 sm:gap-6">
          {[
            { value: "500+", label: "artisans actifs" },
            { value: "10 000+", label: "factures transmises" },
            { value: "99,9 %", label: "taux de conformité" },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className="font-mono text-2xl font-extrabold text-[#0F172A] sm:text-3xl">
                {s.value}
              </p>
              <p className="mt-0.5 text-[13px] text-slate-400">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Section feature alternée ─────────────────────────── */
interface FeatureSectionProps {
  tag: string;
  title: string;
  titleHighlight?: string;
  description: string;
  features: { icon: React.ReactNode; label: string; desc: string }[];
  mockup: React.ReactNode;
  reverse?: boolean;
  bg?: string;
}

function FeatureSection({
  tag,
  title,
  titleHighlight,
  description,
  features,
  mockup,
  reverse = false,
  bg = "bg-white",
}: FeatureSectionProps) {
  return (
    <section className={`${bg} py-20 sm:py-24`}>
      <div className="mx-auto max-w-6xl px-5">
        <div
          className={`grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-20 ${
            reverse ? "lg:grid-flow-dense" : ""
          }`}
        >
          {/* Texte */}
          <div className={`flex flex-col gap-6 ${reverse ? "lg:col-start-2" : ""}`}>
            <span className="inline-flex w-fit items-center rounded-full border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-1 text-[12px] font-semibold uppercase tracking-widest text-[#2563EB]">
              {tag}
            </span>
            <h2 className="text-3xl font-extrabold leading-tight tracking-tight text-[#0F172A] sm:text-4xl">
              {title}{" "}
              {titleHighlight && (
                <span className="text-[#2563EB]">{titleHighlight}</span>
              )}
            </h2>
            <p className="text-[15px] leading-relaxed text-slate-500">
              {description}
            </p>
            <ul className="flex flex-col gap-4">
              {features.map((f, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#EFF6FF] text-[#2563EB]">
                    {f.icon}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-[#0F172A]">{f.label}</p>
                    <p className="text-[13px] text-slate-400">{f.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
            <Link href="/signup" className="w-fit">
              <Button className="mt-2 h-10 rounded-xl bg-[#0F172A] px-5 text-sm font-semibold text-white hover:bg-[#1E293B] gap-2">
                Essayer gratuitement <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>

          {/* Mockup */}
          <div className={`relative ${reverse ? "lg:col-start-1 lg:row-start-1" : ""}`}>
            {/* Halo */}
            <div className="pointer-events-none absolute -inset-6 rounded-3xl bg-gradient-to-br from-[#DBEAFE]/40 via-[#EDE9FE]/20 to-transparent blur-2xl" />
            <div className="relative overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_20px_60px_-12px_rgba(15,23,42,0.12)]">
              {mockup}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Mockup 1 : Création facture ───────────────────────── */
function InvoiceCreationMockup() {
  return (
    <div className="p-5 bg-[#F8FAFC]">
      {/* Entête simulée */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5">Nouvelle facture</p>
          <p className="font-mono text-sm font-bold text-[#0F172A]">FAC-2026-008</p>
        </div>
        <span className="rounded-full bg-[#FEF3C7] px-2.5 py-0.5 text-[11px] font-semibold text-[#D97706]">Brouillon</span>
      </div>
      {/* Client */}
      <div className="mb-3 rounded-xl border border-[#E2E8F0] bg-white p-3">
        <p className="mb-1 text-[11px] font-medium text-slate-400">Client</p>
        <p className="text-sm font-semibold text-[#0F172A]">Garage Martin SARL</p>
        <p className="text-[12px] text-slate-400">12 rue de la République, 75001 Paris</p>
      </div>
      {/* Lignes */}
      <div className="mb-3 rounded-xl border border-[#E2E8F0] bg-white overflow-hidden">
        <div className="border-b border-[#F1F5F9] px-3 py-2 flex justify-between text-[11px] font-medium text-slate-400">
          <span>Prestation</span><span>Montant HT</span>
        </div>
        {[
          { label: "Réfection toiture", qty: "1", price: "2 400 €" },
          { label: "Main d'œuvre (8h)", qty: "8", price: "640 €" },
        ].map((row) => (
          <div key={row.label} className="flex items-center justify-between border-b border-[#F8FAFC] px-3 py-2 last:border-0">
            <span className="text-[12px] text-[#0F172A]">{row.label}</span>
            <span className="font-mono text-[12px] font-semibold text-[#0F172A]">{row.price}</span>
          </div>
        ))}
        <div className="flex items-center justify-between bg-[#F8FAFC] px-3 py-2 border-t border-[#E2E8F0]">
          <span className="text-[12px] font-semibold text-[#0F172A]">Total HT</span>
          <span className="font-mono text-sm font-bold text-[#0F172A]">3 040 €</span>
        </div>
      </div>
      {/* CTA simulé */}
      <button className="w-full rounded-xl bg-[#2563EB] py-2.5 text-[13px] font-semibold text-white flex items-center justify-center gap-2">
        <Send className="h-3.5 w-3.5" />
        Envoyer la facture
      </button>
    </div>
  );
}

/* ─── Mockup 2 : Suivi & conformité ─────────────────────── */
function ComplianceMockup() {
  return (
    <div className="p-5 bg-[#F8FAFC]">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Suivi de transmission</p>
      <div className="flex flex-col gap-2.5">
        {[
          { step: "01", label: "Facture générée", sub: "PDF Factur-X conforme", done: true, color: "#10B981" },
          { step: "02", label: "Transmise au PPF", sub: "Portail Public de Facturation", done: true, color: "#10B981" },
          { step: "03", label: "Reçue par le client", sub: "Accusé de réception signé", done: true, color: "#10B981" },
          { step: "04", label: "Paiement en attente", sub: "Échéance : 30 jours", done: false, color: "#D97706" },
        ].map((s) => (
          <div key={s.step} className={`flex items-start gap-3 rounded-xl border p-3 bg-white ${s.done ? "border-[#D1FAE5]" : "border-[#FEF3C7]"}`}>
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
              style={{ backgroundColor: s.color }}
            >
              {s.done ? "✓" : s.step}
            </span>
            <div>
              <p className="text-[12px] font-semibold text-[#0F172A]">{s.label}</p>
              <p className="text-[11px] text-slate-400">{s.sub}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-xl border border-[#DBEAFE] bg-[#EFF6FF] px-3 py-2.5 flex items-center gap-2">
        <Archive className="h-4 w-4 text-[#2563EB] shrink-0" />
        <p className="text-[12px] text-[#1E40AF] font-medium">Archivée automatiquement — conservation 10 ans</p>
      </div>
    </div>
  );
}

/* ─── Page principale ───────────────────────────────────── */
export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <LandingHero />

      {/* Logos & stats */}
      <TrustedBySection />

      {/* Feature 1 — texte gauche, mockup droite */}
      <FeatureSection
        tag="Création rapide"
        title="Une facture en"
        titleHighlight="3 clics chrono."
        description="Sélectionne ton client, ajoute tes prestations et envoie. Qonforme génère automatiquement le PDF Factur-X, le fichier XML et transmet au PPF. Tu ne touches à rien."
        features={[
          {
            icon: <FileText className="h-4 w-4" />,
            label: "PDF Factur-X auto-généré",
            desc: "Format légal prêt à l'envoi en un clic.",
          },
          {
            icon: <Send className="h-4 w-4" />,
            label: "Transmission PPF immédiate",
            desc: "Envoi au Portail Public de Facturation sans délai.",
          },
          {
            icon: <Zap className="h-4 w-4" />,
            label: "Import de devis en facture",
            desc: "Convertis un devis accepté en facture en 1 clic.",
          },
        ]}
        mockup={<InvoiceCreationMockup />}
        bg="bg-white"
      />

      {/* Feature 2 — mockup gauche, texte droite */}
      <FeatureSection
        tag="Conformité & suivi"
        title="Zéro démarche,"
        titleHighlight="100 % conforme."
        description="Qonforme gère la chaîne complète : génération, transmission, archivage légal 10 ans. Tu reçois une notification à chaque étape clé et sais toujours où en est ta facture."
        features={[
          {
            icon: <Shield className="h-4 w-4" />,
            label: "Conforme réglementation 2026",
            desc: "Factur-X, PPF et PDP : toutes les normes couvertes.",
          },
          {
            icon: <Bell className="h-4 w-4" />,
            label: "Notifications en temps réel",
            desc: "Reçue, acceptée, rejetée — tu es alerté immédiatement.",
          },
          {
            icon: <Archive className="h-4 w-4" />,
            label: "Archivage automatique 10 ans",
            desc: "Retrouve n'importe quelle facture en quelques secondes.",
          },
        ]}
        mockup={<ComplianceMockup />}
        reverse={true}
        bg="bg-[#F8FAFC]"
      />

      {/* ── Pricing ───────────────────────────────────────── */}
      <section id="pricing" className="bg-white py-20 sm:py-24">
        <div className="max-w-5xl mx-auto px-5">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-extrabold tracking-tight text-[#0F172A] mb-3">
              Tarifs simples, sans surprise
            </h2>
            <p className="text-slate-500">
              Option annuelle — 2 mois offerts (−16 %)
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {/* Starter */}
            <div className="bg-white rounded-2xl p-8 border border-[#E2E8F0] shadow-sm">
              <p className="text-sm font-semibold text-slate-400 mb-1 uppercase tracking-widest">Starter</p>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-extrabold text-[#0F172A] font-mono">9 €</span>
                <span className="text-slate-400 text-sm">/mois HT</span>
              </div>
              <ul className="space-y-3 mb-8">
                {["10 factures par mois","Création de devis","Transmission automatique PPF","Archivage légal 10 ans","Support email 48h"].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-slate-600">
                    <CheckCircle2 className="w-4 h-4 text-[#10B981] mt-0.5 shrink-0" />{item}
                  </li>
                ))}
              </ul>
              <Link href="/signup">
                <Button className="w-full rounded-xl" variant="outline">Commencer l&apos;essai gratuit</Button>
              </Link>
            </div>
            {/* Pro */}
            <div className="bg-[#0F172A] rounded-2xl p-8 border border-[#1E293B] shadow-lg relative overflow-hidden">
              <Badge className="absolute top-4 right-4 bg-white/10 text-white border-0 text-xs">Populaire</Badge>
              <p className="text-sm font-semibold text-slate-400 mb-1 uppercase tracking-widest">Pro</p>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-extrabold text-white font-mono">19 €</span>
                <span className="text-slate-400 text-sm">/mois HT</span>
              </div>
              <ul className="space-y-3 mb-8">
                {["Factures illimitées","Création de devis","Transmission PPF/PDP","Archivage légal 10 ans","Relances automatiques J+30/45","Tableau de bord CA complet","Support email 24h"].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-slate-300">
                    <CheckCircle2 className="w-4 h-4 text-[#10B981] mt-0.5 shrink-0" />{item}
                  </li>
                ))}
              </ul>
              <Link href="/signup">
                <Button className="w-full rounded-xl bg-white text-[#0F172A] hover:bg-slate-100">Commencer l&apos;essai gratuit</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────── */}
      <footer className="border-t border-[#E2E8F0] bg-[#F8FAFC] py-10">
        <div className="max-w-5xl mx-auto px-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link href="/">
            <Image src={LOGO_URL} alt="Qonforme" width={120} height={30} className="h-7 w-auto object-contain" unoptimized />
          </Link>
          <p className="text-sm text-slate-400 text-center">
            © 2026 Qonforme — Conforme à la réglementation française de facturation électronique.
          </p>
          <div className="flex items-center gap-4 text-sm text-slate-400">
            <Link href="/mentions-legales" className="hover:text-[#0F172A] transition-colors">Mentions légales</Link>
            <Link href="/cgu" className="hover:text-[#0F172A] transition-colors">CGU</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
