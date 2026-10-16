"use client"

/**
 * Carte « Plan mots-clés du 16 octobre » (admin › SEO › Mots-clés) : affichée
 * tant que des mots-clés du plan (lib/seo/keywords/plan.ts) ne sont pas
 * suivis. « Ajouter au suivi » appelle POST /api/admin/seo/keywords/plan :
 * les manquants arrivent en « Ciblé » avec leur volume et leur page ; les
 * mots-clés déjà suivis gardent leur statut. Puis la page se recharge
 * (router.refresh) et la carte disparaît d'elle-même.
 */
import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ListPlus, Loader2, Map as MapIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { api } from "@/components/admin/seo/articles/api"
import type { PlanImportResult } from "@/lib/seo/articles/editor-types"

const nf = (n: number) => n.toLocaleString("fr-FR")
const PREVIEW = 3

export function PlanImportCard({
  missing,
  total,
  className,
}: {
  /** Mots-clés du plan pas encore suivis, les plus recherchés d'abord. */
  missing: { keyword: string; volume: number; targetPath: string | null }[]
  /** Mots-clés du plan. */
  total: number
  className?: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  if (missing.length === 0) return null

  const shown = missing.slice(0, PREVIEW)
  const rest = missing.length - shown.length
  const volume = missing.reduce((s, k) => s + k.volume, 0)

  async function importPlan() {
    if (busy) return
    setBusy(true)
    const res = await api<PlanImportResult>("/api/admin/seo/keywords/plan", "POST")
    setBusy(false)
    if (!res.ok || !res.data) {
      toast.error(res.error ?? "L'ajout n'a pas pu aboutir. Réessayez dans un instant.")
      return
    }
    const { added, updated } = res.data
    const parts = [
      added > 0 ? `${nf(added)} mot${added > 1 ? "s" : ""}-clé${added > 1 ? "s" : ""} ajouté${added > 1 ? "s" : ""} au suivi` : null,
      updated > 0 ? `${nf(updated)} complété${updated > 1 ? "s" : ""}` : null,
    ].filter(Boolean)
    toast.success(parts.length > 0 ? `${parts.join(", ")}.` : "Le plan est déjà suivi en entier.")
    router.refresh()
  }

  return (
    // Carte du kit, sans liseré : la tuile d'icône porte l'accent (une proposition, pas une alerte)
    <section aria-labelledby="titre-plan-mots-cles" className={cn("q-card", className)}>
      <div className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:gap-6 md:p-5 md:pl-6">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex items-start gap-3.5">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--q-wash)] text-[var(--q-accent-strong)]" aria-hidden>
              <MapIcon className="size-5" />
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <p className="q-eyebrow m-0">Plan mots-clés du 16 octobre</p>
              <h2 id="titre-plan-mots-cles" className="m-0 text-[15px] font-semibold leading-snug text-[var(--q-ink)] md:text-base">
                {nf(total)} mots-clés, dont {nf(missing.length)} pas encore suivi{missing.length > 1 ? "s" : ""}
              </h2>
            </div>
          </div>
          <div className="flex min-w-0 flex-col gap-2 md:pl-[54px]">
            {/* Téléphone : liste empilée (mot-clé à gauche, volume aligné à droite) ; ordinateur : puces */}
            <ul className="m-0 flex list-none flex-col gap-1.5 p-0 md:flex-row md:flex-wrap" aria-label="Aperçu des mots-clés à ajouter">
              {shown.map((k) => (
                <li
                  key={k.keyword}
                  className="flex min-w-0 max-w-full items-baseline justify-between gap-3 rounded-xl border border-[var(--q-line)] bg-[var(--q-surface-2)] px-3 py-2 text-[13px] leading-snug md:inline-flex md:justify-start md:gap-1.5 md:rounded-2xl md:px-2.5 md:py-1 md:text-[12.5px]"
                >
                  <span className="min-w-0 font-medium text-[var(--q-ink)] [overflow-wrap:anywhere]">{k.keyword}</span>
                  <span className="q-num shrink-0 whitespace-nowrap tabular-nums text-[var(--q-text-4)]">{nf(k.volume)}/mois</span>
                </li>
              ))}
              {rest > 0 && (
                <li className="inline-flex items-center px-1 pt-0.5 text-[12.5px] text-[var(--q-text-4)] md:rounded-full md:px-1.5 md:py-1">
                  et {nf(rest)} autre{rest > 1 ? "s" : ""}
                </li>
              )}
            </ul>
            <p className="m-0 text-[12px] leading-snug text-[var(--q-text-4)]">
              {nf(volume)} recherches par mois au total. Ajoutés en « Ciblé », avec leur volume et leur page ; les mots-clés déjà suivis gardent leur statut.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={importPlan}
          aria-disabled={busy || undefined}
          aria-busy={busy || undefined}
          className="q-btn q-btn-primary w-full shrink-0 max-md:h-12 max-md:rounded-[14px] max-md:text-[15px] md:w-auto"
        >
          {busy ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden /> : <ListPlus aria-hidden />}
          {busy ? "Ajout en cours…" : "Ajouter au suivi"}
        </button>
      </div>
    </section>
  )
}
