"use client"

/** Sélecteur de période de « Vos statistiques » (7 derniers jours · 28 derniers jours · 3 derniers mois). */
import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { ChevronDown } from "lucide-react"
import type { PeriodKey } from "@/lib/seo/period"
import { actionsHref, type ActionsQuery } from "@/components/admin/seo/actions/url"

const OPTIONS: { value: PeriodKey; label: string }[] = [
  { value: "7j", label: "7 derniers jours" },
  { value: "28j", label: "28 derniers jours" },
  { value: "3m", label: "3 derniers mois" },
]

export function PeriodSelect({ query }: { query: ActionsQuery }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  return (
    <label className="relative inline-flex items-center" aria-busy={pending}>
      <span className="sr-only">Période des statistiques</span>
      <select
        value={query.periode}
        onChange={(e) => startTransition(() => router.replace(actionsHref({ ...query, periode: e.target.value as PeriodKey }), { scroll: false }))}
        className="q-input h-11 w-auto appearance-none pr-8 text-base font-semibold md:h-[34px] md:text-[13px]"
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 size-4 text-[var(--q-text-4)]" aria-hidden />
    </label>
  )
}
