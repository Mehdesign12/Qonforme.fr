/**
 * Conseil « Personnalisez vos factures » au-dessus de l'éditeur de facture,
 * tant qu'aucun logo n'est configuré (masquable). Partagé avec la démo.
 */
import Link from "next/link"
import { Sparkles, X, ArrowRight } from "lucide-react"

export function PersonalizeTip({
  href,
  cta,
  text = "Ajoutez votre logo et votre identité visuelle pour un rendu professionnel.",
  onDismiss,
}: {
  href: string
  cta: string
  text?: string
  onDismiss: () => void
}) {
  return (
    <div className="q-banner items-center">
      <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-[var(--q-surface)] text-[var(--q-accent-strong)]">
        <Sparkles className="size-[18px]" strokeWidth={1.75} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-[var(--q-ink)]">Personnalisez vos factures</span>
        <span className="hidden text-[13px] text-[var(--q-text-3)] sm:block">{text}</span>
        {/* Mobile : lien sous le titre, pour ne pas serrer le texte contre un bouton */}
        <Link href={href} className="q-link mt-0.5 inline-flex items-center gap-1 text-[13px] sm:hidden">
          {cta}
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </span>
      <Link href={href} className="q-btn q-btn-secondary q-btn-sm hidden shrink-0 sm:inline-flex">
        {cta}
        <ArrowRight aria-hidden />
      </Link>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Masquer ce conseil"
        className="grid size-8 shrink-0 place-items-center rounded-lg text-[var(--q-text-4)] transition-colors hover:bg-[var(--q-surface)] hover:text-[var(--q-ink)]"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  )
}
