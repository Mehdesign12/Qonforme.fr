'use client'

/**
 * Barre latérale et barre du bas de la démo : les composants de l'application
 * réelle (Sidebar.tsx) en mode « demo » — un seul rendu pour les deux, donc
 * jamais de décalage entre la démo et le produit (règle « Mode démo » de CLAUDE.md).
 * Spécifique à la démo : badge « Démo », encart « Mode démo », « Créer mon compte »
 * et « Retour à l'accueil » à la place de la déconnexion.
 */
import { Sidebar, MobileBottomNav } from "@/components/layout/Sidebar"
import { DEMO_IDENTITY } from "@/components/layout/shell"

export function DemoSidebar() {
  return <Sidebar identity={DEMO_IDENTITY} />
}

export function DemoMobileBottomNav() {
  return <MobileBottomNav identity={DEMO_IDENTITY} />
}
