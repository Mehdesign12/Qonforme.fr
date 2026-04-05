"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useRef, useEffect, useCallback } from "react";
import {
  CheckCircle2, XCircle, Zap, Shield, ArrowRight,
  FileText, Send, Archive, Bell,
  UserPlus, FileEdit, SendHorizonal,
  ChevronDown, Star, Mail, Clock3,
  Check, Users, FileCheck, ShieldCheck, Clock, BadgeCheck, Quote,
} from "lucide-react";
import { motion, AnimatePresence, useInView, useScroll, useTransform, useMotionValue, useSpring } from "motion/react";

import { ShimmerButton } from "@/components/ui/shimmer-button";
import { LandingHero } from "@/components/landing/LandingHero";
import Footer from "@/components/layout/Footer";


const PICTO_Q =
  "https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Logo%20bleu%20Qonforme%20PNG.webp";

/* ─────────────────────────────────────────────────────────
   HELPER — Pill de label + pattern titre avec accent bleu
───────────────────────────────────────────────────────── */
function SectionPill({ label }: { label: string }) {
  return (
    <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-1 text-[13px] font-medium text-[#2563EB]">
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
   HELPER — Counter animé (0 → valeur finale au scroll)
───────────────────────────────────────────────────────── */
function AnimatedCounter({ value, suffix = "", prefix = "" }: { value: number; suffix?: string; prefix?: string }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.5 });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    const duration = 1200;
    const start = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      setDisplay(Math.round(eased * value));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [isInView, value]);

  return <span ref={ref}>{prefix}{display.toLocaleString("fr-FR")}{suffix}</span>;
}

/* ─────────────────────────────────────────────────────────
   HELPER — Parallax wrapper (mockups qui bougent au scroll)
───────────────────────────────────────────────────────── */
function ParallaxWrapper({ children, offset = 40, className }: { children: React.ReactNode; offset?: number; className?: string }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [offset, -offset]);

  return (
    <motion.div ref={ref} style={{ y }} className={className}>
      {children}
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────
   HELPER — Tilt 3D hover sur cards
───────────────────────────────────────────────────────── */
function TiltCard({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  const smoothX = useSpring(rotateX, { stiffness: 200, damping: 20 });
  const smoothY = useSpring(rotateY, { stiffness: 200, damping: 20 });

  const handleMouse = useCallback((e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    rotateX.set(y * -8);
    rotateY.set(x * 8);
  }, [rotateX, rotateY]);

  const handleLeave = useCallback(() => {
    rotateX.set(0);
    rotateY.set(0);
  }, [rotateX, rotateY]);

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouse}
      onMouseLeave={handleLeave}
      style={{ rotateX: smoothX, rotateY: smoothY, transformPerspective: 800, ...style }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────
   HELPER — Draw checkmark SVG animé
───────────────────────────────────────────────────────── */
function DrawCheckmark({ size = 20, color = "#10B981", delay = 0 }: { size?: number; color?: string; delay?: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.5 });

  return (
    <svg ref={ref} width={size} height={size} viewBox="0 0 24 24" fill="none" className="shrink-0">
      <motion.path
        d="M5 12l5 5L19 7"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={isInView ? { pathLength: 1, opacity: 1 } : {}}
        transition={{ duration: 0.5, delay, ease: "easeOut" }}
      />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────
   SECTION C — Comment ça marche (timeline animée)
───────────────────────────────────────────────────────── */
function HowItWorksSection() {
  const steps = [
    { n: "01", icon: <UserPlus className="h-6 w-6" />, title: "Crée ton compte", desc: "Renseigne les infos de ton entreprise. 5 minutes et c'est fait." },
    { n: "02", icon: <FileEdit className="h-6 w-6" />, title: "Crée ta facture", desc: "Sélectionne ton client et renseigne tes prestations. Simple et rapide." },
    { n: "03", icon: <SendHorizonal className="h-6 w-6" />, title: "Télécharge & transmets", desc: "Qonforme génère ton Factur-X certifié EN 16931. Télécharge-le en 1 clic et transmets-le en 2 minutes via Chorus Pro (gratuit) — notre guide t'accompagne étape par étape." },
  ];

  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: true, amount: 0.3 });

  return (
    <section ref={sectionRef} className="relative overflow-hidden bg-[#F8FAFC] py-20 sm:py-24">
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 z-0 -translate-x-1/2 -translate-y-1/2 select-none" style={{ opacity: 0.05 }}>
        <Image src={PICTO_Q} alt="" width={500} height={500} className="w-[420px] sm:w-[500px]" sizes="(min-width: 640px) 500px, 420px" loading="lazy" />
      </div>
      <div className="relative z-10 mx-auto max-w-5xl px-5">
        <FadeIn className="mb-14 flex flex-col items-center text-center gap-3">
          <SectionPill label="SIMPLICITÉ" />
          <h2 className="text-3xl font-extrabold tracking-[-0.025em] text-[#0F172A] sm:text-4xl" style={{ fontFamily: "var(--font-bricolage)" }}>
            En 3 étapes,{" "}
            <span className="text-[#2563EB]">tu es conforme</span>
          </h2>
          <p className="mx-auto max-w-md text-[15px] text-slate-500">
            Le Factur-X EN 16931, c&apos;est 47 champs obligatoires et zéro droit à l&apos;erreur. On le génère pour toi.
          </p>
        </FadeIn>

        {/* Desktop — horizontal timeline */}
        <div className="hidden sm:block">
          <div className="relative grid grid-cols-3 gap-4">
            {/* SVG ligne + pulse lumineux */}
            <svg aria-hidden className="pointer-events-none absolute left-[16.66%] right-[16.66%] top-[28px] z-0 h-[3px] w-[66.66%] overflow-visible">
              {/* Ligne de fond grise */}
              <line x1="0" y1="1.5" x2="100%" y2="1.5" stroke="#DBEAFE" strokeWidth="2" />
              {/* Ligne qui se dessine */}
              <motion.line
                x1="0" y1="1.5" x2="100%" y2="1.5"
                stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={isInView ? { pathLength: 1 } : {}}
                transition={{ duration: 1.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
              />
              {/* Pulse lumineux qui parcourt la ligne */}
              <motion.circle
                r="6" cy="1.5" fill="#2563EB"
                initial={{ cx: "0%", opacity: 0 }}
                animate={isInView ? { cx: ["0%", "100%"], opacity: [0, 1, 1, 0] } : {}}
                transition={{ duration: 1.8, delay: 0.3, ease: "easeInOut" }}
                style={{ filter: "blur(3px)" }}
              />
              <motion.circle
                r="3" cy="1.5" fill="white"
                initial={{ cx: "0%", opacity: 0 }}
                animate={isInView ? { cx: ["0%", "100%"], opacity: [0, 1, 1, 0] } : {}}
                transition={{ duration: 1.8, delay: 0.3, ease: "easeInOut" }}
              />
            </svg>

            {steps.map((s, i) => (
              <div key={i} className="relative flex flex-col items-center text-center">
                {/* Cercle avec bounce-in + glow */}
                <motion.div
                  className="relative mb-5"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={isInView ? { scale: 1, opacity: 1 } : {}}
                  transition={{
                    delay: 0.3 + i * 0.4,
                    duration: 0.5,
                    type: "spring",
                    stiffness: 260,
                    damping: 20,
                  }}
                >
                  {/* Ring glow animé */}
                  <motion.div
                    className="absolute inset-0 rounded-full bg-[#2563EB]"
                    initial={{ scale: 1, opacity: 0 }}
                    animate={isInView ? { scale: [1, 1.6, 1.8], opacity: [0.4, 0.1, 0] } : {}}
                    transition={{ delay: 0.5 + i * 0.4, duration: 0.8, ease: "easeOut" }}
                  />
                  <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-[#2563EB] text-white shadow-[0_4px_14px_rgba(37,99,235,0.35)]">
                    {/* Icône avec micro-rotation */}
                    <motion.div
                      initial={{ rotate: -20, opacity: 0 }}
                      animate={isInView ? { rotate: 0, opacity: 1 } : {}}
                      transition={{ delay: 0.5 + i * 0.4, duration: 0.4 }}
                    >
                      {s.icon}
                    </motion.div>
                    {/* Numéro badge */}
                    <motion.span
                      className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-bold text-[#2563EB] ring-2 ring-[#EFF6FF]"
                      initial={{ scale: 0 }}
                      animate={isInView ? { scale: 1 } : {}}
                      transition={{ delay: 0.7 + i * 0.4, type: "spring", stiffness: 400, damping: 15 }}
                    >
                      {s.n}
                    </motion.span>
                  </div>
                </motion.div>

                {/* Texte slide-up + blur-in */}
                <motion.h3
                  className="mb-2 text-[15px] font-bold text-[#0F172A]"
                  initial={{ opacity: 0, y: 14, filter: "blur(4px)" }}
                  animate={isInView ? { opacity: 1, y: 0, filter: "blur(0px)" } : {}}
                  transition={{ delay: 0.7 + i * 0.4, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                >
                  {s.title}
                </motion.h3>
                <motion.p
                  className="max-w-[220px] text-[13px] leading-relaxed text-slate-500"
                  initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
                  animate={isInView ? { opacity: 1, y: 0, filter: "blur(0px)" } : {}}
                  transition={{ delay: 0.85 + i * 0.4, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                >
                  {s.desc}
                </motion.p>
              </div>
            ))}
          </div>
        </div>

        {/* Mobile — cards centrées avec connecteurs */}
        <div className="sm:hidden">
          <div className="flex flex-col items-center gap-0">
            {steps.map((s, i) => (
              <div key={i} className="flex flex-col items-center w-full">
                {/* Connecteur vertical entre les cards */}
                {i > 0 && (
                  <motion.div
                    className="flex flex-col items-center gap-0.5 py-2"
                    initial={{ opacity: 0, scaleY: 0 }}
                    animate={isInView ? { opacity: 1, scaleY: 1 } : {}}
                    transition={{ delay: 0.3 + i * 0.4, duration: 0.3, ease: "easeOut" }}
                    style={{ transformOrigin: "top" }}
                  >
                    <div className="w-px h-4 bg-gradient-to-b from-[#BFDBFE] to-[#2563EB]/40" />
                    <ChevronDown className="h-3.5 w-3.5 text-[#2563EB]/40" />
                  </motion.div>
                )}

                {/* Card */}
                <motion.div
                  className="w-full rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm"
                  initial={{ opacity: 0, y: 20, scale: 0.96 }}
                  animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
                  transition={{ delay: 0.4 + i * 0.4, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div className="flex flex-col items-center text-center gap-3">
                    {/* Cercle + numéro */}
                    <motion.div
                      className="relative"
                      initial={{ scale: 0 }}
                      animate={isInView ? { scale: 1 } : {}}
                      transition={{ delay: 0.5 + i * 0.4, type: "spring", stiffness: 260, damping: 20 }}
                    >
                      <motion.div
                        className="absolute inset-0 rounded-full bg-[#2563EB]"
                        initial={{ scale: 1, opacity: 0 }}
                        animate={isInView ? { scale: [1, 1.5, 1.7], opacity: [0.3, 0.08, 0] } : {}}
                        transition={{ delay: 0.6 + i * 0.4, duration: 0.7, ease: "easeOut" }}
                      />
                      <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-[#2563EB] text-white shadow-[0_4px_14px_rgba(37,99,235,0.35)]">
                        <motion.div
                          initial={{ rotate: -20, opacity: 0 }}
                          animate={isInView ? { rotate: 0, opacity: 1 } : {}}
                          transition={{ delay: 0.6 + i * 0.4, duration: 0.4 }}
                        >
                          {s.icon}
                        </motion.div>
                        <motion.span
                          className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-bold text-[#2563EB] ring-2 ring-[#EFF6FF]"
                          initial={{ scale: 0 }}
                          animate={isInView ? { scale: 1 } : {}}
                          transition={{ delay: 0.7 + i * 0.4, type: "spring", stiffness: 400, damping: 15 }}
                        >
                          {s.n}
                        </motion.span>
                      </div>
                    </motion.div>

                    {/* Texte */}
                    <motion.h3
                      className="text-[15px] font-bold text-[#0F172A]"
                      initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
                      animate={isInView ? { opacity: 1, y: 0, filter: "blur(0px)" } : {}}
                      transition={{ delay: 0.65 + i * 0.4, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                    >
                      {s.title}
                    </motion.h3>
                    <motion.p
                      className="text-[13px] leading-relaxed text-slate-500"
                      initial={{ opacity: 0, y: 6, filter: "blur(4px)" }}
                      animate={isInView ? { opacity: 1, y: 0, filter: "blur(0px)" } : {}}
                      transition={{ delay: 0.75 + i * 0.4, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                    >
                      {s.desc}
                    </motion.p>
                  </div>
                </motion.div>
              </div>
            ))}
          </div>
        </div>

        <FadeIn delay={0.3} className="mt-12 flex justify-center">
          <Link href="/signup">
            <ShimmerButton background="rgba(37,99,235,1)" shimmerColor="#ffffff" shimmerDuration="2.5s" borderRadius="10px" className="h-11 px-6 text-[15px] font-semibold gap-2">
              Créer mon compte gratuitement <ArrowRight className="h-4 w-4" />
            </ShimmerButton>
          </Link>
        </FadeIn>
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
  ctaLabel?: string;
}

function FeatureSection({ pillLabel, tag, title, titleHighlight, description, features, mockup, reverse = false, bg = "bg-white", ctaLabel = "Commencer maintenant" }: FeatureSectionProps) {
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
                {ctaLabel} <ArrowRight className="h-3.5 w-3.5" />
              </ShimmerButton>
            </Link>
          </FadeIn>
          <FadeIn delay={0.1} x={reverse ? -20 : 20} className={`relative ${reverse ? "lg:col-start-1 lg:row-start-1" : ""}`}>
            <ParallaxWrapper offset={30}>
              <div className="pointer-events-none absolute -inset-6 rounded-3xl bg-gradient-to-br from-[#DBEAFE]/40 via-[#EDE9FE]/20 to-transparent blur-2xl" />
              <div className="relative overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_20px_60px_-12px_rgba(15,23,42,0.12)]">{mockup}</div>
            </ParallaxWrapper>
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
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ backgroundColor: s.color }}>{s.done ? <DrawCheckmark size={16} color="#ffffff" delay={0.1} /> : s.step}</span>
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
        <Image src={PICTO_Q} alt="" width={400} height={400} className="w-[400px]" sizes="400px" loading="lazy" />
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
              Passer à Qonforme <ArrowRight className="h-4 w-4" />
            </ShimmerButton>
          </Link>
        </FadeIn>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────
   SECTION B — Témoignages V4 (Trustpilot-style carousel)
───────────────────────────────────────────────────────── */
function TestimonialsSection() {
  const testimonials = [
    { name: "Marc D.", role: "Plombier indépendant", title: "Simple et efficace", date: "12 mars 2026", text: "J'avais peur que ce soit compliqué. J'ai créé ma première facture en 4 minutes. Depuis, je n'y pense plus. Le guide Chorus Pro est top.", stars: 5 },
    { name: "Sophie L.", role: "Auto-entrepreneuse", title: "Fini le stress", date: "8 mars 2026", text: "Le passage à la facturation électronique m'angoissait. Qonforme a tout géré. Je reçois juste un email quand c'est transmis. Un vrai soulagement.", stars: 5 },
    { name: "Atelier Renard", role: "Menuiserie", title: "20 factures/mois sans effort", date: "2 mars 2026", text: "On envoyait 20 factures par mois à la main. Maintenant c'est automatique et on est en règle. Indispensable pour notre atelier.", stars: 5 },
    { name: "Thomas B.", role: "Électricien", title: "Conforme en 5 min", date: "25 févr. 2026", text: "J'ai tout configuré en une pause café. Le Factur-X se génère tout seul, je n'ai rien à comprendre. Exactement ce qu'il me fallait.", stars: 5 },
    { name: "Claire M.", role: "Graphiste freelance", title: "Interface au top", date: "18 févr. 2026", text: "Enfin un outil de facturation qui ne ressemble pas à un logiciel des années 2000. C'est beau, c'est rapide, et c'est conforme. Bravo.", stars: 5 },
  ];

  const TOTAL_REVIEWS = 47;
  const AVG_RATING = 4.8;

  return (
    <section className="relative overflow-hidden py-20 sm:py-24" style={{ backgroundColor: "#EFF6FF" }}>
      {/* Q watermarks */}
      <div aria-hidden className="pointer-events-none absolute select-none" style={{ top: "40%", left: "38%", transform: "translate(-50%, -50%)", opacity: 0.03, zIndex: 0 }}>
        <Image src={PICTO_Q} alt="" width={280} height={280} className="w-[280px]" sizes="280px" loading="lazy" />
      </div>
      <div aria-hidden className="pointer-events-none absolute select-none" style={{ top: "-20px", right: "-20px", opacity: 0.08, zIndex: 0 }}>
        <Image src={PICTO_Q} alt="" width={160} height={160} className="w-[160px]" sizes="160px" loading="lazy" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-5">
        {/* Header */}
        <FadeIn className="mb-6 flex flex-col items-center text-center gap-3">
          <SectionPill label="AVIS CLIENTS" />
          <h2 className="text-3xl font-extrabold tracking-[-0.025em] text-[#0F172A] sm:text-4xl" style={{ fontFamily: "var(--font-bricolage)" }}>
            Ce que nos utilisateurs{" "}
            <span className="text-[#2563EB]">en pensent</span>
          </h2>
        </FadeIn>

        {/* Score global Trustpilot-style */}
        <FadeIn delay={0.1} className="mb-10 flex justify-center">
          <div className="inline-flex flex-col sm:flex-row items-center gap-4 sm:gap-5 rounded-2xl border border-[#E2E8F0] bg-white px-6 py-4 shadow-sm">
            {/* Score cercle */}
            <div className="flex h-16 w-16 items-center justify-center rounded-full border-[3px] border-[#00B67A] bg-[#F0FDF4]">
              <div className="text-center">
                <span className="text-xl font-extrabold text-[#0F172A] leading-none">{AVG_RATING}</span>
                <p className="text-[10px] font-semibold text-slate-400 -mt-0.5">de 5</p>
              </div>
            </div>
            {/* Texte + étoiles */}
            <div className="flex flex-col items-center sm:items-start gap-1">
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-bold text-[#0F172A]">Excellent</span>
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-4.5 w-4.5 fill-[#00B67A] text-[#00B67A]" />
                  ))}
                </div>
              </div>
              <span className="text-[13px] text-slate-500">
                <strong className="font-semibold text-[#0F172A]">{AVG_RATING}/5</strong> — sur la base de {TOTAL_REVIEWS} avis
              </span>
            </div>
          </div>
        </FadeIn>

        {/* Desktop — grille 3 colonnes avec overflow peek */}
        <div className="hidden sm:grid sm:grid-cols-3 gap-5">
          {testimonials.slice(0, 3).map((t, i) => (
            <TiltCard key={t.name} className="flex flex-col rounded-2xl bg-white border border-[#E2E8F0] shadow-sm overflow-hidden">
              <motion.div
                className="flex flex-col h-full"
                initial={{ opacity: 0, y: 24, scale: 0.92 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ delay: i * 0.12, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              >
                {/* Quote icon + stars + date */}
                <div className="px-6 pt-5 pb-3">
                  <div className="flex items-start justify-between mb-3">
                    <Quote className="h-6 w-6 text-[#00B67A]/50 rotate-180" />
                    <span className="text-[11px] text-slate-400">{t.date}</span>
                  </div>
                  <div className="flex gap-0.5 mb-3">
                    {Array.from({ length: t.stars }).map((_, j) => (
                      <div key={j} className="flex h-5 w-5 items-center justify-center rounded-sm bg-[#00B67A]">
                        <Star className="h-3 w-3 fill-white text-white" />
                      </div>
                    ))}
                  </div>
                  {/* Title + text */}
                  <h3 className="text-[15px] font-bold text-[#0F172A] mb-2">{t.title}</h3>
                  <p className="text-[13px] leading-relaxed text-slate-500">{t.text}</p>
                </div>
                {/* Footer — name + verified */}
                <div className="mt-auto border-t border-[#F1F5F9] px-6 py-3.5 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[#0F172A]">{t.name}</p>
                    <p className="text-[11px] text-slate-400">{t.role}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#00B67A] shrink-0">
                    <BadgeCheck className="h-3.5 w-3.5" />
                    Vérifié
                  </span>
                </div>
              </motion.div>
            </TiltCard>
          ))}
        </div>

        {/* Mobile — carousel horizontal snap */}
        <div className="sm:hidden -mx-5">
          <div
            className="flex gap-4 overflow-x-auto px-5 pb-4 snap-x snap-mandatory scrollbar-hide"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {testimonials.map((t, i) => (
              <motion.div
                key={t.name}
                className="flex flex-col rounded-2xl bg-white border border-[#E2E8F0] shadow-sm snap-center shrink-0 overflow-hidden"
                style={{ minWidth: "85vw", maxWidth: "85vw" }}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ delay: i * 0.08, duration: 0.4 }}
              >
                {/* Quote icon + stars + date */}
                <div className="px-5 pt-4 pb-3">
                  <div className="flex items-start justify-between mb-3">
                    <Quote className="h-5 w-5 text-[#00B67A]/50 rotate-180" />
                    <span className="text-[11px] text-slate-400">{t.date}</span>
                  </div>
                  <div className="flex gap-0.5 mb-3">
                    {Array.from({ length: t.stars }).map((_, j) => (
                      <div key={j} className="flex h-5 w-5 items-center justify-center rounded-sm bg-[#00B67A]">
                        <Star className="h-3 w-3 fill-white text-white" />
                      </div>
                    ))}
                  </div>
                  <h3 className="text-[15px] font-bold text-[#0F172A] mb-2">{t.title}</h3>
                  <p className="text-[13px] leading-relaxed text-slate-500">{t.text}</p>
                </div>
                {/* Footer */}
                <div className="mt-auto border-t border-[#F1F5F9] px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[#0F172A]">{t.name}</p>
                    <p className="text-[11px] text-slate-400">{t.role}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#00B67A] shrink-0">
                    <BadgeCheck className="h-3.5 w-3.5" />
                    Vérifié
                  </span>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Dots pagination */}
          <div className="flex justify-center gap-1.5 mt-2">
            {testimonials.map((_, i) => (
              <div key={i} className={`h-1.5 rounded-full transition-all ${i === 0 ? "w-4 bg-[#2563EB]" : "w-1.5 bg-[#BFDBFE]"}`} />
            ))}
          </div>
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
    <section id="pricing" className="relative overflow-hidden py-20 sm:py-24" style={{ background: "linear-gradient(135deg, #EFF6FF 0%, #F5F3FF 40%, #E0F2FE 70%, #EFF6FF 100%)" }}>
      {/* Q filigrane background */}
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 z-0 -translate-x-1/2 -translate-y-1/2 select-none" style={{ opacity: 0.04 }}>
        <Image src={PICTO_Q} alt="" width={500} height={500} className="w-[420px] sm:w-[500px]" sizes="(min-width: 640px) 500px, 420px" loading="lazy" />
      </div>
      <div className="relative z-10 max-w-5xl mx-auto px-5">
        <FadeIn className="text-center mb-8 flex flex-col items-center gap-3">
          <SectionPill label="TARIFS" />
          <h2 className="text-3xl font-extrabold tracking-[-0.025em] text-[#0F172A] sm:text-4xl" style={{ fontFamily: "var(--font-bricolage)" }}>
            Un prix fixe.{" "}
            <span className="text-[#2563EB]">Aucune surprise.</span>
          </h2>
          <p className="text-slate-500 max-w-md">
            Tout ce qu&apos;il faut pour être conforme. Sans engagement, résiliable en 1 clic.
          </p>

          {/* Toggle mensuel / annuel — plus gros */}
          <div className="mt-3 flex items-center gap-1 rounded-full border border-[#E2E8F0] bg-[#F8FAFC] p-1">
            <button
              onClick={() => setAnnual(false)}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition-all ${!annual ? "bg-[#2563EB] text-white shadow-sm" : "text-slate-500 hover:text-[#0F172A]"}`}
            >
              Mensuel
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-all ${annual ? "bg-[#2563EB] text-white shadow-sm" : "text-slate-500 hover:text-[#0F172A]"}`}
            >
              Annuel
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${annual ? "bg-white/20 text-white" : "bg-[#D1FAE5] text-[#065F46]"}`}>-16%</span>
            </button>
          </div>
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-3xl mx-auto">
          {/* ── Card Starter ── */}
          <FadeIn delay={0.15} x={-10} className="bg-white rounded-2xl p-6 sm:p-7 border border-[#E2E8F0] shadow-sm flex flex-col">
            <span className="w-fit rounded-full bg-[#F1F5F9] px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-[#64748B] mb-4">Starter</span>

            {/* Prix + CTA groupés */}
            <div className="flex items-baseline gap-1 mb-1">
              {annual && <span className="text-lg font-bold text-slate-300 line-through font-mono mr-1">9€</span>}
              <span className="text-4xl font-extrabold text-[#0F172A] font-mono">{annual ? "7,50€" : "9€"}</span>
              <span className="text-slate-400 text-sm">/mois HT</span>
            </div>
            {annual && <p className="text-[12px] text-[#059669] font-medium mb-3">Soit 90€/an HT — tu économises 18€</p>}
            <p className="text-[13px] text-slate-400 mb-4">{!annual ? "Facturé mensuellement" : "Facturé 90€ par an"}</p>

            <Link href="/signup">
              <button className="w-full rounded-xl border border-[#E2E8F0] bg-white py-3 text-sm font-semibold text-[#0F172A] transition-colors hover:bg-[#F8FAFC] active:scale-[0.98]">
                Choisir Starter →
              </button>
            </Link>

            <div className="h-px bg-[#E2E8F0] my-5" />

            {/* Features incluses */}
            <ul className="space-y-3">
              {[
                "10 factures/mois",
                "Devis & bons de commande illimités",
                "Guide transmission Chorus Pro",
                "Support 48h",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-slate-600">
                  <CheckCircle2 className="w-4 h-4 text-[#10B981] mt-0.5 shrink-0" />{item}
                </li>
              ))}
            </ul>

            {/* Features absentes */}
            <div className="h-px bg-[#E2E8F0] my-4" />
            <ul className="space-y-3 flex-1">
              {[
                "Factures illimitées",
                "Tableau de bord CA & encours",
                "Relances automatiques",
                "Support 24h prioritaire",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-slate-400">
                  <XCircle className="w-4 h-4 text-slate-300 mt-0.5 shrink-0" />{item}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-center text-[12px] text-slate-400">Idéal pour démarrer</p>
          </FadeIn>

          {/* ── Card Pro — dominant ── */}
          <FadeIn delay={0.2} x={10} className="relative overflow-hidden rounded-2xl p-6 sm:p-7 flex flex-col md:scale-[1.03] md:origin-top" style={{ background: "#0F172A", border: "1px solid rgba(37,99,235,0.3)", boxShadow: "0 0 60px rgba(37,99,235,0.18)" }}>
            {/* Q filigrane */}
            <div aria-hidden className="pointer-events-none absolute -bottom-6 -right-6 select-none" style={{ opacity: 0.06, zIndex: 0 }}>
              <Image src={PICTO_Q} alt="" width={160} height={160} className="w-[160px]" sizes="160px" loading="lazy" />
            </div>
            <div className="relative z-10 flex flex-col flex-1">
              <div className="flex items-center justify-between mb-4">
                <span className="rounded-full bg-[#F1F5F9]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-slate-400">Pro</span>
                <span className="rounded-lg bg-[#2563EB] px-3 py-1 text-[11px] font-bold text-white">Recommandé</span>
              </div>

              {/* Prix + CTA groupés */}
              <div className="flex items-baseline gap-1 mb-1">
                {annual && <span className="text-lg font-bold text-slate-500 line-through font-mono mr-1">19€</span>}
                <span className="text-4xl font-extrabold text-white font-mono">{annual ? "15,83€" : "19€"}</span>
                <span className="text-slate-400 text-sm">/mois HT</span>
              </div>
              {annual && <p className="text-[12px] text-[#34D399] font-medium mb-3">Soit 190€/an HT — tu économises 38€</p>}
              <p className="text-[13px] text-slate-500 mb-4">{!annual ? "Facturé mensuellement" : "Facturé 190€ par an"}</p>

              <Link href="/signup">
                <button className="w-full rounded-xl bg-white py-3 text-sm font-semibold text-[#0F172A] transition-colors hover:bg-slate-100 active:scale-[0.98]">
                  Choisir Pro →
                </button>
              </Link>

              <div className="h-px bg-white/10 my-5" />

              {/* Features différenciantes */}
              <ul className="space-y-3 flex-1">
                {[
                  "Factures illimitées",
                  "Devis & bons de commande illimités",
                  "Guide multiplateforme (Chorus Pro, IOPOLE, 137 PA)",
                  "Tableau de bord CA & encours",
                  "Relances automatiques J+30/J+45",
                  "Support 24h prioritaire",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-slate-300">
                    <CheckCircle2 className="w-4 h-4 text-[#10B981] mt-0.5 shrink-0" />{item}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-center text-[12px] text-[#60A5FA]">Le choix de 8 artisans sur 10</p>
            </div>
          </FadeIn>
        </div>

        {/* ── Inclus dans tous les plans ── */}
        <FadeIn delay={0.3} className="mt-10 max-w-3xl mx-auto">
          <p className="text-center text-[13px] font-bold text-slate-400 uppercase tracking-wider mb-5">Inclus dans tous les plans</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { icon: <FileText className="h-4 w-4" />, label: "Factur-X EN 16931 certifié" },
              { icon: <Send className="h-4 w-4" />, label: "Envoi email avec PDF" },
              { icon: <Archive className="h-4 w-4" />, label: "Archivage légal 10 ans" },
              { icon: <Zap className="h-4 w-4" />, label: "Avoirs en 1 clic" },
              { icon: <Shield className="h-4 w-4" />, label: "Catalogue produits" },
              { icon: <Users className="h-4 w-4" />, label: "Gestion clients" },
            ].map((f) => (
              <div key={f.label} className="flex items-center gap-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#EFF6FF] text-[#2563EB]">{f.icon}</span>
                <span className="text-[12px] sm:text-[13px] font-medium text-[#0F172A]">{f.label}</span>
              </div>
            ))}
          </div>
        </FadeIn>

        {/* Ancrage prix — comparaison coût */}
        <FadeIn delay={0.35} className="mt-8 max-w-3xl mx-auto">
          <div className="rounded-2xl border border-[#FEF3C7] bg-[#FFFBEB] p-5 sm:p-6">
            <p className="text-[13px] font-bold text-[#92400E] uppercase tracking-wider mb-3">
              Le coût de la non-conformité
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4">
              <div className="flex items-start gap-2.5">
                <XCircle className="w-4 h-4 text-[#D97706] mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-[#0F172A]">150 à 300 €/mois</p>
                  <p className="text-[12px] text-slate-500">Prestataire facturation ou comptable</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <XCircle className="w-4 h-4 text-[#D97706] mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-[#0F172A]">15 € par facture</p>
                  <p className="text-[12px] text-slate-500">Amende non-conformité (art.&nbsp;1737 CGI)</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <XCircle className="w-4 h-4 text-[#D97706] mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-[#0F172A]">Rejet Chorus Pro</p>
                  <p className="text-[12px] text-slate-500">Paiement repoussé de 30 à 60 jours</p>
                </div>
              </div>
            </div>
            <div className="h-px bg-[#FDE68A] my-4" />
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#059669] shrink-0" />
              <p className="text-sm text-[#0F172A]">
                <strong className="font-bold">Qonforme : à partir de 9&nbsp;€/mois</strong>
                <span className="text-slate-500"> — tout inclus, sans engagement.</span>
              </p>
            </div>
          </div>
        </FadeIn>
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
        <Image src={PICTO_Q} alt="" width={500} height={500} className="w-[500px]" sizes="500px" style={{ filter: "hue-rotate(0deg) saturate(0) brightness(2) sepia(1) hue-rotate(190deg)" }} loading="lazy" />
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
          <div className="mt-4 flex items-center gap-4 text-[13px]">
            <Link href="/pricing" className="text-slate-400 hover:text-white transition-colors underline underline-offset-2">Voir les tarifs</Link>
            <span className="text-slate-600">·</span>
            <Link href="/demo" className="text-slate-400 hover:text-white transition-colors underline underline-offset-2">Tester la démo</Link>
          </div>
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
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ prenom: "", nom: "", email: "", sujet: "", message: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erreur lors de l'envoi");
      }
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'envoi");
    } finally {
      setSending(false);
    }
  };

  const inputCls = "w-full rounded-[10px] border border-[#E2E8F0] bg-white px-3.5 py-3 text-sm text-[#0F172A] placeholder-slate-400 outline-none transition-all focus:border-[#2563EB] focus:shadow-[0_0_0_3px_rgba(37,99,235,0.1)]";
  const labelCls = "mb-1.5 block text-[13px] font-semibold text-[#0F172A]";

  return (
    <section id="contact" className="bg-[#F8FAFC] py-20 sm:py-24">
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
                {/* Error */}
                {error && (
                  <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
                )}
                {/* Submit */}
                <button
                  type="submit"
                  disabled={sending}
                  className="mt-1 w-full rounded-[10px] bg-[#2563EB] py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-[#1D4ED8] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sending ? "Envoi en cours…" : "Envoyer mon message →"}
                </button>
              </form>
            )}
          </FadeIn>
        </div>
      </div>
    </section>
  );
}

/* Footer is now imported from @/components/layout/Footer */

/* ─────────────────────────────────────────────────────────
   Section chiffres clés
───────────────────────────────────────────────────────── */
function KeyMetricsSection() {
  const metrics = [
    {
      icon: <Users className="h-5 w-5" />,
      numValue: 50, suffix: "+", prefix: "",
      label: "entreprises accompagnées",
      desc: "artisans, indépendants, TPE",
    },
    {
      icon: <FileCheck className="h-5 w-5" />,
      numValue: 1200, suffix: "+", prefix: "",
      label: "factures conformes émises",
      desc: "sans une seule pénalité",
    },
    {
      icon: <Clock className="h-5 w-5" />,
      numValue: 3, suffix: " min", prefix: "< ",
      label: "pour créer et envoyer",
      desc: "en moyenne, depuis n'importe où",
    },
    {
      icon: <ShieldCheck className="h-5 w-5" />,
      numValue: 100, suffix: " %", prefix: "",
      label: "taux de conformité",
      desc: "chaque facture est certifiée EN 16931",
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
            <TiltCard
              key={m.label}
              className="flex flex-col items-center gap-3 rounded-2xl border border-[#BFDBFE]/60 bg-white p-6 text-center shadow-sm"
            >
              <motion.div
                className="flex flex-col items-center gap-3 w-full"
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ delay: i * 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EFF6FF] text-[#2563EB]">
                  {m.icon}
                </span>
                <p className="font-mono text-3xl font-extrabold text-[#0F172A] sm:text-4xl">
                  <AnimatedCounter value={m.numValue} suffix={m.suffix} prefix={m.prefix} />
                </p>
                <div>
                  <p className="text-sm font-semibold text-[#0F172A]">{m.label}</p>
                  <p className="mt-0.5 text-[13px] text-slate-400">{m.desc}</p>
                </div>
              </motion.div>
            </TiltCard>
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
      {/* 3 — Chiffres clés */}
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
        ctaLabel="Créer ma première facture"
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
        ctaLabel="Vérifier ma conformité"
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
      {/* 10a — pSEO : facturation par métier + guides + modèles */}
      <section className="bg-[#F8FAFC] py-14 sm:py-16 border-t border-slate-100">
        <div className="mx-auto max-w-5xl px-5">
          <p className="text-center text-[13px] font-semibold uppercase tracking-[0.2em] text-slate-400 mb-2">Ressources</p>
          <h2 className="text-center text-2xl sm:text-3xl font-bold text-[#0F172A] mb-10">
            Facturation adaptée à <span className="text-[#2563EB]">votre métier</span>
          </h2>

          {/* Métiers populaires */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 mb-10">
            {[
              { slug: "plombier", nom: "Plombier" },
              { slug: "electricien", nom: "Électricien" },
              { slug: "auto-entrepreneur", nom: "Auto-entrepreneur" },
              { slug: "consultant", nom: "Consultant" },
              { slug: "developpeur-freelance", nom: "Développeur" },
              { slug: "graphiste", nom: "Graphiste" },
              { slug: "coiffeur", nom: "Coiffeur" },
              { slug: "osteopathe", nom: "Ostéopathe" },
              { slug: "photographe", nom: "Photographe" },
              { slug: "macon", nom: "Maçon" },
            ].map((m) => (
              <Link
                key={m.slug}
                href={`/facturation/${m.slug}`}
                className="group rounded-xl border border-slate-200 bg-white p-3 text-center text-[13px] font-semibold text-[#0F172A] hover:border-[#2563EB]/30 hover:shadow-md hover:text-[#2563EB] transition-all"
              >
                {m.nom}
              </Link>
            ))}
          </div>
          <div className="text-center mb-12">
            <Link href="/facturation" className="inline-flex items-center gap-1 text-sm font-semibold text-[#2563EB] hover:underline">
              Voir les {29} métiers <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Guides + Modèles */}
          <div className="grid sm:grid-cols-2 gap-6">
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <h3 className="font-bold text-[#0F172A] mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#2563EB]" />
                Guides pratiques
              </h3>
              <ul className="space-y-2.5">
                {[
                  { slug: "mentions-obligatoires-facture", label: "Mentions obligatoires sur une facture" },
                  { slug: "facture-electronique-2026", label: "Facture électronique 2026" },
                  { slug: "facture-auto-entrepreneur", label: "Facture auto-entrepreneur" },
                  { slug: "delai-paiement-facture", label: "Délais de paiement" },
                ].map((g) => (
                  <li key={g.slug}>
                    <Link href={`/guide/${g.slug}`} className="text-sm text-slate-600 hover:text-[#2563EB] transition-colors">
                      → {g.label}
                    </Link>
                  </li>
                ))}
              </ul>
              <Link href="/guide" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#2563EB] hover:underline">
                Tous les guides <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <h3 className="font-bold text-[#0F172A] mb-4 flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-[#2563EB]" />
                Modèles gratuits
              </h3>
              <ul className="space-y-2.5">
                {[
                  { slug: "facture-classique", label: "Modèle de facture classique" },
                  { slug: "facture-auto-entrepreneur", label: "Modèle facture auto-entrepreneur" },
                  { slug: "devis-travaux", label: "Modèle de devis travaux" },
                  { slug: "devis-prestation-service", label: "Modèle devis prestation de service" },
                ].map((m) => (
                  <li key={m.slug}>
                    <Link href={`/modele/${m.slug}`} className="text-sm text-slate-600 hover:text-[#2563EB] transition-colors">
                      → {m.label}
                    </Link>
                  </li>
                ))}
              </ul>
              <Link href="/modele" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#2563EB] hover:underline">
                Tous les modèles <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 10b — Ressources (maillage interne) */}
      <section className="bg-white py-14 sm:py-16 border-t border-slate-100">
        <div className="mx-auto max-w-3xl px-5">
          <p className="text-center text-[13px] font-semibold uppercase tracking-[0.2em] text-slate-400 mb-6">Aller plus loin</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Link href="/blog" className="group flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-[#F8FAFC] p-5 text-center hover:border-[#2563EB]/30 hover:shadow-md transition-all">
              <FileText className="h-5 w-5 text-[#2563EB]" />
              <span className="text-[14px] font-bold text-[#0F172A] group-hover:text-[#2563EB] transition-colors">Blog &amp; guides</span>
              <span className="text-[12px] text-slate-400">Tout comprendre sur la facturation électronique 2026</span>
            </Link>
            <Link href="/demo" className="group flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-[#F8FAFC] p-5 text-center hover:border-[#2563EB]/30 hover:shadow-md transition-all">
              <Zap className="h-5 w-5 text-[#2563EB]" />
              <span className="text-[14px] font-bold text-[#0F172A] group-hover:text-[#2563EB] transition-colors">Démo interactive</span>
              <span className="text-[12px] text-slate-400">Explorez l&apos;interface sans créer de compte</span>
            </Link>
            <Link href="/pricing" className="group flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-[#F8FAFC] p-5 text-center hover:border-[#2563EB]/30 hover:shadow-md transition-all">
              <Shield className="h-5 w-5 text-[#2563EB]" />
              <span className="text-[14px] font-bold text-[#0F172A] group-hover:text-[#2563EB] transition-colors">Tarifs</span>
              <span className="text-[12px] text-slate-400">À partir de 9&nbsp;€/mois · sans engagement</span>
            </Link>
          </div>
        </div>
      </section>
      {/* 11 — Contact */}
      <ContactSection />
      {/* 12 — Footer navy */}
      <Footer />
    </div>
  );
}
