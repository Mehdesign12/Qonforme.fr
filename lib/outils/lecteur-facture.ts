/**
 * Lecteur de facture électronique (outil gratuit /outils/lecteur-factur-x).
 *
 * Même lecture que l'import des factures reçues (lib/reception/analyze.ts) :
 * PDF Factur-X (XML joint), XML CII ou XML UBL 2.1, type reconnu par le contenu.
 * Mêmes contrôles (lib/reception/checks.ts), sauf ceux qui supposent un compte :
 * destinataire (SIREN de l'entreprise) et doublon.
 *
 * Code pur : il tourne dans le navigateur, le fichier n'est envoyé nulle part.
 */
import { analyzeFile } from "@/lib/reception/analyze"
import { checkParsedInvoice } from "@/lib/reception/checks"
import { PLATFORM_SENDING_LIVE } from "@/lib/pa/sending"
import type { ParsedInvoice, ReceivedFormat, ReceptionCheck } from "@/lib/reception/types"

/** Contrôles qui n'ont de sens qu'avec le compte de l'entreprise destinataire. */
const ACCOUNT_CHECKS = new Set(["buyer_siren", "duplicate"])

export type LectureFacture =
  | { ok: true; kind: "structured"; format: Exclude<ReceivedFormat, "pdf">; invoice: ParsedInvoice; checks: ReceptionCheck[]; has_pdf: boolean }
  | { ok: true; kind: "pdf_only"; note: string }
  | { ok: false; message: string }

/** Ce qu'un PDF sans données structurées veut dire, en clair. */
export const PDF_SIMPLE_NOTE =
  "Ce PDF ne contient pas de données de facture électronique : c'est une facture PDF simple, lisible par une personne mais pas par un logiciel. Ce n'est pas une facture électronique au sens de la réforme."

export async function lireFactureElectronique(bytes: Uint8Array): Promise<LectureFacture> {
  const a = await analyzeFile(bytes)
  if (!a.ok) return { ok: false, message: a.message }
  if (a.kind === "pdf_only") {
    // Les notes de l'import (« Saisissez l'essentiel ci-dessous ») parlent à un utilisateur connecté
    const reason = a.note ? `${a.note.replace(/\s*Saisissez l'essentiel ci-dessous\.?$/, "").trim()} ` : ""
    return { ok: true, kind: "pdf_only", note: `${reason}${PDF_SIMPLE_NOTE}`.trim() }
  }
  const checks = checkParsedInvoice(a.invoice, a.format, { companySiren: null, duplicate: null }).filter((c) => !ACCOUNT_CHECKS.has(c.id))
  return { ok: true, kind: "structured", format: a.format, invoice: a.invoice, checks, has_pdf: a.has_pdf }
}

/**
 * Questions de la page (affichées et reprises telles quelles dans le JSON-LD FAQPage).
 * Chaque réponse commence par le bénéfice ou par « Oui » (DECISIONS § 2).
 */
export const LECTEUR_FAQ: { q: string; a: string }[] = [
  {
    q: "Qu'est-ce qu'une facture Factur-X ?",
    a: "C'est une facture électronique en deux parties dans un seul fichier : un PDF lisible par une personne et un fichier XML joint (factur-x.xml), lisible par un logiciel. Le format est franco-allemand, fondé sur la norme européenne EN 16931, et fait partie des trois formats admis par la réforme de la facturation électronique, avec UBL et CII.",
  },
  {
    q: "Comment lire une facture Factur-X ?",
    a: "Déposez-la dans le lecteur ci-dessus : vendeur, client, lignes, TVA par taux, totaux et coordonnées de paiement s'affichent en clair, avec les contrôles de cohérence. Un lecteur PDF ordinaire montre seulement la partie visible ; les données du XML joint restent cachées.",
  },
  {
    q: "Comment savoir si ma facture PDF est une facture électronique ?",
    a: "Le lecteur vous le dit en une seconde : il cherche le XML joint au PDF. S'il n'y en a pas, c'est une facture PDF simple. Vous pouvez aussi ouvrir le panneau des pièces jointes de votre lecteur PDF : une facture Factur-X joint un fichier factur-x.xml.",
  },
  {
    q: "Mon fichier est-il envoyé sur un serveur ?",
    a: "Il reste sur votre appareil : le lecteur tourne dans votre navigateur et n'envoie le fichier nulle part. Rien n'est enregistré ; fermer la page efface tout.",
  },
  {
    q: "Factur-X, UBL, CII : quelle différence ?",
    a: "Les trois portent les mêmes données, définies par la norme EN 16931. CII et UBL sont des fichiers XML seuls ; Factur-X joint un XML CII à un PDF, ce qui garde une facture lisible à l'œil. Le lecteur ouvre les trois.",
  },
  {
    q: "Puis-je créer mes propres factures au format Factur-X ?",
    a: `Oui, avec Qonforme : chaque facture envoyée avec la formule Essentiel est un PDF Factur-X${PLATFORM_SENDING_LIVE ? ", et elle peut partir par la plateforme agréée Super PDP" : ""}. Vos devis, eux, sont gratuits.`,
  },
  {
    q: "Puis-je recevoir mes factures fournisseurs automatiquement ?",
    a: "Oui : avec Essentiel, vos factures fournisseurs arrivent dans Qonforme par la plateforme agréée Super PDP, déjà lues et contrôlées comme dans ce lecteur. La réception des factures électroniques est obligatoire pour toutes les entreprises depuis le 1er septembre 2026.",
  },
]
