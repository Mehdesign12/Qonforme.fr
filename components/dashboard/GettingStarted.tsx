/**
 * Tableau de bord d'un compte neuf, sans facture ni devis (canevas
 * « Onb-8 — Tableau de bord ») : premiers pas en tuiles, indicateurs à zéro,
 * état vide des documents. Remplace la fenêtre de bienvenue pour ces comptes.
 *
 * Tuiles limitées aux écrans qui existent : les tuiles « factures
 * fournisseurs » et « importer vos clients » du canevas ne sont pas livrées
 * (DECISIONS § 10), le logo se règle dans Paramètres › Modèles de documents.
 *
 * Inscription en deux champs (canevas « Plus-tard ») : tant qu'une étape de la
 * fenêtre « Bienvenue » reste à faire, la tuile « Terminer votre inscription »
 * vient en premier, à la place de « Compléter votre entreprise », et rouvre la
 * fenêtre à cette étape. Sur téléphone, le logo long Qonforme coiffe la page.
 */
import Link from "next/link"
import { ArrowRight, Building2, FileCheck2, FileText, ImagePlus, UserPlus } from "lucide-react"
import { formatCurrency } from "@/lib/utils/invoice"
import { cn } from "@/lib/utils"
import { hrefFor, type DashInscription, type DashMode, type DashboardView } from "@/components/dashboard/model"
import { KPI_GRID } from "@/components/dashboard/ui"
import { BrandLogo } from "@/components/dashboard/BrandLogo"

const TILES = [
  { key: "quote", path: "/quotes/new", Icon: FileCheck2, title: "Faire votre premier devis", text: "Gratuit et sans limite de nombre." },
  { key: "logo", path: "/settings/invoices", Icon: ImagePlus, title: "Ajouter votre logo", text: "Sur vos devis et vos factures." },
  { key: "company", path: "/settings/company", Icon: Building2, title: "Compléter votre entreprise", text: "SIREN, adresse et IBAN, repris sur vos documents." },
  { key: "client", path: "/clients/new", Icon: UserPlus, title: "Ajouter votre premier client", text: "Par son SIREN ou à la main." },
]

/** Ce que l'étape restante apporte, sous « Terminer votre inscription ». */
const RESUME_TEXT: Record<DashInscription["step"], string> = {
  company: "Votre entreprise, reprise sur vos devis et vos factures.",
  trade: "Votre métier prépare votre catalogue.",
  name: "Votre prénom, pour vous accueillir.",
}

const TILE = cn(
  "group flex flex-col gap-2 rounded-[20px] border border-[var(--q-line)] bg-[var(--q-surface)] p-5 text-[var(--q-ink-strong)] md:p-6",
  "shadow-[0_1px_2px_rgba(10,17,34,.04),0_12px_32px_-24px_rgba(10,17,34,.18)]",
  "transition-[border-color,box-shadow,transform] duration-200",
  "hover:-translate-y-0.5 hover:border-[var(--q-field)] hover:shadow-[0_2px_4px_rgba(10,17,34,.05),0_22px_44px_-26px_rgba(10,17,34,.32)]",
  "active:scale-[.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[var(--q-accent)]",
  "motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100",
)

/** Lien de la tuile : rouvre la fenêtre « Bienvenue » à l'étape restante. */
function resumeHref(mode: DashMode): string {
  return mode === "demo" ? "/demo/bienvenue?inscription=reprendre" : "/dashboard?inscription=reprendre"
}

function ResumeTile({ inscription, mode }: { inscription: DashInscription; mode: DashMode }) {
  const done = inscription.number - 1
  return (
    <Link href={resumeHref(mode)} className={cn(TILE, "!border-[var(--q-wash-line)]")}>
      <span className="mb-2.5 flex items-start">
        <Building2 className="size-[26px] shrink-0" strokeWidth={1.25} aria-hidden />
      </span>
      <span className="text-lg font-semibold tracking-[-0.01em]">Terminer votre inscription</span>
      <span className="text-[15px] leading-normal text-[var(--q-text-3)]">{RESUME_TEXT[inscription.step]}</span>
      <span className="mt-1.5 flex items-center gap-2.5">
        <span className="flex gap-1" aria-hidden>
          {Array.from({ length: inscription.total }, (_, i) => (
            <span
              key={i}
              className={cn("h-1 w-[22px] rounded-full", i < done ? "bg-[var(--q-accent)]" : "bg-[var(--q-line)]")}
            />
          ))}
        </span>
        <span className="whitespace-nowrap text-[13px] text-[var(--q-text-4)]">
          Étape {inscription.number} sur {inscription.total}
        </span>
        <span className="ml-auto whitespace-nowrap text-[14px] font-semibold text-[var(--q-accent-strong)]">
          Reprendre <span aria-hidden>→</span>
        </span>
      </span>
    </Link>
  )
}

function ZeroKpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="q-kpi rounded-2xl border border-[var(--q-line)] bg-[var(--q-surface)]">
      <span className="q-kpi-label">{label}</span>
      <span className="q-kpi-value !text-[var(--q-placeholder)]">{value}</span>
    </div>
  )
}

export function GettingStarted({ view }: { view: DashboardView }) {
  const zero = formatCurrency(0)
  const inscription = view.inscription
  // L'inscription à terminer remplace « Compléter votre entreprise »
  const tiles = inscription ? TILES.filter((t) => t.key !== "company") : TILES

  return (
    <div className="flex flex-col gap-6 md:gap-7">
      {/* Téléphone et tablette : logo long centré (pas de barre supérieure sous 1024 px) */}
      <div className="-mb-1 flex justify-center pt-1 lg:hidden">
        <BrandLogo />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm text-[var(--q-text-4)]">{view.dateLong}</span>
        <h1 className="q-h1">{view.firstName ? `Bienvenue, ${view.firstName}.` : "Bienvenue."}</h1>
        <p className="text-base text-[var(--q-text-3)]">Explorez librement&nbsp;: rien ne part sans vous.</p>
      </div>

      <section aria-labelledby="dash-start" className="flex flex-col gap-3">
        <h2 id="dash-start" className="q-h2">Pour commencer</h2>
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(260px,100%),1fr))]">
          {inscription && <ResumeTile inscription={inscription} mode={view.mode} />}
          {tiles.map(({ key, path, Icon, title, text }) => (
            <Link key={key} href={hrefFor(view.mode, path)} className={TILE}>
              <span className="mb-2.5 flex items-start justify-between">
                <Icon className="size-[26px] shrink-0" strokeWidth={1.25} aria-hidden />
                <ArrowRight
                  className="size-[18px] shrink-0 text-[var(--q-placeholder)] transition-[color,transform] duration-200 group-hover:translate-x-[3px] group-hover:text-[var(--q-accent-strong)] motion-reduce:group-hover:translate-x-0"
                  strokeWidth={1.25}
                  aria-hidden
                />
              </span>
              <span className="text-lg font-semibold tracking-[-0.01em]">{title}</span>
              <span className="text-[15px] leading-normal text-[var(--q-text-3)]">{text}</span>
            </Link>
          ))}
        </div>
      </section>

      <section aria-label="Vos chiffres" className={cn(KPI_GRID, "max-md:grid-cols-2")}>
        <ZeroKpi label="Facturé ce mois" value={zero} />
        <ZeroKpi label="À encaisser" value={zero} />
        <ZeroKpi label="Devis en attente" value={String(view.kpi.quotesPending)} />
        <ZeroKpi label="À échoir sous 30 jours" value={zero} />
      </section>

      <section aria-labelledby="dash-docs" className="q-card overflow-hidden">
        <h2 id="dash-docs" className="q-h2 border-b border-[var(--q-line-soft)] px-5 py-4">Derniers documents</h2>
        <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
          <FileText className="size-8 text-[var(--q-placeholder)]" strokeWidth={1.25} aria-hidden />
          <p className="text-[15px] text-[var(--q-text-3)]">Vos devis et factures apparaîtront ici.</p>
          <Link href={hrefFor(view.mode, "/quotes/new")} className="q-btn q-btn-secondary">Faire un devis</Link>
        </div>
      </section>
    </div>
  )
}
