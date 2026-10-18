import { FeatureBlock, ScreenPair, SIGNUP_HREF } from "@/components/home/kit"
import { SCREENS, type ScreenProps } from "@/components/landing/devices"
import { PLANS } from "@/lib/stripe/plans"

/**
 * Blocs de fonctions de l'accueil : texte, coches et
 * bouton d'un côté, vraie capture d'ordinateur avec son téléphone de l'autre
 * (pages de démo, données d'exemple), en alternance.
 *
 * Seulement ce qui existe dans l'application aujourd'hui ; ce qui demande une
 * formule (envoi, relances) le dit sous les coches. Le téléphone se place du
 * côté du texte : à gauche quand la capture est à droite, et inversement.
 * Chaque bloc porte une ancre (#devis, #facturation…) pour les liens internes.
 */

const NB = " "

/** Capture de components/landing/devices : ScreenPair pose lui-même les tailles. */
const screen = (key: keyof typeof SCREENS): ScreenProps => ({ ...SCREENS[key], sizes: "" })

/* ─────────────────────────────────────────────────────────
   1 — Devis
───────────────────────────────────────────────────────── */
export function DevisBlock() {
  return (
    <FeatureBlock
      id="devis"
      title="Créez vos devis"
      accent="en quelques minutes."
      items={[
        "Depuis l'ordinateur, la tablette ou le téléphone",
        "Vos prestations et vos prix rangés dans un catalogue",
        `La TVA choisie ligne par ligne${NB}: 20, 10 ou 5,5${NB}%`,
        `Les mentions prêtes${NB}: assurance décennale, franchise de TVA`,
      ]}
      cta={{ href: SIGNUP_HREF, label: "Démarrer maintenant" }}
      link={{ href: "/demo/quotes/d-2026-035", label: "Voir un devis dans la démo" }}
      visual={<ScreenPair desktop={screen("devis")} phone={screen("mobileDevis")} phoneSide="left" />}
    />
  )
}

/* ─────────────────────────────────────────────────────────
   2 — Facturation (capture à gauche)
───────────────────────────────────────────────────────── */
export function FacturationBlock() {
  return (
    <FeatureBlock
      id="facturation"
      reverse
      title="Facturez"
      accent="sans rien ressaisir."
      items={[
        "Le devis accepté devient une facture en brouillon, à relire avant l'envoi",
        "Des factures numérotées à la suite les unes des autres",
        `Une facture envoyée ne se modifie plus${NB}: l'erreur se corrige par un avoir`,
        "Vos factures émises au format Factur-X",
      ]}
      cta={{ href: SIGNUP_HREF, label: "Essayer gratuitement" }}
      link={{ href: "/guide/mentions-obligatoires-facture", label: "Les mentions obligatoires d'une facture" }}
      visual={<ScreenPair desktop={screen("facture")} phone={screen("mobileFacture")} phoneSide="right" />}
    />
  )
}

/* ─────────────────────────────────────────────────────────
   3 — Relances. L'envoi et les relances demandent la formule
   Essentiel : la note le dit sous les coches.
───────────────────────────────────────────────────────── */
export function RelancesBlock() {
  return (
    <FeatureBlock
      id="relances"
      title="Faites-vous payer"
      accent="à l'heure."
      items={[
        "Chaque facture envoyée par email, avec votre IBAN",
        "Les relances partent seules après l'échéance",
        "Un bouton Relancer quand vous voulez le faire vous-même",
        "Les relances s'arrêtent dès que vous marquez la facture payée",
      ]}
      note={`Envoi et relances avec la formule ${PLANS.starter.name}.`}
      cta={{ href: SIGNUP_HREF, label: "Démarrer maintenant" }}
      link={{ href: "/modele/lettre-relance-impaye", label: "Modèle de relance de facture impayée" }}
      visual={<ScreenPair desktop={screen("relances")} phone={screen("mobileRelances")} phoneSide="left" />}
    />
  )
}

/* ─────────────────────────────────────────────────────────
   4 — Tableau de bord (capture à gauche)
───────────────────────────────────────────────────────── */
export function PilotageBlock() {
  return (
    <FeatureBlock
      id="pilotage"
      reverse
      title="Pilotez votre activité"
      accent="d'un coup d'œil."
      items={[
        "Le chiffre facturé du mois et de l'année",
        "Ce qui reste à encaisser, et ce qui est en retard",
        "Ce qu'il reste à faire, dans l'ordre",
        "L'export comptable FEC pour votre comptable",
      ]}
      cta={{ href: SIGNUP_HREF, label: "Essayer gratuitement" }}
      link={{ href: "/demo", label: "Ouvrir la démo" }}
      visual={<ScreenPair desktop={screen("tableauDeBord")} phone={screen("mobileTableauDeBord")} phoneSide="right" />}
    />
  )
}

/* ─────────────────────────────────────────────────────────
   5 — Catalogue de prestations
───────────────────────────────────────────────────────── */
export function CatalogueBlock() {
  return (
    <FeatureBlock
      id="catalogue"
      title="Vos prestations,"
      accent="prêtes à chiffrer."
      items={[
        "Les prestations courantes de votre métier, à importer",
        "Unité, prix net HT et TVA sur chaque ligne",
        `Aucun prix inventé${NB}: vous fixez les vôtres`,
        "Réutilisées d'un devis à l'autre",
      ]}
      cta={{ href: SIGNUP_HREF, label: "Démarrer maintenant" }}
      link={{ href: "/modele", label: "Modèle de devis gratuit" }}
      visual={<ScreenPair desktop={screen("catalogue")} phone={screen("mobileCatalogue")} phoneSide="left" />}
    />
  )
}
