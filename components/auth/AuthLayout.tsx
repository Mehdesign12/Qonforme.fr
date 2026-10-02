import AuthLogo from "@/components/auth/AuthLogo"
import StepIndicator from "@/components/auth/StepIndicator"
import { cn } from "@/lib/utils"

/**
 * Coque des pages d'accès (connexion, inscription, mot de passe, entreprise,
 * formule), au design du canevas :
 *  - par défaut (« Connexion », « Onb-1-Inscription ») : colonne blanche avec
 *    le logo et le formulaire, `aside` à droite sur fond #F6F8FB (≥ lg) ;
 *    sans `aside`, une seule colonne centrée ;
 *  - avec `bar` (« Onb-2-Entreprise », « Onb-7-Bienvenue ») : barre blanche en
 *    haut (logo, étapes, lien à droite), contenu centré sur le fond.
 * Ni backdrop-filter ni will-change (règle iOS de CLAUDE.md) ; couleurs par
 * les jetons --q-*, thème sombre compris.
 */
interface AuthLayoutProps {
  children: React.ReactNode
  /** Colonne de droite, affichée à partir de 1024 px. */
  aside?: React.ReactNode
  /** Barre du haut : étapes de l'inscription et lien à droite. */
  bar?: {
    steps?: { label: string }[]
    current?: number
    right?: React.ReactNode
    logoHref?: string
  }
  /** Largeur de la colonne de contenu (défaut md = 448 px, 400 px avec `aside`). */
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "wide"
}

const widthMap = {
  sm:  "max-w-sm",
  md:  "max-w-md",
  lg:  "max-w-lg",
  xl:  "max-w-xl",
  "2xl": "max-w-[680px]",
  wide: "max-w-[1080px]",
}

/** Encoches et barre d'accueil iOS/Android (dvh = hauteur dynamique de Safari). */
const SAFE_AREA: React.CSSProperties = {
  minHeight: "100dvh",
  paddingTop: "env(safe-area-inset-top)",
  paddingBottom: "env(safe-area-inset-bottom)",
  paddingLeft: "env(safe-area-inset-left)",
  paddingRight: "env(safe-area-inset-right)",
}

/** Halo bleu discret en haut de page (fond mobile du canevas « Mobile-connexion »). */
function Glow({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-x-0 top-0 h-[420px]", className)}
      style={{ background: "var(--q-glow)" }}
    />
  )
}

export default function AuthLayout({ children, aside, bar, maxWidth = "md" }: AuthLayoutProps) {
  /* ── Barre du haut + contenu centré ─────────────────────────────────── */
  if (bar) {
    return (
      <div className="relative flex flex-col bg-q-bg" style={SAFE_AREA}>
        <header className="relative z-10 grid grid-cols-[1fr_auto] items-center gap-4 border-b border-q-line-soft bg-q-surface px-4 py-3.5 sm:px-[clamp(16px,3vw,32px)] md:grid-cols-[1fr_auto_1fr] md:py-4">
          <div className="justify-self-start">
            <AuthLogo height={19} href={bar.logoHref} />
          </div>
          {bar.steps && (
            <div className="justify-self-end md:justify-self-center">
              <StepIndicator steps={bar.steps} current={bar.current ?? 0} />
            </div>
          )}
          {bar.right && <div className="col-span-2 justify-self-end md:col-span-1">{bar.right}</div>}
        </header>
        <Glow className="top-[60px] hidden md:block" />
        <main className={cn("relative mx-auto flex w-full flex-1 flex-col gap-5 px-4 pb-16 pt-8 sm:px-5 md:pt-14", widthMap[maxWidth])}>
          {children}
        </main>
      </div>
    )
  }

  /* ── Colonne du formulaire (+ colonne de droite) ────────────────────── */
  return (
    <div
      className={cn("relative bg-q-bg", aside && "lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]")}
      style={SAFE_AREA}
    >
      <div
        className={cn(
          "relative flex min-h-[100dvh] flex-col px-4 pb-10 pt-6 sm:px-8 lg:pb-8 lg:pt-7",
          aside && "lg:bg-q-surface lg:px-[clamp(20px,5vw,72px)]",
        )}
      >
        <Glow className={aside ? "lg:hidden" : undefined} />
        <div className={cn("relative", !aside && "flex justify-center sm:justify-start")}>
          <AuthLogo height={20} />
        </div>
        <main
          className={cn(
            "relative mx-auto flex w-full flex-1 flex-col pt-9 sm:justify-center sm:py-12",
            aside ? "max-w-[400px]" : widthMap[maxWidth],
          )}
        >
          {children}
        </main>
      </div>
      {aside && (
        <aside className="hidden items-center justify-center border-l border-q-line bg-q-bg px-[clamp(24px,4vw,64px)] py-14 lg:flex">
          {aside}
        </aside>
      )}
    </div>
  )
}
