"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { Menu, ArrowRight, Shield, Zap, Play, Lock, X, Star, ChevronDown, Calculator, FileText, Search, Receipt, FileCheck, Scale, TrendingUp, Hash, ClipboardList, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { LightRays } from "@/components/ui/light-rays";

/* 1.3 — Logo officiel sans fond blanc */
const LOGO_URL =
  "https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Logo%20long%20bleu.webp";

/* 1.4 — Picto Q filigrane */
const PICTO_Q_URL =
  "https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Logo%20bleu%20Qonforme%20PNG.webp";

/* ─────────────────────────────────────────────────────────
   OUTILS GRATUITS — données pour le mega-menu
───────────────────────────────────────────────────────── */
const OUTILS_CATEGORIES = [
  {
    title: "Calculateurs",
    items: [
      { label: "Calculateur TVA HT ↔ TTC", href: "/outils/calculateur-tva", icon: Calculator, desc: "Conversion instantanée HT/TTC" },
      { label: "Simulateur charges auto-entrepreneur", href: "/outils/simulateur-charges-auto-entrepreneur", icon: TrendingUp, desc: "Cotisations URSSAF 2026" },
      { label: "Calculateur pénalités de retard", href: "/outils/calculateur-penalites-retard", icon: Scale, desc: "Intérêts légaux & indemnité" },
      { label: "Simulateur seuil TVA", href: "/outils/simulateur-seuil-tva", icon: Calculator, desc: "Franchise TVA dépassée ?" },
    ],
  },
  {
    title: "Générateurs",
    items: [
      { label: "Générateur de facture gratuit", href: "/outils/generateur-facture-gratuite", icon: FileText, desc: "Créez un PDF en 2 min" },
      { label: "Générateur de devis gratuit", href: "/outils/generateur-devis-gratuit", icon: ClipboardList, desc: "Devis professionnel PDF" },
      { label: "Générateur n° de facture", href: "/outils/generateur-numero-facture", icon: Hash, desc: "Numérotation conforme" },
      { label: "Générateur conditions de paiement", href: "/outils/generateur-conditions-paiement", icon: Receipt, desc: "Mentions légales à copier" },
    ],
  },
  {
    title: "Vérificateurs",
    items: [
      { label: "Vérificateur SIREN/SIRET", href: "/outils/verification-siret", icon: Search, desc: "Vérifiez une entreprise" },
      { label: "Vérificateur mentions facture", href: "/outils/verificateur-mentions-facture", icon: FileCheck, desc: "Mentions obligatoires 2026" },
      { label: "Vérificateur conformité facture", href: "/outils/verificateur-conformite-facture", icon: Shield, desc: "Votre facture est-elle conforme ?" },
      { label: "Simulateur revenus net", href: "/outils/simulateur-revenu-net", icon: TrendingUp, desc: "Revenus réels après charges" },
    ],
  },
];

/* ─────────────────────────────────────────────────────────
   HEADER
   - Au départ : totalement transparent
   - Au scroll > 40px : pilule blanche avec ombre + backdrop blur
   - CTA secondaire "Voir la démo" ajouté (3.1)
   - "Démo" remplacé par "Outils gratuits" avec mega-menu (4.1)
───────────────────────────────────────────────────────── */
function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [outilsOpen, setOutilsOpen] = useState(false);
  const outilsTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* Fermer le dropdown si clic en dehors */
  useEffect(() => {
    if (!outilsOpen) return;
    const onClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOutilsOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [outilsOpen]);

  const handleOutilsEnter = () => {
    if (outilsTimeout.current) clearTimeout(outilsTimeout.current);
    setOutilsOpen(true);
  };
  const handleOutilsLeave = () => {
    outilsTimeout.current = setTimeout(() => setOutilsOpen(false), 200);
  };

  const navLinks = [
    { label: "Fonctionnalités", href: "#features" },
    { label: "Tarifs", href: "#pricing" },
    { label: "Blog", href: "/blog" },
  ];

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] flex justify-center px-5 pt-4">
      <motion.nav
        animate={{
          borderRadius: scrolled ? "9999px" : "16px",
          paddingLeft: scrolled ? "24px" : "16px",
          paddingRight: scrolled ? "24px" : "16px",
          backgroundColor: scrolled
            ? "rgba(255,255,255,0.96)"
            : "rgba(255,255,255,0)",
          borderColor: scrolled
            ? "rgba(226,232,240,0.9)"
            : "rgba(255,255,255,0)",
          boxShadow: scrolled
            ? "0 8px 32px -4px rgba(15,23,42,0.12), 0 2px 8px -2px rgba(15,23,42,0.06)"
            : "none",
        }}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
        className={`flex w-full max-w-5xl items-center justify-between border py-2.5 ${scrolled ? "md:backdrop-blur-[18px]" : ""}`}
      >
        {/* Logo — sans fond, bien à gauche */}
        <Link href="/" className="flex shrink-0 items-center pl-3">
          <Image
            src={LOGO_URL}
            alt="Qonforme"
            width={130}
            height={32}
            className="h-[30px] w-auto object-contain"
            sizes="130px"
            priority
          />
        </Link>

        {/* Nav desktop — centré absolument */}
        <div className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-7 md:flex">
          {navLinks.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              className="text-sm font-medium text-slate-700 transition-colors hover:text-[#0F172A]"
            >
              {l.label}
            </Link>
          ))}

          {/* Outils gratuits — dropdown mega-menu */}
          <div
            ref={dropdownRef}
            className="relative"
            onMouseEnter={handleOutilsEnter}
            onMouseLeave={handleOutilsLeave}
          >
            <button
              className="inline-flex items-center gap-1 text-sm font-medium text-slate-700 transition-colors hover:text-[#0F172A]"
              onClick={() => setOutilsOpen((v) => !v)}
            >
              Outils gratuits
              <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${outilsOpen ? "rotate-180" : ""}`} />
            </button>

            <AnimatePresence>
              {outilsOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.97 }}
                  transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                  className="absolute right-1/2 translate-x-1/2 top-full mt-3 w-[720px] rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xl shadow-slate-200/50"
                  style={{ zIndex: 150 }}
                >
                  {/* 3 colonnes */}
                  <div className="grid grid-cols-3 gap-5">
                    {OUTILS_CATEGORIES.map((cat) => (
                      <div key={cat.title}>
                        <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          {cat.title}
                        </p>
                        <div className="flex flex-col gap-0.5">
                          {cat.items.map((item) => (
                            <Link
                              key={item.href}
                              href={item.href}
                              onClick={() => setOutilsOpen(false)}
                              className="group flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-[#EFF6FF]"
                            >
                              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F1F5F9] text-slate-500 transition-colors group-hover:bg-[#DBEAFE] group-hover:text-[#2563EB]">
                                <item.icon className="h-4 w-4" />
                              </span>
                              <div className="min-w-0">
                                <p className="text-[13px] font-semibold text-[#0F172A] leading-tight">
                                  {item.label}
                                </p>
                                <p className="mt-0.5 text-[11px] text-slate-400 leading-tight">
                                  {item.desc}
                                </p>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Footer du dropdown */}
                  <div className="mt-4 flex items-center justify-between rounded-xl bg-gradient-to-r from-[#EFF6FF] to-[#F5F3FF] px-4 py-3">
                    <div>
                      <p className="text-[13px] font-semibold text-[#0F172A]">Tous les outils gratuits</p>
                      <p className="text-[11px] text-slate-500">12 outils pour gérer votre activité</p>
                    </div>
                    <Link
                      href="/outils"
                      onClick={() => setOutilsOpen(false)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-3.5 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-[#1D4ED8]"
                    >
                      Voir tout
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Actions desktop — bien à droite (3.1 : CTA secondaire + principal) */}
        <div className="hidden shrink-0 items-center gap-2.5 pr-3 md:flex">
          {/* CTA secondaire navbar */}
          <Link href="/demo">
            <Button
              variant="ghost"
              className="h-8 px-3.5 text-sm font-medium text-slate-600 hover:text-[#0F172A]"
            >
              Voir la démo
            </Button>
          </Link>
          <Separator orientation="vertical" className="h-4 opacity-40" />
          {/* 1.1 + 2.1 — CTA principal navbar */}
          <Link href="/signup">
            <ShimmerButton
              background="rgba(37,99,235,1)"
              shimmerColor="#ffffff"
              shimmerDuration="2.5s"
              borderRadius="9999px"
              className="h-8 px-4 text-sm font-semibold"
            >
              Commencer →
            </ShimmerButton>
          </Link>
        </div>

        {/* Hamburger mobile — toggle (Menu ↔ X) */}
        <button
          className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-white/50 active:bg-white/70"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Menu"
        >
          <AnimatePresence mode="wait">
            {mobileOpen ? (
              <motion.span key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
                <X className="h-5 w-5" />
              </motion.span>
            ) : (
              <motion.span key="m" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}>
                <Menu className="h-5 w-5" />
              </motion.span>
            )}
          </AnimatePresence>
        </button>

      {/* ── Menu mobile dropdown — tombe sous le header pill ── */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            {/* Backdrop transparent — ferme au tap */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[98] md:hidden"
              onClick={() => setMobileOpen(false)}
            />

            {/* Panel dropdown — positionné sous la nav pill */}
            <motion.div
              initial={{ opacity: 0, y: -12, scaleY: 0.95 }}
              animate={{ opacity: 1, y: 0, scaleY: 1 }}
              exit={{ opacity: 0, y: -12, scaleY: 0.95 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="fixed left-4 right-4 z-[99] rounded-2xl border border-slate-200/80 bg-white/95 shadow-xl shadow-slate-900/10 md:hidden overflow-hidden"
              style={{
                top: "calc(env(safe-area-inset-top, 0px) + 68px)",
                originY: 0,
                maxHeight: "calc(100dvh - env(safe-area-inset-top, 0px) - 80px)",
              }}
            >
              <div className="overflow-y-auto overscroll-contain" style={{ maxHeight: "calc(100dvh - env(safe-area-inset-top, 0px) - 80px)" }}>
                {/* ── CTAs en haut ── */}
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05, duration: 0.25 }}
                  className="px-4 pt-4 pb-3 flex flex-col gap-2"
                >
                  <Link href="/signup" onClick={() => setMobileOpen(false)} className="block">
                    <ShimmerButton
                      background="rgba(37,99,235,1)"
                      shimmerColor="#ffffff"
                      shimmerDuration="2.5s"
                      borderRadius="14px"
                      className="w-full h-[48px] text-[14px] font-semibold justify-center"
                    >
                      Commencer maintenant →
                    </ShimmerButton>
                  </Link>
                  <Link href="/login" onClick={() => setMobileOpen(false)} className="block">
                    <button className="w-full h-[42px] rounded-xl bg-slate-50 border border-slate-200/80 text-[13px] font-semibold text-[#0F172A] active:scale-[0.98] transition-all touch-manipulation">
                      Se connecter
                    </button>
                  </Link>
                </motion.div>

                {/* Séparateur */}
                <div className="mx-4 h-px bg-slate-100" />

                {/* ── Liens de navigation ── */}
                <nav className="flex flex-col px-2 py-2 gap-0.5">
                  {navLinks.map((l, i) => (
                    <motion.div
                      key={l.label}
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.08 + i * 0.04, duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <Link
                        href={l.href}
                        onClick={() => setMobileOpen(false)}
                        className="group flex items-center justify-between rounded-xl px-4 py-3 hover:bg-slate-50 active:bg-slate-100 transition-all touch-manipulation"
                      >
                        <span className="text-[15px] font-semibold text-[#0F172A]">{l.label}</span>
                        <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-[#2563EB] transition-colors" />
                      </Link>
                    </motion.div>
                  ))}

                  {/* Outils gratuits — expandable */}
                  <motion.div
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2, duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <MobileOutilsMenu onNavigate={() => setMobileOpen(false)} />
                  </motion.div>
                </nav>

                {/* Réassurance */}
                <div className="px-4 pb-4 pt-1">
                  <p className="text-center text-[11px] text-slate-400">
                    ✓ Accès immédiat &nbsp;·&nbsp; ✓ Sans engagement
                  </p>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      </motion.nav>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   MOBILE OUTILS MENU — sous-menu expandable
───────────────────────────────────────────────────────── */
function MobileOutilsMenu({ onNavigate }: { onNavigate: () => void }) {
  const [expanded, setExpanded] = useState(false);

  const topItems = [
    { label: "Calculateur TVA", href: "/outils/calculateur-tva", icon: Calculator },
    { label: "Simulateur charges", href: "/outils/simulateur-charges-auto-entrepreneur", icon: TrendingUp },
    { label: "Vérificateur SIRET", href: "/outils/verification-siret", icon: Search },
    { label: "Générateur facture", href: "/outils/generateur-facture-gratuite", icon: FileText },
    { label: "Générateur devis", href: "/outils/generateur-devis-gratuit", icon: ClipboardList },
    { label: "Conformité facture", href: "/outils/verificateur-conformite-facture", icon: Shield },
  ];

  return (
    <div>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="group flex w-full items-center justify-between rounded-xl px-4 py-3 hover:bg-slate-50 active:bg-slate-100 transition-all touch-manipulation"
      >
        <span className="text-[15px] font-semibold text-[#0F172A]">Outils gratuits</span>
        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-0.5 px-2 pb-1">
              {topItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className="group flex items-center gap-2.5 rounded-lg px-3 py-2 hover:bg-slate-50 active:bg-slate-100 transition-all touch-manipulation"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#EFF6FF] text-[#2563EB]">
                    <item.icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-[13px] font-medium text-slate-700">{item.label}</span>
                </Link>
              ))}
              <Link
                href="/outils"
                onClick={onNavigate}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-slate-50 px-3 py-2 mt-1 text-[12px] font-semibold text-[#2563EB] active:bg-slate-100 transition-colors touch-manipulation"
              >
                Voir les 12 outils
                <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   HERO
───────────────────────────────────────────────────────── */
function Hero() {
  return (
    <section className="mx-auto max-w-6xl px-5 pb-28 pt-[108px]">
      <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-14">

        {/* ── Colonne gauche — texte ── */}
        <motion.div
          className="flex flex-col items-center gap-4 text-center md:items-start md:text-left"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Badge conformité */}
          <motion.div
            className="mx-auto w-fit md:mx-0"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.4 }}
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-[#BFDBFE] bg-[#EFF6FF]/90 px-3.5 py-1 text-[13px] font-medium text-[#2563EB] backdrop-blur-sm">
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#2563EB] opacity-70" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#2563EB]" />
              </span>
              Conforme réglementation 2026&nbsp;/&nbsp;2027
            </span>
          </motion.div>

          {/* 2.2 — Accroche principale — text reveal ligne par ligne */}
          <h1 className="text-[2.3rem] font-extrabold leading-[1.1] tracking-[-0.03em] text-[#0F172A] sm:text-[2.75rem] lg:text-[3rem]">
            {[
              { text: "La facturation électronique ", delay: 0.08, color: "" },
              { text: "devient obligatoire.", delay: 0.2, color: "text-[#2563EB]", font: "var(--font-bricolage)" },
              { text: "Sois prêt avant tout le monde.", delay: 0.35, color: "text-[#0F172A]", br: true },
            ].map((line, i) => (
              <motion.span
                key={i}
                className={`inline ${line.color}`}
                style={line.font ? { fontFamily: line.font } : undefined}
                initial={{ opacity: 0, y: 18, filter: "blur(6px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ delay: line.delay, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              >
                {line.br && <br />}
                {line.text}
              </motion.span>
            ))}
          </h1>

          {/* 2.3 — Sous-titre */}
          <motion.p
            className="mx-auto max-w-[440px] text-[15px] leading-[1.7] text-slate-500 md:mx-0"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            La loi impose la facturation électronique à toutes les entreprises dès septembre&nbsp;2026.{" "}
            <strong className="font-semibold text-[#0F172A]">
              Qonforme génère ton Factur-X certifié EN&nbsp;16931 — la partie la plus technique — et t&apos;accompagne pas à pas pour la transmission.
            </strong>{" "}
            Tu restes concentré sur ton métier.
          </motion.p>

          {/* 3.1 — Double CTA hero */}
          <motion.div
            className="flex flex-wrap items-center justify-center gap-3 pt-1 md:justify-start"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.27, duration: 0.5 }}
          >
            {/* CTA principal */}
            <Link href="/signup">
              <ShimmerButton
                background="rgba(37,99,235,1)"
                shimmerColor="#ffffff"
                shimmerDuration="2.5s"
                borderRadius="10px"
                className="h-11 px-5 text-[15px] font-semibold gap-2"
              >
                Commencer maintenant
                <ArrowRight className="h-4 w-4" />
              </ShimmerButton>
            </Link>
            {/* CTA secondaire hero (3.1) */}
            <Link href="/demo">
              <button className="group inline-flex h-11 items-center gap-2 rounded-[10px] border border-[#D1D5DB] bg-white/80 px-4 text-sm font-medium text-[#0F172A] backdrop-blur-sm transition-all hover:border-[#2563EB]/40 hover:shadow-sm">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#F1F5F9] transition-colors group-hover:bg-[#EFF6FF]">
                  <Play className="h-2.5 w-2.5 fill-[#2563EB] text-[#2563EB]" />
                </span>
                Essayer la démo
              </button>
            </Link>
          </motion.div>

          {/* Social proof — Trustpilot + reassurance */}
          <motion.div
            className="flex flex-col items-center gap-3 pt-2 md:items-start"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.34, duration: 0.5 }}
          >
            {/* Trustpilot-style rating */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-[#00B67A] text-[#00B67A]" />
                  ))}
                </div>
                <span className="text-[13px] font-bold text-[#0F172A]">4.8/5</span>
              </div>
              <span className="text-[12px] text-slate-400">sur Trustpilot</span>
            </div>

            {/* Badges de réassurance */}
            <div className="flex flex-wrap justify-center gap-2 md:justify-start">
              {[
                {
                  icon: <Zap className="h-3 w-3" />,
                  label: "Accès immédiat",
                  color: "text-[#2563EB]",
                  bg: "bg-[#EFF6FF]",
                  border: "border-[#BFDBFE]/60",
                },
                {
                  icon: <Shield className="h-3 w-3" />,
                  label: "Conforme réglementation",
                  color: "text-[#059669]",
                  bg: "bg-[#ECFDF5]",
                  border: "border-[#A7F3D0]/60",
                },
                {
                  icon: <Lock className="h-3 w-3" />,
                  label: "Sans engagement",
                  color: "text-slate-500",
                  bg: "bg-white/70",
                  border: "border-slate-200/70",
                },
              ].map((b) => (
                <span
                  key={b.label}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${b.color} ${b.bg} ${b.border}`}
                >
                  {b.icon}
                  {b.label}
                </span>
              ))}
            </div>
          </motion.div>
        </motion.div>

        {/* ── Colonne droite — illustration hero ── */}
        <motion.div
          className="relative"
          initial={{ opacity: 0, x: 20, y: 10 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          transition={{ delay: 0.18, duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
        >
          <Image
            src="https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/company-assets/Images%20lP/Instagram%20post%20-%2024.webp"
            alt="Qonforme — facturation sur mobile et desktop"
            width={700}
            height={580}
            className="w-full h-auto"
            sizes="(max-width: 768px) 100vw, 55vw"
            priority
          />
        </motion.div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────
   EXPORT PRINCIPAL
───────────────────────────────────────────────────────── */
export function LandingHero() {
  return (
    <>
      <Header />

      <div
        className="relative w-full"
        style={{
          background:
            "linear-gradient(125deg, #EFF6FF 0%, #EEF2FF 20%, #F5F3FF 35%, #E0F2FE 50%, #EFF6FF 65%, #F0FDF4 80%, #EEF2FF 100%)",
        }}
      >
        {/* Desktop only — dégradé riche + effets lumineux */}
        <div className="pointer-events-none absolute inset-0 hidden md:block">
          {/* Overlay dégradé desktop */}
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(160deg, #EFF6FF 0%, #EEF2FF 20%, #F5F3FF 38%, #E0F2FE 55%, #EFF6FF 75%, #F8FAFC 100%)",
            }}
          />
          {/* Lueurs radiales douces */}
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 65% 45% at 15% -5%, rgba(37,99,235,0.09) 0%, transparent 55%), " +
                "radial-gradient(ellipse 45% 35% at 85% 0%, rgba(124,58,237,0.07) 0%, transparent 50%)",
            }}
          />
          {/* LightRays */}
          <LightRays
            count={8}
            color="rgba(99, 155, 235, 0.55)"
            blur={28}
            speed={12}
            length="120vh"
            className="z-0"
          />
        </div>

        {/* Picto Q filigrane — mobile : centré */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center md:hidden"
          style={{ opacity: 0.07 }}
        >
          <Image
            src={PICTO_Q_URL}
            alt=""
            width={300}
            height={300}
            className="w-[280px] select-none"
            sizes="280px"
            loading="lazy"
          />
        </div>

        {/* Picto Q filigrane — desktop : côté droit, derrière mockup */}
        <div
          aria-hidden
          className="pointer-events-none absolute right-[-60px] top-[50px] z-[1] hidden lg:block"
          style={{ opacity: 0.06 }}
        >
          <Image
            src={PICTO_Q_URL}
            alt=""
            width={480}
            height={480}
            className="w-[420px] select-none"
            sizes="420px"
            loading="lazy"
          />
        </div>

        {/* Contenu hero au-dessus */}
        <div className="relative z-10">
          <Hero />
        </div>

        {/* Fade blanc en bas */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-40"
          style={{
            background: "linear-gradient(to bottom, transparent 0%, #ffffff 100%)",
          }}
        />
      </div>
    </>
  );
}
