/**
 * Suivi d'un email du journal, tel que l'admin le lit : remis, rejeté, cliqué,
 * étape franchie. Module pur (écrans serveur et client, tests).
 */
import type { Tone } from "@/components/app/kit"

export interface TrackableEmail {
  category: string
  status: string
  sent_at: string
  delivered_at: string | null
  bounced_at: string | null
  opened_at: string | null
  first_clicked_at: string | null
  click_count: number
  error?: string | null
}

export interface TrackStep {
  label: string
  tone: Tone
}

const HM = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
export const fmtWhen = (iso: string) => HM.format(new Date(iso)).replace(":", " h ")

/** Pastilles de suivi, dans l'ordre. */
export function trackSteps(e: TrackableEmail): TrackStep[] {
  if (e.status === "failed") return [{ label: "Non parti", tone: "danger" }]
  if (e.status === "sending") return [{ label: "Envoi en cours", tone: "neutral" }]
  const steps: TrackStep[] = []
  if (e.status === "bounced") steps.push({ label: "Rejeté par la messagerie", tone: "danger" })
  else if (e.status === "complained") steps.push({ label: "Signalé comme indésirable", tone: "danger" })
  else if (e.status === "delivered" || e.delivered_at) steps.push({ label: "Remis", tone: "neutral" })
  else steps.push({ label: "Envoyé", tone: "neutral" })
  if (e.opened_at) steps.push({ label: `Ouvert ${fmtWhen(e.opened_at)}`, tone: "info" })
  if (e.first_clicked_at) {
    steps.push({ label: e.click_count > 1 ? `Cliqué ${e.click_count} fois` : `Cliqué ${fmtWhen(e.first_clicked_at)}`, tone: "info" })
    steps.push({ label: "Revenu sur Qonforme", tone: "ok" })
  } else if (e.status !== "bounced" && e.status !== "complained") {
    steps.push({ label: "Pas encore cliqué", tone: "neutral" })
  }
  return steps
}

/** Une ligne courte pour la liste des utilisateurs. */
export function trackSummary(e: TrackableEmail): { text: string; tone: Tone } {
  if (e.status === "failed") return { text: "Non parti", tone: "danger" }
  if (e.status === "bounced") return { text: "Rejeté par la messagerie", tone: "danger" }
  if (e.status === "complained") return { text: "Signalé comme indésirable", tone: "danger" }
  if (e.first_clicked_at) return { text: "Cliqué, revenu sur Qonforme", tone: "ok" }
  if (e.opened_at) return { text: "Ouvert, pas cliqué", tone: "info" }
  return { text: "Pas encore cliqué", tone: "neutral" }
}

export const CATEGORY_LABELS: Record<string, { label: string; tone: Tone }> = {
  onboarding: { label: "Démarrage", tone: "neutral" },
  reprise: { label: "Reprise", tone: "warn" },
  manual: { label: "À la main", tone: "info" },
  account: { label: "Compte", tone: "neutral" },
}
