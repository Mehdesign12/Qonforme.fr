"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useRef } from "react";
import {
  CheckCircle2, XCircle, Zap, Shield, ArrowRight,
  FileText, Send, Archive, Bell,
  UserPlus, FileEdit, SendHorizonal,
  ChevronDown, Star, Mail, Clock3,
  Check, Users, FileCheck, ShieldCheck, Clock,
} from "lucide-react";
import { motion, AnimatePresence, useInView } from "motion/react";

import { ShimmerButton } from "@/components/ui/shimmer-button";
import { LandingHero } from "@/components/landing/LandingHero";

const LOGO_URL =
  "https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Logo%20long%20bleu.webp";

const PICTO_Q =
  "https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Logo%20bleu%20Qonforme%20PNG.webp";

/* ─────────────────────────────────────────────────────────
   HELPER — Pill de label + pattern titre avec accent bleu
───────────────────────────────────────────────────────── */
function SectionPill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-1 text-[13px] font-medium text-[#2563EB]">
      <span className="h-1.5 w-1.5 rounded-full bg-[#2563EB]" />
      {label}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────
   HELPER — Fade-in au scroll (opacity + translateY/X)
   Anime uniquement des propriétés composited → 0 jank.
   Pas de will-change ni backdrop-filter → safe iOS mobile.
───────────────────────────────────────────────────────── */
function FadeIn({
  children,
  delay = 0,
  x = 0,
  className,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  x?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.15 });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20, x }}
      animate={isInView ? { opacity: 1, y: 0, x: 0 } : {}}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay }}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────
   SECTION C — Comment ça marche
───────────────────────────────────────────────────────── */
function HowItWorksSection() {
  const steps = [
    { n: "01", icon: <UserPlus className="h-6 w-6" />, title: "Crée ton compte", desc: "Renseigne les infos de ton entreprise. 5 minutes et c'est fait." },
    { n: "02", icon: <FileEdit className="h-6 w-6" />, title: "Crée ta facture", desc: "Sélectionne ton client et renseigne tes prestations. Simple et rapide." },
    { n: "03", icon: <SendHorizonal className="h-6 w-6" />, title: "Télécharge & transmets", desc: "Qonforme génère ton Factur-X certifié EN 16931. Télécharge-le en 1 clic et transmets-le en 2 minutes via Chorus Pro (gratuit) — notre guide t'accompagne étape par étape." },
  ];

  return (
    <section className="relative overflow-hidden bg-[#F8FAFC] py-20 sm:py-24">
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 z-0 -translate-x-1/2 -translate-y-1/2 select-none" style={{ opacity: 0.05 }}>
        <Image src={PICTO_Q} alt="" width={500} height={500} className="w-[420px] sm:w-[500px]" loading="lazy" />
      </div>
      <div className="relative z-10 mx-auto max-w-5xl px-5">
        <FadeIn className="mb-12 flex flex-col items-center text-center gap-3">
          <SectionPill label="SIMPLICITÉ" />
          <h2 className="text-3xl font-extrabold tracking-[-0.025em] text-[#0F172A] sm:text-4xl" style={{ fontFamily: "var(--font-bricolage)" }}>
            En 3 étapes,{" "}
            <span className="text-[#2563EB]">tu es conforme</span>
          </h2>
          <p className="mx-auto max-w-md text-[15px] text-slate-500">
            Le Factur-X EN 16931, c&apos;est 47 champs obligatoires et zéro droit à l&apos;erreur. On le génère pour toi.
          </p>
        </FadeIn>
        <div className="relative grid grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-4">
          <div aria-hidden className="pointer-events-none absolute left-[16.66%] right-[16.66%] top-[28px] hidden h-px bg-gradient-to-r from-[#BFDBFE] via-[#2563EB]/30 to-[#BFDBFE] sm:block" />
          {steps.map((s, i) => (
            <FadeIn key={i} delay={i * 0.1} className="relative flex flex-col items-center text-center">
              <div className="relative mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#2563EB] text-white shadow-[0_4px_14px_rgba(37,99,235,0.35)]">
                {s.icon}
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-bold text-[#2563EB] ring-2 ring-[#EFF6FF]">{s.n}</span>
              </div>
              <h3 className="mb-2 text-[15px] font-bold text-[#0F172A]">{s.title}</h3>
              <p className="max-w-[200px] text-[13px] leading-relaxed text-slate-500">{s.desc}</p>
            </FadeIn>
          ))}
        </div>
        <FadeIn delay={0.3} className="mt-12 flex justify-center">
          <Link href="/signup">
            <ShimmerButton background="rgba(37,99,235,1)" shimmerColor="#ffffff" shimmerDuration="2.5s" borderRadius="10px" className="h-11 px-6 text-[15px] font-semibold gap-2">
              Commencer maintenant <ArrowRight className="h-4 w-4" />
            </ShimmerButton>
          </Link>
        </FadeIn>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────
   Section logos / marques — EXISTANTE inchangée
───────────────────────────────────────────────────────── */
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
        <p className="mb-8 text-center text-[13px] font-medium uppercase tracking-[0.2em] text-slate-400">Ils nous font confiance</p>
        <div className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-20 bg-gradient-to-r from-white to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-20 bg-gradient-to-l from-white to-transparent" />
          <div className="flex gap-12 animate-marquee whitespace-nowrap">
            {[...logos, ...logos].map((logo, i) => (
              <div key={i} className="inline-flex shrink-0 items-center gap-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-5 py-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold text-white" style={{ backgroundColor: logo.color }}>{logo.abbr}</span>
                <span className="text-sm font-semibold text-slate-600">{logo.name}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-10 grid grid-cols-3 gap-4 sm:gap-6">
          {[{ value: "500+", label: "artisans actifs" }, { value: "10 000+", label: "factures transmises" }, { value: "99,9 %", label: "taux de conformité" }].map((s, i) => (
            <FadeIn key={s.label} delay={i * 0.1} className="text-center">
              <p className="font-mono text-2xl font-extrabold text-[#0F172A] sm:text-3xl">{s.value}</p>
              <p className="mt-0.5 text-[13px] text-slate-400">{s.label}</p>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────
   Section feature alternée — EXISTANTE, pills ajoutées
───────────────────────────────────────────────────────── */
interface FeatureSectionProps {
  pillLabel: string;
  tag: string;
  title: string;
  titleHighlight?: string;
  description: string;
  features: { icon: React.ReactNode; label: string; desc: string }[];
  mockup: React.ReactNode;
  reverse?: boolean;
  bg?: string;
}

function FeatureSection({ pillLabel, tag, title, titleHighlight, description, features, mockup, reverse = false, bg = "bg-white" }: FeatureSectionProps) {
  return (
    <section className={`${bg} py-20 sm:py-24`} id={tag === "Création rapide" ? "features" : undefined}>
      <div className="mx-auto max-w-6xl px-5">
        <div className={`grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-20 ${reverse ? "lg:grid-flow-dense" : ""}`}>
          <FadeIn x={reverse ? 20 : -20} className={`flex flex-col gap-5 ${reverse ? "lg:col-start-2" : ""}`}>
            <SectionPill label={pillLabel} />
            <h2 className="text-3xl font-extrabold leading-tight tracking-[-0.025em] text-[#0F172A] sm:text-4xl" style={{ fontFamily: "var(--font-bricolage)" }}>
              {title}{" "}
              {titleHighlight && <span className="text-[#2563EB]">{titleHighlight}</span>}
            </h2>
            <p className="text-[15px] leading-relaxed text-slate-500">{description}</p>
            <ul className="flex flex-col gap-4">
              {features.map((f, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#EFF6FF] text-[#2563EB]">{f.icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-[#0F172A]">{f.label}</p>
                    <p className="text-[13px] text-slate-400">{f.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
            <Link href="/signup" className="w-fit mt-2">
              <ShimmerButton background="rgba(37,99,235,1)" shimmerColor="#ffffff" shimmerDuration="2.5s" borderRadius="10px" className="h-10 px-5 text-sm font-semibold gap-2">
                Commencer maintenant <ArrowRight className="h-3.5 w-3.5" />
              </ShimmerButton>
            </Link>
          </FadeIn>
          <FadeIn delay={0.1} x={reverse ? -20 : 20} className={`relative ${reverse ? "lg:col-start-1 lg:row-start-1" : ""}`}>
            <div className="pointer-events-none absolute -inset-6 rounded-3xl bg-gradient-to-br from-[#DBEAFE]/40 via-[#EDE9FE]/20 to-transparent blur-2xl" />
            <div className="relative overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_20px_60px_-12px_rgba(15,23,42,0.12)]">{mockup}</div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}

/* Mockup 1 */
function InvoiceCreationMockup() {
  return (
    <div className="p-5 bg-[#F8FAFC]">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5">Nouvelle facture</p>
          <p className="font-mono text-sm font-bold text-[#0F172A]">FAC-2026-008</p>
        </div>
        <span className="rounded-full bg-[#FEF3C7] px-2.5 py-0.5 text-[11px] font-semibold text-[#D97706]">Brouillon</span>
      </div>
      <div className="mb-3 rounded-xl border border-[#E2E8F0] bg-white p-3">
        <p className="mb-1 text-[11px] font-medium text-slate-400">Client</p>
        <p className="text-sm font-semibold text-[#0F172A]">Garage Martin SARL</p>
        <p className="text-[12px] text-slate-400">12 rue de la République, 75001 Paris</p>
      </div>
      <div className="mb-3 rounded-xl border border-[#E2E8F0] bg-white overflow-hidden">
        <div className="border-b border-[#F1F5F9] px-3 py-2 flex justify-between text-[11px] font-medium text-slate-400"><span>Prestation</span><span>Montant HT</span></div>
        {[{ label: "Réfection toiture", price: "2 400 €" }, { label: "Main d'œuvre (8h)", price: "640 €" }].map((row) => (
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
      <button className="w-full rounded-xl bg-[#2563EB] py-2.5 text-[13px] font-semibold text-white flex items-center justify-center gap-2">
        <Send className="h-3.5 w-3.5" />Envoyer la facture
      </button>
    </div>
  );
}

/* Mockup 2 */
function ComplianceMockup() {
  return (
    <div className="p-5 bg-[#F8FAFC]">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Suivi de transmission</p>
      <div className="flex flex-col gap-2.5">
        {[
          { step: "01", label: "Factur-X certifié généré", sub: "Format EN 16931 EXTENDED validé", done: true, color: "#10B981" },
          { step: "02", label: "Prêt à transmettre", sub: "Téléchargement en 1 clic — guide inclus", done: true, color: "#10B981" },
          { step: "03", label: "Reçue par le client", sub: "Via sa Plateforme Agréée", done: true, color: "#10B981" },
          { step: "04", label: "Paiement en attente", sub: "Échéance : 30 jours", done: false, color: "#D97706" },
        ].map((s) => (
          <div key={s.step} className={`flex items-start gap-3 rounded-xl border p-3 bg-white ${s.done ? "border-[#D1FAE5]" : "border-[#FEF3C7]"}`}>
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ backgroundColor: s.color }}>{s.done ? "✓" : s.step}</span>
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

/* ─────────────────────────────────────────────────────────
   SECTION D — Comparaison redesign complet
───────────────────────────────────────────────────────── */
function ComparisonSection() {
  const withoutItems = [
    "Générer le XML Factur-X manuellement (47 champs, zéro erreur tolérée)",
    "Valider la conformité EN 16931 soi-même — ou payer un expert",
    "Facture mal formatée = rejet immédiat = délai de paiement",
    "Archivage manuel sur 10 ans — obligation légale souvent oubliée",
    "Aucun suivi : tu ne sais jamais si la facture a bien été reçue",
    "Des heures perdues à chaque dossier, chaque mois",
  ];
  const withItems = [
    "Factur-X certifié EN 16931 généré automatiquement — zéro erreur",
    "Devis, bons de commande, avoirs : tout est inclus",
    "Guide de transmission Chorus Pro pas-à-pas — 2 minutes",
    "Archivage légal 10 ans inclus sans surcoût",
    "Tableau de bord CA, encours, retards — en temps réel",
    "Une facture conforme créée et envoyée en moins de 3 minutes",
  ];

  return (
    <section className="relative overflow-hidden bg-[#F8FAFC] py-20 sm:py-24">
      {/* Q centré en fond */}
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 z-0 -translate-x-1/2 -translate-y-1/2 select-none" style={{ opacity: 0.04 }}>
        <Image src={PICTO_Q} alt="" width={400} height={400} className="w-[400px]" loading="lazy" />
      </div>

      <div className="relative z-10 mx-auto max-w-5xl px-5">
        <FadeIn className="mb-12 flex flex-col items-center text-center gap-3">
          <SectionPill label="COMPARAISON" />
          <h2 className="text-3xl font-extrabold tracking-[-0.025em] text-[#0F172A] sm:text-4xl" style={{ fontFamily: "var(--font-bricolage)" }}>
            Pourquoi{" "}
            <span className="text-[#2563EB]">Qonforme</span>{" "}
            plutôt que de le faire soi-même ?
          </h2>
        </FadeIn>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {/* Sans Qonforme */}
          <FadeIn delay={0.1} x={-20}
            className="rounded-2xl p-8"
            style={{
              background: "#FEF2F2",
              border: "1px solid #FECACA",
              borderRadius: "16px",
              boxShadow: "0 4px 16px rgba(239,68,68,0.08)",
            }}
          >
            <div className="mb-5 flex items-center gap-2">
              <XCircle className="h-4 w-4 text-[#EF4444] shrink-0" />
              <p className="text-[11px] font-bold tracking-[0.1em] text-[#991B1B] uppercase">Sans Qonforme</p>
            </div>
            <ul className="flex flex-col">
              {withoutItems.map((item, i) => (
                <li key={item}>
                  <div className="flex items-start gap-2.5 py-3">
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#EF4444]" />
                    <span className="text-sm text-[#7F1D1D]">{item}</span>
                  </div>
                  {i < withoutItems.length - 1 && <div className="h-px bg-[#E2E8F0]" />}
                </li>
              ))}
            </ul>
          </FadeIn>

          {/* Avec Qonforme */}
          <FadeIn delay={0.2} x={20}
            className="rounded-2xl p-8"
            style={{
              background: "#F0FDF4",
              border: "1px solid #A7F3D0",
              borderRadius: "16px",
              boxShadow: "0 4px 16px rgba(16,185,129,0.08)",
            }}
          >
            <div className="mb-5 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[#10B981] shrink-0" />
              <p className="text-[11px] font-bold tracking-[0.1em] text-[#065F46] uppercase">Avec Qonforme</p>
            </div>
            <ul className="flex flex-col">
              {withItems.map((item, i) => (
                <li key={item}>
                  <div className="flex items-start gap-2.5 py-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#10B981]" />
                    <span className="text-sm text-[#064E3B]">{item}</span>
                  </div>
                  {i < withItems.length - 1 && <div className="h-px bg-[#E2E8F0]" />}
                </li>
              ))}
            </ul>
          </FadeIn>
        </div>

        <FadeIn delay={0.3} className="mt-10 flex justify-center">
          <Link href="/signup">
            <ShimmerButton background="rgba(37,99,235,1)" shimmerColor="#ffffff" shimmerDuration="2.5s" borderRadius="10px" className="h-11 px-6 text-[15px] font-semibold gap-2">
              Commencer maintenant <ArrowRight className="h-4 w-4" />
            </ShimmerButton>
          </Link>
        </FadeIn>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────
   SECTION B — Témoignages V3 (pill ajoutée)
───────────────────────────────────────────────────────── */
function TestimonialsSection() {
  const testimonials = [
    { name: "Marc D.", role: "Plombier indépendant", city: "Lyon", initials: "MD", bg: "#DBEAFE", text: "J'avais peur que ce soit compliqué. J'ai créé ma première facture en 4 minutes. Depuis, je n'y pense plus.", stars: 5 },
    { name: "Sophie L.", role: "Auto-entrepreneuse", city: "Paris", initials: "SL", bg: "#EDE9FE", text: "Le passage à la facturation électronique m'angoissait. Qonforme a tout géré. Je reçois juste un email quand c'est transmis.", stars: 5 },
    { name: "Atelier Renard", role: "Menuiserie", city: "Bordeaux", initials: "AR", bg: "#D1FAE5", text: "On envoyait 20 factures par mois à la main. Maintenant c'est automatique et on est en règle. Indispensable.", stars: 5 },
  ];
  return (
    <section className="relative overflow-hidden py-20 sm:py-24" style={{ backgroundColor: "#EFF6FF" }}>
      <div aria-hidden className="pointer-events-none absolute select-none" style={{ top: "40%", left: "38%", transform: "translate(-50%, -50%)", opacity: 0.03, zIndex: 0 }}>
        <Image src={PICTO_Q} alt="" width={280} height={280} className="w-[280px]" loading="lazy" />
      </div>
      <div aria-hidden className="pointer-events-none absolute select-none" style={{ top: "-20px", right: "-20px", opacity: 0.08, zIndex: 0 }}>
        <Image src={PICTO_Q} alt="" width={160} height={160} className="w-[160px]" loading="lazy" />
      </div>
      <div aria-hidden className="pointer-events-none absolute select-none" style={{ bottom: "-30px", left: "-30px", opacity: 0.05, zIndex: 0 }}>
        <Image src={PICTO_Q} alt="" width={140} height={140} className="w-[140px]" loading="lazy" />
      </div>
      <div className="relative z-10 mx-auto max-w-5xl px-5">
        <FadeIn className="mb-12 flex flex-col items-center text-center gap-3">
          <SectionPill label="ILS NOUS FONT CONFIANCE" />
          <h2 className="mb-1 text-3xl font-extrabold tracking-[-0.025em] text-[#0F172A] sm:text-4xl" style={{ fontFamily: "var(--font-bricolage)" }}>
            Ils ont fait le{" "}
            <span className="text-[#2563EB]">choix Qonforme</span>
          </h2>
          <p className="text-[15px] text-slate-500">Des artisans et indépendants qui ont sécurisé leur conformité</p>
        </FadeIn>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {testimonials.map((t, i) => (
            <FadeIn key={t.name} delay={i * 0.1} className="flex flex-col gap-4 rounded-2xl bg-white p-6" style={{ border: "1px solid #BFDBFE", boxShadow: "0 2px 8px rgba(37,99,235,0.07)" }}>
              <div className="flex gap-0.5">{Array.from({ length: t.stars }).map((_, i) => <Star key={i} className="h-4 w-4 fill-[#F59E0B] text-[#F59E0B]" />)}</div>
              <p className="flex-1 text-[14px] leading-relaxed text-slate-600">&ldquo;{t.text}&rdquo;</p>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-slate-700" style={{ backgroundColor: t.bg }}>{t.initials}</div>
                <div>
                  <p className="text-sm font-semibold text-[#0F172A]">{t.name}</p>
                  <p className="text-[12px] text-slate-400">{t.role} · {t.city}</p>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────
   SECTION PRICING — toggle mensuel/annuel + cards améliorées
───────────────────────────────────────────────────────── */
function PricingSection() {
  const [annual, setAnnual] = useState(false);



  return (
    <section id="pricing" className="bg-white py-20 sm:py-24">
      <div className="max-w-5xl mx-auto px-5">
        <FadeIn className="text-center mb-10 flex flex-col items-center gap-3">
          <SectionPill label="TARIFS" />
          <h2 className="text-3xl font-extrabold tracking-[-0.025em] text-[#0F172A] sm:text-4xl" style={{ fontFamily: "var(--font-bricolage)" }}>
            Un prix fixe.{" "}
            <span className="text-[#2563EB]">Aucune surprise.</span>
          </h2>
          <p className="text-slate-500 max-w-md">
            Tout ce qu&apos;il faut pour être conforme. Pas de frais cachés, pas de limite de fonctionnalités essentielles.
          </p>

          {/* Toggle mensuel / annuel */}
          <div className="mt-4 flex items-center gap-1 rounded-full border border-[#E2E8F0] bg-[#F8FAFC] p-1">
            <button
              onClick={() => setAnnual(false)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${!annual ? "bg-[#2563EB] text-white shadow-sm" : "text-slate-500 hover:text-[#0F172A]"}`}
            >
              Mensuel
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-all ${annual ? "bg-[#2563EB] text-white shadow-sm" : "text-slate-500 hover:text-[#0F172A]"}`}
            >
              Annuel
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${annual ? "bg-white/20 text-white" : "bg-[#D1FAE5] text-[#065F46]"}`}>-16%</span>
            </button>
          </div>
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {/* Card Starter */}
          <FadeIn delay={0.15} x={-10} className="bg-white rounded-2xl p-8 border border-[#E2E8F0] shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <span className="rounded-full bg-[#F1F5F9] px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-[#64748B]">Starter</span>
            </div>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-4xl font-extrabold text-[#0F172A] font-mono">{annual ? "90 €" : "9 €"}</span>
              <span className="text-slate-400 text-sm">{annual ? "/an HT" : "/mois HT"}</span>
            </div>
            <div className="h-px bg-[#E2E8F0] my-5" />
            <ul className="space-y-3 mb-6 flex-1">
              {["10 factures/mois · devis & bons de commande illimités", "Avoirs en 1 clic depuis une facture", "Factur-X EN 16931 certifié — généré automatiquement", "Guide de transmission Chorus Pro inclus", "Envoi par email avec PDF joint", "Catalogue produits réutilisables", "Archivage légal 10 ans inclus", "Support email 48h"].map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-slate-600">
                  <CheckCircle2 className="w-4 h-4 text-[#10B981] mt-0.5 shrink-0" />{item}
                </li>
              ))}
            </ul>
            <Link href="/signup">
              <button className="w-full rounded-xl border border-[#E2E8F0] bg-white py-2.5 text-sm font-semibold text-[#0F172A] transition-colors hover:bg-[#F8FAFC]">
                Choisir ce plan →
              </button>
            </Link>
            <p className="mt-3 text-center text-[12px] text-slate-400">Idéal pour démarrer</p>
          </FadeIn>

          {/* Card Pro */}
          <FadeIn delay={0.25} x={10} className="relative overflow-hidden rounded-2xl p-8 flex flex-col" style={{ background: "#0F172A", border: "1px solid rgba(37,99,235,0.3)", boxShadow: "0 0 40px rgba(37,99,235,0.15)" }}>
            {/* Q filigrane dans la card */}
            <div aria-hidden className="pointer-events-none absolute -bottom-6 -right-6 select-none" style={{ opacity: 0.06, zIndex: 0 }}>
              <Image src={PICTO_Q} alt="" width={160} height={160} className="w-[160px]" loading="lazy" />
            </div>
            <div className="relative z-10 flex flex-col flex-1">
              <div className="flex items-center justify-between mb-4">
                <span className="rounded-full bg-[#F1F5F9]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-slate-400">Pro</span>
                <span className="rounded-lg bg-[#2563EB] px-2.5 py-1 text-[11px] font-bold text-white">Populaire</span>
              </div>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-4xl font-extrabold text-white font-mono">{annual ? "190 €" : "19 €"}</span>
                <span className="text-slate-400 text-sm">{annual ? "/an HT" : "/mois HT"}</span>
              </div>
              <div className="h-px bg-white/10 my-5" />
              <ul className="space-y-3 mb-6 flex-1">
                {["Factures illimitées · devis & bons de commande illimités", "Avoirs en 1 clic depuis une facture", "Factur-X EN 16931 certifié — généré automatiquement", "Guide de transmission multiplateforme (Chorus Pro, IOPOLE, 137 PA)", "Envoi par email avec PDF joint", "Catalogue produits réutilisables", "Archivage légal 10 ans inclus", "Tableau de bord CA : chiffre du mois, encours, retards", "Relances automatiques J+30/J+45", "Support email 24h prioritaire"].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-slate-300">
                    <CheckCircle2 className="w-4 h-4 text-[#10B981] mt-0.5 shrink-0" />{item}
                  </li>
                ))}
              </ul>
              <Link href="/signup">
                <button className="w-full rounded-xl bg-white py-2.5 text-sm font-semibold text-[#0F172A] transition-colors hover:bg-slate-100">
                  Choisir ce plan →
                </button>
              </Link>
              <p className="mt-3 text-center text-[12px] text-[#60A5FA]">Le choix de 8 artisans sur 10</p>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────
   SECTION E — Bannière urgence navy
───────────────────────────────────────────────────────── */
function UrgencyBannerSection() {
  return (
    <section className="relative overflow-hidden bg-[#0F172A] py-20 sm:py-24">
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none" style={{ opacity: 0.07, zIndex: 0 }}>
        <Image src={PICTO_Q} alt="" width={500} height={500} className="w-[500px]" style={{ filter: "hue-rotate(0deg) saturate(0) brightness(2) sepia(1) hue-rotate(190deg)" }} loading="lazy" />
      </div>
      <FadeIn className="relative z-10 mx-auto max-w-2xl px-5 text-center">
        <p className="mb-4 text-[13px] font-semibold uppercase tracking-[0.25em] text-[#60A5FA]">⏱ Septembre 2026 — dans moins de 6 mois</p>
        <h2 className="mb-4 text-3xl font-extrabold tracking-[-0.025em] text-white sm:text-4xl" style={{ fontFamily: "var(--font-bricolage)" }}>
          Chaque mois sans agir, c&apos;est un mois de retard sur tes concurrents.
        </h2>
        <p className="mb-8 text-[15px] leading-relaxed text-slate-400">La loi impose la facturation électronique à toutes les entreprises. Une facture non conforme&nbsp;= rejet immédiat&nbsp;= délai de paiement. Qonforme génère ton Factur-X certifié EN&nbsp;16931&nbsp;— sois en règle avant tout le monde.</p>
        <div className="flex flex-col items-center gap-4">
          <Link href="/signup">
            <button className="inline-flex h-12 items-center gap-2 rounded-[10px] bg-white px-7 text-[15px] font-semibold text-[#0F172A] transition-all hover:bg-slate-100 hover:shadow-lg">
              Devenir conforme maintenant →
            </button>
          </Link>
          <p className="text-[12px] text-slate-500">Opérationnel en 5 minutes · 9&nbsp;€/mois · Résiliable à tout moment</p>
        </div>
      </FadeIn>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────
   SECTION A — FAQ accordéon
───────────────────────────────────────────────────────── */
const FAQ_ITEMS = [
  { q: "Qu'est-ce que la facturation électronique obligatoire ?", a: "À partir de septembre 2026, toutes les entreprises françaises devront émettre et recevoir leurs factures en format électronique structuré (Factur-X). Qonforme génère ce fichier certifié EN 16931 automatiquement. Tu le transmets ensuite en quelques clics via Chorus Pro (gratuit, sans agrément requis) — guidé étape par étape depuis ton compte." },
  { q: "Qonforme est-il homologué par l'État ?", a: "Oui. Qonforme génère des Factur-X conformes à la norme EN 16931 — le format officiel validé par la DGFiP. La transmission se fait ensuite via Chorus Pro (B2G) ou l'une des 137 Plateformes Agréées, avec un guide pas-à-pas intégré à ton espace." },
  { q: "Est-ce que Qonforme transmet les factures automatiquement ?", a: "Qonforme s'occupe de la partie la plus complexe : générer le Factur-X certifié EN 16931 — 47 champs obligatoires, zéro erreur possible. La transmission via Chorus Pro (gratuit, géré par l'État) prend ensuite 2 minutes avec notre guide intégré. La majorité de nos utilisateurs considèrent que c'est suffisamment simple pour ne plus y penser." },
  { q: "Et si mon client n'a pas de SIREN ?", a: "Aucun problème. Qonforme gère les clients particuliers et les clients étrangers sans SIREN. La conformité s'applique uniquement aux transactions B2B entre entreprises françaises." },
  { q: "Est-ce que je peux résilier à tout moment ?", a: "Oui, sans engagement ni frais de résiliation. La résiliation se fait en un clic depuis les paramètres de ton compte. Tu conserves l'accès en lecture seule à tes factures archivées." },
  { q: "Que se passe-t-il à la fin de mon abonnement ?", a: "Ton compte passe en accès lecture seule. Toutes tes factures archivées restent accessibles et téléchargeables pendant toute la durée légale d'archivage (10 ans)." },
];

function FAQSection() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <section className="bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-3xl px-5">
        <div className="mb-12 flex flex-col items-center text-center gap-3">
          <SectionPill label="FAQ" />
          <h2 className="text-3xl font-extrabold tracking-[-0.025em] text-[#0F172A] sm:text-4xl" style={{ fontFamily: "var(--font-bricolage)" }}>
            Vous avez des questions ?
          </h2>
        </div>
        <div className="flex flex-col divide-y divide-[#F1F5F9]">
          {FAQ_ITEMS.map((item, i) => (
            <div key={i} className="py-4">
              <button onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-start justify-between gap-4 text-left">
                <span className="text-[15px] font-semibold text-[#0F172A]">{item.q}</span>
                <ChevronDown className={`mt-0.5 h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200 ${open === i ? "rotate-180" : ""}`} />
              </button>
              <AnimatePresence initial={false}>
                {open === i && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }} className="overflow-hidden">
                    <p className="pt-3 text-[14px] leading-relaxed text-slate-500">{item.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────
   SECTION CONTACT — 2 colonnes + formulaire complet
───────────────────────────────────────────────────────── */
function ContactSection() {
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({ prenom: "", nom: "", email: "", sujet: "", message: "" });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSent(true);
  };

  const inputCls = "w-full rounded-[10px] border border-[#E2E8F0] bg-white px-3.5 py-3 text-sm text-[#0F172A] placeholder-slate-400 outline-none transition-all focus:border-[#2563EB] focus:shadow-[0_0_0_3px_rgba(37,99,235,0.1)]";
  const labelCls = "mb-1.5 block text-[13px] font-semibold text-[#0F172A]";

  return (
    <section className="bg-[#F8FAFC] py-20 sm:py-24">
      <div className="mx-auto max-w-5xl px-5">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[2fr_3fr] lg:gap-16 items-start">

          {/* Colonne gauche */}
          <FadeIn x={-20} className="flex flex-col gap-6">
            <SectionPill label="CONTACT" />
            <h2 className="text-3xl font-extrabold tracking-[-0.025em] text-[#0F172A] sm:text-4xl" style={{ fontFamily: "var(--font-bricolage)" }}>
              Une question ?{" "}
              <span className="text-[#2563EB]">On te répond.</span>
            </h2>
            <p className="text-[15px] text-slate-500 leading-relaxed">Notre équipe répond sous 24h.</p>

            <div className="flex flex-col gap-4 mt-2">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EFF6FF]">
                  <Mail className="h-4 w-4 text-[#2563EB]" />
                </div>
                <div>
                  <p className="text-[12px] font-medium text-slate-400 uppercase tracking-wide">Email</p>
                  <a href="mailto:contact@qonforme.fr" className="text-sm font-semibold text-[#0F172A] hover:text-[#2563EB] transition-colors">contact@qonforme.fr</a>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EFF6FF]">
                  <Clock3 className="h-4 w-4 text-[#2563EB]" />
                </div>
                <div>
                  <p className="text-[12px] font-medium text-slate-400 uppercase tracking-wide">Délai de réponse</p>
                  <p className="text-sm font-semibold text-[#0F172A]">Réponse sous 24h</p>
                </div>
              </div>
            </div>
          </FadeIn>

          {/* Colonne droite — formulaire ou succès */}
          <FadeIn delay={0.1} x={20} className="rounded-2xl bg-white p-8" style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.07)" }}>
            {sent ? (
              <div className="flex flex-col items-center justify-center gap-4 py-8 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#D1FAE5]">
                  <Check className="h-7 w-7 text-[#059669]" />
                </div>
                <h3 className="text-xl font-bold text-[#0F172A]">Message envoyé !</h3>
                <p className="text-[15px] text-slate-500">On te répond sous 24h.</p>
                <button
                  onClick={() => { setSent(false); setForm({ prenom: "", nom: "", email: "", sujet: "", message: "" }); }}
                  className="mt-2 rounded-[10px] border border-[#E2E8F0] px-5 py-2.5 text-sm font-medium text-[#0F172A] hover:bg-[#F8FAFC] transition-colors"
                >
                  Envoyer un autre message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                {/* Prénom & Nom */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Prénom</label>
                    <input type="text" required placeholder="Marc" value={form.prenom} onChange={e => setForm({ ...form, prenom: e.target.value })} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Nom</label>
                    <input type="text" required placeholder="Dupont" value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} className={inputCls} />
                  </div>
                </div>
                {/* Email */}
                <div>
                  <label className={labelCls}>Email</label>
                  <input type="email" required placeholder="marc@exemple.fr" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className={inputCls} />
                </div>
                {/* Sujet */}
                <div>
                  <label className={labelCls}>Sujet</label>
                  <select required value={form.sujet} onChange={e => setForm({ ...form, sujet: e.target.value })} className={inputCls}>
                    <option value="">Choisir un sujet...</option>
                    <option value="abonnement">Question sur mon abonnement</option>
                    <option value="technique">Problème technique</option>
                    <option value="conformite">Question sur la conformité PPF</option>
                    <option value="autre">Autre</option>
                  </select>
                </div>
                {/* Message */}
                <div>
                  <label className={labelCls}>Message</label>
                  <textarea required rows={4} placeholder="Décris ta question ou ton problème..." value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} className={`${inputCls} resize-none`} />
                </div>
                {/* Submit */}
                <button type="submit" className="mt-1 w-full rounded-[10px] bg-[#2563EB] py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-[#1D4ED8]">
                  Envoyer mon message →
                </button>
              </form>
            )}
          </FadeIn>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────
   FOOTER NAVY 4 colonnes
───────────────────────────────────────────────────────── */
function Footer() {
  return (
    <footer className="relative overflow-hidden" style={{ background: "#0F172A", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
      {/* Q géant centré en fond */}
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none" style={{ opacity: 0.03, zIndex: 0 }}>
        <Image src={PICTO_Q} alt="" width={600} height={600} className="w-[600px]" loading="lazy" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-5 pt-16 pb-10">
        {/* 4 colonnes */}
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4 mb-12">
          {/* Col 1 — Marque */}
          <div className="lg:col-span-1">
            <Link href="/">
              <Image src={LOGO_URL} alt="Qonforme" width={130} height={32} className="h-7 w-auto object-contain mb-4" loading="lazy" />
            </Link>
            <p className="text-[13px] leading-relaxed text-slate-400 mb-4">
              Facturation électronique conforme à la réglementation française 2026.
            </p>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-slate-400">
              <CheckCircle2 className="h-3 w-3 text-[#10B981]" />
              Conforme PPF · DGFiP
            </span>
          </div>

          {/* Col 2 — Produit */}
          <div>
            <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Produit</p>
            <ul className="flex flex-col gap-2.5">
              {[
                { label: "Fonctionnalités", href: "#features" },
                { label: "Tarifs", href: "#pricing" },
                { label: "Démo interactive", href: "/demo" },
                { label: "Nouveautés", href: "#" },
              ].map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-[13px] text-slate-400 transition-colors hover:text-white">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 3 — Légal */}
          <div>
            <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Légal</p>
            <ul className="flex flex-col gap-2.5">
              {[
                { label: "Mentions légales", href: "/mentions-legales" },
                { label: "CGU", href: "/cgu" },
                { label: "Politique de confidentialité", href: "/confidentialite" },
                { label: "Gestion des cookies", href: "#" },
              ].map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-[13px] text-slate-400 transition-colors hover:text-white">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 4 — Contact */}
          <div>
            <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Contact</p>
            <ul className="flex flex-col gap-2.5">
              <li>
                <a href="mailto:contact@qonforme.fr" className="text-[13px] text-slate-400 transition-colors hover:text-white">contact@qonforme.fr</a>
              </li>
              <li>
                <p className="text-[13px] text-slate-500">Lun–Ven 9h–18h</p>
              </li>
              <li>
                <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="text-[13px] text-slate-400 transition-colors hover:text-white">LinkedIn Qonforme</a>
              </li>
            </ul>
          </div>
        </div>

        {/* Barre copyright */}
        <div className="border-t pt-6" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-[13px] text-[#475569] text-center sm:text-left">
              © 2026 Qonforme — Conforme à la réglementation française de facturation électronique.
            </p>
            <div className="flex items-center gap-4 text-[13px] text-[#475569]">
              <Link href="/mentions-legales" className="hover:text-white transition-colors">Mentions légales</Link>
              <span className="text-slate-700">·</span>
              <Link href="/cgu" className="hover:text-white transition-colors">CGU</Link>
              <span className="text-slate-700">·</span>
              <Link href="/confidentialite" className="hover:text-white transition-colors">Confidentialité</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ─────────────────────────────────────────────────────────
   Section chiffres clés
───────────────────────────────────────────────────────── */
function KeyMetricsSection() {
  const metrics = [
    {
      icon: <Users className="h-5 w-5" />,
      value: "500+",
      label: "entreprises accompagnées",
      desc: "artisans, indépendants, TPE",
    },
    {
      icon: <FileCheck className="h-5 w-5" />,
      value: "10 000+",
      label: "factures conformes émises",
      desc: "sans une seule pénalité",
    },
    {
      icon: <Clock className="h-5 w-5" />,
      value: "< 3 min",
      label: "pour créer et envoyer",
      desc: "en moyenne, depuis n'importe où",
    },
    {
      icon: <ShieldCheck className="h-5 w-5" />,
      value: "99,9 %",
      label: "taux de conformité",
      desc: "certifié Chorus Pro & DGFiP",
    },
  ];

  return (
    <section className="border-y border-[#BFDBFE]/40 bg-[#EFF6FF]/40 py-16 sm:py-20">
      <div className="mx-auto max-w-5xl px-5">
        <div className="mb-10 flex flex-col items-center gap-3 text-center">
          <SectionPill label="NOS CHIFFRES" />
          <h2
            className="text-3xl font-extrabold tracking-[-0.025em] text-[#0F172A] sm:text-4xl"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            Des résultats qui{" "}
            <span className="text-[#2563EB]">parlent d&apos;eux-mêmes</span>
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
          {metrics.map((m, i) => (
            <motion.div
              key={m.label}
              className="flex flex-col items-center gap-3 rounded-2xl border border-[#BFDBFE]/60 bg-white p-6 text-center shadow-sm"
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ delay: i * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EFF6FF] text-[#2563EB]">
                {m.icon}
              </span>
              <p className="font-mono text-3xl font-extrabold text-[#0F172A] sm:text-4xl">
                {m.value}
              </p>
              <div>
                <p className="text-sm font-semibold text-[#0F172A]">{m.label}</p>
                <p className="mt-0.5 text-[13px] text-slate-400">{m.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────
   PAGE PRINCIPALE
───────────────────────────────────────────────────────── */
/* ─────────────────────────────────────────────────────────
   JSON-LD — FAQPage (données structurées pour Google)
───────────────────────────────────────────────────────── */
const FAQ_JSONLD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_ITEMS.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.a,
    },
  })),
};

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* JSON-LD FAQPage */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSONLD) }}
      />
      {/* 1 — Hero */}
      <LandingHero />
      {/* 2 — Comment ça marche */}
      <HowItWorksSection />
      {/* 3 — Social proof */}
      <TrustedBySection />
      {/* 4 — Chiffres clés */}
      <KeyMetricsSection />
      {/* 5 — Création rapide */}
      <FeatureSection
        pillLabel="CRÉATION RAPIDE"
        tag="Création rapide"
        title="Une facture envoyée en"
        titleHighlight="moins de 3 minutes."
        description="Sélectionne ton client, renseigne ta prestation. Qonforme génère ton Factur-X certifié EN 16931 en un clic — la partie la plus technique, résolue en 3 secondes. La transmission via Chorus Pro prend 2 minutes de plus avec notre guide."
        features={[
          { icon: <FileText className="h-4 w-4" />, label: "PDF Factur-X auto-généré", desc: "Format légal certifié EN 16931, prêt en un clic." },
          { icon: <Send className="h-4 w-4" />, label: "Prêt à transmettre en 1 clic", desc: "Factur-X généré, guide inclus. Chorus Pro en 2 minutes." },
          { icon: <Zap className="h-4 w-4" />, label: "Conversion devis → facture", desc: "Convertis un devis accepté en facture en 1 clic." },
        ]}
        mockup={<InvoiceCreationMockup />}
        bg="bg-white"
      />
      {/* 5 — Conformité & suivi */}
      <FeatureSection
        pillLabel="CONFORMITÉ & SUIVI"
        tag="Conformité & suivi"
        title="Toujours en règle,"
        titleHighlight="sans y penser."
        description="Qonforme prend en charge la partie la plus complexe : génération du Factur-X certifié EN 16931, guide de transmission pas-à-pas, archivage légal 10 ans. Tu gardes la main sur chaque facture — sans avoir à comprendre le jargon PPF."
        features={[
          { icon: <Shield className="h-4 w-4" />, label: "Conforme réglementation 2026", desc: "Format EN 16931 validé DGFiP — zéro risque de rejet." },
          { icon: <Bell className="h-4 w-4" />, label: "Statuts en temps réel", desc: "Brouillon, envoyée, payée, en retard — tout tracé dans ton tableau de bord." },
          { icon: <Archive className="h-4 w-4" />, label: "Archivage légal 10 ans", desc: "Retrouve n'importe quelle facture en quelques secondes." },
        ]}
        mockup={<ComplianceMockup />}
        reverse={true}
        bg="bg-[#F8FAFC]"
      />
      {/* 6 — Comparaison */}
      <ComparisonSection />
      {/* 7 — Témoignages */}
      <TestimonialsSection />
      {/* 8 — Pricing */}
      <PricingSection />
      {/* 9 — Bannière urgence */}
      <UrgencyBannerSection />
      {/* 10 — FAQ */}
      <FAQSection />
      {/* 11 — Contact */}
      <ContactSection />
      {/* 12 — Footer navy */}
      <Footer />
    </div>
  );
}
