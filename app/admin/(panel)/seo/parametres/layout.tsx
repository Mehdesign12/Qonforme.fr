/**
 * Paramètres de l'onglet SEO (planches Parametres-*.dc.html) : en-tête commun
 * « Paramètres », carte de navigation des cinq écrans (260 px à gauche, au-dessus
 * du contenu sous 900 px de large et sur téléphone), contenu à droite.
 * Pas d'action primaire dans l'en-tête : chaque écran a la sienne.
 */
import { redirect } from "next/navigation"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { SeoHeader } from "@/components/admin/seo/SeoHeader"
import { SettingsNav } from "@/components/admin/seo/settings/SettingsNav"

export const dynamic = "force-dynamic"

export default async function SeoSettingsLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAdminAuthenticated())) redirect("/admin/login")
  return (
    <div className="flex flex-col gap-5">
      <SeoHeader
        section="settings"
        title="Paramètres"
        subtitle="Gérez qonforme.fr, votre contexte de marque et vos préférences SEO."
      />
      <div className="flex flex-col gap-5 md:flex-row md:flex-wrap md:items-start">
        <SettingsNav />
        <div className="flex min-w-0 flex-col gap-5 md:flex-[1_1_620px]">{children}</div>
      </div>
    </div>
  )
}
