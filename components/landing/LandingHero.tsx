"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { Menu, ArrowRight, Shield, Zap, Users, Play } from "lucide-react";
import { motion } from "motion/react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { AuroraBackground } from "@/components/ui/aurora-background";

const LOGO_URL =
  "https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Logo%20long%20simple%20bleu%20avec%20fond.webp";

export function LandingHero() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { label: "Fonctionnalités", href: "#features" },
    { label: "Tarifs", href: "#pricing" },
    { label: "Démo", href: "/demo" },
  ];

  return (
    /*
     * AuroraBackground englobe TOUT : header + hero.
     * Ainsi le fond animé est visible dès le top de la page,
     * sans espace blanc sous le header.
     */
    <AuroraBackground
      className="bg-white"
      showRadialGradient={true}
    >
      {/* ═══════════════════════════════════════════════════════════
          HEADER — sticky, fond transparent pour laisser voir l'aurora
      ═══════════════════════════════════════════════════════════ */}
      <div className="sticky top-0 z-50 px-4 pt-3">
        <nav className="mx-auto flex max-w-5xl items-center justify-between rounded-xl border border-white/60 bg-white/75 px-4 py-2 shadow-sm backdrop-blur-md">
          {/* Logo + nav links desktop */}
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center">
              <Image
                src={LOGO_URL}
                alt="Qonforme"
                width={130}
                height={32}
                className="h-8 w-auto object-contain"
                unoptimized
              />
            </Link>
            <div className="hidden items-center gap-5 md:flex">
              {navLinks.map((l) => (
                <Link
                  key={l.label}
                  href={l.href}
                  className="text-sm text-slate-500 transition-colors hover:text-[#0F172A]"
                >
                  {l.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Actions desktop */}
          <div className="flex items-center gap-3">
            <Separator orientation="vertical" className="hidden h-5 md:block" />
            <Link href="/login" className="hidden md:block">
              <Button
                variant="ghost"
                className="h-8 px-3 text-sm font-normal text-slate-500 hover:text-[#0F172A]"
              >
                Se connecter
              </Button>
            </Link>
            <Link href="/signup" className="hidden md:block">
              <ShimmerButton
                background="rgba(37, 99, 235, 1)"
                shimmerColor="#ffffff"
                shimmerDuration="2.5s"
                borderRadius="9999px"
                className="h-8 px-4 text-sm font-medium"
              >
                Essai gratuit
              </ShimmerButton>
            </Link>

            {/* Hamburger mobile */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger
                className="md:hidden inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 transition-colors"
                render={
                  <button aria-label="Menu">
                    <Menu className="h-4 w-4" />
                  </button>
                }
              />
              <SheetContent side="right" className="w-[260px]">
                <div className="mb-6 mt-2">
                  <Image
                    src={LOGO_URL}
                    alt="Qonforme"
                    width={120}
                    height={30}
                    className="h-7 w-auto"
                    unoptimized
                  />
                </div>
                <nav className="flex flex-col gap-4">
                  {navLinks.map((l) => (
                    <Link
                      key={l.label}
                      href={l.href}
                      onClick={() => setMobileOpen(false)}
                      className="text-sm text-slate-500 transition-colors hover:text-[#0F172A]"
                    >
                      {l.label}
                    </Link>
                  ))}
                  <Separator />
                  <Link href="/login" onClick={() => setMobileOpen(false)}>
                    <Button
                      variant="ghost"
                      className="w-full justify-start h-9 text-sm font-normal text-slate-500"
                    >
                      Se connecter
                    </Button>
                  </Link>
                  <Link href="/signup" onClick={() => setMobileOpen(false)}>
                    <ShimmerButton
                      background="rgba(37, 99, 235, 1)"
                      shimmerColor="#ffffff"
                      shimmerDuration="2.5s"
                      borderRadius="9999px"
                      className="w-full h-9 text-sm justify-center"
                    >
                      Essai gratuit
                    </ShimmerButton>
                  </Link>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </nav>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          HERO — layout 2 colonnes style Alva
          Gauche : badge + titre + sous-titre + CTAs + social proof
          Droite : dashboard mockup
      ═══════════════════════════════════════════════════════════ */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 pb-16 pt-8 md:pt-10 md:pb-20">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16 items-center">

          {/* ── Colonne gauche — texte ─────────────────────────── */}
          <motion.div
            className="flex flex-col items-start gap-6"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
          >
            {/* Badge */}
            <motion.div
              className="inline-flex items-center gap-2 rounded-full border border-[#BFDBFE] bg-[#EFF6FF]/80 px-4 py-1.5 text-sm font-medium text-[#2563EB] backdrop-blur-sm"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.05, duration: 0.4 }}
            >
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#2563EB] opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#2563EB]" />
              </span>
              Conforme réglementation 2026&nbsp;/&nbsp;2027
            </motion.div>

            {/* Titre */}
            <motion.h1
              className="text-4xl font-extrabold leading-[1.1] tracking-tight text-[#0F172A] sm:text-5xl lg:text-6xl"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.5 }}
            >
              En 3 clics,{" "}
              <span className="text-[#2563EB]">ta facture<br />est envoyée.</span>
              <br />
              On s&apos;occupe du reste.
            </motion.h1>

            {/* Sous-titre */}
            <motion.p
              className="max-w-md text-base leading-relaxed text-slate-500 sm:text-lg"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18, duration: 0.5 }}
            >
              Facturation électronique pour{" "}
              <strong className="font-semibold text-[#0F172A]">
                artisans, auto-entrepreneurs et TPE
              </strong>
              . Transmission légale automatique, archivage 10 ans,{" "}
              <strong className="font-semibold text-[#0F172A]">zéro jargon.</strong>
            </motion.p>

            {/* CTAs */}
            <motion.div
              className="flex flex-wrap items-center gap-3"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.5 }}
            >
              <Link href="/signup">
                <ShimmerButton
                  background="rgba(37, 99, 235, 1)"
                  shimmerColor="#ffffff"
                  shimmerDuration="2.5s"
                  borderRadius="10px"
                  className="h-11 px-6 text-base font-semibold gap-2"
                >
                  Commencer gratuitement
                  <ArrowRight className="h-4 w-4" />
                </ShimmerButton>
              </Link>
              <Link href="/demo">
                <button className="inline-flex h-11 items-center gap-2 rounded-[10px] border border-[#E2E8F0] bg-white/80 px-5 text-sm font-medium text-[#0F172A] backdrop-blur-sm transition-all hover:border-[#2563EB] hover:text-[#2563EB]">
                  <Play className="h-3.5 w-3.5 fill-current" />
                  Voir la démo
                </button>
              </Link>
            </motion.div>

            {/* Social proof — style Alva */}
            <motion.div
              className="flex items-center gap-3"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.32, duration: 0.5 }}
            >
              {/* Avatars empilés */}
              <div className="flex -space-x-2">
                {["#DBEAFE", "#EDE9FE", "#D1FAE5"].map((bg, i) => (
                  <div
                    key={i}
                    className="h-8 w-8 rounded-full border-2 border-white flex items-center justify-center"
                    style={{ backgroundColor: bg }}
                  >
                    <Users className="h-3.5 w-3.5 text-slate-500" />
                  </div>
                ))}
              </div>
              <div>
                <p className="text-sm font-semibold text-[#0F172A]">500+ artisans</p>
                <p className="text-xs text-slate-400">utilisent Qonforme au quotidien</p>
              </div>
            </motion.div>

            {/* Réassurance en ligne */}
            <motion.div
              className="flex flex-wrap gap-4 text-xs text-slate-400"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.5 }}
            >
              <span className="flex items-center gap-1.5">
                <Zap className="h-3 w-3 text-[#2563EB]" />
                7 jours gratuits
              </span>
              <span>·</span>
              <span className="flex items-center gap-1.5">
                <Shield className="h-3 w-3 text-[#10B981]" />
                Conforme PPF 2026
              </span>
              <span>·</span>
              <span>Sans carte bancaire</span>
            </motion.div>
          </motion.div>

          {/* ── Colonne droite — dashboard mockup ─────────────── */}
          <motion.div
            className="relative w-full"
            initial={{ opacity: 0, x: 32, y: 10 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ delay: 0.15, duration: 0.7, ease: "easeOut" }}
          >
            {/* Halo lumineux derrière le mockup */}
            <div className="pointer-events-none absolute -inset-4 rounded-3xl bg-gradient-to-br from-[#DBEAFE]/60 via-[#EDE9FE]/40 to-transparent blur-2xl" />

            <div className="relative w-full rounded-2xl border border-[#E2E8F0] bg-white shadow-2xl overflow-hidden">
              {/* Barre de fenêtre */}
              <div className="flex items-center gap-1.5 border-b border-[#F1F5F9] bg-[#F8FAFC] px-4 py-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#EF4444]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#D97706]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#10B981]" />
                <span className="mx-auto font-mono text-xs text-slate-400">
                  app.qonforme.fr/dashboard
                </span>
              </div>

              {/* Contenu dashboard */}
              <div className="bg-[#F8FAFC] p-4 sm:p-5">
                {/* KPIs */}
                <div className="mb-4 grid grid-cols-2 gap-3">
                  {[
                    { label: "CA ce mois", value: "8 450 €", delta: "+12 %", color: "#10B981" },
                    { label: "Factures émises", value: "7", delta: "ce mois", color: "#2563EB" },
                    { label: "En attente", value: "2 100 €", delta: "3 factures", color: "#D97706" },
                    { label: "En retard", value: "0 €", delta: "tout est ok ✓", color: "#10B981" },
                  ].map((kpi) => (
                    <div
                      key={kpi.label}
                      className="rounded-xl border border-[#E2E8F0] bg-white p-3"
                    >
                      <p className="mb-0.5 text-xs text-slate-400">{kpi.label}</p>
                      <p className="font-mono text-base font-bold text-[#0F172A]">{kpi.value}</p>
                      <p className="mt-0.5 text-xs" style={{ color: kpi.color }}>{kpi.delta}</p>
                    </div>
                  ))}
                </div>

                {/* Liste factures */}
                <div className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white">
                  <div className="flex items-center justify-between border-b border-[#F1F5F9] px-4 py-2.5">
                    <span className="text-xs font-semibold text-[#0F172A]">Dernières factures</span>
                    <span className="text-xs text-[#2563EB]">Voir tout →</span>
                  </div>
                  {[
                    { num: "FAC-2026-007", client: "Garage Martin", amount: "1 200 €", status: "Payée", sc: "#10B981", sb: "#D1FAE5" },
                    { num: "FAC-2026-006", client: "Atelier Dubois", amount: "890 €", status: "Envoyée", sc: "#1E40AF", sb: "#DBEAFE" },
                    { num: "FAC-2026-005", client: "Plomberie Moreau", amount: "460 €", status: "En retard", sc: "#991B1B", sb: "#FEE2E2" },
                  ].map((row) => (
                    <div
                      key={row.num}
                      className="flex items-center justify-between border-b border-[#F8FAFC] px-4 py-2.5 last:border-0"
                    >
                      <div>
                        <p className="text-xs font-medium text-[#0F172A]">{row.num}</p>
                        <p className="text-xs text-slate-400">{row.client}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs font-semibold text-[#0F172A]">
                          {row.amount}
                        </span>
                        <span
                          className="rounded-full px-2 py-0.5 text-xs font-medium"
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

            {/* Gradient fondu bas — effet depth */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 rounded-b-2xl bg-gradient-to-t from-white/60 to-transparent" />
          </motion.div>
        </div>
      </section>
    </AuroraBackground>
  );
}
