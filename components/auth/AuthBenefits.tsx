import { Bell, FileCheck2, FileText, Smartphone, type LucideIcon } from "lucide-react"

/**
 * Colonne de droite de la connexion (canevas « Connexion », « À votre retour »).
 * Uniquement ce que le code livre : devis gratuits (mur de paiement à
 * l'émission seulement), mentions et PDF avec données Factur-X, relance en un clic et
 * rappels du cron J+30/J+45 réservés aux formules, site installable (PWA).
 */
const BENEFITS: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: FileText,
    title: "Des devis gratuits et illimités",
    text: "Préparez et envoyez autant de devis qu’il le faut, sans formule. Elle ne sert qu’à émettre vos factures.",
  },
  {
    icon: FileCheck2,
    title: "Des factures aux mentions obligatoires",
    text: "Numérotation continue, mentions légales reprises d’office, PDF accompagné de ses données Factur-X, à télécharger ou envoyer.",
  },
  {
    icon: Bell,
    title: "Des relances par email",
    text: "Avec une formule, relancez un client en un clic ; un rappel part aussi 30 puis 45 jours après l’échéance.",
  },
  {
    icon: Smartphone,
    title: "Sur votre téléphone aussi",
    text: "Le site s’installe sur l’écran d’accueil de votre téléphone, comme une application.",
  },
]

export default function AuthBenefits() {
  return (
    <div className="w-full max-w-[480px]">
      <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-q-text-4">À votre retour</p>
      <ul className="mt-4 flex flex-col gap-3.5">
        {BENEFITS.map(({ icon: Icon, title, text }) => (
          <li key={title} className="q-card flex items-start gap-3.5 px-[18px] py-4">
            <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[11px] bg-q-wash text-q-accent-strong">
              <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
            </span>
            <span className="flex flex-col gap-[3px]">
              <span className="text-[15px] font-semibold tracking-[-0.005em] text-q-ink">{title}</span>
              <span className="text-[14px] leading-[1.5] text-q-text-3">{text}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
