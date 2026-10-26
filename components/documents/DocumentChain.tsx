import Link from "next/link"
import { Check, Plus } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Chaîne du document (téléphone), maquette « Fiche devis » du 23/10/2026 :
 * frise verticale devis → bon de commande (facultatif) → facture, avec l'étape
 * faite, la prochaine et celles à venir. Ne dit que ce que les données savent :
 * le bon de commande n'est jamais présenté comme une étape à franchir.
 */
export interface ChainStep {
  key: string
  label: string
  sub?: string
  state: "done" | "next" | "todo" | "optional"
  href?: string
}

export function DocumentChain({ steps, className }: { steps: ChainStep[]; className?: string }) {
  const done = steps.filter((s) => s.state === "done").length
  return (
    <section aria-label="Chaîne du document" className={cn("q-card p-[18px] print:hidden", className)}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-[17px] font-semibold tracking-[-0.01em] text-[var(--q-ink)]">Chaîne du document</h2>
        <span className="text-[12.5px] text-[var(--q-text-4)]">{done} étape{done > 1 ? "s" : ""} sur {steps.length}</span>
      </div>
      <ol>
        {steps.map((s, i) => {
          const last = i === steps.length - 1
          const body = (
            <>
              <b className={cn("block text-[15px] font-semibold", s.state === "next" && "text-[var(--q-accent-strong)]", s.state === "optional" && "text-[var(--q-text-3)]")}>{s.label}</b>
              {s.sub && <small className="mt-0.5 block text-[13px] text-[var(--q-text-4)]">{s.sub}</small>}
            </>
          )
          return (
            <li key={s.key} className={cn("relative pl-10", !last && "pb-5")} aria-current={s.state === "next" ? "step" : undefined}>
              {!last && <span aria-hidden className="absolute bottom-0 left-[13px] top-7 w-px bg-[var(--q-field)]" />}
              <span
                aria-hidden
                className={cn(
                  "absolute left-0 top-0 grid size-7 place-items-center rounded-full border-[1.5px]",
                  s.state === "done" && "border-[var(--q-accent)] bg-[var(--q-accent)] text-white",
                  s.state === "next" && "border-[var(--q-accent)] bg-[var(--q-surface)] text-[var(--q-accent-strong)] shadow-[0_0_0_4px_var(--q-wash-line)]",
                  s.state === "todo" && "border-[var(--q-field)] bg-[var(--q-surface)] text-[var(--q-text-4)]",
                  s.state === "optional" && "border-dashed border-[var(--q-field)] bg-[var(--q-surface)] text-[var(--q-text-4)]",
                )}
              >
                {s.state === "done" && <Check className="size-3.5" strokeWidth={2.6} />}
                {s.state === "next" && <Plus className="size-3.5" strokeWidth={2.6} />}
              </span>
              {s.href ? <Link href={s.href} className="block">{body}</Link> : body}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

export function quoteChainSteps(q: {
  status: string
  quote_number: string
  converted: boolean
  converted_invoice: { number?: string | null; status?: string | null; href: string } | null
}, conversionBlocked?: string | null): ChainStep[] {
  const quoteDone = q.status === "accepted"
  const quoteStep: ChainStep = {
    key: "quote",
    label: quoteDone ? "Devis accepté" : q.status === "sent" ? "Devis envoyé" : q.status === "draft" ? "Devis en brouillon" : q.status === "withdrawn" ? "Devis rétracté" : q.status === "rejected" ? "Devis refusé" : "Devis",
    sub: q.quote_number,
    state: quoteDone ? "done" : q.status === "draft" || q.status === "sent" ? "next" : "todo",
  }
  const orderStep: ChainStep = { key: "order", label: "Bon de commande", sub: "Facultatif · le devis signé vaut commande", state: "optional" }
  const invoiceStep: ChainStep = q.converted && q.converted_invoice
    ? { key: "invoice", label: "Facture", sub: q.converted_invoice.number ?? "Facture créée", state: "done", href: q.converted_invoice.href }
    : conversionBlocked
      ? { key: "invoice", label: "Facture", sub: "Acomptes et situations", state: quoteDone ? "next" : "todo" }
      : { key: "invoice", label: "Facture", sub: quoteDone ? "À créer à partir du devis" : "Après l'accord du client", state: quoteDone ? "next" : "todo" }
  return [quoteStep, orderStep, invoiceStep]
}
