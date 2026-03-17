import Image from "next/image"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

const LOGO_LONG_BLEU = "https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Logo%20long%20bleu.webp"
const PICTO_Q        = "https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Logo%20bleu%20Qonforme%20PNG.webp"

interface LegalLayoutProps {
  children:     React.ReactNode
  title:        string
  subtitle:     string
  lastUpdated:  string
}

export function LegalLayout({ children, title, subtitle, lastUpdated }: LegalLayoutProps) {
  return (
    <div
      className="relative min-h-screen overflow-x-hidden"
      style={{
        background: "linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 30%, #EEF2FF 60%, #F0F9FF 85%, #F8FAFC 100%)",
      }}
    >
      {/* ── Fonds décoratifs ── */}
      <div
        aria-hidden
        className="pointer-events-none select-none absolute -top-32 -left-32 z-0 w-[480px] h-[480px] rounded-full"
        style={{ background: "radial-gradient(circle at center, rgba(37,99,235,0.10) 0%, rgba(37,99,235,0.03) 55%, transparent 75%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none select-none absolute top-1/2 -right-24 z-0 w-[420px] h-[420px] rounded-full"
        style={{ background: "radial-gradient(circle at center, rgba(99,102,241,0.08) 0%, transparent 70%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none select-none absolute inset-0 z-0"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(37,99,235,0.06) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
          maskImage: "radial-gradient(ellipse 90% 90% at 50% 30%, black 40%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 90% 90% at 50% 30%, black 40%, transparent 100%)",
        }}
      />
      {/* Picto Q filigrane */}
      <div
        aria-hidden
        className="pointer-events-none select-none absolute right-[-80px] bottom-[-80px] z-0 hidden lg:block"
        style={{ opacity: 0.055 }}
      >
        <Image src={PICTO_Q} alt="" width={400} height={400} loading="lazy" />
      </div>

      {/* ── Barre header ── */}
      <header className="relative z-10 border-b border-[#BFDBFE]/50 bg-white/60" style={{ backdropFilter: undefined }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" aria-label="Retour à l'accueil">
            <Image
              src={LOGO_LONG_BLEU}
              alt="Qonforme"
              width={150}
              height={37}
              className="h-8 w-auto"
              priority
            />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#2563EB] hover:text-[#1D4ED8] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Retour au site
          </Link>
        </div>
      </header>

      {/* ── Contenu ── */}
      <main className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-14">

        {/* En-tête de la page */}
        <div className="mb-10">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-1 text-[13px] font-medium text-[#2563EB] mb-4">
            <span className="h-1.5 w-1.5 rounded-full bg-[#2563EB]" />
            Informations légales
          </span>
          <h1
            className="text-3xl sm:text-4xl font-extrabold text-[#0F172A] leading-tight tracking-tight mb-2"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            {title}
          </h1>
          <p className="text-[15px] text-slate-500">{subtitle}</p>
          <p className="text-[12px] text-slate-400 mt-1">Dernière mise à jour : {lastUpdated}</p>
        </div>

        {/* Corps de texte */}
        <div
          className="rounded-2xl border border-white/70 bg-white/80 p-6 sm:p-10 shadow-[0_8px_32px_rgba(37,99,235,0.07)]"
        >
          <div className="legal-content">
            {children}
          </div>
        </div>

        {/* Pied de page de la carte */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[13px] text-slate-400">
          <p>© {new Date().getFullYear()} Qonforme. Tous droits réservés.</p>
          <div className="flex items-center gap-4">
            <Link href="/mentions-legales" className="hover:text-[#2563EB] transition-colors">Mentions légales</Link>
            <Link href="/cgu" className="hover:text-[#2563EB] transition-colors">CGU</Link>
            <Link href="/login" className="hover:text-[#2563EB] transition-colors">Connexion</Link>
          </div>
        </div>
      </main>
    </div>
  )
}
