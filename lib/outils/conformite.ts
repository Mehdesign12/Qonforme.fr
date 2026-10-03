import { dateValide } from "./document"

/**
 * Vérificateur de conformité d'une facture : critères selon le profil et la
 * date d'émission. L'outil ne délivre jamais de « conformité » : il dit si
 * tous les critères vérifiés sont remplis.
 *
 * Calendrier de la facture électronique entre entreprises établies en France
 * (loi n° 2023-1322 du 29 décembre 2023 de finances pour 2024, art. 91 ;
 * entreprendre.service-public.gouv.fr, actualité A15683 et fiche F31808,
 * vérifiée le 11 août 2026) :
 * - réception : toutes les entreprises depuis le 1er septembre 2026 ;
 * - émission : grandes entreprises et ETI depuis le 1er septembre 2026,
 *   PME et micro-entreprises à partir du 1er septembre 2027 ;
 * - les nouvelles mentions (SIREN du client, adresse de livraison, nature des
 *   opérations, option sur les débits) suivent le calendrier de l'émission.
 *
 * Conservation : 6 ans au titre du contrôle fiscal (LPF, art. L102 B), 10 ans
 * pour les pièces comptables (Code de commerce, art. L123-22). Authenticité de
 * l'origine, intégrité du contenu et lisibilité : CGI, art. 289.
 */
export const CALENDRIER_FACTURE_ELECTRONIQUE = {
  reception: "2026-09-01",
  emissionGrandes: "2026-09-01",
  emissionPme: "2027-09-01",
} as const

export interface ProfilConformite {
  taille: "pme" | "grande"
  client: "pro" | "autre"
  /** Date d'émission de la facture, AAAA-MM-JJ. */
  dateEmission: string
}

export type StatutCritere = "obligatoire" | "a-venir" | "si-applicable"

export interface Critere {
  id: string
  label: string
  category: string
  help?: string
  statut: StatutCritere
}

/** Date à partir de laquelle l'entreprise doit émettre ses factures entre entreprises en facture électronique. */
export function dateEmissionElectronique(taille: ProfilConformite["taille"]): string {
  return taille === "grande" ? CALENDRIER_FACTURE_ELECTRONIQUE.emissionGrandes : CALENDRIER_FACTURE_ELECTRONIQUE.emissionPme
}

/** Vrai si cette facture doit être une facture électronique (client professionnel en France, date atteinte). */
export function factureElectroniqueObligatoire(p: ProfilConformite): boolean {
  return p.client === "pro" && dateValide(p.dateEmission) && p.dateEmission >= dateEmissionElectronique(p.taille)
}

const fmt = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).replace(/^1 /, "1er ")

export function criteresPourProfil(p: ProfilConformite): Critere[] {
  const pro = p.client === "pro"
  const fe = factureElectroniqueObligatoire(p)
  const echeanceFe = fmt(dateEmissionElectronique(p.taille))
  const statutFe: StatutCritere = fe ? "obligatoire" : "a-venir"
  const aide = fe ? undefined : `Exigé à partir du ${echeanceFe} pour votre entreprise`
  const reception = dateValide(p.dateEmission) && p.dateEmission >= CALENDRIER_FACTURE_ELECTRONIQUE.reception

  const criteres: (Critere | false)[] = [
    { id: "emetteur", category: "Mentions", label: "Identité de l'émetteur : nom, adresse, SIREN, n° de TVA s'il la facture", statut: "obligatoire" },
    { id: "client", category: "Mentions", label: "Nom et adresse du client", statut: "obligatoire" },
    { id: "numero", category: "Mentions", label: "Numéro unique, à la suite des précédents", statut: "obligatoire" },
    { id: "dates", category: "Mentions", label: "Date d'émission et date ou délai de paiement", statut: "obligatoire" },
    { id: "lignes", category: "Mentions", label: "Lignes détaillées : désignation, quantité, prix unitaire HT, taux de TVA", statut: "obligatoire" },
    { id: "totaux", category: "Mentions", label: "Totaux HT, TVA et TTC justes", statut: "obligatoire" },
    { id: "tva_par_taux", category: "Mentions", label: "TVA ventilée par taux : base HT et TVA de chaque taux", help: "CGI, annexe II, art. 242 nonies A, I-11°", statut: "obligatoire" },
    { id: "mention_tva", category: "Mentions", label: "Mention de TVA quand elle s'applique : franchise (art. 293 B du CGI), autoliquidation, exonération", statut: "si-applicable" },
    { id: "penalites", category: "Conditions de paiement", label: "Taux des pénalités de retard", statut: "obligatoire" },
    { id: "escompte", category: "Conditions de paiement", label: "Conditions d'escompte, ou mention de leur absence", statut: "obligatoire" },
    pro && { id: "indemnite_40", category: "Conditions de paiement", label: "Indemnité forfaitaire de recouvrement de 40 €", statut: "obligatoire" },
    pro && {
      id: "fe_format",
      category: "Facture électronique",
      label: "Facture électronique structurée (Factur-X, UBL ou CII), conforme à la norme EN 16931",
      help: aide,
      statut: statutFe,
    },
    pro && { id: "fe_plateforme", category: "Facture électronique", label: "Transmise par une plateforme agréée", help: aide, statut: statutFe },
    pro && {
      id: "fe_mentions",
      category: "Facture électronique",
      label: "Nouvelles mentions : SIREN du client, adresse de livraison si différente, nature des opérations, option sur les débits",
      help: aide,
      statut: statutFe,
    },
    reception && {
      id: "reception",
      category: "Facture électronique",
      label: "Votre entreprise peut recevoir des factures électroniques (plateforme agréée choisie)",
      help: "Obligatoire pour toutes les entreprises depuis le 1er septembre 2026",
      statut: "obligatoire",
    },
    {
      id: "conservation",
      category: "Conservation",
      label: "Factures conservées 6 ans (contrôle fiscal) et 10 ans (pièces comptables)",
      help: "Livre des procédures fiscales, art. L102 B ; Code de commerce, art. L123-22",
      statut: "obligatoire",
    },
    {
      id: "integrite",
      category: "Conservation",
      label: "Origine authentique, contenu intègre et lisible jusqu'à la fin de la conservation",
      help: "CGI, art. 289 : piste d'audit fiable, signature électronique ou facture électronique",
      statut: "obligatoire",
    },
  ]
  return criteres.filter((c): c is Critere => Boolean(c))
}

export type NiveauBilan = "vide" | "insuffisant" | "partiel" | "complet"

export interface BilanConformite {
  obligatoires: Critere[]
  manquants: Critere[]
  /** Part des critères obligatoires cochés, à l'entier inférieur : 100 % seulement s'il n'en manque aucun. */
  pourcentage: number
  niveau: NiveauBilan
}

export function bilanConformite(criteres: Critere[], coches: Record<string, boolean>): BilanConformite {
  const obligatoires = criteres.filter((c) => c.statut === "obligatoire")
  const manquants = obligatoires.filter((c) => !coches[c.id])
  const faits = obligatoires.length - manquants.length
  const pourcentage = obligatoires.length ? Math.floor((faits / obligatoires.length) * 100) : 0
  const niveau: NiveauBilan = faits === 0 ? "vide" : manquants.length === 0 ? "complet" : pourcentage >= 60 ? "partiel" : "insuffisant"
  return { obligatoires, manquants, pourcentage, niveau }
}
