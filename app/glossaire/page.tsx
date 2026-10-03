import type { Metadata } from "next"
import { GLOSSAIRE } from "@/lib/pseo/glossaire"
import { ContentCta, ContentHero, ContentPage, LinkCard, WRAP } from "@/components/content/ui"

export const metadata: Metadata = {
  title: "Glossaire facturation — Définitions et termes clés",
  description: "Glossaire complet de la facturation : acompte, avoir, Factur-X, TVA, FEC, PDP, pénalités de retard. Toutes les définitions pour comprendre la facturation en France.",
  keywords: ["glossaire facturation", "definition facture", "termes facturation", "lexique comptabilite"],
  alternates: { canonical: "/glossaire" },
  openGraph: {
    title: "Glossaire facturation | Qonforme",
    description: "Toutes les définitions pour comprendre la facturation en France.",
    url: "https://qonforme.fr/glossaire",
    images: [{ url: "/api/og?title=Glossaire%20facturation&subtitle=D%C3%A9finitions%20et%20termes%20cl%C3%A9s", width: 1200, height: 630 }],
  },
}

/** Lettre d'index d'un terme, sans accent (« Échéance » → « E »). */
function initial(terme: string) {
  return terme.normalize("NFD").replace(/[\u0300-\u036f]/g, "").charAt(0).toUpperCase()
}

export default function GlossaireIndexPage() {
  const sorted = [...GLOSSAIRE].sort((a, b) => a.terme.localeCompare(b.terme, "fr"))

  // Regroupement alphabétique
  const groups = new Map<string, typeof sorted>()
  for (const t of sorted) {
    const letter = initial(t.terme)
    groups.set(letter, [...(groups.get(letter) ?? []), t])
  }
  const letters = Array.from(groups.keys())

  return (
    <ContentPage>
      <ContentHero
        eyebrow="Ressources"
        title="Le glossaire"
        accent="de la facturation."
        sub={`${GLOSSAIRE.length} définitions pour comprendre la facturation, la TVA et les obligations légales en France, expliquées simplement.`}
      >
        {/* Index des lettres */}
        <nav aria-label="Lettres" className="mt-8">
          <ul className="flex flex-wrap justify-center gap-1.5">
            {letters.map((l) => (
              <li key={l}>
                <a
                  href={`#lettre-${l}`}
                  className="grid h-10 w-10 place-items-center rounded-full border border-q-line bg-q-surface text-[14px] font-semibold text-q-ink transition-colors hover:border-q-accent hover:bg-q-accent hover:text-white"
                >
                  {l}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </ContentHero>

      <div className="px-4 sm:px-6">
        <div className={`${WRAP} flex flex-col gap-12`}>
          {letters.map((l) => (
            <section key={l} aria-labelledby={`lettre-${l}`} className="grid gap-5 lg:grid-cols-[120px_minmax(0,1fr)]">
              <h2 id={`lettre-${l}`} className="scroll-mt-28 font-display text-[44px] font-semibold leading-none tracking-[-0.03em] text-q-accent lg:text-[56px]">
                {l}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {groups.get(l)!.map((terme) => (
                  <LinkCard key={terme.slug} href={`/glossaire/${terme.slug}`} title={terme.terme} text={terme.definition} as="h3" className="p-5" />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      <ContentCta
        links={[
          { href: "/facturation", label: "Facturation par métier" },
          { href: "/guide", label: "Guides pratiques" },
          { href: "/modele", label: "Modèles gratuits" },
          { href: "/blog", label: "Blog" },
        ]}
      />
    </ContentPage>
  )
}
