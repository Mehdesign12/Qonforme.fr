"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import {
  CheckCircle2, XCircle, Zap, Shield, ArrowRight,
  FileText, Send, Archive, Bell,
  UserPlus, FileEdit, SendHorizonal,
  ChevronDown, Star,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { LandingHero } from "@/components/landing/LandingHero";

/* 1.3 — Logo officiel sans fond blanc */
const LOGO_URL =
  "https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Logo%20long%20bleu.webp";

/* Picto Q filigrane */
const PICTO_Q =
  "https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Logo%20bleu%20Qonforme%20PNG.webp";

/* ─────────────────────────────────────────────────────────
   SECTION C (position 2) — Comment ça marche
   Fond #F8FAFC · picto Q centré 4-6%
───────────────────────────────────────────────────────── */
function HowItWorksSection() {
  const steps = [
    {
      n: "01",
      icon: <UserPlus className="h-6 w-6" />,
      title: "Crée ton compte",
      desc: "Renseigne les infos de ton entreprise. 5 minutes et c'est fait.",
    },
    {
      n: "02",
      icon: <FileEdit className="h-6 w-6" />,
      title: "Crée ta facture",
      desc: "Sélectionne ton client et renseigne tes prestations. Simple et rapide.",
    },
    {
      n: "03",
      icon: <SendHorizonal className="h-6 w-6" />,
      title: "Envoie",
      desc: "Qonforme génère le Factur-X, transmet au PPF et archive automatiquement.",
    },
  ];

  return (
    <section className="relative overflow-hidden bg-[#F8FAFC] py-20 sm:py-24">
      {/* Q filigrane centré */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 z-0 -translate-x-1/2 -translate-y-1/2 select-none"
        style={{ opacity: 0.05 }}
      >
        <Image src={PICTO_Q} alt="" width={500} height={500} className="w-[420px] sm:w-[500px]" unoptimized />
      </div>

      <div className="relative z-10 mx-auto max-w-5xl px-5">
        <div className="mb-12 text-center">
          <h2
            className="mb-3 text-3xl font-extrabold tracking-[-0.025em] text-[#0F172A] sm:text-4xl"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            En 3 étapes, tu es conforme
          </h2>
          <p className="mx-auto max-w-md text-[15px] text-slate-500">
            Pas besoin de comprendre le PPF ni le Factur-X. On s&apos;en occupe.
          </p>
        </div>

        <div className="relative grid grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-4">
          {/* Ligne de connexion desktop */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-[16.66%] right-[16.66%] top-[28px] hidden h-px bg-gradient-to-r from-[#BFDBFE] via-[#2563EB]/30 to-[#BFDBFE] sm:block"
          />

          {steps.map((s, i) => (
            <div key={i} className="relative flex flex-col items-center text-center">
              {/* Numéro cercle */}
              <div className="relative mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#2563EB] text-white shadow-[0_4px_14px_rgba(37,99,235,0.35)]">
                {s.icon}
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-bold text-[#2563EB] ring-2 ring-[#EFF6FF]">
                  {s.n}
                </span>
              </div>
              <h3 className="mb-2 text-[15px] font-bold text-[#0F172A]">{s.title}</h3>
              <p className="max-w-[200px] text-[13px] leading-relaxed text-slate-500">{s.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 flex justify-center">
          <Link href="/signup">
            <ShimmerButton
              background="rgba(37,99,235,1)"
              shimmerColor="#ffffff"
              shimmerDuration="2.5s"
              borderRadius="10px"
              className="h-11 px-6 text-[15px] font-semibold gap-2"
            >
              Commencer maintenant <ArrowRight className="h-4 w-4" />
            </ShimmerButton>
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────
   Section logos / marques — EXISTANTE, inchangée
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
        <p className="mb-8 text-center text-[13px] font-medium uppercase tracking-[0.2em] text-slate-400">
          Ils nous font confiance
        </p>
        <div className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-20 bg-gradient-to-r from-white to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-20 bg-gradient-to-l from-white to-transparent" />
          <div className="flex gap-12 animate-marquee whitespace-nowrap">
            {[...logos, ...logos].map((logo, i) => (
              <div
                key={i}
                className="inline-flex shrink-0 items-center gap-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-5 py-3"
              >
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold text-white"
                  style={{ backgroundColor: logo.color }}
                >
                  {logo.abbr}
                </span>
                <span className="text-sm font-semibold text-slate-600">{logo.name}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-10 grid grid-cols-3 gap-4 sm:gap-6">
          {[
            { value: "500+", label: "artisans actifs" },
            { value: "10 000+", label: "factures transmises" },
            { value: "99,9 %", label: "taux de conformité" },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className="font-mono text-2xl font-extrabold text-[#0F172A] sm:text-3xl">{s.value}</p>
              <p className="mt-0.5 text-[13px] text-slate-400">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────
   Section feature alternée — EXISTANTE, inchangée
───────────────────────────────────────────────────────── */
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

function FeatureSection({ tag, title, titleHighlight, description, features, mockup, reverse = false, bg = "bg-white" }: FeatureSectionProps) {
  return (
    <section className={`${bg} py-20 sm:py-24`}>
      <div className="mx-auto max-w-6xl px-5">
        <div className={`grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-20 ${reverse ? "lg:grid-flow-dense" : ""}`}>
          <div className={`flex flex-col gap-6 ${reverse ? "lg:col-start-2" : ""}`}>
            <span className="inline-flex w-fit items-center rounded-full border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-1 text-[12px] font-semibold uppercase tracking-widest text-[#2563EB]">
              {tag}
            </span>
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
          </div>
          <div className={`relative ${reverse ? "lg:col-start-1 lg:row-start-1" : ""}`}>
            <div className="pointer-events-none absolute -inset-6 rounded-3xl bg-gradient-to-br from-[#DBEAFE]/40 via-[#EDE9FE]/20 to-transparent blur-2xl" />
            <div className="relative overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_20px_60px_-12px_rgba(15,23,42,0.12)]">{mockup}</div>
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
        <div className="border-b border-[#F1F5F9] px-3 py-2 flex justify-between text-[11px] font-medium text-slate-400">
          <span>Prestation</span><span>Montant HT</span>
        </div>
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
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ backgroundColor: s.color }}>
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

/* ─────────────────────────────────────────────────────────
   SECTION D (position 6) — Tableau comparaison
   Q centré en fond 3-5%
───────────────────────────────────────────────────────── */
function ComparisonSection() {
  const withoutItems = [
    "Connexion manuelle à Chorus Pro à chaque facture",
    "Génération du fichier Factur-X à la main",
    "Risque d'erreur de format → facture rejetée",
    "Archivage manuel sur 10 ans",
    "Aucun suivi de statut en temps réel",
    "Perte de temps sur chaque facture",
  ];
  const withItems = [
    "Transmission automatique au PPF en un clic",
    "Factur-X généré et validé automatiquement",
    "0 risque de rejet pour raison technique",
    "Archivage légal 10 ans inclus",
    "Statut en temps réel à chaque étape",
    "Une facture envoyée en moins de 3 minutes",
  ];

  return (
    <section className="relative overflow-hidden bg-white py-20 sm:py-24">
      {/* Q centré en fond */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 z-0 -translate-x-1/2 -translate-y-1/2 select-none"
        style={{ opacity: 0.04 }}
      >
        <Image src={PICTO_Q} alt="" width={520} height={520} className="w-[440px] sm:w-[520px]" unoptimized />
      </div>

      <div className="relative z-10 mx-auto max-w-5xl px-5">
        <div className="mb-12 text-center">
          <h2
            className="text-3xl font-extrabold tracking-[-0.025em] text-[#0F172A] sm:text-4xl"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            Pourquoi Qonforme plutôt que de le faire soi-même ?
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Sans Qonforme */}
          <div className="rounded-2xl border border-[#FECACA] bg-[#FEF2F2] p-6">
            <p className="mb-5 text-[13px] font-bold uppercase tracking-widest text-[#991B1B]">
              ✗ Sans Qonforme
            </p>
            <ul className="flex flex-col gap-3">
              {withoutItems.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-[#7F1D1D]">
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#EF4444]" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Avec Qonforme */}
          <div className="rounded-2xl border border-[#BBF7D0] bg-[#F0FDF4] p-6">
            <p className="mb-5 text-[13px] font-bold uppercase tracking-widest text-[#065F46]">
              ✓ Avec Qonforme
            </p>
            <ul className="flex flex-col gap-3">
              {withItems.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-[#064E3B]">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#10B981]" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 flex justify-center">
          <Link href="/signup">
            <ShimmerButton
              background="rgba(37,99,235,1)"
              shimmerColor="#ffffff"
              shimmerDuration="2.5s"
              borderRadius="10px"
              className="h-11 px-6 text-[15px] font-semibold gap-2"
            >
              Commencer maintenant <ArrowRight className="h-4 w-4" />
            </ShimmerButton>
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────
   SECTION B (position 7) — Témoignages V3
   Fond #EFF6FF · 3 Q selon specs exactes
───────────────────────────────────────────────────────── */
function TestimonialsSection() {
  const testimonials = [
    {
      name: "Marc D.",
      role: "Plombier indépendant",
      city: "Lyon",
      initials: "MD",
      bg: "#DBEAFE",
      text: "J'avais peur que ce soit compliqué. J'ai créé ma première facture en 4 minutes. Depuis, je n'y pense plus.",
      stars: 5,
    },
    {
      name: "Sophie L.",
      role: "Auto-entrepreneuse",
      city: "Paris",
      initials: "SL",
      bg: "#EDE9FE",
      text: "Le passage à la facturation électronique m'angoissait. Qonforme a tout géré. Je reçois juste un email quand c'est transmis.",
      stars: 5,
    },
    {
      name: "Atelier Renard",
      role: "Menuiserie",
      city: "Bordeaux",
      initials: "AR",
      bg: "#D1FAE5",
      text: "On envoyait 20 factures par mois à la main. Maintenant c'est automatique et on est en règle. Indispensable.",
      stars: 5,
    },
  ];

  return (
    <section
      className="relative overflow-hidden py-20 sm:py-24"
      style={{ backgroundColor: "#EFF6FF" }}
    >
      {/* Q n°3 — centré fond (3%) */}
      <div
        aria-hidden
        className="pointer-events-none absolute select-none"
        style={{
          top: "40%", left: "38%",
          transform: "translate(-50%, -50%)",
          opacity: 0.03, zIndex: 0,
        }}
      >
        <Image src={PICTO_Q} alt="" width={280} height={280} className="w-[280px]" unoptimized />
      </div>
      {/* Q n°1 — coin haut droit (8%) */}
      <div
        aria-hidden
        className="pointer-events-none absolute select-none"
        style={{ top: "-20px", right: "-20px", opacity: 0.08, zIndex: 0 }}
      >
        <Image src={PICTO_Q} alt="" width={160} height={160} className="w-[160px]" unoptimized />
      </div>
      {/* Q n°2 — coin bas gauche (5%) */}
      <div
        aria-hidden
        className="pointer-events-none absolute select-none"
        style={{ bottom: "-30px", left: "-30px", opacity: 0.05, zIndex: 0 }}
      >
        <Image src={PICTO_Q} alt="" width={140} height={140} className="w-[140px]" unoptimized />
      </div>

      <div className="relative z-10 mx-auto max-w-5xl px-5">
        <div className="mb-12 text-center">
          <h2
            className="mb-3 text-3xl font-extrabold tracking-[-0.025em] text-[#0F172A] sm:text-4xl"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            Ils ont fait le choix Qonforme
          </h2>
          <p className="text-[15px] text-slate-500">
            Des artisans et indépendants qui ont sécurisé leur conformité
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {testimonials.map((t) => (
            <div
              key={t.name}
              className="flex flex-col gap-4 rounded-2xl bg-white p-6"
              style={{
                border: "1px solid #BFDBFE",
                boxShadow: "0 2px 8px rgba(37,99,235,0.07)",
              }}
            >
              {/* Étoiles */}
              <div className="flex gap-0.5">
                {Array.from({ length: t.stars }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-[#F59E0B] text-[#F59E0B]" />
                ))}
              </div>
              {/* Témoignage */}
              <p className="flex-1 text-[14px] leading-relaxed text-slate-600">
                &ldquo;{t.text}&rdquo;
              </p>
              {/* Auteur */}
              <div className="flex items-center gap-3">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-slate-700"
                  style={{ backgroundColor: t.bg }}
                >
                  {t.initials}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#0F172A]">{t.name}</p>
                  <p className="text-[12px] text-slate-400">{t.role} · {t.city}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────
   Pricing — EXISTANTE, inchangée
───────────────────────────────────────────────────────── */
function PricingSection() {
  return (
    <section id="pricing" className="bg-white py-20 sm:py-24">
      <div className="max-w-5xl mx-auto px-5">
        <div className="text-center mb-12">
          <h2
            className="text-3xl font-extrabold tracking-[-0.025em] text-[#0F172A] mb-3"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            Un prix fixe. Aucune surprise.
          </h2>
          <p className="text-slate-500 max-w-md mx-auto">
            Tout ce qu&apos;il faut pour être conforme et bien gérer ta facturation.
            Pas de frais cachés, pas de limite de fonctionnalités essentielles.
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
              {["10 factures par mois", "Création de devis", "Transmission automatique PPF", "Archivage légal 10 ans", "Support email 48h"].map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-slate-600">
                  <CheckCircle2 className="w-4 h-4 text-[#10B981] mt-0.5 shrink-0" />{item}
                </li>
              ))}
            </ul>
            <Link href="/signup">
              <Button className="w-full rounded-xl" variant="outline">Choisir ce plan →</Button>
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
              {["Factures illimitées", "Création de devis", "Transmission PPF/PDP", "Archivage légal 10 ans", "Relances automatiques J+30/45", "Tableau de bord CA complet", "Support email 24h"].map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-[#10B981] mt-0.5 shrink-0" />{item}
                </li>
              ))}
            </ul>
            <Link href="/signup">
              <Button className="w-full rounded-xl bg-white text-[#0F172A] hover:bg-slate-100">Choisir ce plan →</Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────
   SECTION E (position 9) — Bannière urgence navy V1
   Q géant centré 500px · 7% · couleur #2563EB
───────────────────────────────────────────────────────── */
function UrgencyBannerSection() {
  return (
    <section className="relative overflow-hidden bg-[#0F172A] py-20 sm:py-24">
      {/* Q géant centré */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none"
        style={{ opacity: 0.07, zIndex: 0 }}
      >
        <Image
          src={PICTO_Q}
          alt=""
          width={500}
          height={500}
          className="w-[500px]"
          style={{ filter: "hue-rotate(0deg) saturate(0) brightness(2) sepia(1) hue-rotate(190deg)" }}
          unoptimized
        />
      </div>

      <div className="relative z-10 mx-auto max-w-2xl px-5 text-center">
        <p className="mb-4 text-[13px] font-semibold uppercase tracking-[0.25em] text-[#60A5FA]">
          Septembre 2026
        </p>
        <h2
          className="mb-4 text-3xl font-extrabold tracking-[-0.025em] text-white sm:text-4xl"
          style={{ fontFamily: "var(--font-bricolage)" }}
        >
          La date limite approche.
        </h2>
        <p className="mb-8 text-[15px] leading-relaxed text-slate-400">
          Septembre 2026 — facturation électronique obligatoire pour toutes les entreprises.
        </p>
        <div className="flex flex-col items-center gap-4">
          <Link href="/signup">
            <button className="inline-flex h-12 items-center gap-2 rounded-[10px] bg-white px-7 text-[15px] font-semibold text-[#0F172A] transition-all hover:bg-slate-100 hover:shadow-lg">
              Je me prépare maintenant →
            </button>
          </Link>
          <p className="text-[12px] text-slate-500">
            Opérationnel en 5 minutes · Résiliable à tout moment
          </p>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────
   SECTION A (position 10) — FAQ accordéon
   Fond blanc · pas de Q
───────────────────────────────────────────────────────── */
const FAQ_ITEMS = [
  {
    q: "Qu'est-ce que la facturation électronique obligatoire ?",
    a: "À partir de septembre 2026, toutes les entreprises françaises devront émettre et recevoir leurs factures en format électronique structuré (Factur-X). Ces factures transitent par le Portail Public de Facturation (PPF), géré par l'État. Qonforme s'y connecte automatiquement — tu n'as rien à faire.",
  },
  {
    q: "Qonforme est-il homologué par l'État ?",
    a: "Oui. Qonforme est connecté à l'API officielle Chorus Pro, géré par la DGFiP. Chaque facture émise respecte les normes Factur-X et est transmise au PPF selon les exigences légales.",
  },
  {
    q: "Et si mon client n'a pas de SIREN ?",
    a: "Aucun problème. Qonforme gère les clients particuliers et les clients étrangers sans SIREN. La conformité s'applique uniquement aux transactions B2B entre entreprises françaises.",
  },
  {
    q: "Puis-je importer mes clients existants ?",
    a: "Oui. Un import CSV est disponible depuis les paramètres. Tu peux aussi ajouter tes clients manuellement avec une recherche automatique par SIREN pour pré-remplir les informations.",
  },
  {
    q: "Est-ce que je peux résilier à tout moment ?",
    a: "Oui, sans engagement ni frais de résiliation. La résiliation se fait en un clic depuis les paramètres de ton compte. Tu conserves l'accès en lecture seule à tes factures archivées.",
  },
  {
    q: "Que se passe-t-il à la fin de mon abonnement ?",
    a: "Ton compte passe en accès lecture seule. Toutes tes factures archivées restent accessibles et téléchargeables pendant toute la durée légale d'archivage (10 ans).",
  },
];

function FAQSection() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section className="bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-3xl px-5">
        <div className="mb-12 text-center">
          <h2
            className="text-3xl font-extrabold tracking-[-0.025em] text-[#0F172A] sm:text-4xl"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            Vous avez des questions ?
          </h2>
        </div>

        <div className="flex flex-col divide-y divide-[#F1F5F9]">
          {FAQ_ITEMS.map((item, i) => (
            <div key={i} className="py-4">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="flex w-full items-start justify-between gap-4 text-left"
              >
                <span className="text-[15px] font-semibold text-[#0F172A]">{item.q}</span>
                <ChevronDown
                  className={`mt-0.5 h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200 ${open === i ? "rotate-180" : ""}`}
                />
              </button>
              <AnimatePresence initial={false}>
                {open === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                    className="overflow-hidden"
                  >
                    <p className="pt-3 text-[14px] leading-relaxed text-slate-500">{item.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <p className="text-[14px] text-slate-400">
            Une autre question ?{" "}
            <a href="mailto:contact@qonforme.fr" className="text-[#2563EB] hover:underline font-medium">
              Contacte-nous →
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────
   PAGE PRINCIPALE — Structure complète avec positions
───────────────────────────────────────────────────────── */
export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* 1 — Hero (existant) */}
      <LandingHero />

      {/* 2 — Section C : Comment ça marche ← NOUVEAU */}
      <HowItWorksSection />

      {/* 3 — Social proof / Logos & stats (existant) */}
      <TrustedBySection />

      {/* 4 — Section Création rapide (existante) */}
      <FeatureSection
        tag="Création rapide"
        title="Une facture envoyée en"
        titleHighlight="moins de 3 minutes."
        description="Sélectionne ton client, renseigne ta prestation, envoie. Qonforme s'occupe du reste : génération Factur-X, transmission au PPF, archivage légal. Tu ne touches à rien."
        features={[
          { icon: <FileText className="h-4 w-4" />, label: "PDF Factur-X auto-généré", desc: "Format légal prêt à l'envoi en un clic." },
          { icon: <Send className="h-4 w-4" />, label: "Transmission PPF immédiate", desc: "Envoi au Portail Public de Facturation sans délai." },
          { icon: <Zap className="h-4 w-4" />, label: "Import de devis en facture", desc: "Convertis un devis accepté en facture en 1 clic." },
        ]}
        mockup={<InvoiceCreationMockup />}
        bg="bg-white"
      />

      {/* 5 — Section Conformité & suivi (existante) */}
      <FeatureSection
        tag="Conformité & suivi"
        title="Toujours en règle,"
        titleHighlight="sans y penser."
        description="Qonforme gère la chaîne complète pour toi : génération, transmission, accusé de réception, archivage 10 ans. Tu sais à tout moment où en est chaque facture — sans avoir à te connecter à Chorus Pro."
        features={[
          { icon: <Shield className="h-4 w-4" />, label: "Conforme réglementation 2026", desc: "Factur-X, PPF et PDP : toutes les normes couvertes." },
          { icon: <Bell className="h-4 w-4" />, label: "Notifications en temps réel", desc: "Reçue, acceptée, rejetée — tu es alerté immédiatement." },
          { icon: <Archive className="h-4 w-4" />, label: "Archivage automatique 10 ans", desc: "Retrouve n'importe quelle facture en quelques secondes." },
        ]}
        mockup={<ComplianceMockup />}
        reverse={true}
        bg="bg-[#F8FAFC]"
      />

      {/* 6 — Section D : Tableau comparaison ← NOUVEAU */}
      <ComparisonSection />

      {/* 7 — Section B : Témoignages V3 ← NOUVEAU */}
      <TestimonialsSection />

      {/* 8 — Pricing (existant) */}
      <PricingSection />

      {/* 9 — Section E : Bannière urgence navy ← NOUVEAU */}
      <UrgencyBannerSection />

      {/* 10 — Section A : FAQ accordéon ← NOUVEAU */}
      <FAQSection />

      {/* 11 — Footer (existant) + Q filigrane blanc centré 3-4% */}
      <footer className="relative overflow-hidden border-t border-[#E2E8F0] bg-[#F8FAFC] py-10">
        {/* Q filigrane blanc centré footer */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 z-0 -translate-x-1/2 -translate-y-1/2 select-none"
          style={{ opacity: 0.04 }}
        >
          <Image src={PICTO_Q} alt="" width={300} height={300} className="w-[260px]" unoptimized />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-5 flex flex-col sm:flex-row items-center justify-between gap-4">
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
