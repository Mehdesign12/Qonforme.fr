"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Shield, Zap, Play, Lock, Star } from "lucide-react";
import { motion } from "motion/react";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { LightRays } from "@/components/ui/light-rays";
import { PublicHeader } from "@/components/layout/PublicHeader";

/* Picto Q filigrane */
const PICTO_Q_URL =
  "https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Logo%20bleu%20Qonforme%20PNG.webp";

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

          {/* Accroche principale */}
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

          {/* Sous-titre */}
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

          {/* Double CTA hero */}
          <motion.div
            className="flex flex-wrap items-center justify-center gap-3 pt-1 md:justify-start"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.27, duration: 0.5 }}
          >
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
            className="flex flex-col items-center gap-3 pt-2 md:items-start"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.34, duration: 0.5 }}
          >
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

            <div className="flex flex-wrap justify-center gap-2 md:justify-start">
              {[
                { icon: <Zap className="h-3 w-3" />, label: "Accès immédiat", color: "text-[#2563EB]", bg: "bg-[#EFF6FF]", border: "border-[#BFDBFE]/60" },
                { icon: <Shield className="h-3 w-3" />, label: "Conforme réglementation", color: "text-[#059669]", bg: "bg-[#ECFDF5]", border: "border-[#A7F3D0]/60" },
                { icon: <Lock className="h-3 w-3" />, label: "Sans engagement", color: "text-slate-500", bg: "bg-white/70", border: "border-slate-200/70" },
              ].map((b) => (
                <span key={b.label} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${b.color} ${b.bg} ${b.border}`}>
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
      <PublicHeader isLandingPage />

      <div
        className="relative w-full"
        style={{
          background:
            "linear-gradient(125deg, #EFF6FF 0%, #EEF2FF 20%, #F5F3FF 35%, #E0F2FE 50%, #EFF6FF 65%, #F0FDF4 80%, #EEF2FF 100%)",
        }}
      >
        {/* Desktop only — dégradé riche + effets lumineux */}
        <div className="pointer-events-none absolute inset-0 hidden md:block">
          <div aria-hidden className="absolute inset-0" style={{ background: "linear-gradient(160deg, #EFF6FF 0%, #EEF2FF 20%, #F5F3FF 38%, #E0F2FE 55%, #EFF6FF 75%, #F8FAFC 100%)" }} />
          <div aria-hidden className="absolute inset-0" style={{ background: "radial-gradient(ellipse 65% 45% at 15% -5%, rgba(37,99,235,0.09) 0%, transparent 55%), radial-gradient(ellipse 45% 35% at 85% 0%, rgba(124,58,237,0.07) 0%, transparent 50%)" }} />
          <LightRays count={8} color="rgba(99, 155, 235, 0.55)" blur={28} speed={12} length="120vh" className="z-0" />
        </div>

        {/* Picto Q filigrane — mobile */}
        <div aria-hidden className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center md:hidden" style={{ opacity: 0.07 }}>
          <Image src={PICTO_Q_URL} alt="" width={300} height={300} className="w-[280px] select-none" sizes="280px" loading="lazy" />
        </div>

        {/* Picto Q filigrane — desktop */}
        <div aria-hidden className="pointer-events-none absolute right-[-60px] top-[50px] z-[1] hidden lg:block" style={{ opacity: 0.06 }}>
          <Image src={PICTO_Q_URL} alt="" width={480} height={480} className="w-[420px] select-none" sizes="420px" loading="lazy" />
        </div>

        <div className="relative z-10">
          <Hero />
        </div>

        {/* Fade blanc en bas */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-40" style={{ background: "linear-gradient(to bottom, transparent 0%, #ffffff 100%)" }} />
      </div>
    </>
  );
}
