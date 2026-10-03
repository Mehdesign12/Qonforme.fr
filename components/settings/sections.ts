/**
 * Rubriques des paramètres, partagées par le cadre (colonne et onglets),
 * l'accueil des paramètres et les pages — application et démo.
 *
 * N'y figurent que des écrans qui existent : pas d'« Équipe » (plusieurs
 * utilisateurs) ni de plateforme agréée connectée (DECISIONS § 10).
 */
import { Bell, Building2, CreditCard, Layers, ShieldCheck, UserCheck, type LucideIcon } from "lucide-react"
import type { ShellMode } from "@/components/layout/nav"

export interface SettingsSection {
  key: string
  label: string
  /** Chemin dans l'application réelle ; la démo le préfixe par /demo. */
  href: string
  icon: LucideIcon
}

export const SETTINGS_SECTIONS: SettingsSection[] = [
  { key: "company", label: "Entreprise", href: "/settings/company", icon: Building2 },
  { key: "invoices", label: "Modèles de documents", href: "/settings/invoices", icon: Layers },
  { key: "ppf", label: "Facturation électronique", href: "/settings/ppf", icon: ShieldCheck },
  { key: "billing", label: "Abonnement", href: "/settings/billing", icon: CreditCard },
  { key: "notifications", label: "Relances", href: "/settings/notifications", icon: Bell },
  { key: "comptable", label: "Accès comptable", href: "/settings/comptable", icon: UserCheck },
]

/** Chemin d'une page des paramètres selon le mode (« /settings/company » → « /demo/settings/company »). */
export function settingsHref(href: string, mode: ShellMode): string {
  return mode === "demo" ? `/demo${href}` : href
}
