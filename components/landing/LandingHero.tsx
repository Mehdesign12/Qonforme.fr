"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { Menu, ArrowRight, Shield, Zap, Play, Lock, X } from "lucide-react";
import { motion } from "motion/react";
import { Sheet, SheetContent, SheetTrigger, SheetClose } from "@/components/ui/sheet";
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
   HEADER
   - Au départ : totalement transparent
   - Au scroll > 40px : pilule blanche avec ombre + backdrop blur
   - CTA secondaire "Voir la démo" ajouté (3.1)
───────────────────────────────────────────────────────── */
function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navLinks = [
    { label: "Fonctionnalités", href: "#features" },
    { label: "Tarifs", href: "#pricing" },
    { label: "Blog", href: "/blog" },
    { label: "Démo", href: "/demo" },
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

        {/* Hamburger mobile */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger
            className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-white/50 active:bg-white/70"
            render={
              <button aria-label="Menu">
                <Menu className="h-5 w-5" />
              </button>
            }
          />

          {/*
           * Menu mobile plein écran — slide depuis la droite.
           * !w-full !max-w-full : override les classes data-side du composant Sheet.
           * !z-[200] : passe au-dessus de la navbar (z-[100]) → supprime le double logo
           *           et le bouton ≡× fusionné.
           */}
          <SheetContent
            side="right"
            showCloseButton={false}
            className="!w-full !max-w-full !z-[200] p-0 overflow-hidden border-none"
            style={{
              background:
                "linear-gradient(145deg, #EFF6FF 0%, #EEF2FF 28%, #F5F3FF 52%, #E0F2FE 72%, #EFF6FF 100%)",
            }}
          >
            {/* Q filigrane — coin bas-droit, taille réduite */}
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-6 -right-6 select-none z-0"
              style={{ opacity: 0.08 }}
            >
              <Image
                src={PICTO_Q_URL}
                alt=""
                width={200}
                height={200}
                className="w-[180px] select-none"
                sizes="180px"
                loading="lazy"
              />
            </div>

            {/* Contenu au-dessus du filigrane */}
            <div className="relative z-10 flex flex-col h-full">

              {/* ── Header : logo + bouton fermer ── */}
              <div
                className="flex items-center justify-between px-6 border-b border-white/60 shrink-0"
                style={{ paddingTop: 'max(20px, env(safe-area-inset-top, 20px))', paddingBottom: '18px' }}
              >
                <Link href="/" onClick={() => setMobileOpen(false)}>
                  <Image
                    src={LOGO_URL}
                    alt="Qonforme"
                    width={124}
                    height={30}
                    className="h-8 w-auto"
                    sizes="124px"
                    priority
                  />
                </Link>
                <SheetClose
                  render={
                    <button
                      className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/70 backdrop-blur-sm border border-white/60 text-slate-500 shadow-sm active:scale-95 transition-all touch-manipulation"
                      aria-label="Fermer le menu"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  }
                />
              </div>

              {/* ── Liens de navigation (flux naturel, sans flex-1) ── */}
              <nav className="flex flex-col px-4 pt-5 pb-2 gap-0.5 shrink-0">
                {navLinks.map((l) => (
                  <Link
                    key={l.label}
                    href={l.href}
                    onClick={() => setMobileOpen(false)}
                    className="group flex items-center justify-between rounded-2xl px-5 py-[17px] bg-white/0 hover:bg-white/50 active:bg-white/70 transition-all touch-manipulation"
                  >
                    <span className="text-[18px] font-semibold text-[#0F172A]">{l.label}</span>
                    <span className="text-slate-300 group-hover:text-[#2563EB] transition-colors text-[18px] leading-none">→</span>
                  </Link>
                ))}
              </nav>

              {/* Séparateur */}
              <div className="mx-5 mt-5 h-px bg-white/70 shrink-0" />

              {/* ── CTAs — juste après le séparateur ── */}
              <div className="px-5 pt-5 flex flex-col gap-3 shrink-0">
                <Link href="/login" onClick={() => setMobileOpen(false)} className="block">
                  <button className="w-full h-[52px] rounded-2xl bg-white/80 backdrop-blur-sm border border-white/80 text-[15px] font-semibold text-[#0F172A] shadow-sm active:scale-[0.98] transition-all touch-manipulation">
                    Se connecter
                  </button>
                </Link>
                <Link href="/signup" onClick={() => setMobileOpen(false)} className="block">
                  <ShimmerButton
                    background="rgba(37,99,235,1)"
                    shimmerColor="#ffffff"
                    shimmerDuration="2.5s"
                    borderRadius="16px"
                    className="w-full h-[52px] text-[15px] font-semibold justify-center"
                  >
                    Commencer maintenant →
                  </ShimmerButton>
                </Link>
                {/* Texte réassurance — whitespace-nowrap pour éviter la coupure */}
                <p className="text-center text-[11px] text-slate-400 pt-0.5 whitespace-nowrap">
                  ✓ Accès immédiat &nbsp;·&nbsp; ✓ Sans engagement
                </p>
              </div>

            </div>
          </SheetContent>
        </Sheet>
      </motion.nav>
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

          {/* 2.2 — Accroche principale (option recommandée) */}
          <motion.h1
            className="text-[2.3rem] font-extrabold leading-[1.1] tracking-[-0.03em] text-[#0F172A] sm:text-[2.75rem] lg:text-[3rem]"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, duration: 0.55 }}
          >
            La facturation électronique{" "}
            <span
              className="text-[#2563EB]"
              style={{ fontFamily: "var(--font-bricolage)" }}
            >
              devient obligatoire.
            </span>
            <br />
            <span className="text-[#0F172A]">Sois prêt avant tout le monde.</span>
          </motion.h1>

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

          {/* Social proof */}
          <motion.div
            className="flex flex-col items-center gap-2.5 pt-1 md:items-start"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.34, duration: 0.5 }}
          >
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2.5">
                {[
                  { bg: "#DBEAFE", initials: "GM" },
                  { bg: "#EDE9FE", initials: "AB" },
                  { bg: "#D1FAE5", initials: "PL" },
                  { bg: "#FEF3C7", initials: "+5" },
                ].map((a, i) => (
                  <div
                    key={i}
                    className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-[10px] font-semibold text-slate-600"
                    style={{ backgroundColor: a.bg }}
                  >
                    {a.initials}
                  </div>
                ))}
              </div>
              <div>
                <p className="text-[13px] font-semibold text-[#0F172A]">500+ artisans</p>
                <p className="text-[11px] text-slate-400">utilisent Qonforme au quotidien</p>
              </div>
            </div>

            {/* 2.4 — Badges de réassurance mis à jour */}
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
                  label: "Conforme réglementation 2026",
                  color: "text-[#059669]",
                  bg: "bg-[#ECFDF5]",
                  border: "border-[#A7F3D0]/60",
                },
                {
                  icon: <Lock className="h-3 w-3" />,
                  label: "Résiliable à tout moment",
                  color: "text-slate-500",
                  bg: "bg-white/70",
                  border: "border-slate-200/70",
                },
              ].map((b) => (
                <span
                  key={b.label}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${b.color} ${b.bg} ${b.border} backdrop-blur-sm`}
                >
                  {b.icon}
                  {b.label}
                </span>
              ))}
            </div>
          </motion.div>
        </motion.div>

        {/* ── Colonne droite — mockup dashboard ── */}
        <motion.div
          className="relative"
          initial={{ opacity: 0, x: 20, y: 10 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          transition={{ delay: 0.18, duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Halo lumineux derrière la carte */}
          <div className="pointer-events-none absolute -inset-6 rounded-3xl bg-gradient-to-br from-[#DBEAFE]/60 via-[#EDE9FE]/40 to-[#D1FAE5]/20 blur-2xl" />

          <div className="relative overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_24px_64px_-12px_rgba(15,23,42,0.14)]">
            {/* Window bar */}
            <div className="flex items-center gap-1.5 border-b border-[#F1F5F9] bg-[#F8FAFC] px-4 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#FC6058]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#FEC02F]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#2ACA44]" />
              <span className="mx-auto font-mono text-[11px] tracking-wide text-slate-400">
                app.qonforme.fr/dashboard
              </span>
            </div>

            <div className="bg-[#F8FAFC] p-4">
              {/* KPIs */}
              <div className="mb-3 grid grid-cols-2 gap-2.5">
                {[
                  { label: "CA ce mois", value: "8 450 €", delta: "+12 %", dc: "#059669" },
                  { label: "Factures émises", value: "7", delta: "ce mois", dc: "#2563EB" },
                  { label: "En attente", value: "2 100 €", delta: "3 factures", dc: "#D97706" },
                  { label: "En retard", value: "0 €", delta: "tout est ok ✓", dc: "#059669" },
                ].map((kpi) => (
                  <div
                    key={kpi.label}
                    className="rounded-xl border border-[#E8EFF6] bg-white px-3 py-2.5"
                  >
                    <p className="mb-0.5 text-[11px] text-slate-400">{kpi.label}</p>
                    <p className="font-mono text-[15px] font-bold text-[#0F172A]">{kpi.value}</p>
                    <p className="mt-0.5 text-[11px] font-medium" style={{ color: kpi.dc }}>
                      {kpi.delta}
                    </p>
                  </div>
                ))}
              </div>

              {/* Table factures */}
              <div className="overflow-hidden rounded-xl border border-[#E8EFF6] bg-white">
                <div className="flex items-center justify-between border-b border-[#F1F5F9] px-3.5 py-2">
                  <span className="text-[12px] font-semibold text-[#0F172A]">
                    Dernières factures
                  </span>
                  <span className="text-[11px] font-medium text-[#2563EB]">Voir tout →</span>
                </div>
                {[
                  { num: "FAC-2026-007", client: "Garage Martin", amount: "1 200 €", status: "Payée", sc: "#059669", sb: "#D1FAE5" },
                  { num: "FAC-2026-006", client: "Atelier Dubois", amount: "890 €", status: "Envoyée", sc: "#1E40AF", sb: "#DBEAFE" },
                  { num: "FAC-2026-005", client: "Plomberie Moreau", amount: "460 €", status: "En retard", sc: "#991B1B", sb: "#FEE2E2" },
                ].map((row) => (
                  <div
                    key={row.num}
                    className="flex items-center justify-between border-b border-[#F8FAFC] px-3.5 py-2.5 last:border-0"
                  >
                    <div>
                      <p className="text-[12px] font-medium text-[#0F172A]">{row.num}</p>
                      <p className="text-[11px] text-slate-400">{row.client}</p>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-[12px] font-semibold text-[#0F172A]">
                        {row.amount}
                      </span>
                      <span
                        className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                        style={{ color: row.sc, backgroundColor: row.sb }}
                      >
                        {row.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
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
