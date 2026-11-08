/**
 * Ouverture de l'émission par la plateforme agréée (Super PDP) : UN SEUL
 * réglage. `PLATFORM_SENDING_MODES` dit quels comptes peuvent envoyer leurs
 * factures par la plateforme : `["test"]` = comptes d'essai (bac à sable)
 * seulement ; ajouter `"live"` ouvre la production, après l'essai complet par
 * le fondateur (DECISIONS § 16).
 *
 * Tous les textes publics qui parlent de l'émission (Tarifs, outils, guides,
 * pages métier, llms.txt, consignes des générateurs d'articles) lisent
 * `PLATFORM_SENDING_LIVE` : ils disent « prévu pour 2027 » tant que la
 * production est fermée, et la fonction livrée dès qu'elle est ouverte. Les
 * écrans de l'application lisent le mode du compte (`platformSendingOpenFor`).
 * Module pur, sans dépendance serveur (lu par des composants client).
 */
import type { PaMode } from "@/lib/pa/superpdp/config"

export const PLATFORM_SENDING_MODES: readonly PaMode[] = ["test", "live"]

/** Émission ouverte aux comptes de production : les textes publics la présentent comme livrée. */
export const PLATFORM_SENDING_LIVE: boolean = PLATFORM_SENDING_MODES.includes("live")

/** L'émission est-elle ouverte pour un compte de ce mode ? */
export function platformSendingOpenFor(mode: PaMode | null | undefined): boolean {
  return !!mode && PLATFORM_SENDING_MODES.includes(mode)
}

/** Textes publics de l'émission, selon que la production est ouverte ou non. */
export function sendingTexts(live: boolean) {
  return {
    /** Fin de phrase après « vos factures fournisseurs arrivent par une plateforme agréée ; ». */
    clause: live
      ? "vos factures à vos clients professionnels inscrits à l'annuaire partent aussi par la plateforme"
      : "l'envoi de vos factures par la plateforme est prévu pour 2027",
    /** Phrase autonome, pour une FAQ ou une liste de faits. */
    sentence: live
      ? "Avec Essentiel, vos factures et avoirs partent aussi par la plateforme agréée vers vos clients professionnels inscrits à l'annuaire de la facturation électronique ; les autres reçoivent toujours leur facture par email."
      : "L'envoi de vos factures à vos clients par la plateforme agréée est prévu pour 2027 ; d'ici là, elles partent par email avec leur PDF Factur-X.",
    /** Consigne des générateurs d'articles. */
    promptRule: live
      ? "Avec la formule Essentiel, Qonforme envoie aussi les factures et avoirs aux clients professionnels inscrits à l'annuaire de la facturation électronique par une plateforme agréée ; les autres clients les reçoivent par email."
      : "L'envoi des factures des artisans à leurs clients par la plateforme agréée n'est pas encore disponible (prévu pour 2027) : n'écrivez jamais que Qonforme envoie ou transmet les factures électroniques des artisans à leurs clients.",
  }
}

const TEXTS = sendingTexts(PLATFORM_SENDING_LIVE)
export const SENDING_CLAUSE = TEXTS.clause
export const SENDING_SENTENCE = TEXTS.sentence
export const SENDING_PROMPT_RULE = TEXTS.promptRule

/** Ligne de la formule Essentiel (fonction livrée, ou « à venir »). */
export const SENDING_FEATURE = "Envoi de vos factures et avoirs à vos clients par la plateforme agréée"
export const SENDING_UPCOMING = "Envoi de vos factures à vos clients par la plateforme agréée, prévu pour 2027"
