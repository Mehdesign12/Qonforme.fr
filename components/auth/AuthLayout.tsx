import Image from "next/image"
import Link from "next/link"

// ✅ URLs correctes (vérifiées sur la landing page)
const LOGO_LONG_BLEU = "https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Logo%20long%20bleu.webp"
const PICTO_Q        = "https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Logo%20bleu%20Qonforme%20PNG.webp"

interface AuthLayoutProps {
  children: React.ReactNode
  /** largeur de la carte centrale (défaut max-w-md = 448 px) */
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl"
}

const widthMap = {
  sm:  "max-w-sm",
  md:  "max-w-md",
  lg:  "max-w-lg",
  xl:  "max-w-xl",
  "2xl": "max-w-2xl",
}

export default function AuthLayout({ children, maxWidth = "md" }: AuthLayoutProps) {
  return (
    /* ── Viewport complet avec support safe-area iOS/Android ───────────── */
    <div
      className="relative flex flex-col items-center justify-center overflow-x-hidden"
      style={{
        minHeight: "100dvh",           /* dvh = dynamic viewport height (iOS Safari) */
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }}
    >

      {/* ── Fond dégradé bleu statique ─────────────────────────────────── */}
      <div
        aria-hidden
        className="pointer-events-none select-none absolute inset-0 z-0"
        style={{
          background:
            "linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 30%, #EEF2FF 60%, #F0F9FF 85%, #F8FAFC 100%)",
        }}
      />

      {/* ── Tache lumineuse bleue haut-gauche ──────────────────────────── */}
      <div
        aria-hidden
        className="pointer-events-none select-none absolute -top-32 -left-32 z-0 w-[480px] h-[480px] rounded-full"
        style={{
          background:
            "radial-gradient(circle at center, rgba(37,99,235,0.13) 0%, rgba(37,99,235,0.04) 55%, transparent 75%)",
        }}
      />

      {/* ── Tache lumineuse bleue bas-droite ───────────────────────────── */}
      <div
        aria-hidden
        className="pointer-events-none select-none absolute -bottom-24 -right-24 z-0 w-[420px] h-[420px] rounded-full"
        style={{
          background:
            "radial-gradient(circle at center, rgba(99,102,241,0.10) 0%, rgba(37,99,235,0.04) 50%, transparent 72%)",
        }}
      />

      {/* ── Grille de points décorative (subtile) ──────────────────────── */}
      <div
        aria-hidden
        className="pointer-events-none select-none absolute inset-0 z-0"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(37,99,235,0.08) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
          maskImage:
            "radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)",
        }}
      />

      {/* ── Picto Q filigrane — centré en fond, très grand ─────────────── */}
      <div
        aria-hidden
        className="pointer-events-none select-none absolute inset-0 z-0 flex items-center justify-center"
        style={{ opacity: 0.055 }}
      >
        <Image
          src={PICTO_Q}
          alt=""
          width={700}
          height={700}
          className="w-[380px] sm:w-[520px] lg:w-[700px]"
          priority
        />
      </div>

      {/* ── Picto Q supplémentaire — coin bas-droite desktop ───────────── */}
      <div
        aria-hidden
        className="pointer-events-none select-none hidden lg:block absolute right-[-60px] bottom-[-60px] z-0"
        style={{ opacity: 0.07 }}
      >
        <Image
          src={PICTO_Q}
          alt=""
          width={320}
          height={320}
          className="w-[280px]"
          loading="lazy"
        />
      </div>

      {/* ── Contenu principal ────────────────────────────────────────────── */}
      <div
        className={`relative z-10 w-full ${widthMap[maxWidth]}`}
        style={{ padding: "clamp(16px, 4vw, 40px) clamp(16px, 5vw, 32px)" }}
      >

        {/* Logo */}
        <div className="flex justify-center mb-6 sm:mb-8">
          <Link href="/" className="block" aria-label="Retour à l'accueil">
            <Image
              src={LOGO_LONG_BLEU}
              alt="Qonforme"
              width={180}
              height={44}
              className="h-9 sm:h-10 w-auto drop-shadow-sm"
              priority
            />
          </Link>
        </div>

        {children}
      </div>
    </div>
  )
}
