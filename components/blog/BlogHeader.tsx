"use client"

import Link from "next/link"
import Image from "next/image"
import { useState, useEffect } from "react"
import { Menu, X } from "lucide-react"
import { motion } from "motion/react"
import { Sheet, SheetContent, SheetTrigger, SheetClose } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { ShimmerButton } from "@/components/ui/shimmer-button"

const LOGO_URL =
  "https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Logo%20long%20bleu.webp"
const PICTO_Q_URL =
  "https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Logo%20bleu%20Qonforme%20PNG.webp"

interface BlogHeaderProps {
  showBackLink?: boolean
}

export default function BlogHeader({ showBackLink }: BlogHeaderProps) {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const navLinks = [
    { label: "Accueil", href: "/" },
    { label: "Blog", href: "/blog" },
    { label: "Tarifs", href: "/pricing" },
    { label: "Démo", href: "/demo" },
  ]

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] flex justify-center px-5 pt-4">
      <motion.nav
        animate={{
          borderRadius: scrolled ? "9999px" : "16px",
          paddingLeft: scrolled ? "24px" : "16px",
          paddingRight: scrolled ? "24px" : "16px",
          backgroundColor: scrolled
            ? "rgba(255,255,255,0.96)"
            : "rgba(255,255,255,0.96)",
          borderColor: scrolled
            ? "rgba(226,232,240,0.9)"
            : "rgba(226,232,240,0.5)",
          boxShadow: scrolled
            ? "0 8px 32px -4px rgba(15,23,42,0.12), 0 2px 8px -2px rgba(15,23,42,0.06)"
            : "0 1px 4px rgba(15,23,42,0.04)",
        }}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
        className={`flex w-full max-w-5xl items-center justify-between border py-2.5 ${scrolled ? "md:backdrop-blur-[18px]" : ""}`}
      >
        {/* Logo */}
        <div className="flex shrink-0 items-center gap-3 pl-3">
          <Link href="/" className="flex items-center">
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
          {showBackLink && (
            <>
              <Separator orientation="vertical" className="h-4 opacity-30 hidden sm:block" />
              <Link
                href="/blog"
                className="hidden sm:inline text-[13px] font-medium text-slate-400 hover:text-[#2563EB] transition-colors"
              >
                ← Articles
              </Link>
            </>
          )}
        </div>

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

        {/* Actions desktop */}
        <div className="hidden shrink-0 items-center gap-2.5 pr-3 md:flex">
          <Link href="/demo">
            <Button
              variant="ghost"
              className="h-8 px-3.5 text-sm font-medium text-slate-600 hover:text-[#0F172A]"
            >
              Voir la démo
            </Button>
          </Link>
          <Separator orientation="vertical" className="h-4 opacity-40" />
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

          <SheetContent
            side="right"
            showCloseButton={false}
            className="!w-full !max-w-full !z-[200] p-0 overflow-hidden border-none"
            style={{
              background:
                "linear-gradient(145deg, #EFF6FF 0%, #EEF2FF 28%, #F5F3FF 52%, #E0F2FE 72%, #EFF6FF 100%)",
            }}
          >
            {/* Q filigrane */}
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

            <div className="relative z-10 flex flex-col h-full">
              {/* Header drawer : logo + fermer */}
              <div
                className="flex items-center justify-between px-6 border-b border-white/60 shrink-0"
                style={{ paddingTop: "max(20px, env(safe-area-inset-top, 20px))", paddingBottom: "18px" }}
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
                      className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/70 border border-white/60 text-slate-500 shadow-sm active:scale-95 transition-all touch-manipulation"
                      aria-label="Fermer le menu"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  }
                />
              </div>

              {/* Liens de navigation */}
              <nav className="flex flex-col px-4 pt-5 pb-2 gap-0.5 shrink-0">
                {showBackLink && (
                  <Link
                    href="/blog"
                    onClick={() => setMobileOpen(false)}
                    className="group flex items-center justify-between rounded-2xl px-5 py-[17px] bg-white/30 hover:bg-white/50 active:bg-white/70 transition-all touch-manipulation mb-1"
                  >
                    <span className="text-[18px] font-semibold text-[#2563EB]">← Tous les articles</span>
                  </Link>
                )}
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

              {/* CTAs */}
              <div className="px-5 pt-5 flex flex-col gap-3 shrink-0">
                <Link href="/login" onClick={() => setMobileOpen(false)} className="block">
                  <button className="w-full h-[52px] rounded-2xl bg-white/80 border border-white/80 text-[15px] font-semibold text-[#0F172A] shadow-sm active:scale-[0.98] transition-all touch-manipulation">
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
                <p className="text-center text-[11px] text-slate-400 pt-0.5 whitespace-nowrap">
                  ✓ Accès immédiat &nbsp;·&nbsp; ✓ Sans engagement
                </p>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </motion.nav>
    </div>
  )
}
