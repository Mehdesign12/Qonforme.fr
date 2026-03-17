'use client'

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import Image from "next/image"
import Link from "next/link"
import { FileText, Receipt, ShoppingCart, Users, ArrowLeft, FileX } from "lucide-react"

const LOGO_URL =
  "https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Logo%20long%20bleu.webp"
const LOGO_URL_DARK =
  "https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Logo%20long%20simple.png"

const floatingIcons = [
  { Icon: FileText,    top: "12%",  left: "8%",   size: 22, opacity: 0.18, rotate: "-15deg" },
  { Icon: Receipt,     top: "18%",  right: "10%", size: 18, opacity: 0.14, rotate: "12deg"  },
  { Icon: ShoppingCart,top: "70%",  left: "6%",   size: 20, opacity: 0.15, rotate: "-8deg"  },
  { Icon: Users,       top: "75%",  right: "7%",  size: 22, opacity: 0.16, rotate: "10deg"  },
  { Icon: FileText,    top: "45%",  left: "3%",   size: 16, opacity: 0.10, rotate: "20deg"  },
  { Icon: Receipt,     top: "55%",  right: "4%",  size: 16, opacity: 0.10, rotate: "-18deg" },
]

export default function NotFound() {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const isDark = mounted && resolvedTheme === "dark"

  return (
    <div
      className="relative min-h-[100dvh] flex flex-col items-center justify-center overflow-hidden px-6"
      style={{ background: "var(--dashboard-bg)" }}
    >
      {/* Blobs décoratifs */}
      <div
        aria-hidden
        className="pointer-events-none fixed top-0 right-0 w-[600px] h-[600px] z-0"
        style={{ background: "var(--dashboard-blob1)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed bottom-0 left-0 w-[400px] h-[400px] z-0"
        style={{ background: "var(--dashboard-blob2)" }}
      />

      {/* Icônes flottantes */}
      {floatingIcons.map(({ Icon, top, left, right, size, opacity, rotate }, i) => (
        <div
          key={i}
          aria-hidden
          className="pointer-events-none fixed z-0 text-blue-500"
          style={{
            top, left, right,
            opacity,
            transform: `rotate(${rotate})`,
          }}
        >
          <Icon size={size} />
        </div>
      ))}

      {/* Contenu principal */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-md w-full">

        {/* Logo */}
        <div className="mb-10">
          {mounted ? (
            <Image
              src={isDark ? LOGO_URL_DARK : LOGO_URL}
              alt="Qonforme"
              width={160}
              height={40}
              className="h-9 w-auto"
              sizes="160px"
              priority
            />
          ) : (
            <div className="h-9 w-40 rounded bg-blue-100/60" />
          )}
        </div>

        {/* Picto 404 */}
        <div className="relative mb-6 flex items-center justify-center">
          {/* Grand nombre 404 */}
          <span
            className="text-[120px] md:text-[160px] font-black leading-none select-none"
            style={{
              background: "linear-gradient(135deg, #2563EB 0%, #60A5FA 50%, #A5B4FC 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              letterSpacing: "-0.04em",
            }}
          >
            404
          </span>
          {/* Icône document barré posée sur le 0 */}
          <div
            className="absolute flex items-center justify-center rounded-2xl"
            style={{
              width: 52,
              height: 52,
              background: "linear-gradient(135deg, #DBEAFE, #EFF6FF)",
              border: "1.5px solid rgba(37,99,235,0.18)",
              boxShadow: "0 4px 16px rgba(37,99,235,0.14)",
              bottom: 18,
            }}
          >
            <FileX size={26} className="text-blue-500" />
          </div>
        </div>

        {/* Titre */}
        <h1
          className="text-2xl md:text-3xl font-bold mb-3"
          style={{ color: "var(--foreground)" }}
        >
          Page introuvable
        </h1>

        {/* Description */}
        <p
          className="text-sm md:text-base mb-8 leading-relaxed"
          style={{ color: "var(--muted-foreground)" }}
        >
          La page que vous cherchez n&apos;existe pas ou a été déplacée.
          <br className="hidden sm:block" />
          Retournez à l&apos;accueil pour continuer.
        </p>

        {/* CTA */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white transition-transform active:scale-95"
          style={{
            background: "linear-gradient(135deg, #2563EB, #1D4ED8)",
            boxShadow: "0 2px 14px rgba(37,99,235,0.35)",
          }}
        >
          <ArrowLeft size={16} />
          Retour à l&apos;accueil
        </Link>

        {/* Lien secondaire vers le dashboard si connecté */}
        <Link
          href="/dashboard"
          className="mt-4 text-xs underline underline-offset-4 transition-opacity hover:opacity-80"
          style={{ color: "var(--muted-foreground)" }}
        >
          Aller au tableau de bord
        </Link>
      </div>

      {/* Filet bas de page */}
      <p
        className="absolute bottom-6 text-xs z-10"
        style={{ color: "var(--muted-foreground)", opacity: 0.5 }}
      >
        © {new Date().getFullYear()} Qonforme — Facturation professionnelle
      </p>
    </div>
  )
}
