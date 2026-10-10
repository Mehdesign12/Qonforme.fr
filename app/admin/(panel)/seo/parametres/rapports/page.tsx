/**
 * Paramètres › Rapports (planche Parametres-rapports.dc.html) : réglages du
 * résumé hebdomadaire et aperçu construit avec les données actuelles
 * (lib/seo/reports). L'adresse de l'administrateur n'est jamais affichée.
 * « Dernier envoi » montre le dernier essai et son état (envoyé, en échec
 * avec le motif sans clé, interrompu, non envoyé) et le nouvel essai prévu.
 */
import { redirect } from "next/navigation"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { load, seoDb } from "@/lib/seo/db"
import { getSettings } from "@/lib/seo/settings"
import { buildDigest } from "@/lib/seo/reports/digest"
import { currentWeekKey } from "@/lib/seo/reports/schedule"
import {
  deliveryProblem,
  digestBaseUrl,
  DIGEST_MAX_ATTEMPTS,
  lastWeeklyAttempt,
  lastWeeklySentAt,
  readWeekAttempts,
  weekDigestState,
} from "@/lib/seo/reports/send"
import { ALL_DIGEST_SECTIONS } from "@/lib/seo/reports/types"
import { FailureState } from "@/components/admin/seo/SeoStates"
import { ReportsForm } from "@/components/admin/seo/settings/ReportsForm"

export const dynamic = "force-dynamic"
export const metadata = { title: "Admin — SEO · Rapports" }

export default async function SeoReportsSettingsPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login")
  const db = seoDb()
  const now = new Date()
  const settings = await load(async () => {
    const [stored, lastSentAt, weekAttempts, lastAttempt] = await Promise.all([
      getSettings(db, "reports"),
      lastWeeklySentAt(db),
      readWeekAttempts(db, currentWeekKey(now)),
      lastWeeklyAttempt(db),
    ])
    return { stored, lastSentAt, week: weekDigestState(weekAttempts, now), lastAttempt }
  })
  if (!settings.ok) return <FailureState failure={settings.failure} what="les réglages des rapports" retryHref="/admin/seo/parametres/rapports" />

  // Aperçu : toutes les sections lues, la page n'affiche que celles cochées
  const digest = await load(() => buildDigest(db, now, ALL_DIGEST_SECTIONS))

  return (
    <ReportsForm
      initial={settings.data.stored.value}
      updatedAt={settings.data.stored.updatedAt}
      digest={digest.ok ? digest.data : null}
      digestError={digest.ok ? null : "Aperçu indisponible : les données du résumé n'ont pas pu être lues. Réessayez dans un instant."}
      baseUrl={digestBaseUrl()}
      deliveryProblem={deliveryProblem()}
      lastSentAt={settings.data.lastSentAt}
      lastAttempt={settings.data.lastAttempt}
      weekState={settings.data.week.kind}
      maxAttempts={DIGEST_MAX_ATTEMPTS}
      nowIso={now.toISOString()}
    />
  )
}
