import Link from "next/link"
import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react"
import { ChevronDown, FileText } from "lucide-react"
import PublicHeaderWrapper from "@/components/layout/PublicHeaderWrapper"
import Footer from "@/components/layout/Footer"

interface LegalLayoutProps {
  children:     ReactNode
  /** Début du titre (Bricolage). */
  title:        string
  /** Fin du titre en seconde voix (Instrument Serif italique, bleu). */
  titleAccent?: string
  subtitle:     string
  lastUpdated:  string
  /** Chemin de la page, pour la marquer dans « Documents légaux ». */
  path?:        string
}

const LEGAL_PAGES = [
  { href: "/mentions-legales", label: "Mentions légales" },
  { href: "/cgu",              label: "Conditions générales d'utilisation" },
  { href: "/confidentialite",  label: "Politique de confidentialité" },
]

interface TocEntry { id: string; num: string | null; label: string }

/** Texte brut d'un nœud React (titres h2 du contenu). */
function textOf(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return ""
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(textOf).join("")
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children)
  return ""
}

function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/**
 * Donne un identifiant à chaque titre h2 du contenu et en tire le sommaire.
 * « Article 4 — Formules… » et « 4. Formules… » donnent le numéro 4 et le libellé.
 */
function withToc(children: ReactNode): { content: ReactNode[]; toc: TocEntry[] } {
  const toc: TocEntry[] = []
  const used = new Set<string>()
  const content = Children.toArray(children).map((child) => {
    if (!isValidElement<{ id?: string; children?: ReactNode }>(child) || child.type !== "h2") return child
    const text = textOf(child.props.children).trim()
    let id = child.props.id ?? (slugify(text) || "section")
    for (let n = 2; used.has(id); n++) id = `${slugify(text)}-${n}`
    used.add(id)
    const m = text.match(/^(?:Article\s+)?(\d+)\s*(?:\.|—|-)\s*(.+)$/)
    toc.push({ id, num: m ? m[1] : null, label: m ? m[2] : text })
    return cloneElement(child as ReactElement<{ id?: string }>, { id })
  })
  return { content, toc }
}

function TocList({ toc }: { toc: TocEntry[] }) {
  return (
    <ol className="flex flex-col">
      {toc.map((t) => (
        <li key={t.id}>
          <a
            href={`#${t.id}`}
            className="flex min-h-[40px] items-baseline gap-3 rounded-[10px] px-3 py-2 text-[13.5px] leading-snug text-q-text-3 transition-colors hover:bg-q-hover hover:text-q-ink lg:min-h-0 lg:py-1.5"
          >
            {t.num && <span className="w-5 shrink-0 text-right text-xs font-medium tabular-nums text-q-text-4">{t.num}</span>}
            <span className="min-w-0">{t.label}</span>
          </a>
        </li>
      ))}
    </ol>
  )
}

function OtherDocs({ path }: { path?: string }) {
  return (
    <div className="q-card p-2">
      <p className="px-3 pb-1 pt-2.5 text-xs font-semibold uppercase tracking-[0.08em] text-q-text-4">Documents légaux</p>
      <ul className="flex flex-col">
        {LEGAL_PAGES.map((p) => (
          <li key={p.href}>
            <Link
              href={p.href}
              aria-current={p.href === path ? "page" : undefined}
              className="flex min-h-[44px] items-center gap-2.5 rounded-[10px] px-3 py-2 text-sm text-q-text-2 transition-colors hover:bg-q-hover hover:text-q-ink aria-[current=page]:bg-q-wash aria-[current=page]:font-semibold aria-[current=page]:text-q-accent-strong"
            >
              <FileText className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
              {p.label}
            </Link>
          </li>
        ))}
      </ul>
      <p className="border-t border-q-line-soft px-3 pb-2 pt-3 text-[13px] text-q-text-4">
        Une question&nbsp;?{" "}
        <a href="mailto:contact@qonforme.fr" className="q-link">contact@qonforme.fr</a>
      </p>
    </div>
  )
}

/**
 * Pages légales (mentions légales, CGU, confidentialité) : en-tête et pied de
 * page publics, titre en deux voix, texte sur 720 px dans une carte, sommaire
 * collant sur ordinateur et repliable sur mobile. Couleurs par jetons --q-*
 * (thème sombre compris) ; typographie du texte : bloc .legal-content de globals.css.
 */
export function LegalLayout({ children, title, titleAccent, subtitle, lastUpdated, path }: LegalLayoutProps) {
  const { content, toc } = withToc(children)

  return (
    <div className="relative min-h-screen bg-q-bg text-q-ink">
      {/* Halo bleu discret en haut de page, comme la coque de l'application */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[520px]" style={{ background: "var(--q-glow)" }} />

      <PublicHeaderWrapper />

      <main className="relative px-4 pb-16 pt-[112px] sm:px-6 sm:pb-24 sm:pt-[136px]">
        <div className="mx-auto grid max-w-[1040px] gap-6 lg:grid-cols-[256px_minmax(0,720px)] lg:justify-center lg:gap-x-14 lg:gap-y-8">
          {/* En-tête */}
          <header className="lg:col-start-2">
            <p className="q-eyebrow">Informations légales</p>
            <h1 className="mt-3 font-display text-[clamp(34px,5vw,52px)] font-semibold leading-[1.05] tracking-[-0.035em] text-q-ink [text-wrap:balance]">
              {title}
              {titleAccent && <> <span className="q-serif">{titleAccent}</span></>}
            </h1>
            <p className="mt-4 max-w-[620px] text-base leading-relaxed text-q-text-3 sm:text-[17px]">{subtitle}</p>
            <p className="mt-3 text-[13px] text-q-text-4">Dernière mise à jour&nbsp;: {lastUpdated}</p>
          </header>

          {/* Sommaire et autres documents (colonne collante sur ordinateur) */}
          {toc.length > 0 && (
            <aside className="lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:self-start lg:sticky lg:top-[104px]">
              <details className="group q-card lg:hidden">
                <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-3 px-4 text-[15px] font-semibold text-q-ink [&::-webkit-details-marker]:hidden">
                  <span>
                    Sommaire <span className="font-normal text-q-text-4">· {toc.length} sections</span>
                  </span>
                  <ChevronDown className="h-4 w-4 text-q-text-4 transition-transform group-open:rotate-180" aria-hidden />
                </summary>
                <nav aria-label="Sommaire" className="border-t border-q-line-soft p-1.5">
                  <TocList toc={toc} />
                </nav>
              </details>

              <div className="hidden flex-col gap-4 lg:flex">
                <nav aria-label="Sommaire" className="q-card p-2">
                  <p className="px-3 pb-1 pt-2.5 text-xs font-semibold uppercase tracking-[0.08em] text-q-text-4">Sommaire</p>
                  <TocList toc={toc} />
                </nav>
                <OtherDocs path={path} />
              </div>
            </aside>
          )}

          {/* Texte */}
          <article className="q-card px-5 py-7 sm:px-10 sm:py-10 lg:col-start-2">
            <div className="legal-content">{content}</div>
          </article>

          <div className="lg:hidden">
            <OtherDocs path={path} />
          </div>
        </div>
      </main>

      <Footer showCta={false} />
    </div>
  )
}
