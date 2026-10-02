'use client'

/**
 * Barre supérieure de la démo : celle de l'application réelle (Header.tsx) en
 * mode « demo » (badge « Démo », « Créer mon compte » dans le menu du compte).
 */
import { Header } from "@/components/layout/Header"
import { DEMO_IDENTITY } from "@/components/layout/shell"

export function DemoHeader() {
  return <Header identity={DEMO_IDENTITY} />
}
