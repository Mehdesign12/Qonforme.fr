/**
 * Paramètres › Connexions (planche Parametres-connexions.dc.html).
 * Présence des variables d'environnement (jamais leur valeur, lib/seo/connections.ts)
 * et derniers résultats du bouton « Tester » (lib/seo/connections-test.ts).
 * La présence ne dépend pas de la base : la page s'affiche même avant la
 * migration ou pendant une coupure, seul l'historique des tests manque alors
 * (deux messages distincts : base pas à jour, ou lecture en échec).
 */
import { redirect } from "next/navigation"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { load, seoDb } from "@/lib/seo/db"
import { connectionStatuses } from "@/lib/seo/connections"
import { readConnectionTests } from "@/lib/seo/connections-test"
import { gscProperty } from "@/lib/seo/google"
import { ConnectionsPanel } from "@/components/admin/seo/settings/ConnectionsPanel"

export const dynamic = "force-dynamic"
export const metadata = { title: "Admin — SEO · Connexions" }

export default async function SeoConnectionsSettingsPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login")
  const tests = await load(() => readConnectionTests(seoDb()))
  const rows = connectionStatuses().map((c) => ({
    key: c.key,
    name: c.name,
    purpose: c.purpose,
    env: c.env,
    note: c.note,
    state: c.state,
  }))
  return (
    <ConnectionsPanel
      rows={rows}
      initialTests={tests.ok ? tests.data : {}}
      testsFailure={tests.ok ? null : tests.failure}
      property={gscProperty()}
    />
  )
}
