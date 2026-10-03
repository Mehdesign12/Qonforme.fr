/**
 * Contrôles d'une facture reçue (import et fiche) : chaque ligne porte une
 * icône et un libellé, jamais la couleur seule.
 */
import Link from "next/link"
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ReceptionCheck } from "@/lib/reception/types"

const ORDER = { error: 0, warning: 1, ok: 2 } as const

export function ChecksList({
  checks,
  duplicateHref,
  className,
}: {
  checks: ReceptionCheck[]
  /** Lien vers la facture déjà enregistrée (doublon). */
  duplicateHref?: (id: string) => string
  className?: string
}) {
  const sorted = [...checks].sort((a, b) => ORDER[a.level] - ORDER[b.level])
  return (
    <ul className={cn("flex flex-col gap-2.5", className)}>
      {sorted.map((c) => {
        const Icon = c.level === "ok" ? CheckCircle2 : c.level === "warning" ? AlertTriangle : XCircle
        return (
          <li key={c.id} className="flex gap-2.5">
            <Icon
              className={cn(
                "mt-0.5 size-[18px] shrink-0",
                c.level === "ok" && "text-[var(--q-ok)]",
                c.level === "warning" && "text-[var(--q-warn)]",
                c.level === "error" && "text-[var(--q-danger)]",
              )}
              aria-hidden
            />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className={cn("text-sm font-semibold", c.level === "error" ? "text-[var(--q-danger)]" : "text-[var(--q-ink)]")}>
                <span className="sr-only">{c.level === "ok" ? "Conforme : " : c.level === "warning" ? "À vérifier : " : "Bloquant : "}</span>
                {c.title}
              </span>
              {c.detail && <span className="break-words text-[13px] leading-relaxed text-[var(--q-text-3)]">{c.detail}</span>}
              {c.duplicate_of && duplicateHref && (
                <Link href={duplicateHref(c.duplicate_of.id)} className="q-link text-[13px]">Voir la facture déjà enregistrée</Link>
              )}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
