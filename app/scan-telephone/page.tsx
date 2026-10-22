import type { Metadata } from "next"
import { cookies } from "next/headers"
import { PhoneScan } from "@/components/scan/PhoneScan"
import { createAdminClient } from "@/lib/supabase/server"
import { PAIR_COOKIE, authorizePairing } from "@/lib/scan/pairing"

/**
 * Scan depuis un téléphone appairé. Publique (accès par le cookie posé par
 * /scan/p/<jeton>), propre à un compte : jamais indexée, jamais mise en cache,
 * sans Referer, sans mesure d'audience (consent.ts).
 */
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Scanner un document",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: "no-referrer",
}

export default async function ScanTelephonePage() {
  let valid = false
  try {
    const access = await authorizePairing(createAdminClient(), cookies().get(PAIR_COOKIE)?.value)
    valid = access.ok
  } catch {
    valid = false
  }
  if (valid) return <PhoneScan />
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-6 py-10 text-center">
      <h1 className="q-h1">Ce code n&apos;est plus <span className="font-serif italic text-[var(--q-accent)]">valable.</span></h1>
      <p className="text-[15px] leading-relaxed text-[var(--q-text-3)]">
        Le code d&apos;appairage dure 15 minutes. Sur votre ordinateur, ouvrez Documents puis « Avec mon téléphone » : un nouveau QR code s&apos;affiche, à scanner avec l&apos;appareil photo de ce téléphone.
      </p>
    </main>
  )
}
