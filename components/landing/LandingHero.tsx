"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { Menu, ArrowRight, FileText, Shield, Zap } from "lucide-react";
import { motion } from "motion/react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";


const LOGO_URL =
  "https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Logo%20long%20simple%20bleu%20avec%20fond.webp";

// Badge animé "Conforme 2026/2027"
function ComplianceBadge() {
  return (
    <motion.div
      className="inline-flex items-center gap-2 rounded-full border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-1.5 text-sm font-medium text-[#2563EB]"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#2563EB] opacity-50" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-[#2563EB]" />
      </span>
      Conforme réglementation 2026 / 2027
    </motion.div>
  );
}

export function LandingHero() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { label: "Fonctionnalités", href: "#features" },
    { label: "Tarifs", href: "#pricing" },
    { label: "Démo", href: "/demo" },
  ];

  return (
    <div className="bg-white">
      {/* ═══════════════════════════════════════════════════════════
          HEADER — sticky flottant exactement comme Acme
      ═══════════════════════════════════════════════════════════ */}
      <div className="sticky top-0 z-50 px-4 pt-4">
        <nav className="mx-auto flex max-w-5xl items-center justify-between rounded-xl border border-[#E2E8F0] bg-white/90 px-4 py-2 shadow-lg backdrop-blur-md">
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
                  className="text-sm text-slate-400 transition-colors hover:text-[#0F172A]"
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
                className="h-7 px-2 text-sm font-normal text-slate-400 hover:text-[#0F172A]"
              >
                Se connecter
              </Button>
            </Link>
            <Link href="/signup" className="hidden md:block">
              <Button className="h-8 rounded-full bg-[#0F172A] px-4 text-sm font-medium text-white hover:bg-[#1E293B]">
                Essai gratuit
              </Button>
            </Link>

            {/* Hamburger mobile */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger
                className="md:hidden inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 transition-colors"
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
                    <Button className="w-full h-9 rounded-full bg-[#0F172A] text-sm text-white hover:bg-[#1E293B]">
                      Essai gratuit
                    </Button>
                  </Link>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </nav>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          HERO — structure Acme, copy + couleurs Qonforme
      ═══════════════════════════════════════════════════════════ */}
      <main className="mx-auto max-w-5xl px-4">
        <section className="w-full py-16 md:py-24 lg:py-32">
          <motion.div
            className="flex flex-col items-center space-y-6 text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.4 }}
            >
              <ComplianceBadge />
            </motion.div>

            {/* Titre principal */}
            <motion.h1
              className="max-w-3xl text-4xl font-bold tracking-tight text-[#0F172A] sm:text-5xl md:text-6xl lg:text-7xl"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              En 3 clics,{" "}
              <span className="text-[#2563EB]">ta facture est envoyée.</span>
              <br className="hidden sm:block" />
              On s&apos;occupe du reste.
            </motion.h1>

            {/* Sous-titre */}
            <motion.p
              className="mx-auto max-w-xl text-base text-slate-500 sm:text-xl"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
            >
              Facturation électronique pour{" "}
              <span className="font-semibold text-[#0F172A]">
                artisans, auto-entrepreneurs et TPE
              </span>
              . Transmission légale automatique, archivage 10 ans,{" "}
              <span className="font-semibold text-[#0F172A]">zéro jargon.</span>
            </motion.p>

            {/* CTAs */}
            <motion.div
              className="flex flex-col gap-3 sm:flex-row"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
            >
              <Link href="/signup">
                <Button className="rounded-xl bg-[#0F172A] px-6 text-white hover:bg-[#1E293B] h-11">
                  Commencer gratuitement
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/demo">
                <Button
                  variant="outline"
                  className="rounded-xl border-[#E2E8F0] h-11 px-6 text-[#0F172A] hover:border-[#2563EB] hover:text-[#2563EB]"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Voir la démo interactive
                </Button>
              </Link>
            </motion.div>

            {/* Bandeau de réassurance — style Acme */}
            <motion.div
              className="flex flex-col items-center gap-3 pb-10"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
            >
              <div className="flex flex-wrap items-center justify-center gap-5 text-sm">
                <span className="flex items-center gap-1.5 text-[#2563EB]">
                  <Zap className="h-3.5 w-3.5" />
                  3 clics pour facturer
                </span>
                <span className="text-slate-300">·</span>
                <span className="text-slate-400">7 jours d&apos;essai gratuit</span>
                <span className="text-slate-300">·</span>
                <span className="flex items-center gap-1.5 text-[#2563EB]">
                  <Shield className="h-3.5 w-3.5" />
                  Transmission PPF automatique
                </span>
              </div>
              <p className="text-sm text-slate-400">
                Sans carte bancaire · Sans engagement · Résiliation à tout moment
              </p>
            </motion.div>

            {/* Preview dashboard — style Acme avec gradient bas */}
            <motion.div
              className="w-full rounded-3xl border border-[#E2E8F0] bg-white p-2 shadow-xl"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.8 }}
            >
              <div className="relative w-full">
                <div className="relative w-full overflow-hidden rounded-2xl border border-[#E2E8F0] shadow-inner">
                  {/* Barre de fenêtre factice */}
                  <div className="flex items-center gap-1.5 bg-[#F8FAFC] px-4 py-2.5 border-b border-[#E2E8F0]">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#EF4444]" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#D97706]" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#10B981]" />
                    <span className="mx-auto text-xs text-slate-400 font-mono">
                      app.qonforme.fr/dashboard
                    </span>
                  </div>
                  {/* Dashboard mockup — UI Qonforme */}
                  <div className="bg-[#F8FAFC] p-4 sm:p-6">
                    {/* KPI row */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                      {[
                        { label: "CA ce mois", value: "8 450 €", delta: "+12%", color: "#10B981" },
                        { label: "Factures émises", value: "7", delta: "ce mois", color: "#2563EB" },
                        { label: "En attente", value: "2 100 €", delta: "3 factures", color: "#D97706" },
                        { label: "En retard", value: "0 €", delta: "tout est ok", color: "#10B981" },
                      ].map((kpi) => (
                        <div key={kpi.label} className="rounded-xl bg-white border border-[#E2E8F0] p-3">
                          <p className="text-xs text-slate-400 mb-1">{kpi.label}</p>
                          <p className="text-base font-bold text-[#0F172A] font-mono">{kpi.value}</p>
                          <p className="text-xs mt-0.5" style={{ color: kpi.color }}>{kpi.delta}</p>
                        </div>
                      ))}
                    </div>
                    {/* Fausse liste factures */}
                    <div className="rounded-xl bg-white border border-[#E2E8F0] overflow-hidden">
                      <div className="px-4 py-2.5 border-b border-[#F1F5F9] flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#0F172A]">Dernières factures</span>
                        <span className="text-xs text-[#2563EB]">Voir tout →</span>
                      </div>
                      {[
                        { num: "FAC-2026-007", client: "Garage Martin", amount: "1 200 €", status: "Payée", statusColor: "#10B981", statusBg: "#D1FAE5" },
                        { num: "FAC-2026-006", client: "Atelier Dubois", amount: "890 €", status: "Envoyée", statusColor: "#1E40AF", statusBg: "#DBEAFE" },
                        { num: "FAC-2026-005", client: "Plomberie Moreau", amount: "460 €", status: "En retard", statusColor: "#991B1B", statusBg: "#FEE2E2" },
                      ].map((row) => (
                        <div key={row.num} className="flex items-center justify-between px-4 py-2.5 border-b border-[#F8FAFC] last:border-0">
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-lg bg-[#EFF6FF] flex items-center justify-center">
                              <FileText className="w-3.5 h-3.5 text-[#2563EB]" />
                            </div>
                            <div>
                              <p className="text-xs font-medium text-[#0F172A]">{row.num}</p>
                              <p className="text-xs text-slate-400">{row.client}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-semibold text-[#0F172A] font-mono">{row.amount}</span>
                            <span
                              className="text-xs font-medium px-2 py-0.5 rounded-full"
                              style={{ color: row.statusColor, backgroundColor: row.statusBg }}
                            >
                              {row.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                {/* Gradient fondu vers le bas — effet Acme */}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[45%] rounded-b-2xl bg-gradient-to-t from-white to-transparent" />
              </div>
            </motion.div>
          </motion.div>
        </section>
      </main>
    </div>
  );
}
