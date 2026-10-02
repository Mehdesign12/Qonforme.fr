import Image from "next/image"
import Link from "next/link"
import { ArrowLeft, FileX, Monitor } from "lucide-react"
import { LOGO_LONG_BLUE, LOGO_LONG_LIGHT } from "@/lib/brand"

/**
 * Page 404, dans la langue du canevas : titre en deux voix, document « 404 »
 * en guise d'illustration, retour à l'accueil ou démo. Jetons --q-* (thème
 * sombre compris) ; le logo change de version par CSS (dark:), sans lire
 * resolvedTheme, donc sans écart d'hydratation.
 */
export default function NotFound() {
  return (
    <div className="relative flex min-h-[100dvh] flex-col overflow-x-clip bg-q-bg text-q-ink">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[560px]" style={{ background: "var(--q-glow)" }} />

      <header className="relative mx-auto w-full max-w-[1200px] px-4 pt-6 sm:px-6 sm:pt-8">
        <Link href="/" aria-label="Qonforme, accueil" className="inline-flex rounded-lg py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-q-accent">
          <Image src={LOGO_LONG_BLUE} alt="Qonforme" width={115} height={22} sizes="115px" priority className="h-[22px] w-auto dark:hidden" />
          <Image src={LOGO_LONG_LIGHT} alt="Qonforme" width={115} height={22} sizes="115px" className="hidden h-[22px] w-auto dark:block" />
        </Link>
      </header>

      <main className="relative flex flex-1 flex-col items-center justify-center px-4 pb-16 pt-10 text-center sm:px-6">
        {/* Illustration : un document qui n'existe pas */}
        <div aria-hidden className="q-card mb-10 w-[264px] p-5 text-left">
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-[13px] text-q-text-3">P-0404</span>
            <span className="q-pill q-pill-warn">
              <FileX />
              Introuvable
            </span>
          </div>
          <div className="mt-5 h-2.5 w-3/4 rounded-full bg-q-sunken" />
          <div className="mt-2.5 h-2.5 w-1/2 rounded-full bg-q-sunken" />
          <div className="mt-6 flex items-end justify-between border-t border-q-line-soft pt-4">
            <span className="text-xs text-q-text-4">Total</span>
            <span className="font-display text-[28px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-q-ink">404</span>
          </div>
        </div>

        <p className="q-eyebrow">Erreur 404</p>
        <h1 className="mt-3 font-display text-[clamp(36px,6vw,60px)] font-semibold leading-[1.05] tracking-[-0.035em] text-q-ink [text-wrap:balance]">
          Cette page est <span className="q-serif">introuvable.</span>
        </h1>
        <p className="mt-5 max-w-[460px] text-base leading-relaxed text-q-text-3 sm:text-[17px]">
          La page que vous cherchez n&apos;existe pas ou a été déplacée. Reprenez depuis l&apos;accueil, ou découvrez
          Qonforme avec la démo.
        </p>

        <div className="mt-8 flex w-full max-w-[360px] flex-col gap-3 sm:w-auto sm:max-w-none sm:flex-row">
          <Link href="/" className="lp-btn-p !px-6">
            <ArrowLeft className="h-[18px] w-[18px]" aria-hidden />
            Retour à l&apos;accueil
          </Link>
          <Link href="/demo" className="lp-btn-s">
            <span className="lp-btn-s-ic" aria-hidden>
              <Monitor className="h-[15px] w-[15px]" />
            </span>
            Voir la démo
          </Link>
        </div>

        <p className="mt-7 text-sm text-q-text-4">
          Déjà client&nbsp;?{" "}
          <Link href="/dashboard" className="q-link">Aller au tableau de bord</Link>
        </p>
      </main>

      <footer className="relative pb-6 text-center text-xs text-q-text-4">
        © {new Date().getFullYear()} Qonforme SAS · Devis et factures des artisans du bâtiment.
      </footer>
    </div>
  )
}
