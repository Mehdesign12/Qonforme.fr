"use client"

import Image from "next/image"
import { motion } from "motion/react"
import type { ReactNode } from "react"

const PICTO_Q_URL =
  "https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Logo%20bleu%20Qonforme%20PNG.webp"

interface OutilsHeroProps {
  icon: ReactNode
  iconBg?: string
  title: ReactNode
  subtitle: string
  badge?: string
}

/**
 * Hero partagé pour toutes les pages /outils.
 * Gradient signature Qonforme + picto Q en filigrane.
 */
export function OutilsHero({ icon, iconBg = "bg-blue-50 text-[#2563EB]", title, subtitle, badge }: OutilsHeroProps) {
  return (
    <div
      className="relative w-full overflow-hidden"
      style={{
        background:
          "linear-gradient(125deg, #EFF6FF 0%, #EEF2FF 20%, #F5F3FF 35%, #E0F2FE 50%, #EFF6FF 65%, #F0FDF4 80%, #EEF2FF 100%)",
      }}
    >
      {/* Lueurs radiales */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 hidden md:block"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 20% -10%, rgba(37,99,235,0.08) 0%, transparent 55%), " +
            "radial-gradient(ellipse 40% 40% at 80% 0%, rgba(124,58,237,0.06) 0%, transparent 50%)",
        }}
      />

      {/* Picto Q filigrane — mobile centré */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center md:hidden"
        style={{ opacity: 0.05 }}
      >
        <Image
          src={PICTO_Q_URL}
          alt=""
          width={240}
          height={240}
          className="w-[200px] select-none"
          sizes="200px"
          loading="lazy"
        />
      </div>

      {/* Picto Q filigrane — desktop droite */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 top-0 z-[1] hidden md:block"
        style={{ opacity: 0.04 }}
      >
        <Image
          src={PICTO_Q_URL}
          alt=""
          width={350}
          height={350}
          className="w-[300px] select-none"
          sizes="300px"
          loading="lazy"
        />
      </div>

      {/* Contenu */}
      <div className="relative z-10 mx-auto max-w-3xl px-5 pb-10 pt-24 text-center sm:pb-14 sm:pt-28">
        {/* Badge */}
        {badge && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mb-4"
          >
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#BFDBFE] bg-white/70 px-3 py-1 text-[12px] font-semibold text-[#2563EB]">
              {badge}
            </span>
          </motion.div>
        )}

        {/* Icone */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl shadow-sm ${iconBg}`}
        >
          {icon}
        </motion.div>

        {/* Titre */}
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="text-[1.7rem] font-extrabold leading-tight tracking-[-0.02em] text-[#0F172A] sm:text-[2.1rem] lg:text-[2.4rem]"
          style={{ fontFamily: "var(--font-bricolage)" }}
        >
          {title}
        </motion.h1>

        {/* Sous-titre */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16, duration: 0.5 }}
          className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-slate-500 sm:text-base"
        >
          {subtitle}
        </motion.p>
      </div>

      {/* Fade bas */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-20"
        style={{
          background: "linear-gradient(to bottom, transparent 0%, #F8FAFC 100%)",
        }}
      />
    </div>
  )
}
