import { Check, Plus, Search, Send } from "lucide-react"
import { EXAMPLE_COMPANY, EXAMPLE_PRODUCTS, EXAMPLES } from "@/components/landing/examples"
import { formatCurrency } from "@/lib/utils/invoice"
import { cn } from "@/lib/utils"

/**
 * Petites maquettes des trois étapes de démarrage (« Trois étapes, et votre
 * premier devis est parti »), dans une fenêtre d'application de hauteur fixe.
 *
 * Elles reprennent des écrans qui existent (recherche par SIREN à
 * l'inscription, catalogue de prestations, devis envoyé par email) avec les
 * données de la démo. Décoratives : role="img" et un libellé qui dit ce
 * qu'elles montrent. Couleurs par jetons --q-* (thème sombre compris).
 */

function Win({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div
      role="img"
      aria-label={label}
      className="lp-clip rounded-[14px] border border-q-line bg-q-surface shadow-[0_1px_2px_rgba(10,17,34,.04),0_30px_60px_-36px_rgba(10,17,34,.4)]"
    >
      <div aria-hidden className="flex h-7 items-center gap-1.5 border-b border-q-line bg-q-sunken px-3">
        <span className="h-[9px] w-[9px] rounded-full bg-q-field" />
        <span className="h-[9px] w-[9px] rounded-full bg-q-field" />
        <span className="h-[9px] w-[9px] rounded-full bg-q-field" />
      </div>
      <div aria-hidden className={cn("flex h-[220px] flex-col gap-2.5 bg-q-bg p-4 text-left text-[11px] leading-snug text-q-text-3", className)}>
        {children}
      </div>
    </div>
  )
}

const sirenGroups = (s: string) => s.replace(/(\d{3})(?=\d)/g, "$1 ")

/** Étape 1 : la recherche par SIREN remplit l'entreprise. */
export function StepCompany() {
  const c = EXAMPLE_COMPANY
  return (
    <Win label={`L'étape Entreprise : le SIREN ${sirenGroups(c.siren)} remplit le nom et l'adresse de ${c.name}`}>
      <p className="text-[13px] font-semibold text-q-ink-strong">Votre entreprise</p>
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-semibold text-q-text-4">Numéro SIREN</span>
        <div className="flex items-center gap-2">
          <span className="flex h-8 flex-1 items-center rounded-lg border border-q-accent bg-q-surface px-2.5 font-mono text-[12px] text-q-ink-strong shadow-[0_0_0_3px_var(--q-focus)]">
            {sirenGroups(c.siren)}
          </span>
          <span className="inline-flex h-8 items-center gap-1 rounded-lg bg-q-accent px-2.5 text-[11px] font-semibold text-white">
            <Search className="h-3 w-3" strokeWidth={2} />
            Rechercher
          </span>
        </div>
      </div>
      <div className="mt-auto flex flex-col gap-1 rounded-[10px] border border-q-line bg-q-surface p-3">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-[12px] font-semibold text-q-ink-strong">{c.name}</span>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-q-ok-bg px-2 py-0.5 text-[10px] font-semibold text-q-ok">
            <Check className="h-2.5 w-2.5" strokeWidth={2.5} />
            Trouvée
          </span>
        </span>
        <span>
          {c.address}, {c.zip_code} {c.city}
        </span>
        <span className="font-mono text-[10px] text-q-text-4">TVA {c.vat_number}</span>
      </div>
    </Win>
  )
}

/** Étape 2 : le catalogue de prestations, avec unités et prix. */
export function StepCatalogue() {
  return (
    <Win label="L'étape Prestations : trois prestations du catalogue avec leur unité et leur prix hors taxes">
      <p className="text-[13px] font-semibold text-q-ink-strong">Vos prestations</p>
      <div className="lp-clip flex flex-col rounded-[10px] border border-q-line bg-q-surface">
        {EXAMPLE_PRODUCTS.map((p, i) => (
          <span key={p.id} className={cn("flex items-center gap-2 px-3 py-2", i > 0 && "border-t border-q-line-soft")}>
            <span className="min-w-0 flex-1 truncate text-q-ink-strong">{p.name}</span>
            <span className="shrink-0 text-q-text-4">{p.unit}</span>
            <span className="w-[62px] shrink-0 text-right font-semibold tabular-nums text-q-ink-strong">{formatCurrency(p.unit_price_ht)}</span>
          </span>
        ))}
      </div>
      <span className="mt-auto inline-flex items-center gap-1 font-semibold text-q-accent-strong">
        <Plus className="h-3 w-3" strokeWidth={2.25} />
        Ajouter une prestation
      </span>
    </Win>
  )
}

/** Étape 3 : le devis prêt à partir par email. */
export function StepQuote() {
  const q = EXAMPLES.devis
  return (
    <Win label={`L'étape Premier devis : le devis ${q.quote_number} pour ${q.client.name}, prêt à être envoyé par email`}>
      <div className="flex items-start justify-between gap-2">
        <span className="flex flex-col">
          <span className="text-[13px] font-semibold text-q-ink-strong">{q.client.name}</span>
          <span className="font-mono text-[10px] text-q-text-4">{q.quote_number}</span>
        </span>
        <span className="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg bg-q-accent px-2.5 text-[11px] font-semibold text-white">
          <Send className="h-3 w-3" strokeWidth={2} />
          Envoyer par email
        </span>
      </div>
      <div className="flex flex-col rounded-[10px] border border-q-line bg-q-surface px-3 py-1.5">
        {q.lines.slice(0, 2).map((l) => (
          <span key={l.id} className="flex items-center gap-2 border-b border-q-line-soft py-1.5 last:border-b-0">
            <span className="min-w-0 flex-1 truncate text-q-ink-strong">{l.description}</span>
            <span className="shrink-0 font-semibold tabular-nums text-q-ink-strong">{formatCurrency(l.total_ht)}</span>
          </span>
        ))}
      </div>
      <span className="mt-auto flex items-center justify-between rounded-[10px] bg-q-surface px-3 py-2 text-[12px]">
        <span className="font-semibold text-q-ink-strong">Total TTC</span>
        <span className="font-semibold tabular-nums text-q-ink-strong">{formatCurrency(q.total_ttc)}</span>
      </span>
    </Win>
  )
}
