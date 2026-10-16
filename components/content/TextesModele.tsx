import type { Modele } from "@/lib/pseo/modeles"
import { CopyButton } from "@/components/outils/controls"
import { SectionHeading } from "@/components/content/ui"
import { fr } from "@/components/content/text"

/**
 * Textes prêts à recopier d'un modèle (relances par mail, lettre de mise en demeure) :
 * objet, corps et bouton Copier. Le texte copié garde les crochets à remplacer.
 */
export function TextesModele({ textes, className }: { textes: NonNullable<Modele["textes"]>; className?: string }) {
  return (
    <section aria-labelledby="textes" className={className}>
      <SectionHeading id="textes" title={textes.titre} accent={textes.accent} className="mb-4" />
      <p className="mb-6 max-w-[68ch] text-[15px] leading-[1.6] text-q-text-3">{fr(textes.intro)}</p>

      <div className="flex flex-col gap-5">
        {textes.liste.map((t) => (
          <article
            key={t.id}
            aria-labelledby={`texte-${t.id}`}
            className="overflow-hidden rounded-[20px] border border-q-line bg-q-surface shadow-[var(--q-shadow-card)]"
          >
            <header className="flex flex-wrap items-start justify-between gap-3 border-b border-q-line px-5 py-4 sm:px-7">
              <div className="flex min-w-0 flex-col gap-1">
                <span className="q-eyebrow">{t.canal}</span>
                <h3 id={`texte-${t.id}`} className="font-display text-[18px] font-semibold tracking-[-0.02em] text-q-ink-strong">
                  {fr(t.titre)}
                </h3>
                <p className="text-[13px] text-q-text-4">{fr(t.quand)}</p>
              </div>
              <CopyButton text={`Objet : ${t.objet}\n\n${t.corps.join("\n\n")}`} label="Copier le texte" />
            </header>
            <div className="px-5 py-5 sm:px-7">
              <p className="text-[14px] font-semibold text-q-ink">{fr(`Objet : ${t.objet}`)}</p>
              <div className="mt-4 flex flex-col gap-3 text-[15px] leading-[1.65] text-q-text-2">
                {t.corps.map((c, i) => (
                  <p key={i}>{fr(c)}</p>
                ))}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
