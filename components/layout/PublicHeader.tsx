"use client"

import Link from "next/link"
import Image from "next/image"
import { useState, useEffect, useRef } from "react"
import { Menu, ArrowRight, Shield, X, ChevronDown, Calculator, FileText, Search, FileCheck, Scale, TrendingUp, Hash, ClipboardList, Receipt, ChevronRight } from "lucide-react"
import { motion, AnimatePresence } from "motion/react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { ShimmerButton } from "@/components/ui/shimmer-button"

const LOGO_URL =
  "https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Logo%20long%20bleu.webp"

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
]

const MOBILE_OUTILS = [
  { label: "Calculateur TVA", href: "/outils/calculateur-tva", icon: Calculator },
  { label: "Simulateur charges", href: "/outils/simulateur-charges-auto-entrepreneur", icon: TrendingUp },
  { label: "Vérificateur SIRET", href: "/outils/verification-siret", icon: Search },
  { label: "Générateur facture", href: "/outils/generateur-facture-gratuite", icon: FileText },
  { label: "Générateur devis", href: "/outils/generateur-devis-gratuit", icon: ClipboardList },
  { label: "Conformité facture", href: "/outils/verificateur-conformite-facture", icon: Shield },
]

interface PublicHeaderProps {
  /** If true, nav links use anchor (#features) instead of absolute paths (/#features) */
  isLandingPage?: boolean
}

/**
 * Shared public header for ALL public pages.
 * Pill shape, scroll animation, mega-menu desktop, clip-path reveal mobile.
 */
export function PublicHeader({ isLandingPage = false }: PublicHeaderProps) {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [outilsOpen, setOutilsOpen] = useState(false)
  const [outilsMobileOpen, setOutilsMobileOpen] = useState(false)
  const outilsTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  useEffect(() => {
    if (!outilsOpen) return
    const onClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOutilsOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [outilsOpen])

  const handleOutilsEnter = () => { if (outilsTimeout.current) clearTimeout(outilsTimeout.current); setOutilsOpen(true) }
  const handleOutilsLeave = () => { outilsTimeout.current = setTimeout(() => setOutilsOpen(false), 200) }

  const prefix = isLandingPage ? "" : "/"
  const navLinks = [
    { label: "Fonctionnalités", href: `${prefix}#features` },
    { label: "Tarifs", href: `${prefix}#pricing` },
    { label: "Blog", href: "/blog" },
  ]

  return (
    <>
      {/* Backdrop mobile */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="fixed inset-0 z-[99] bg-black/10 md:hidden" onClick={() => setMobileOpen(false)} />
        )}
      </AnimatePresence>

      <div className="fixed top-0 left-0 right-0 z-[100] flex justify-center px-5 pt-4">
        <motion.nav
          animate={{
            paddingLeft: scrolled || mobileOpen ? "24px" : "16px",
            paddingRight: scrolled || mobileOpen ? "24px" : "16px",
            backgroundColor: scrolled || mobileOpen ? "rgba(255,255,255,0.98)" : "rgba(255,255,255,0)",
            borderColor: scrolled || mobileOpen ? "rgba(226,232,240,0.9)" : "rgba(255,255,255,0)",
            boxShadow: scrolled || mobileOpen ? "0 8px 32px -4px rgba(15,23,42,0.12), 0 2px 8px -2px rgba(15,23,42,0.06)" : "none",
          }}
          transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
          className={`relative z-[101] w-full max-w-5xl border py-2.5 ${mobileOpen ? "rounded-3xl" : scrolled ? "rounded-full" : "rounded-2xl"} ${scrolled ? "md:backdrop-blur-[18px]" : ""}`}
        >
          {/* Top row */}
          <div className="flex items-center justify-between">
            <Link href="/" className="flex shrink-0 items-center pl-3">
              <Image src={LOGO_URL} alt="Qonforme" width={130} height={32} className="h-[30px] w-auto object-contain" sizes="130px" priority />
            </Link>

            {/* Nav desktop */}
            <div className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-7 md:flex">
              {navLinks.map((l) => (
                <Link key={l.label} href={l.href} className="text-sm font-medium text-slate-700 transition-colors hover:text-[#0F172A]">{l.label}</Link>
              ))}
              {/* Outils dropdown */}
              <div ref={dropdownRef} className="relative" onMouseEnter={handleOutilsEnter} onMouseLeave={handleOutilsLeave}>
                <button className="inline-flex items-center gap-1 text-sm font-medium text-slate-700 transition-colors hover:text-[#0F172A]" onClick={() => setOutilsOpen((v) => !v)}>
                  Outils gratuits <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${outilsOpen ? "rotate-180" : ""}`} />
                </button>
                <AnimatePresence>
                  {outilsOpen && (
                    <motion.div initial={{ opacity: 0, y: 8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.97 }} transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }} className="absolute right-1/2 translate-x-1/2 top-full mt-3 w-[720px] rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xl shadow-slate-200/50" style={{ zIndex: 150 }}>
                      <div className="grid grid-cols-3 gap-5">
                        {OUTILS_CATEGORIES.map((cat) => (
                          <div key={cat.title}>
                            <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">{cat.title}</p>
                            <div className="flex flex-col gap-0.5">
                              {cat.items.map((item) => (
                                <Link key={item.href} href={item.href} onClick={() => setOutilsOpen(false)} className="group flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-[#EFF6FF]">
                                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F1F5F9] text-slate-500 transition-colors group-hover:bg-[#DBEAFE] group-hover:text-[#2563EB]"><item.icon className="h-4 w-4" /></span>
                                  <div className="min-w-0"><p className="text-[13px] font-semibold text-[#0F172A] leading-tight">{item.label}</p><p className="mt-0.5 text-[11px] text-slate-400 leading-tight">{item.desc}</p></div>
                                </Link>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 flex items-center justify-between rounded-xl bg-gradient-to-r from-[#EFF6FF] to-[#F5F3FF] px-4 py-3">
                        <div><p className="text-[13px] font-semibold text-[#0F172A]">Tous les outils gratuits</p><p className="text-[11px] text-slate-500">12 outils pour gérer votre activité</p></div>
                        <Link href="/outils" onClick={() => setOutilsOpen(false)} className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-3.5 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-[#1D4ED8]">Voir tout <ArrowRight className="h-3 w-3" /></Link>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Actions desktop */}
            <div className="hidden shrink-0 items-center gap-2.5 pr-3 md:flex">
              <Link href="/demo"><Button variant="ghost" className="h-8 px-3.5 text-sm font-medium text-slate-600 hover:text-[#0F172A]">Voir la démo</Button></Link>
              <Separator orientation="vertical" className="h-4 opacity-40" />
              <Link href="/signup"><ShimmerButton background="rgba(37,99,235,1)" shimmerColor="#ffffff" shimmerDuration="2.5s" borderRadius="9999px" className="h-8 px-4 text-sm font-semibold">Commencer →</ShimmerButton></Link>
            </div>

            {/* Hamburger mobile */}
            <button className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-slate-100/50 active:bg-slate-100" onClick={() => setMobileOpen((v) => !v)} aria-label="Menu">
              <AnimatePresence mode="wait">
                {mobileOpen ? (
                  <motion.span key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}><X className="h-5 w-5" /></motion.span>
                ) : (
                  <motion.span key="m" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}><Menu className="h-5 w-5" /></motion.span>
                )}
              </AnimatePresence>
            </button>
          </div>

          {/* Mobile menu — height reveal */}
          <AnimatePresence>
            {mobileOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden md:hidden"
              >
                <div className="overflow-y-auto overscroll-contain scrollbar-hide" style={{ maxHeight: "calc(100dvh - 100px)" }}>
                  <div className="mt-3 h-px bg-slate-100" />
                  <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08, duration: 0.25 }} className="pt-4 pb-3 flex flex-col gap-2">
                    <Link href="/signup" onClick={() => setMobileOpen(false)} className="block">
                      <ShimmerButton background="rgba(37,99,235,1)" shimmerColor="#ffffff" shimmerDuration="2.5s" borderRadius="14px" className="w-full h-[46px] text-[14px] font-semibold justify-center">Commencer maintenant →</ShimmerButton>
                    </Link>
                    <Link href="/login" onClick={() => setMobileOpen(false)} className="block">
                      <button className="w-full h-[40px] rounded-xl bg-slate-50 border border-slate-200/80 text-[13px] font-semibold text-[#0F172A] active:scale-[0.98] transition-all touch-manipulation">Se connecter</button>
                    </Link>
                  </motion.div>
                  <div className="h-px bg-slate-100" />
                  <nav className="flex flex-col py-2 gap-0.5">
                    {navLinks.map((l, i) => (
                      <motion.div key={l.label} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.04, duration: 0.25, ease: [0.22, 1, 0.36, 1] }}>
                        <Link href={l.href} onClick={() => setMobileOpen(false)} className="group flex items-center justify-between rounded-xl px-2 py-3 hover:bg-slate-50 active:bg-slate-100 transition-all touch-manipulation">
                          <span className="text-[15px] font-semibold text-[#0F172A]">{l.label}</span>
                          <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-[#2563EB] transition-colors" />
                        </Link>
                      </motion.div>
                    ))}
                    {/* Outils gratuits expandable */}
                    <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.22, duration: 0.25, ease: [0.22, 1, 0.36, 1] }}>
                      <div>
                        <button onClick={() => setOutilsMobileOpen((v) => !v)} className="group flex w-full items-center justify-between rounded-xl px-2 py-3 hover:bg-slate-50 active:bg-slate-100 transition-all touch-manipulation">
                          <span className="text-[15px] font-semibold text-[#0F172A]">Outils gratuits</span>
                          <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${outilsMobileOpen ? "rotate-180" : ""}`} />
                        </button>
                        <AnimatePresence>
                          {outilsMobileOpen && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }} className="overflow-hidden">
                              <div className="flex flex-col gap-0.5 px-2 pb-1">
                                {MOBILE_OUTILS.map((item) => (
                                  <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className="group flex items-center gap-2.5 rounded-lg px-3 py-2 hover:bg-slate-50 active:bg-slate-100 transition-all touch-manipulation">
                                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#EFF6FF] text-[#2563EB]"><item.icon className="h-3.5 w-3.5" /></span>
                                    <span className="text-[13px] font-medium text-slate-700">{item.label}</span>
                                  </Link>
                                ))}
                                <Link href="/outils" onClick={() => setMobileOpen(false)} className="flex items-center justify-center gap-1.5 rounded-lg bg-slate-50 px-3 py-2 mt-1 text-[12px] font-semibold text-[#2563EB] active:bg-slate-100 transition-colors touch-manipulation">
                                  Voir les 12 outils <ChevronRight className="h-3 w-3" />
                                </Link>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  </nav>
                  <div className="pb-3 pt-1"><p className="text-center text-[11px] text-slate-400">✓ Accès immédiat &nbsp;·&nbsp; ✓ Sans engagement</p></div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.nav>
      </div>
    </>
  )
}
