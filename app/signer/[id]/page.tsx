import type { Metadata } from "next"
import { cookies } from "next/headers"
import { createAdminClient } from "@/lib/supabase/server"
import { PublicSignView } from "@/components/signature/PublicSignView"
import { buildPublicView, emptyPublicView } from "@/lib/signature/public"
import { isUuid, linkCookieName, loadLinkForToken } from "@/lib/signature/server"
import type { PublicSignViewData } from "@/lib/signature/view"

/**
 * /signer/<identifiant> — page publique du client (sans compte).
 *
 * Le jeton n'est jamais dans l'adresse : il arrive par le cookie HttpOnly posé
 * par /s/<jeton>. Sans cookie valable, la page dit « lien introuvable » et ne
 * montre rien du document. Jamais indexée, jamais mise en cache (dynamique,
 * absente des pages du service worker), sans Referer vers les liens sortants.
 */
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Signature en ligne",
  description: "Consultez et signez votre document.",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: "no-referrer",
}

export default async function SignerPage({ params, searchParams }: { params: { id: string }; searchParams: Record<string, string | string[] | undefined> }) {
  const id = params.id
  let data: PublicSignViewData = emptyPublicView(isUuid(id) ? id : "inconnu")

  if (isUuid(id)) {
    try {
      const admin = createAdminClient()
      const row = await loadLinkForToken(admin, id, cookies().get(linkCookieName(id))?.value)
      if (row) data = await buildPublicView(admin, row, { onSite: searchParams["sur-place"] === "1" })
    } catch (err) {
      console.error("[signature] page publique :", err)
    }
  }

  return <PublicSignView data={data} />
}
