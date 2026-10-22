import type { Metadata } from "next"
import { ContentHero, ContentPage, WRAP } from "@/components/content/ui"
import { ContactClient } from "@/components/support/ContactClient"

export const metadata: Metadata = {
  title: "Contact : écrire à Qonforme",
  description: "Une question sur votre compte, la facturation ou un problème à signaler ? Écrivez à Christophe, responsable service client : il vous répond par email.",
  alternates: { canonical: "/contact" },
}

export default function ContactPage() {
  return (
    <ContentPage>
      <ContentHero
        size="md"
        className="sm:pb-24"
        crumbs={[{ label: "Accueil", href: "/" }, { label: "Contact" }]}
        title="Une question ?"
        accent="Écrivez-nous."
        sub="Christophe lit votre message et vous répond par email."
      />
      <div className="px-4 pb-20 sm:px-6">
        <div className={WRAP}>
          <ContactClient />
        </div>
      </div>
    </ContentPage>
  )
}
