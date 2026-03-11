import Image from "next/image"
import Link from "next/link"

const LOGO_LONG_BLEU = "https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Logo%20long%20bleu%20Qonforme.webp"
const PICTO_Q        = "https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Logo%20bleu%20Qonforme%20PNG.webp"

interface AuthLayoutProps {
  children: React.ReactNode
  /** largeur de la carte centrale (défaut max-w-md = 448 px) */
  maxWidth?: "sm" | "md" | "lg"
}

const widthMap = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
}

export default function AuthLayout({ children, maxWidth = "md" }: AuthLayoutProps) {
  return (
    <div className="relative min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4 py-10 overflow-hidden">

      {/* ── Q filigrane droit (desktop uniquement) ───────────────────── */}
      <div
        aria-hidden
        className="pointer-events-none select-none hidden lg:block absolute right-0 top-1/2 -translate-y-1/2 -translate-x-4"
        style={{ opacity: 0.07, zIndex: 0 }}
      >
        <Image
          src={PICTO_Q}
          alt=""
          width={420}
          height={420}
          className="w-[380px]"
          unoptimized
        />
      </div>

      {/* ── Contenu ─────────────────────────────────────────────────────── */}
      <div className={`relative z-10 w-full ${widthMap[maxWidth]}`}>

        {/* Logo */}
        <div className="flex justify-center mb-7">
          <Link href="/" className="block" aria-label="Retour à l'accueil">
            <Image
              src={LOGO_LONG_BLEU}
              alt="Qonforme"
              width={160}
              height={40}
              className="h-9 w-auto"
              priority
              unoptimized
            />
          </Link>
        </div>

        {children}
      </div>
    </div>
  )
}
