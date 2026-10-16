/**
 * Plan mots-clés du 16/10/2026 (MOTS-CLES-COMPACTS-2026-10.md § 0, validé avec
 * le fondateur) : les requêtes exactes retenues, leur volume mensuel en France
 * (Google Ads via OpenSEO, 16/10/2026) et la page qui doit y répondre.
 *
 * Proposés dans l'éditeur d'articles même avant leur import, et ajoutés à
 * l'onglet Mots-clés par « Ajouter au suivi » (POST /api/admin/seo/keywords/plan).
 * Les lignes doubles du plan (« exemple devis peinture, peinture façade
 * extérieure ») sont des mots-clés distincts.
 *
 * Module pur.
 */
import type { KeywordIntent } from "@/lib/seo/types"

export interface PlanKeyword {
  /** Orthographe correcte, accents compris (forme canonique : minuscules). */
  keyword: string
  volume: number
  intent: KeywordIntent
  /** Page qui doit répondre ; null : plusieurs pages (pages métier). */
  targetPath: string | null
}

export const PLAN_LABEL = "Plan mots-clés du 16/10/2026"
export const PLAN_NOTE = "Plan mots-clés du 16/10/2026 (MOTS-CLES-COMPACTS-2026-10.md § 0)"

export const PLAN_KEYWORDS: PlanKeyword[] = [
  { keyword: "logiciel devis facture bâtiment", volume: 880, intent: "commercial", targetPath: "/" },
  { keyword: "exemple devis auto entrepreneur", volume: 480, intent: "informational", targetPath: "/modele/devis-auto-entrepreneur" },
  { keyword: "exemple devis remplacement tableau électrique", volume: 390, intent: "informational", targetPath: "/modele/devis-electricien" },
  { keyword: "exemple devis paysagiste", volume: 390, intent: "informational", targetPath: "/modele/devis-paysagiste" },
  { keyword: "exemple devis peinture", volume: 320, intent: "informational", targetPath: "/modele/devis-peinture" },
  { keyword: "devis peinture façade extérieure", volume: 320, intent: "informational", targetPath: "/modele/devis-peinture" },
  { keyword: "devis vierge à imprimer", volume: 260, intent: "informational", targetPath: "/modele/devis-vierge" },
  { keyword: "devis vierge pdf", volume: 170, intent: "informational", targetPath: "/modele/devis-vierge" },
  { keyword: "logiciel plombier", volume: 260, intent: "commercial", targetPath: "/facturation/plombier" },
  { keyword: "exemple devis électricité maison 100m2", volume: 210, intent: "informational", targetPath: "/modele/devis-electricien" },
  { keyword: "exemple devis maçonnerie", volume: 170, intent: "informational", targetPath: "/modele/devis-maconnerie" },
  { keyword: "modèle devis auto entrepreneur sans tva", volume: 140, intent: "informational", targetPath: "/modele/devis-auto-entrepreneur" },
  { keyword: "exemple devis plomberie", volume: 140, intent: "informational", targetPath: "/modele/devis-plomberie" },
  { keyword: "logiciel chauffagiste", volume: 140, intent: "commercial", targetPath: "/facturation/chauffagiste" },
  { keyword: "attestation tva 10 travaux", volume: 140, intent: "informational", targetPath: "/guide/tva-travaux" },
  { keyword: "exemple devis placo", volume: 110, intent: "informational", targetPath: "/modele/devis-placo" },
  { keyword: "relance facture impayée mail", volume: 110, intent: "informational", targetPath: "/modele/lettre-relance-impaye" },
  { keyword: "logiciel devis bâtiment gratuit", volume: 90, intent: "commercial", targetPath: null },
  { keyword: "logiciel devis artisan", volume: 90, intent: "commercial", targetPath: "/" },
  { keyword: "logiciel devis menuisier", volume: 70, intent: "commercial", targetPath: "/facturation/menuisier" },
  { keyword: "logiciel devis électricité gratuit", volume: 50, intent: "commercial", targetPath: "/facturation/electricien" },
]
