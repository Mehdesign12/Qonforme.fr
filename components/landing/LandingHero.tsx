"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { Menu, ArrowRight, Shield, Zap, Play, CheckCircle2 } from "lucide-react";
import { motion } from "motion/react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { LightRays } from "@/components/ui/light-rays";

const LOGO_URL =
  "https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Logo%20long%20simple%20bleu%20avec%20fond.webp";

/* ─────────────────────────────────────────────────────────
   HEADER — EN DEHORS de AuroraBackground pour que le
   sticky fonctionne même avec overflow-hidden sur l'aurora.
───────────────────────────────────────────────────────── */
function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navLinks = [
    { label: "Fonctionnalités", href: "#features" },
    { label: "Tarifs", href: "#pricing" },
    { label: "Démo", href: "/demo" },
  ];

  return (
    /* sticky top-0 sur ce wrapper — PAS à l'intérieur d'un overflow-hidden */
    <div className="sticky top-0 z-[100] flex justify-center px-5 pt-4">
      <motion.nav
        animate={{
          borderRadius: scrolled ? "9999px" : "16px",
          paddingLeft:  scrolled ? "24px" : "20px",
          paddingRight: scrolled ? "24px" : "20px",
          boxShadow: scrolled
            ? "0 8px 32px -4px rgba(15,23,42,0.14), 0 2px 8px -2px rgba(15,23,42,0.06)"
            : "0 2px 12px -2px rgba(15,23,42,0.06)",
          backgroundColor: scrolled
            ? "rgba(255,255,255,0.97)"
            : "rgba(255,255,255,0.82)",
        }}
        transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
        className="relative flex w-full max-w-5xl items-center justify-between border border-white/70 py-2.5 backdrop-blur-md"
      >
        {/* Logo */}
        <Link href="/" className="flex shrink-0 items-center">
          <Image src={LOGO_URL} alt="Qonforme" width={130} height={32}
            className="h-[30px] w-auto object-contain" unoptimized />
        </Link>

        {/* Nav desktop — centré en absolu */}
        <div className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-6 md:flex">
          {navLinks.map((l) => (
            <Link key={l.label} href={l.href}
              className="text-sm font-medium text-slate-500 transition-colors hover:text-[#0F172A]">
              {l.label}
            </Link>
          ))}
        </div>

        {/* Actions desktop */}
        <div className="hidden shrink-0 items-center gap-2 md:flex">
          <Link href="/login">
            <Button variant="ghost" className="h-8 px-3 text-sm font-medium text-slate-500 hover:text-[#0F172A]">
              Se connecter
            </Button>
          </Link>
          <Separator orientation="vertical" className="h-4" />
          <Link href="/signup">
            <ShimmerButton background="rgba(37,99,235,1)" shimmerColor="#ffffff"
              shimmerDuration="2.5s" borderRadius="9999px" className="h-8 px-4 text-sm font-semibold">
              Essai gratuit
            </ShimmerButton>
          </Link>
        </div>

        {/* Hamburger mobile */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger
            className="md:hidden inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100"
            render={<button aria-label="Menu"><Menu className="h-4 w-4" /></button>}
          />
          <SheetContent side="right" className="w-[260px]">
            <div className="mb-6 mt-2">
              <Image src={LOGO_URL} alt="Qonforme" width={110} height={28} className="h-7 w-auto" unoptimized />
            </div>
            <nav className="flex flex-col gap-3">
              {navLinks.map((l) => (
                <Link key={l.label} href={l.href} onClick={() => setMobileOpen(false)}
                  className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-50 hover:text-[#0F172A]">
                  {l.label}
                </Link>
              ))}
              <Separator className="my-1" />
              <Link href="/login" onClick={() => setMobileOpen(false)}>
                <Button variant="ghost" className="w-full justify-start h-9 text-sm text-slate-500">Se connecter</Button>
              </Link>
              <Link href="/signup" onClick={() => setMobileOpen(false)}>
                <ShimmerButton background="rgba(37,99,235,1)" shimmerColor="#ffffff"
                  shimmerDuration="2.5s" borderRadius="9999px" className="w-full h-9 text-sm justify-center">
                  Essai gratuit
                </ShimmerButton>
              </Link>
            </nav>
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
    <section className="mx-auto max-w-6xl px-5 pb-20 pt-8 sm:pt-10">
      <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[1fr_1.05fr] lg:gap-16">

        {/* Colonne gauche */}
        <motion.div className="flex flex-col gap-5"
          initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>

          {/* Badge */}
          <motion.div className="w-fit" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.4 }}>
            <span className="inline-flex items-center gap-2 rounded-full border border-[#BFDBFE] bg-[#EFF6FF]/90 px-3.5 py-1 text-[13px] font-medium text-[#2563EB] backdrop-blur-sm">
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#2563EB] opacity-70" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#2563EB]" />
              </span>
              Conforme réglementation 2026&nbsp;/&nbsp;2027
            </span>
          </motion.div>

          {/* Titre */}
          <motion.h1
            className="text-[2.6rem] font-extrabold leading-[1.08] tracking-[-0.03em] text-[#0F172A] sm:text-5xl lg:text-[3.25rem]"
            initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, duration: 0.55 }}>
            En 3&nbsp;clics,{" "}
            <span className="text-[#2563EB]" style={{ fontFamily: "var(--font-bricolage)" }}>
              ta&nbsp;facture
              <br className="hidden sm:block" />
              est&nbsp;envoyée.
            </span>
            <br />
            <span>On s&apos;occupe du reste.</span>
          </motion.h1>

          {/* Sous-titre */}
          <motion.p className="max-w-[440px] text-[15px] leading-[1.7] text-slate-500"
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}>
            Facturation électronique pour{" "}
            <strong className="font-semibold text-[#0F172A]">artisans, auto-entrepreneurs et TPE</strong>.
            Transmission légale automatique, archivage 10 ans,{" "}
            <strong className="font-semibold text-[#0F172A]">zéro jargon.</strong>
          </motion.p>

          {/* CTAs */}
          <motion.div className="flex flex-wrap items-center gap-3 pt-1"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.27, duration: 0.5 }}>
            <Link href="/signup">
              <ShimmerButton background="rgba(37,99,235,1)" shimmerColor="#ffffff"
                shimmerDuration="2.5s" borderRadius="10px"
                className="h-11 px-5 text-[15px] font-semibold gap-2">
                Commencer gratuitement <ArrowRight className="h-4 w-4" />
              </ShimmerButton>
            </Link>
            <Link href="/demo">
              <button className="group inline-flex h-11 items-center gap-2 rounded-[10px] border border-[#E2E8F0] bg-white/70 px-4 text-sm font-medium text-[#0F172A] backdrop-blur-sm transition-all hover:border-[#CBD5E1] hover:shadow-sm">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#F1F5F9] transition-colors group-hover:bg-[#EFF6FF]">
                  <Play className="h-2.5 w-2.5 fill-[#2563EB] text-[#2563EB]" />
                </span>
                Voir la démo
              </button>
            </Link>
          </motion.div>

          {/* Social proof */}
          <motion.div className="flex flex-col gap-3 pt-1"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.34, duration: 0.5 }}>
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2.5">
                {[{ bg: "#DBEAFE", initials: "GM" }, { bg: "#EDE9FE", initials: "AB" },
                  { bg: "#D1FAE5", initials: "PL" }, { bg: "#FEF3C7", initials: "+5" }].map((a, i) => (
                  <div key={i}
                    className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-[10px] font-semibold text-slate-600"
                    style={{ backgroundColor: a.bg }}>
                    {a.initials}
                  </div>
                ))}
              </div>
              <div>
                <p className="text-[13px] font-semibold text-[#0F172A]">500+ artisans</p>
                <p className="text-[11px] text-slate-400">utilisent Qonforme au quotidien</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { icon: <Zap className="h-3 w-3" />, label: "7 jours gratuits", color: "text-[#2563EB]", bg: "bg-[#EFF6FF]" },
                { icon: <Shield className="h-3 w-3" />, label: "Conforme PPF 2026", color: "text-[#059669]", bg: "bg-[#ECFDF5]" },
                { icon: <CheckCircle2 className="h-3 w-3" />, label: "Sans engagement", color: "text-slate-500", bg: "bg-[#F8FAFC]" },
              ].map((b) => (
                <span key={b.label} className={`inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 px-2.5 py-1 text-[11px] font-medium ${b.color} ${b.bg}`}>
                  {b.icon}{b.label}
                </span>
              ))}
            </div>
          </motion.div>
        </motion.div>

        {/* Colonne droite — mockup */}
        <motion.div className="relative"
          initial={{ opacity: 0, x: 24, y: 12 }} animate={{ opacity: 1, x: 0, y: 0 }}
          transition={{ delay: 0.18, duration: 0.75, ease: [0.22, 1, 0.36, 1] }}>
          <div className="pointer-events-none absolute -inset-6 rounded-3xl bg-gradient-to-br from-[#DBEAFE]/50 via-[#EDE9FE]/30 to-[#D1FAE5]/20 blur-3xl" />
          <div className="relative overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_20px_60px_-10px_rgba(15,23,42,0.15)]">
            <div className="flex items-center gap-1.5 border-b border-[#F1F5F9] bg-[#F8FAFC] px-4 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#FC6058]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#FEC02F]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#2ACA44]" />
              <span className="mx-auto font-mono text-[11px] text-slate-400 tracking-wide">app.qonforme.fr/dashboard</span>
            </div>
            <div className="bg-[#F8FAFC] p-4">
              <div className="mb-3 grid grid-cols-2 gap-2.5">
                {[
                  { label: "CA ce mois", value: "8 450 €", delta: "+12 %", dc: "#059669" },
                  { label: "Factures émises", value: "7", delta: "ce mois", dc: "#2563EB" },
                  { label: "En attente", value: "2 100 €", delta: "3 factures", dc: "#D97706" },
                  { label: "En retard", value: "0 €", delta: "tout est ok ✓", dc: "#059669" },
                ].map((kpi) => (
                  <div key={kpi.label} className="rounded-xl border border-[#E8EFF6] bg-white px-3 py-2.5">
                    <p className="text-[11px] text-slate-400 mb-0.5">{kpi.label}</p>
                    <p className="font-mono text-[15px] font-bold text-[#0F172A]">{kpi.value}</p>
                    <p className="text-[11px] mt-0.5 font-medium" style={{ color: kpi.dc }}>{kpi.delta}</p>
                  </div>
                ))}
              </div>
              <div className="overflow-hidden rounded-xl border border-[#E8EFF6] bg-white">
                <div className="flex items-center justify-between border-b border-[#F1F5F9] px-3.5 py-2">
                  <span className="text-[12px] font-semibold text-[#0F172A]">Dernières factures</span>
                  <span className="text-[11px] font-medium text-[#2563EB]">Voir tout →</span>
                </div>
                {[
                  { num: "FAC-2026-007", client: "Garage Martin", amount: "1 200 €", status: "Payée", sc: "#059669", sb: "#D1FAE5" },
                  { num: "FAC-2026-006", client: "Atelier Dubois", amount: "890 €", status: "Envoyée", sc: "#1E40AF", sb: "#DBEAFE" },
                  { num: "FAC-2026-005", client: "Plomberie Moreau", amount: "460 €", status: "En retard", sc: "#991B1B", sb: "#FEE2E2" },
                ].map((row) => (
                  <div key={row.num} className="flex items-center justify-between border-b border-[#F8FAFC] px-3.5 py-2.5 last:border-0">
                    <div>
                      <p className="text-[12px] font-medium text-[#0F172A]">{row.num}</p>
                      <p className="text-[11px] text-slate-400">{row.client}</p>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-[12px] font-semibold text-[#0F172A]">{row.amount}</span>
                      <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ color: row.sc, backgroundColor: row.sb }}>{row.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 rounded-b-2xl bg-gradient-to-t from-white/40 to-transparent" />
        </motion.div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────
   EXPORT — Header HORS de AuroraBackground (fix sticky)
───────────────────────────────────────────────────────── */
export function LandingHero() {
  return (
    <>
      {/* Header sticky — hors du overflow-hidden pour que position:sticky fonctionne */}
      <Header />

      {/*
        Wrapper hero : relative + overflow-hidden requis par LightRays.
        Le fond aurora est appliqué via les couches CSS directement ici.
        -mt-[60px] + padding-top compensent le header sticky.
      */}
      <div
        className="relative w-full overflow-hidden -mt-[60px]"
        style={{
          background:
            "linear-gradient(135deg, #EFF6FF 0%, #EEF2FF 20%, #F5F3FF 38%, #E0F2FE 55%, #EFF6FF 72%, #F0FDF4 88%, #EEF2FF 100%)",
        }}
      >
        {/* Lueurs radiales statiques en fond */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 70% 50% at 20% -10%, rgba(37,99,235,0.10) 0%, transparent 60%), radial-gradient(ellipse 50% 40% at 80% 5%, rgba(124,58,237,0.08) 0%, transparent 55%)",
          }}
        />

        {/* LightRays animés — z-0, inset-0 */}
        <LightRays
          count={8}
          color="rgba(147, 197, 253, 0.30)"
          blur={38}
          speed={12}
          length="100%"
          className="z-0"
        />

        {/* Contenu hero au-dessus des rayons */}
        <div className="relative z-10">
          <div className="h-[60px]" />
          <Hero />
        </div>
      </div>
    </>
  );
}
