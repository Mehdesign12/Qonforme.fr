/**
 * Chargement des écrans Articles (Calendrier, Articles, Sujets, Préférences),
 * sur le modèle de l'écran Mots-clés : en-tête et sous-onglets réels (on peut
 * changer d'onglet pendant le chargement ; aucun n'est marqué courant, l'écran
 * demandé n'étant pas connu ici), puis des squelettes sans animation lourde.
 */
import { SeoHeader, SeoTabs } from "@/components/admin/seo/SeoHeader"
import { ARTICLES_SUBTITLE, ARTICLES_TABS, ARTICLES_TITLE } from "@/components/admin/seo/articles/ArticlesHeader"

function Bar({ className }: { className: string }) {
  return <span className={`block rounded-md bg-[var(--q-sunken)] ${className}`} />
}

export default function Loading() {
  return (
    <div className="flex flex-col gap-4">
      <SeoHeader section="articles" title={ARTICLES_TITLE} subtitle={ARTICLES_SUBTITLE} />
      <SeoTabs
        tabs={ARTICLES_TABS.map(({ href, label }) => ({ href, label }))}
        current=""
        label="Sous-onglets d'Articles"
        className="-mx-4 px-4 md:mx-0 md:px-0 max-md:[&>a]:!h-11"
      />
      <div aria-busy="true" aria-live="polite" className="flex flex-col gap-5">
        <span className="sr-only">Chargement…</span>
        <div className="flex flex-wrap items-center gap-3" aria-hidden>
          <Bar className="h-10 w-40" />
          <Bar className="h-10 w-28" />
          <Bar className="ml-auto h-10 w-36" />
        </div>
        <div className="q-card overflow-hidden" aria-hidden>
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className={`flex items-center gap-4 px-5 py-4 ${i > 0 ? "border-t border-[var(--q-line-soft)]" : ""}`}>
              <Bar className="h-3.5 w-56 max-w-[55%]" />
              <Bar className="ml-auto h-3.5 w-20 max-md:hidden" />
              <Bar className="h-6 w-20 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
