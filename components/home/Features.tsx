import { FeatureBlock, ScreenPair, SIGNUP_HREF } from "@/components/home/kit"
import { SCREENS, type ScreenProps } from "@/components/landing/devices"
import { PLANS, scanQuotaText } from "@/lib/stripe/plans"
import { PLATFORM_SENDING_LIVE } from "@/lib/pa/sending"
import { DEMO_SUB_CHANTIER_ID } from "@/lib/demo/data"

/**
 * Blocs de fonctions de l'accueil et des pages de produit : texte, coches et
 * bouton d'un côté, vraie capture d'ordinateur avec son téléphone de l'autre
 * (pages de démo, données d'exemple), en alternance.
 *
 * Copywriting de conversion (DECISIONS-STRATEGIQUES.md § 2, 04/11/2026) : le
 * bénéfice d'abord ; une fonction réservée à une formule le dit (« avec
 * Essentiel », pastille « Avec Artisan »), sans jamais écrire ce que Qonforme
 * ne fait pas. Le téléphone se place du côté du texte : à gauche quand la
 * capture est à droite, et inversement. Chaque bloc porte une ancre (#devis,
 * #chantier, #facturation…) pour les liens internes.
 */

const NB = "\u00a0"
const essentiel = PLANS.starter.name
const artisan = PLANS.pro.name

/** Capture de components/landing/devices : ScreenPair pose lui-même les tailles. */
const screen = (key: keyof typeof SCREENS): ScreenProps => ({ ...SCREENS[key], sizes: "" })

/* ─────────────────────────────────────────────────────────
   1 — Devis
───────────────────────────────────────────────────────── */
export function DevisBlock({ reverse = false }: { reverse?: boolean } = {}) {
  return (
    <FeatureBlock
      id="devis"
      reverse={reverse}
      title="Des devis pros,"
      accent="prêts en quelques minutes."
      items={[
        "Vos prestations et vos prix rangés dans un catalogue, prêts à chiffrer",
        `Des remises par ligne ou sur le total, en${NB}% ou en${NB}€`,
        "La TVA ligne par ligne et les mentions du bâtiment ajoutées pour vous",
        `Signé par votre client depuis son téléphone, avec ${essentiel}`,
      ]}
      cta={{ href: SIGNUP_HREF, label: "Faire mon premier devis gratuit" }}
      link={{ href: "/demo/quotes/d-2026-035", label: "Voir un devis dans la démo" }}
      visual={<ScreenPair desktop={screen("devis")} phone={screen("mobileDevis")} phoneSide={reverse ? "right" : "left"} />}
    />
  )
}

/* ─────────────────────────────────────────────────────────
   2 — Chantier : la fiche du chantier (formule Artisan), avec
   ses documents, ses montants, ses rendez-vous et ses notes.
   Planning, notes et scan sont ouverts à tous les comptes.
───────────────────────────────────────────────────────── */
export function ChantierBlock({ reverse = true }: { reverse?: boolean } = {}) {
  return (
    <FeatureBlock
      id="chantier"
      reverse={reverse}
      badge={`Avec ${artisan}`}
      title="Votre chantier,"
      accent="tout au même endroit."
      items={[
        "Devis, factures, acomptes et situations rangés par chantier",
        `Signé, facturé, encaissé, reste à facturer${NB}: tout se lit d'un coup d'œil`,
        "Les rendez-vous du planning et les tâches sur la fiche du chantier",
        "La retenue de garantie suivie jusqu'à sa libération",
      ]}
      note="Planning, notes et scan de documents inclus dans tous les comptes, gratuits compris."
      cta={{ href: SIGNUP_HREF, label: "Organiser mon premier chantier" }}
      link={{ href: `/demo/chantiers/${DEMO_SUB_CHANTIER_ID}`, label: "Voir un chantier dans la démo" }}
      visual={<ScreenPair desktop={screen("chantier")} phone={screen("mobileChantier")} phoneSide={reverse ? "right" : "left"} />}
    />
  )
}

/* ─────────────────────────────────────────────────────────
   3 — Facturation
───────────────────────────────────────────────────────── */
export function FacturationBlock({ reverse = true }: { reverse?: boolean } = {}) {
  return (
    <FeatureBlock
      id="facturation"
      reverse={reverse}
      title="Facturez"
      accent="sans rien ressaisir."
      items={[
        "Le devis signé devient une facture en un clic",
        `Acomptes, situations et solde calculés pour vous, avec ${artisan}`,
        "Numérotation continue et mentions obligatoires, sans y penser",
        PLATFORM_SENDING_LIVE
          ? "Factures conformes à la réforme, envoyées par email ou par la plateforme agréée"
          : "Factures conformes à la réforme, au format Factur-X",
      ]}
      cta={{ href: SIGNUP_HREF, label: "Préparer ma première facture" }}
      link={{ href: "/guide/mentions-obligatoires-facture", label: "Les mentions obligatoires d'une facture" }}
      visual={<ScreenPair desktop={screen("facture")} phone={screen("mobileFacture")} phoneSide={reverse ? "right" : "left"} />}
    />
  )
}

/* ─────────────────────────────────────────────────────────
   4 — Relances (envoi et relances avec Essentiel : la note le dit)
───────────────────────────────────────────────────────── */
export function RelancesBlock({ reverse = false }: { reverse?: boolean } = {}) {
  return (
    <FeatureBlock
      id="relances"
      reverse={reverse}
      title="Faites-vous payer,"
      accent="sans courir après."
      items={[
        "Un rappel avant l'échéance, des relances après, automatiquement",
        "Votre IBAN et un QR code de virement sur chaque facture",
        "Un bouton Relancer quand vous voulez le faire vous-même",
        "Les relances s'arrêtent dès que la facture est payée",
      ]}
      note={`Envoi et relances inclus dans ${essentiel}.`}
      cta={{ href: SIGNUP_HREF, label: "Être payé plus vite" }}
      link={{ href: "/modele/lettre-relance-impaye", label: "Modèle de relance de facture impayée" }}
      visual={<ScreenPair desktop={screen("relances")} phone={screen("mobileRelances")} phoneSide={reverse ? "right" : "left"} />}
    />
  )
}

/* ─────────────────────────────────────────────────────────
   5 — Tableau de bord
───────────────────────────────────────────────────────── */
export function PilotageBlock({ reverse = true }: { reverse?: boolean } = {}) {
  return (
    <FeatureBlock
      id="pilotage"
      reverse={reverse}
      title="Votre activité,"
      accent="d'un coup d'œil."
      items={[
        "Ce que vous avez facturé et encaissé, ce mois-ci et cette année",
        "Ce qui reste à encaisser, et qui est en retard",
        "Votre trésorerie prévue semaine par semaine, sur 90 jours",
        "L'export FEC et un accès direct pour votre comptable",
      ]}
      cta={{ href: SIGNUP_HREF, label: "Créer mon compte gratuit" }}
      link={{ href: "/demo", label: "Ouvrir la démo" }}
      visual={<ScreenPair desktop={screen("tableauDeBord")} phone={screen("mobileTableauDeBord")} phoneSide={reverse ? "right" : "left"} />}
    />
  )
}

/* ─────────────────────────────────────────────────────────
   6 — Catalogue de prestations
───────────────────────────────────────────────────────── */
export function CatalogueBlock({ reverse = false }: { reverse?: boolean } = {}) {
  return (
    <FeatureBlock
      id="catalogue"
      reverse={reverse}
      title="Vos prestations,"
      accent="prêtes à chiffrer."
      items={[
        "Les prestations courantes de votre métier, à importer en un clic",
        "Unité, prix et TVA sur chaque ligne",
        "Vos tarifs fixés une fois, réutilisés d'un devis à l'autre",
        "Un devis complet en quelques lignes, même sur le chantier",
      ]}
      cta={{ href: SIGNUP_HREF, label: "Importer mon catalogue" }}
      link={{ href: "/modele", label: "Modèle de devis gratuit" }}
      visual={<ScreenPair desktop={screen("catalogue")} phone={screen("mobileCatalogue")} phoneSide={reverse ? "right" : "left"} />}
    />
  )
}

/* ─────────────────────────────────────────────────────────
   7 — Planning et notes (ouverts à tous les comptes, gratuits compris)
───────────────────────────────────────────────────────── */
export function PlanningBlock({ reverse = false }: { reverse?: boolean } = {}) {
  return (
    <FeatureBlock
      id="planning"
      reverse={reverse}
      title="Votre agenda de chantier,"
      accent="dans la poche."
      items={[
        "Visites, chantiers et livraisons, rattachés au client et au chantier",
        "Un rappel par e-mail avant chaque rendez-vous",
        `Des notes et des tâches avec échéance${NB}: par client ou par chantier`,
        "Inclus dans tous les comptes, gratuits compris",
      ]}
      cta={{ href: SIGNUP_HREF, label: "Organiser ma semaine" }}
      link={{ href: "/demo/planning", label: "Voir l'agenda dans la démo" }}
      visual={<ScreenPair desktop={screen("planning")} phone={screen("mobilePlanning")} phoneSide={reverse ? "right" : "left"} />}
    />
  )
}

/* ─────────────────────────────────────────────────────────
   Réception des factures fournisseurs par la plateforme agréée
   (Essentiel), lues et contrôlées ; décisions transmises.
───────────────────────────────────────────────────────── */
export function ReceptionBlock({ reverse = false }: { reverse?: boolean } = {}) {
  return (
    <FeatureBlock
      id="reception"
      reverse={reverse}
      title="Vos factures fournisseurs,"
      accent="lues toutes seules."
      items={[
        "Elles arrivent par une plateforme agréée, sans ressaisie",
        "Lignes, TVA et totaux lus et contrôlés à l'arrivée",
        "Approuvée, refusée ou en litige : votre décision part au fournisseur",
        "Une facture Factur-X, UBL ou CII reçue par email s'importe en un clic",
      ]}
      note={`Réception par la plateforme agréée incluse dans ${essentiel}.`}
      cta={{ href: SIGNUP_HREF, label: "Recevoir mes factures" }}
      link={{ href: "/demo/received-invoices", label: "Voir les factures reçues dans la démo" }}
      visual={<ScreenPair desktop={screen("facturesRecues")} phone={screen("mobileFacturesRecues")} phoneSide={reverse ? "right" : "left"} />}
    />
  )
}

/* ─────────────────────────────────────────────────────────
   Scan des documents papier (tous les comptes, quotas de plans.ts)
───────────────────────────────────────────────────────── */
export function ScanBlock({ reverse = true }: { reverse?: boolean } = {}) {
  return (
    <FeatureBlock
      id="scan"
      reverse={reverse}
      title="Le papier,"
      accent="photographié et rangé."
      items={[
        "Bons de livraison, devis reçus, tickets : une photo avec le téléphone",
        "Recadrage, plusieurs pages, un PDF propre",
        "Classé par type, fournisseur, client et chantier",
        "Scannez avec le téléphone, retrouvez sur l'ordinateur",
      ]}
      note={`Inclus dans tous les comptes : ${scanQuotaText("free")} avec le compte gratuit.`}
      cta={{ href: SIGNUP_HREF, label: "Scanner mon premier document" }}
      link={{ href: "/demo/documents", label: "Voir les documents dans la démo" }}
      visual={<ScreenPair desktop={screen("documents")} phone={screen("mobileDocuments")} phoneSide={reverse ? "right" : "left"} />}
    />
  )
}
