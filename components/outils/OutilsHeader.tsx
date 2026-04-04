"use client"

import Link from "next/link"
import Image from "next/image"
import { useState, useEffect } from "react"
import { ArrowLeft, ChevronRight } from "lucide-react"
import { motion } from "motion/react"
import { ShimmerButton } from "@/components/ui/shimmer-button"

const LOGO_URL =
  "https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Logo%20long%20bleu.webp"

interface OutilsHeaderProps {
  breadcrumb: string
}

/**
 * Header pill partagé pour toutes les pages /outils.
 * Réplique l'animation de la landing : transparent → pill blanche au scroll.
 */
export function OutilsHeader({ breadcrumb }: OutilsHeaderProps) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] flex justify-center px-4 pt-3 sm:px-5 sm:pt-4">
      <motion.nav
        animate={{
          borderRadius: scrolled ? "9999px" : "16px",
          paddingLeft: scrolled ? "20px" : "12px",
          paddingRight: scrolled ? "20px" : "12px",
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
        className={`flex w-full max-w-4xl items-center justify-between border py-2.5 ${scrolled ? "md:backdrop-blur-[18px]" : ""}`}
      >
        {/* Logo */}
        <Link href="/" className="flex shrink-0 items-center pl-2 sm:pl-3">
          <Image
            src={LOGO_URL}
            alt="Qonforme"
            width={120}
            height={30}
            className="h-[26px] w-auto object-contain sm:h-[30px]"
            sizes="120px"
            priority
          />
        </Link>

        {/* Breadcrumb desktop */}
        <div className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1.5 text-[13px] md:flex">
          <Link
            href="/outils"
            className="font-medium text-slate-400 transition-colors hover:text-[#2563EB]"
          >
            Outils gratuits
          </Link>
          {breadcrumb && (
            <>
              <ChevronRight className="h-3 w-3 text-slate-300" />
              <span className="font-semibold text-slate-700">{breadcrumb}</span>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-2 pr-1 sm:pr-3">
          {/* Back mobile */}
          <Link
            href="/outils"
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-[#0F172A] md:hidden"
            aria-label="Retour"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          {/* CTA */}
          <Link href="/signup" className="hidden sm:block">
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
          <Link
            href="/signup"
            className="sm:hidden rounded-full bg-[#2563EB] px-3.5 py-1.5 text-[13px] font-semibold text-white"
          >
            Commencer
          </Link>
        </div>
      </motion.nav>
    </div>
  )
}
