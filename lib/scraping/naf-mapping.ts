/**
 * Mapping codes NAF rev2 ↔ métiers Qonforme
 *
 * Sources : nomenclature NAF rev2 (INSEE)
 * - 39 métiers existants dans lib/pseo/metiers.ts
 * - 4 métiers supplémentaires scraping-only (climaticien, psychologue, peintre-en-batiment alias, developpeur-web alias)
 */

export interface NafEntry {
  metier: string          // slug métier pSEO (ou alias → pointe vers le slug pSEO)
  label: string           // libellé lisible
  nafs: string[]          // codes NAF rev2 correspondants
  metierCanonique?: string // si alias, slug du métier pSEO réel
}

export const NAF_MAPPING: Record<string, NafEntry> = {
  // ═══════════════════════════════════════════════
  // BTP — Bâtiment et travaux publics
  // ═══════════════════════════════════════════════
  plombier: {
    metier: "plombier",
    label: "Plombier",
    nafs: ["43.22A"], // Travaux d'installation d'eau et de gaz en tous locaux
  },
  electricien: {
    metier: "electricien",
    label: "Électricien",
    nafs: ["43.21A"], // Travaux d'installation électrique dans tous locaux
  },
  macon: {
    metier: "macon",
    label: "Maçon",
    nafs: ["43.99A", "43.99B", "41.20A"], // Travaux de maçonnerie générale, terrassement, construction de maisons
  },
  peintre: {
    metier: "peintre",
    label: "Peintre en bâtiment",
    nafs: ["43.34A"], // Travaux de peinture et vitrerie
  },
  carreleur: {
    metier: "carreleur",
    label: "Carreleur",
    nafs: ["43.33Z"], // Travaux de revêtement des sols et des murs
  },
  menuisier: {
    metier: "menuisier",
    label: "Menuisier",
    nafs: ["43.32A", "43.32B"], // Travaux de menuiserie bois et PVC, agencement de lieux de vente
  },
  couvreur: {
    metier: "couvreur",
    label: "Couvreur",
    nafs: ["43.91A", "43.91B"], // Travaux de charpente, couverture par éléments
  },
  plaquiste: {
    metier: "plaquiste",
    label: "Plaquiste",
    nafs: ["43.31Z"], // Travaux de plâtrerie
  },
  chauffagiste: {
    metier: "chauffagiste",
    label: "Chauffagiste",
    nafs: ["43.22B"], // Travaux d'installation d'équipements thermiques et de climatisation
  },
  serrurier: {
    metier: "serrurier",
    label: "Serrurier",
    nafs: ["43.21B"], // Travaux d'installation et de maintenance d'ascenseurs et serrurerie
  },

  // ═══════════════════════════════════════════════
  // Services aux entreprises et freelances
  // ═══════════════════════════════════════════════
  "auto-entrepreneur": {
    metier: "auto-entrepreneur",
    label: "Auto-entrepreneur",
    nafs: ["82.99Z"], // Autres activités de soutien aux entreprises n.c.a.
  },
  consultant: {
    metier: "consultant",
    label: "Consultant",
    nafs: ["70.22Z"], // Conseil pour les affaires et autres conseils de gestion
  },
  "developpeur-freelance": {
    metier: "developpeur-freelance",
    label: "Développeur freelance",
    nafs: ["62.01Z", "62.02A"], // Programmation informatique, conseil en systèmes informatiques
  },
  graphiste: {
    metier: "graphiste",
    label: "Graphiste",
    nafs: ["74.10Z"], // Activités spécialisées de design
  },
  photographe: {
    metier: "photographe",
    label: "Photographe",
    nafs: ["74.20Z"], // Activités photographiques
  },
  formateur: {
    metier: "formateur",
    label: "Formateur",
    nafs: ["85.59A", "85.59B"], // Formation continue d'adultes, autres enseignements
  },
  coach: {
    metier: "coach",
    label: "Coach",
    nafs: ["96.09Z", "70.22Z"], // Autres services personnels, conseil de gestion
  },
  "community-manager": {
    metier: "community-manager",
    label: "Community manager",
    nafs: ["73.11Z"], // Activités des agences de publicité
  },
  traducteur: {
    metier: "traducteur",
    label: "Traducteur",
    nafs: ["74.30Z"], // Traduction et interprétation
  },

  // ═══════════════════════════════════════════════
  // Soins et bien-être
  // ═══════════════════════════════════════════════
  coiffeur: {
    metier: "coiffeur",
    label: "Coiffeur",
    nafs: ["96.02A"], // Coiffure
  },
  estheticienne: {
    metier: "estheticienne",
    label: "Esthéticienne",
    nafs: ["96.02B"], // Soins de beauté
  },

  // ═══════════════════════════════════════════════
  // Aménagement extérieur et services à domicile
  // ═══════════════════════════════════════════════
  paysagiste: {
    metier: "paysagiste",
    label: "Paysagiste",
    nafs: ["81.30Z"], // Services d'aménagement paysager
  },
  "architecte-interieur": {
    metier: "architecte-interieur",
    label: "Architecte d'intérieur",
    nafs: ["74.10Z", "71.11Z"], // Design, activités d'architecture
  },

  // ═══════════════════════════════════════════════
  // Alimentation et métiers de bouche
  // ═══════════════════════════════════════════════
  traiteur: {
    metier: "traiteur",
    label: "Traiteur",
    nafs: ["56.10B", "56.21Z"], // Cafétérias, traiteurs et organisation de réceptions
  },
  boulanger: {
    metier: "boulanger",
    label: "Boulanger",
    nafs: ["10.71A", "10.71B", "10.71C", "10.71D"], // Fabrication industrielle/artisanale de pain et pâtisserie
  },
  // Note : "boucher" est dans le prompt utilisateur mais pas dans metiers.ts
  // On ne l'ajoute pas pour rester cohérent avec les 39 métiers existants
  fleuriste: {
    metier: "fleuriste",
    label: "Fleuriste",
    nafs: ["47.76Z"], // Commerce de détail de fleurs
  },

  // ═══════════════════════════════════════════════
  // Santé et professions médicales/paramédicales
  // ═══════════════════════════════════════════════
  osteopathe: {
    metier: "osteopathe",
    label: "Ostéopathe",
    nafs: ["86.90A"], // Activités de santé humaine non classées ailleurs (ostéo)
  },
  kinesitherapeute: {
    metier: "kinesitherapeute",
    label: "Kinésithérapeute",
    nafs: ["86.90C"], // Activités des auxiliaires médicaux (kinésithérapie)
  },
  "infirmier-liberal": {
    metier: "infirmier-liberal",
    label: "Infirmier libéral",
    nafs: ["86.90D"], // Activités des infirmiers et sages-femmes
  },
  dieteticien: {
    metier: "dieteticien",
    label: "Diététicien",
    nafs: ["86.90F"], // Activités de santé humaine non classées ailleurs (diététique)
  },

  // ═══════════════════════════════════════════════
  // Professions juridiques et financières
  // ═══════════════════════════════════════════════
  comptable: {
    metier: "comptable",
    label: "Comptable",
    nafs: ["69.20Z"], // Activités comptables
  },
  avocat: {
    metier: "avocat",
    label: "Avocat",
    nafs: ["69.10Z"], // Activités juridiques
  },
  "agent-immobilier": {
    metier: "agent-immobilier",
    label: "Agent immobilier",
    nafs: ["68.31Z"], // Agences immobilières
  },

  // ═══════════════════════════════════════════════
  // Transport et logistique
  // ═══════════════════════════════════════════════
  taxi: {
    metier: "taxi",
    label: "Taxi",
    nafs: ["49.32Z"], // Transports de voyageurs par taxis
  },
  vtc: {
    metier: "vtc",
    label: "VTC",
    nafs: ["49.39C"], // Transports routiers réguliers de voyageurs (VTC)
  },
  demenageur: {
    metier: "demenageur",
    label: "Déménageur",
    nafs: ["49.42Z"], // Services de déménagement
  },

  // ═══════════════════════════════════════════════
  // Services à la personne et entretien
  // ═══════════════════════════════════════════════
  "femme-de-menage": {
    metier: "femme-de-menage",
    label: "Femme de ménage",
    nafs: ["81.21Z"], // Nettoyage courant des bâtiments
  },
  jardinier: {
    metier: "jardinier",
    label: "Jardinier",
    nafs: ["81.30Z"], // Services d'aménagement paysager (inclut entretien jardins)
  },
  informaticien: {
    metier: "informaticien",
    label: "Informaticien",
    nafs: ["62.02A", "95.11Z", "62.09Z"], // Conseil en systèmes informatiques, réparation, autres activités
  },
  "garagiste": {
    metier: "garagiste",
    label: "Garagiste",
    nafs: ["45.20A", "45.20B"], // Entretien et réparation de véhicules automobiles
  },

  // ═══════════════════════════════════════════════
  // Métiers supplémentaires (scraping-only, pas dans pSEO)
  // ═══════════════════════════════════════════════
  climaticien: {
    metier: "climaticien",
    label: "Climaticien",
    nafs: ["43.22B"], // Travaux d'installation d'équipements thermiques et de climatisation
    metierCanonique: "chauffagiste", // alias → même code NAF, prospects tagués "chauffagiste"
  },
  psychologue: {
    metier: "psychologue",
    label: "Psychologue",
    nafs: ["86.90G"], // Activités des psychologues
  },
  "peintre-en-batiment": {
    metier: "peintre-en-batiment",
    label: "Peintre en bâtiment",
    nafs: ["43.34A"], // même que "peintre"
    metierCanonique: "peintre",
  },
  "developpeur-web": {
    metier: "developpeur-web",
    label: "Développeur web",
    nafs: ["62.01Z"], // même que "developpeur-freelance"
    metierCanonique: "developpeur-freelance",
  },
}

// ── Reverse mapping : code NAF → slug métier (priorité au métier canonique) ──

export const NAF_TO_METIER: Record<string, string> = (() => {
  const map: Record<string, string> = {}
  // D'abord les métiers principaux (pas les alias)
  for (const entry of Object.values(NAF_MAPPING)) {
    if (entry.metierCanonique) continue
    for (const naf of entry.nafs) {
      if (!map[naf]) map[naf] = entry.metier
    }
  }
  // Ensuite les alias (ne remplacent pas les métiers principaux)
  for (const entry of Object.values(NAF_MAPPING)) {
    if (!entry.metierCanonique) continue
    for (const naf of entry.nafs) {
      if (!map[naf]) map[naf] = entry.metierCanonique
    }
  }
  return map
})()

// ── Liste de tous les codes NAF uniques ──

export const ALL_NAF_CODES: string[] = Array.from(
  new Set(Object.values(NAF_MAPPING).flatMap((e) => e.nafs)),
)

// ── Résoudre le métier canonique (pour les aliases) ──

export function resolveMetier(slug: string): string {
  const entry = NAF_MAPPING[slug]
  return entry?.metierCanonique ?? entry?.metier ?? slug
}

// ── Liste des métiers (sans alias) pour l'UI admin ──

export const METIER_OPTIONS: { value: string; label: string }[] = Object.values(NAF_MAPPING)
  .filter((e) => !e.metierCanonique)
  .map((e) => ({ value: e.metier, label: e.label }))
  .sort((a, b) => a.label.localeCompare(b.label, "fr"))
