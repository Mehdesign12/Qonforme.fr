import type { TypeDocument } from "@/lib/outils/document"

/**
 * Message affiché juste après le téléchargement du PDF des outils gratuits
 * (devis et facture), au moment où l'intention est la plus forte.
 *
 * Ce qui est dit doit rester vrai (DECISIONS-STRATEGIQUES.md § 2) :
 * - l'outil n'enregistre rien : on ne promet donc pas de « retrouver » le document dans un compte ;
 * - un compte gratuit donne des clients et des mentions légales enregistrés une fois, et des
 *   devis gratuits et illimités, envoyables par email ;
 * - on ne parle pas ici de la signature en ligne (décision du fondateur) ni de l'envoi des factures.
 * `source` s'ajoute à l'adresse d'inscription : PostHog la garde dans l'URL de la page vue, ce qui
 * permet d'attribuer l'inscription à l'outil.
 */
export interface MessageApresPdf {
  titre: string
  texte: string
  cta: string
  href: string
}

export function messageApresPdf(type: TypeDocument): MessageApresPdf {
  if (type === "facture") {
    return {
      titre: "Votre facture est prête",
      texte: "Avec un compte gratuit, vos clients et vos mentions légales sont enregistrés une fois, et vos devis sont gratuits et illimités.",
      cta: "Créer mon compte gratuit",
      href: "/signup?source=outil-facture-pdf",
    }
  }
  return {
    titre: "Votre devis est prêt",
    texte: "Avec un compte gratuit, vos clients et vos mentions légales sont enregistrés une fois : vos prochains devis se font plus vite et partent par email à vos clients.",
    cta: "Créer mon compte gratuit",
    href: "/signup?source=outil-devis-pdf",
  }
}
