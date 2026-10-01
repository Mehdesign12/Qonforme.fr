/**
 * Règles de cycle de vie des documents commerciaux (factures, devis, bons de commande).
 *
 * Une facture émise ne se modifie ni ne se supprime : la numérotation doit rester
 * continue et chaque erreur se corrige par un avoir (CGI art. 242 nonies A, BOFiP).
 * Ces règles sont appliquées côté serveur, quel que soit l'écran ou l'appel qui
 * demande le changement : le masquage des boutons dans l'interface ne suffit pas.
 *
 * Avant ce module, un simple PATCH { status: "draft" } remettait une facture
 * émise en brouillon, ce qui la rendait de nouveau modifiable et supprimable.
 */

export type DocumentKind = "invoice" | "quote" | "purchase_order"

/**
 * Changements de statut acceptés par les routes PATCH, par type de document.
 * Tout ce qui n'est pas listé est refusé. Le retour vers « draft » n'est jamais listé.
 *
 * Factures :
 * - « credited » n'est posé que par la route d'avoir, « cancelled » par aucune
 *   route (une facture ne s'annule que par un avoir) : ils sont donc absents ici ;
 * - « paid » peut revenir à « sent » ou « overdue » pour corriger un paiement
 *   saisi par erreur : c'est le suivi de l'encaissement, pas le contenu de la facture ;
 * - « rejected » (rejet technique par la plateforme) peut être renvoyé une fois corrigé.
 */
const TRANSITIONS: Record<DocumentKind, Record<string, readonly string[]>> = {
  invoice: {
    draft: ["sent"],
    sent: ["pending", "received", "accepted", "rejected", "paid", "overdue"],
    pending: ["received", "accepted", "rejected", "paid", "overdue"],
    received: ["accepted", "rejected", "paid", "overdue"],
    accepted: ["paid", "overdue"],
    overdue: ["paid"],
    rejected: ["sent"],
    paid: ["sent", "overdue"],
    credited: [],
    cancelled: [],
  },
  quote: {
    draft: ["sent"],
    sent: ["accepted", "rejected"],
    accepted: [],
    rejected: [],
  },
  purchase_order: {
    draft: ["sent"],
    sent: ["confirmed", "cancelled"],
    confirmed: ["cancelled"],
    cancelled: [],
  },
}

/** Statut de création imposé, quoi que contienne la requête. */
export const INITIAL_STATUS = "draft"

/** Vrai si le changement `from` → `to` est autorisé. Un statut identique est toujours accepté (requête rejouée). */
export function canTransition(kind: DocumentKind, from: string, to: string): boolean {
  if (from === to) return true
  return TRANSITIONS[kind][from]?.includes(to) ?? false
}

/** Le contenu (lignes, montants, client, dates) n'est modifiable qu'à l'état de brouillon. */
export function isContentLocked(status: string): boolean {
  return status !== "draft"
}

/**
 * Statut après un envoi par email. Seul un brouillon (ou une facture rejetée
 * techniquement puis renvoyée) passe à « sent » ; renvoyer une copie d'un
 * document déjà payé, accepté ou crédité ne doit pas écraser son statut.
 */
export function statusAfterSend(kind: DocumentKind, current: string): string {
  if (current === "draft") return "sent"
  if (kind === "invoice" && current === "rejected") return "sent"
  return current
}

/** Statuts de facture qui peuvent recevoir une relance de paiement : émise, non réglée, non créditée. */
const REMINDABLE_INVOICE_STATUSES: readonly string[] = ["sent", "pending", "received", "accepted", "overdue"]

export function canRemindInvoice(status: string): boolean {
  return REMINDABLE_INVOICE_STATUSES.includes(status)
}

/** Seul un devis envoyé ou accepté peut devenir une facture. */
export function canConvertQuote(status: string): boolean {
  return status === "sent" || status === "accepted"
}

/** Message d'erreur lisible pour un changement refusé. */
export function transitionError(kind: DocumentKind, from: string, to: string): string {
  if (to === "draft") {
    return kind === "invoice"
      ? "Une facture émise ne peut pas redevenir un brouillon. Pour la corriger, créez un avoir."
      : "Un document envoyé ne peut pas redevenir un brouillon. Dupliquez-le pour repartir d'une nouvelle version."
  }
  return `Changement de statut impossible : ${from} → ${to}`
}
