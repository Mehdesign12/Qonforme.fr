import type { Metadata } from "next"
import Link from "next/link"
import {
  Download, Upload, CheckCircle2, ExternalLink,
  FileCode, BookOpen, ArrowRight, AlertCircle,
} from "lucide-react"

export const metadata: Metadata = { title: "Guide de transmission — Qonforme" }
export const dynamic = "force-dynamic"

/* ── Données ── */
const STEPS = [
  {
    n: "01",
    icon: FileCode,
    color: "#2563EB",
    bg: "#EFF6FF",
    border: "#BFDBFE",
    title: "Créez ou ouvrez une facture",
    desc: "Rendez-vous dans la section Factures et ouvrez la facture que vous souhaitez transmettre. Elle doit être au statut différent de « Brouillon ».",
    tip: null,
  },
  {
    n: "02",
    icon: Download,
    color: "#2563EB",
    bg: "#EFF6FF",
    border: "#BFDBFE",
    title: "Téléchargez votre Factur-X",
    desc: "Cliquez sur le bouton « Factur-X » dans la barre d'actions de la facture. Un fichier XML certifié EN 16931 EXTENDED est généré et téléchargé instantanément.",
    tip: "Ce fichier XML est votre facture électronique structurée, conforme à la réglementation française et européenne.",
  },
  {
    n: "03",
    icon: Upload,
    color: "#059669",
    bg: "#ECFDF5",
    border: "#A7F3D0",
    title: "Transmettez via votre Plateforme Agréée",
    desc: "Connectez-vous à votre Plateforme Agréée (PA) — Chorus Pro si votre client est une administration publique, ou l'une des 137 PA immatriculées pour le B2B privé — et importez votre fichier XML.",
    tip: null,
  },
  {
    n: "04",
    icon: CheckCircle2,
    color: "#059669",
    bg: "#ECFDF5",
    border: "#A7F3D0",
    title: "Confirmez la transmission",
    desc: "Une fois la facture importée sur votre PA, celle-ci vous confirme la bonne réception. Revenez sur Qonforme et mettez à jour le statut de la facture.",
    tip: null,
  },
]

const PLATFORMS = [
  {
    name: "Chorus Pro",
    desc: "Obligatoire pour les factures destinées à l'État et aux collectivités (B2G).",
    url: "https://chorus-pro.gouv.fr",
    color: "#1E40AF",
    bg: "#EFF6FF",
    border: "#BFDBFE",
    badge: "B2G · Gratuit",
  },
  {
    name: "Portail Public de Facturation",
    desc: "Le PPF de la DGFiP, également accessible pour les entreprises assujetties à la TVA.",
    url: "https://portail-facturation.gouv.fr",
    color: "#065F46",
    bg: "#ECFDF5",
    border: "#A7F3D0",
    badge: "B2B · Gratuit",
  },
  {
    name: "IOPOLE",
    desc: "Plateforme Agréée API-first, pensée pour les entreprises et les éditeurs de logiciels.",
    url: "https://www.iopole.com",
    color: "#7C3AED",
    bg: "#F5F3FF",
    border: "#DDD6FE",
    badge: "B2B · Payant",
  },
  {
    name: "Liste complète des 137 PA",
    desc: "Consulter la liste officielle de toutes les Plateformes Agréées immatriculées par la DGFiP.",
    url: "https://www.impots.gouv.fr/facturation-electronique-et-plateformes-agreees",
    color: "#0F172A",
    bg: "#F8FAFC",
    border: "#E2E8F0",
    badge: "Annuaire officiel",
  },
]

/* ═══════════════════════════════════════════════════════════════════ */

export default function PPFGuidePage() {
  return (
    <div className="max-w-2xl space-y-8 animate-fade-in">

      {/* ── En-tête ── */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EFF6FF] border border-[#BFDBFE]">
            <BookOpen className="w-4 h-4 text-[#2563EB]" />
          </div>
          <div>
            <h1 className="text-[15px] font-bold text-[#0F172A] dark:text-[#E2E8F0] leading-tight">
              Guide de transmission PPF
            </h1>
            <p className="text-[12px] text-slate-400">Conformité réglementation 2026</p>
          </div>
        </div>
        <p className="text-[13px] text-slate-500 leading-relaxed">
          Qonforme génère votre Factur-X certifié EN 16931. Il vous suffit ensuite
          de le transmettre via votre Plateforme Agréée — 4 étapes, moins de 2 minutes.
        </p>
      </div>

      {/* ── Étapes ── */}
      <div className="space-y-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
          Les 4 étapes
        </p>

        {STEPS.map((step, i) => {
          const Icon = step.icon
          return (
            <div
              key={i}
              className="flex gap-4 rounded-2xl border p-4 bg-white dark:bg-[#0F1E35] dark:border-[#1E3A5F] shadow-sm"
            >
              {/* Numéro + icône */}
              <div className="flex flex-col items-center gap-1.5 shrink-0">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-xl border"
                  style={{ background: step.bg, borderColor: step.border }}
                >
                  <Icon className="w-4 h-4" style={{ color: step.color }} />
                </div>
                {i < STEPS.length - 1 && (
                  <div className="w-px flex-1 bg-gradient-to-b from-[#E2E8F0] to-transparent min-h-[16px]" />
                )}
              </div>

              {/* Contenu */}
              <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="text-[10px] font-bold tracking-wider"
                    style={{ color: step.color }}
                  >
                    ÉTAPE {step.n}
                  </span>
                </div>
                <p className="text-[13px] font-semibold text-[#0F172A] dark:text-[#E2E8F0] mb-1">
                  {step.title}
                </p>
                <p className="text-[12px] text-slate-500 leading-relaxed">
                  {step.desc}
                </p>
                {step.tip && (
                  <div className="mt-2 flex items-start gap-2 rounded-xl bg-[#EFF6FF] border border-[#BFDBFE] px-3 py-2">
                    <AlertCircle className="w-3.5 h-3.5 text-[#2563EB] shrink-0 mt-0.5" />
                    <p className="text-[11px] text-[#1E40AF]">{step.tip}</p>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Plateformes ── */}
      <div className="space-y-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
          Plateformes Agréées compatibles
        </p>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {PLATFORMS.map((platform) => (
            <a
              key={platform.name}
              href={platform.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-start gap-3 rounded-2xl border p-4 bg-white dark:bg-[#0F1E35] dark:border-[#1E3A5F] shadow-sm hover:shadow-md transition-shadow"
              style={{ borderColor: platform.border }}
            >
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-extrabold text-white"
                style={{ background: platform.color }}
              >
                {platform.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                  <p className="text-[13px] font-semibold text-[#0F172A] dark:text-[#E2E8F0]">
                    {platform.name}
                  </p>
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: platform.bg, color: platform.color, border: `1px solid ${platform.border}` }}
                  >
                    {platform.badge}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">{platform.desc}</p>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 transition-colors shrink-0 mt-1" />
            </a>
          ))}
        </div>
      </div>

      {/* ── CTA vers les factures ── */}
      <div
        className="rounded-2xl p-5 flex items-center justify-between gap-4"
        style={{
          background: "linear-gradient(135deg, rgba(239,246,255,0.98) 0%, rgba(219,234,254,0.92) 100%)",
          border: "1px solid rgba(147,197,253,0.5)",
        }}
      >
        <div>
          <p className="text-[13px] font-bold text-[#1E40AF]">
            Prêt à télécharger votre premier Factur-X ?
          </p>
          <p className="text-[12px] text-[#2563EB]/70 mt-0.5">
            Ouvrez n&apos;importe quelle facture émise et cliquez sur « Factur-X ».
          </p>
        </div>
        <Link
          href="/invoices"
          className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] active:bg-[#1E40AF] text-white text-[12px] font-bold px-3.5 py-2 transition-colors shadow-sm touch-manipulation whitespace-nowrap"
        >
          Mes factures
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

    </div>
  )
}
