/**
 * En-tête commun des écrans Articles : titre, sous-titre, action primaire
 * (dans l'en-tête sur ordinateur, pleine largeur sous les rubriques sur
 * téléphone, comme la planche Mobile-articles), puis les sous-onglets.
 * Sans hook : pages serveur.
 */
import Link from "next/link"
import { Plus, Sparkles } from "lucide-react"
import { SeoHeader, SeoTabs } from "@/components/admin/seo/SeoHeader"

export type ArticlesTab = "calendrier" | "liste" | "sujets" | "preferences"

export const ARTICLES_BASE = "/admin/seo/articles"

export const ARTICLES_TABS: { key: ArticlesTab; href: string; label: string }[] = [
  { key: "calendrier", href: ARTICLES_BASE, label: "Calendrier" },
  { key: "liste", href: `${ARTICLES_BASE}/liste`, label: "Articles" },
  { key: "sujets", href: `${ARTICLES_BASE}/sujets`, label: "Sujets" },
  { key: "preferences", href: `${ARTICLES_BASE}/preferences`, label: "Préférences" },
]

export const ARTICLES_TITLE = "Articles"
export const ARTICLES_SUBTITLE = "Organisez vos sujets, créez du contenu et développez votre trafic."

export function ArticlesHeader({
  current,
  action,
}: {
  current: ArticlesTab
  /** Action primaire de l'écran (lien qui ouvre la fenêtre par l'adresse). */
  action?: { href: string; label: string; icon: "plus" | "sparkles" }
}) {
  const Icon = action?.icon === "sparkles" ? Sparkles : Plus
  const tab = ARTICLES_TABS.find((t) => t.key === current) ?? ARTICLES_TABS[0]
  return (
    <div className="flex flex-col gap-4">
      <SeoHeader
        section="articles"
        title={ARTICLES_TITLE}
        subtitle={ARTICLES_SUBTITLE}
        actions={
          action ? (
            <Link href={action.href} scroll={false} className="q-btn q-btn-primary max-md:!hidden">
              <Icon strokeWidth={2.25} aria-hidden />
              {action.label}
            </Link>
          ) : undefined
        }
      />
      {action && (
        <Link href={action.href} scroll={false} className="q-btn q-btn-primary q-btn-lg w-full md:!hidden">
          <Icon strokeWidth={2.25} aria-hidden />
          {action.label}
        </Link>
      )}
      <SeoTabs tabs={ARTICLES_TABS.map(({ href, label }) => ({ href, label }))} current={tab.href} label="Sous-onglets d'Articles" className="-mx-4 px-4 md:mx-0 md:px-0 max-md:[&>a]:!h-11" />
    </div>
  )
}
