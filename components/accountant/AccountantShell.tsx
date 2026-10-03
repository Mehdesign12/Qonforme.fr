"use client"

/**
 * Coque de l'espace comptable (/comptable et sa démo /demo/comptable) : une
 * barre blanche (logo, « Espace comptable », compte, déconnexion), le contenu
 * centré, une mention du journal en pied de page. Pas de barre latérale de
 * l'application : le comptable n'a ni devis ni factures à créer.
 *
 * Ni backdrop-filter ni will-change (règle iOS de CLAUDE.md) ; couleurs par
 * les jetons --q-*, thème sombre compris.
 */
import Link from "next/link"
import { ArrowLeft, LayoutDashboard, LogOut, UserPlus } from "lucide-react"
import AuthLogo from "@/components/auth/AuthLogo"
import { useLogout } from "@/components/layout/useLogout"

export function AccountantShell({
  mode,
  email,
  appHref,
  children,
}: {
  mode: "app" | "demo"
  email: string | null
  /** Lien vers la facturation du compte, s'il a aussi une entreprise. */
  appHref?: string | null
  children: React.ReactNode
}) {
  const demo = mode === "demo"
  const logout = useLogout()

  return (
    <div className="min-h-[100dvh] text-[var(--q-ink)]" style={{ background: "var(--dashboard-bg)" }}>
      {demo && (
        <div className="border-b border-[var(--q-info-line)] bg-[var(--q-info-bg)] px-4 py-2.5 text-[13px] text-[var(--q-accent-ink)]">
          <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <span><strong>Démo</strong> · l&apos;espace de votre comptable. Données fictives, rien n&apos;est téléchargé.</span>
            <Link href="/demo/settings/comptable" className="q-link inline-flex min-h-9 items-center gap-1">
              <ArrowLeft className="size-3.5" aria-hidden />
              Retour à l&apos;accès comptable
            </Link>
          </div>
        </div>
      )}

      <header className="border-b border-[var(--q-line)] bg-[var(--q-surface)]" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="mx-auto flex h-16 max-w-[1120px] items-center gap-3 px-4 md:px-6">
          <AuthLogo height={20} href={demo ? "/demo/comptable" : "/comptable"} />
          <span className="q-pill q-pill-info hidden sm:inline-flex">Espace comptable</span>
          <span className="flex-1" />
          {appHref && (
            <Link href={appHref} className="q-btn q-btn-ghost q-btn-sm hidden md:inline-flex">
              <LayoutDashboard aria-hidden />
              Ma facturation
            </Link>
          )}
          {email && <span className="hidden max-w-[240px] truncate text-[13px] text-[var(--q-text-4)] lg:inline">{email}</span>}
          {demo ? (
            <Link href="/signup" className="q-btn q-btn-primary q-btn-sm">
              <UserPlus aria-hidden />
              Créer un compte
            </Link>
          ) : (
            <button type="button" onClick={logout} className="q-btn q-btn-secondary q-btn-sm" aria-label="Se déconnecter">
              <LogOut aria-hidden />
              <span className="hidden sm:inline">Se déconnecter</span>
            </button>
          )}
        </div>
      </header>

      <main
        id="contenu"
        className="mx-auto flex w-full max-w-[1120px] flex-col gap-5 px-4 pt-6 md:px-6 md:pt-8"
        style={{ paddingBottom: "max(48px, env(safe-area-inset-bottom))" }}
      >
        {children}
        <footer className="mt-4 border-t border-[var(--q-line)] pt-4 text-center text-xs leading-relaxed text-[var(--q-text-4)]">
          Accès en lecture seule fourni par Qonforme. Chaque consultation et chaque téléchargement sont enregistrés
          et visibles par l&apos;entreprise concernée pendant un an ; elle peut retirer l&apos;accès à tout moment.
        </footer>
      </main>
    </div>
  )
}
