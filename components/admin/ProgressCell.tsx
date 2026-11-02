import { StatusPill } from "@/components/app/kit"
import { PROGRESS_STEPS, ageLabel, type Progress } from "@/lib/admin/onboarding-progress"

/**
 * Colonne « Parcours » d'Admin › Utilisateurs : cinq points (entreprise, devis créé, devis envoyé,
 * facture créée, facture envoyée) et l'état : terminé, en cours (prochaine étape) ou bloqué avant
 * le premier devis depuis N jours. `null` : lecture impossible, jamais confondue avec « rien fait ».
 */
export function ProgressCell({ progress }: { progress: Progress | null }) {
  if (!progress) return <span className="text-[13px] text-[var(--q-placeholder)]">Indisponible</span>

  const doneLabels = PROGRESS_STEPS.filter((_, i) => progress.done[i]).map((s) => s.label)
  const summary = doneLabels.length
    ? `${progress.completed} étape${progress.completed > 1 ? "s" : ""} sur ${progress.total} : ${doneLabels.join(", ")}`
    : `Aucune étape sur ${progress.total}`

  return (
    <span className="flex min-w-[170px] flex-col items-start gap-1.5">
      <span role="img" aria-label={summary} title={summary} className="flex items-center gap-1">
        {progress.done.map((d, i) => (
          <span
            key={PROGRESS_STEPS[i].key}
            aria-hidden
            className={
              d
                ? "size-2.5 rounded-full bg-[var(--q-accent)]"
                : "size-2.5 rounded-full border border-[var(--q-field)] bg-transparent"
            }
          />
        ))}
        <span aria-hidden className="ml-1 text-xs tabular-nums text-[var(--q-text-3)]">
          {progress.completed}/{progress.total}
        </span>
      </span>
      {progress.status === "complete" ? (
        <StatusPill tone="ok" className="!h-5 !text-[11px]">Facture envoyée</StatusPill>
      ) : progress.status === "needs_help" ? (
        <StatusPill tone="warn" className="!h-5 !text-[11px]">
          Bloqué : {progress.stuckAt}
          <span className="font-normal"> · {ageLabel(progress.ageDays)}</span>
        </StatusPill>
      ) : (
        <span className="text-xs text-[var(--q-text-3)]">
          Prochaine : {progress.next} · {ageLabel(progress.ageDays)}
        </span>
      )}
    </span>
  )
}
