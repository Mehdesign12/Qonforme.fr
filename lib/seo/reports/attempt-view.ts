/**
 * Libellé « Dernier envoi » de Paramètres › Rapports : dernier essai du
 * résumé hebdomadaire et son état. Module pur (navigateur, serveur, tests).
 */
import type { DigestAttempt, WeekDigestState } from "@/lib/seo/reports/send"

/** « 12 oct. 2026, 08:30 », heure de Paris : même format que fmtDateTime (components/admin/ui, qui rend du JSX). */
function fmtDateTime(value: string): string {
  const d = new Date(value)
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

/** Même seuil que DIGEST_STALE_MS (lib/seo/reports/send.ts, serveur seulement). */
const DIGEST_STALE_MINUTES = 15

/**
 * « Dernier envoi » : le dernier essai et son état ; en échec, le motif (déjà
 * débarrassé de toute clé côté serveur) et le nouvel essai prévu.
 */
export function lastAttemptView(
  attempt: DigestAttempt | null,
  now: Date,
  weekState: WeekDigestState["kind"],
  maxAttempts: number,
  lastSentAt: string | null,
): { label: string; tone: "danger" | "neutral"; details: string[] } {
  if (!attempt) return { label: lastSentAt ? fmtDateTime(lastSentAt) : "—", tone: "neutral", details: [] }
  const at = fmtDateTime(attempt.createdAt)
  const details: string[] = []
  const previousSuccess = lastSentAt ? `Dernier résumé envoyé : ${fmtDateTime(lastSentAt)}.` : null
  if (attempt.status === "sent") return { label: `Envoyé le ${fmtDateTime(attempt.sentAt ?? attempt.createdAt)}`, tone: "neutral", details }
  if (attempt.status === "skipped") {
    if (attempt.error) details.push(`Motif : ${attempt.error}`)
    if (previousSuccess) details.push(previousSuccess)
    return { label: `Non envoyé le ${at}`, tone: "neutral", details }
  }
  const interrupted = attempt.status === "sending" && now.getTime() - Date.parse(attempt.createdAt) >= DIGEST_STALE_MINUTES * 60_000
  if (attempt.status === "sending" && !interrupted) return { label: `Envoi en cours depuis le ${at}`, tone: "neutral", details }
  details.push(interrupted ? "Motif : envoi interrompu, aucune réponse en 15 minutes." : `Motif : ${attempt.error ?? "erreur inconnue"}`)
  if (weekState === "retry") details.push(`Nouvel essai au prochain passage (essai ${attempt.attempt + 1} sur ${maxAttempts}).`)
  else if (attempt.attempt >= maxAttempts) details.push(`${maxAttempts} essais en échec cette semaine : le résumé repartira la semaine prochaine.`)
  if (previousSuccess) details.push(previousSuccess)
  return { label: `${interrupted ? "Interrompu" : "En échec"} le ${at} (essai ${attempt.attempt} sur ${maxAttempts})`, tone: "danger", details }
}
