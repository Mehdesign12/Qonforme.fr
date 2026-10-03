import type { Metadata } from "next"
import Link from "next/link"
import AuthLayout from "@/components/auth/AuthLayout"
import { AuthTitle, Serif } from "@/components/auth/AuthHeading"
import { UnsubscribeClient } from "@/components/onboarding/UnsubscribeClient"
import { verifyUnsubscribeToken } from "@/lib/onboarding/unsubscribe"

export const metadata: Metadata = {
  title: "Désinscription — Qonforme",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
}
export const dynamic = "force-dynamic"

/**
 * Désinscription des conseils de démarrage, depuis le lien signé des emails
 * (lib/onboarding/unsubscribe.ts), sans connexion. Le jeton est vérifié ici
 * avant tout ; l'enregistrement se fait par POST (components/onboarding/UnsubscribeClient).
 * Page propre à un compte : jamais mise en cache par le service worker.
 */
export default function UnsubscribePage({ searchParams }: { searchParams: { t?: string } }) {
  const token = typeof searchParams?.t === "string" ? searchParams.t : ""
  const valid = verifyUnsubscribeToken(token) !== null

  return (
    <AuthLayout maxWidth="lg">
      <div className="flex flex-col gap-6">
        <AuthTitle className="!text-[30px] sm:!text-[36px]">Conseils de <Serif>démarrage</Serif></AuthTitle>
        {valid ? (
          <UnsubscribeClient token={token} />
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-[16px] leading-relaxed text-q-text-3" role="alert">
              Ce lien de désinscription n&apos;est pas valable : il a peut-être été coupé en deux par votre messagerie.
              Vous pouvez aussi désactiver les conseils depuis Paramètres › Relances, une fois connecté.
            </p>
            <Link href="/settings/notifications" className="q-btn q-btn-primary q-btn-lg self-start">Ouvrir mes paramètres</Link>
          </div>
        )}
      </div>
    </AuthLayout>
  )
}
