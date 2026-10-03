import { aAuPlusDecimales, divArrondi, versEntier } from "./decimal"
import { parseMontant, parseNombre } from "./montant"
import { INDEMNITE_FORFAITAIRE } from "./penalites"

/**
 * Générateurs gratuits de facture et de devis : validation des saisies et
 * calcul des totaux, partagés par l'aperçu à l'écran et par le PDF
 * (/api/outils/facture et /api/outils/devis). Un seul calcul, en centimes
 * entiers : l'aperçu et le PDF affichent toujours les mêmes montants.
 *
 * Règles de calcul :
 * - total HT d'une ligne = quantité × prix unitaire HT, arrondi au centime ;
 * - TVA calculée par taux, sur la somme des lignes HT de ce taux, arrondie au
 *   centime ; la facture ventile la TVA par taux : « par taux d'imposition, le
 *   total hors taxe et la taxe correspondante mentionnés distinctement »
 *   (CGI, annexe II, art. 242 nonies A, I-11°) ;
 * - total TTC = total HT + total TVA.
 */

export type TypeDocument = "facture" | "devis"

/** Taux proposés dans les générateurs (France métropolitaine). */
export const TAUX_TVA_DOCUMENT = [20, 10, 5.5, 2.1, 0] as const

/** Bornes des saisies (taille du PDF, et calcul exact sous Number.MAX_SAFE_INTEGER). */
export const LIMITES = {
  lignes: 200,
  quantite: 100_000,
  prixHT: 10_000_000,
  totalHT: 1_000_000_000,
  nom: 200,
  adresse: 500,
  courts: 60,
  email: 254,
  designation: 1_000,
  texte: 3_000,
} as const

export const MENTION_FRANCHISE = "TVA non applicable, art. 293 B du CGI"

/**
 * Mentions de paiement par défaut, entre professionnels (Code de commerce,
 * art. L441-9 et L441-10 ; indemnité de 40 € : art. D441-5). Le taux est
 * décrit par sa règle (BCE + 10 points), qui reste vraie d'un semestre à l'autre.
 */
export const MENTIONS_PAIEMENT_DEFAUT =
  "En cas de retard de paiement, des pénalités sont dues au taux de la Banque centrale européenne majoré de 10 points, " +
  "sans qu'un rappel soit nécessaire (art. L441-10 du Code de commerce), ainsi qu'une indemnité forfaitaire pour frais " +
  `de recouvrement de ${INDEMNITE_FORFAITAIRE} € (art. D441-5 du Code de commerce). Pas d'escompte pour paiement anticipé.`

export interface Ligne {
  description: string
  quantite: number
  prixHT: number
  tauxTVA: number
}

export interface LigneCalculee extends Ligne {
  /** Total HT de la ligne, en centimes. */
  htCentimes: number
}

export interface VentilationTva {
  taux: number
  baseCentimes: number
  tvaCentimes: number
}

export interface Totaux {
  lignes: LigneCalculee[]
  /** Une entrée par taux, du plus élevé au plus bas. */
  ventilation: VentilationTva[]
  htCentimes: number
  tvaCentimes: number
  ttcCentimes: number
}

/** Total HT d'une ligne en centimes : quantité (3 décimales au plus) × prix (2 décimales au plus). */
export function totalLigneCentimes(quantite: number, prixHT: number): number {
  const qMilli = versEntier(quantite, 3)
  const pC = versEntier(prixHT, 2)
  const qEntiere = Math.trunc(qMilli / 1000)
  const qReste = qMilli - qEntiere * 1000
  // q × p = qEntiere × p + qReste × p / 1000 : chaque produit reste un entier sûr
  return qEntiere * pC + divArrondi(qReste * pC, 1000)
}

/** TVA d'une base HT (centimes) à un taux donné, arrondie au centime. */
export function tvaCentimes(baseCentimes: number, taux: number): number {
  return divArrondi(baseCentimes * versEntier(taux, 2), 10_000)
}

/** Totaux et ventilation de lignes déjà validées. */
export function calculerTotaux(lignes: Ligne[]): Totaux {
  const calculees = lignes.map((l) => ({ ...l, htCentimes: totalLigneCentimes(l.quantite, l.prixHT) }))
  const parTaux = new Map<number, number>()
  for (const l of calculees) parTaux.set(l.tauxTVA, (parTaux.get(l.tauxTVA) ?? 0) + l.htCentimes)
  const ventilation = Array.from(parTaux.entries())
    .sort(([a], [b]) => b - a)
    .map(([taux, baseCentimes]) => ({ taux, baseCentimes, tvaCentimes: tvaCentimes(baseCentimes, taux) }))
  const htCentimes = calculees.reduce((s, l) => s + l.htCentimes, 0)
  const tva = ventilation.reduce((s, v) => s + v.tvaCentimes, 0)
  return { lignes: calculees, ventilation, htCentimes, tvaCentimes: tva, ttcCentimes: htCentimes + tva }
}

/* ─────────────────────────────────────────────────────────
   Validation d'une ligne (formulaire et API)
───────────────────────────────────────────────────────── */

export interface ErreursLigne {
  description?: string
  quantite?: string
  prixHT?: string
  tauxTVA?: string
}

/** Valeur brute d'une ligne : nombres (API) ou texte saisi (formulaire). */
export interface LigneBrute {
  description?: unknown
  quantite?: unknown
  prixHT?: unknown
  tauxTVA?: unknown
}

const estVide = (v: unknown) => v === undefined || v === null || (typeof v === "string" && v.trim() === "")

function lireNombre(v: unknown, lecteur: (s: string) => number | null): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null
  if (typeof v === "string") return lecteur(v)
  return null
}

/** Ligne vierge (ni désignation, ni prix) : ignorée, jamais imprimée. */
export function ligneVierge(l: LigneBrute): boolean {
  const prix = lireNombre(l.prixHT, parseMontant)
  return estVide(l.description) && (estVide(l.prixHT) || prix === 0)
}

/**
 * Valide une ligne. `remises` autorise une quantité ou un prix négatifs (ligne
 * de remise) ; sans ce choix explicite, ils sont refusés.
 */
export function validerLigne(l: LigneBrute, { remises = false }: { remises?: boolean } = {}): { ligne?: Ligne; erreurs: ErreursLigne } {
  const erreurs: ErreursLigne = {}
  const description = typeof l.description === "string" ? l.description.trim() : ""
  if (!description) erreurs.description = "Désignation manquante."
  else if (description.length > LIMITES.designation) erreurs.description = `Désignation trop longue (${LIMITES.designation} caractères au plus).`

  const quantite = estVide(l.quantite) ? null : lireNombre(l.quantite, parseNombre)
  if (quantite === null) erreurs.quantite = estVide(l.quantite) ? "Quantité manquante." : "Quantité invalide : saisissez un nombre, par exemple 12,5."
  else if (quantite === 0) erreurs.quantite = "La quantité ne peut pas être nulle."
  else if (quantite < 0 && !remises) erreurs.quantite = "Quantité négative : activez « Lignes de remise » pour l'accepter."
  else if (Math.abs(quantite) > LIMITES.quantite) erreurs.quantite = `Quantité trop élevée (${LIMITES.quantite.toLocaleString("fr-FR")} au plus).`
  else if (!aAuPlusDecimales(quantite, 3)) erreurs.quantite = "Trois décimales au plus."

  const prixHT = estVide(l.prixHT) ? null : lireNombre(l.prixHT, parseMontant)
  if (prixHT === null) erreurs.prixHT = estVide(l.prixHT) ? "Prix manquant." : "Prix invalide : saisissez un montant, par exemple 1 234,56."
  else if (prixHT < 0 && !remises) erreurs.prixHT = "Prix négatif : activez « Lignes de remise » pour l'accepter."
  else if (Math.abs(prixHT) > LIMITES.prixHT) erreurs.prixHT = `Prix trop élevé (${LIMITES.prixHT.toLocaleString("fr-FR")} € au plus).`
  else if (!aAuPlusDecimales(prixHT, 2)) erreurs.prixHT = "Deux décimales au plus (au centime)."

  const tauxTVA = lireNombre(l.tauxTVA, parseNombre)
  if (tauxTVA === null || !(TAUX_TVA_DOCUMENT as readonly number[]).includes(tauxTVA)) erreurs.tauxTVA = "Taux de TVA non proposé."

  if (Object.keys(erreurs).length) return { erreurs }
  return { ligne: { description, quantite: quantite!, prixHT: prixHT!, tauxTVA: tauxTVA! }, erreurs }
}

/* ─────────────────────────────────────────────────────────
   Validation d'un document complet (API)
───────────────────────────────────────────────────────── */

export interface Partie {
  nom: string
  adresse: string
  siret: string
  email: string
  tva: string
}

export interface DocumentOutil {
  type: TypeDocument
  emetteur: Partie
  client: Pick<Partie, "nom" | "adresse" | "siret">
  numero: string
  /** Date d'émission (AAAA-MM-JJ). */
  date: string
  /** Échéance (facture) ou fin de validité (devis), AAAA-MM-JJ ou vide. */
  date2: string
  mentionTVA: string
  /** Conditions de paiement et mentions (pénalités, indemnité, escompte). */
  mentions: string
  /** Assurance professionnelle (artisans). */
  assurance: string
  notes: string
  totaux: Totaux
}

export type ResultatValidation = { ok: true; document: DocumentOutil } | { ok: false; erreur: string }

const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/

/** Vrai pour une date AAAA-MM-JJ qui existe (pas de 31 février). */
export function dateValide(s: string): boolean {
  if (!DATE_ISO.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

class ErreurSaisie extends Error {}

function texte(v: unknown, max: number, champ: string): string {
  if (v === undefined || v === null) return ""
  if (typeof v !== "string") throw new ErreurSaisie(`${champ} : texte attendu.`)
  const s = v.replace(/\r\n?/g, "\n").trim()
  if (s.length > max) throw new ErreurSaisie(`${champ} : ${max} caractères au plus.`)
  return s
}

const LIBELLE_LIGNE: Record<keyof ErreursLigne, string> = {
  description: "désignation",
  quantite: "quantité",
  prixHT: "prix",
  tauxTVA: "taux de TVA",
}

/** Valide le corps JSON envoyé à /api/outils/facture ou /api/outils/devis. */
export function validerDocument(raw: unknown, type: TypeDocument): ResultatValidation {
  try {
    if (!raw || typeof raw !== "object") throw new ErreurSaisie("Données invalides.")
    const b = raw as Record<string, unknown>
    const em = (b.emetteur ?? {}) as Record<string, unknown>
    const cl = (b.client ?? {}) as Record<string, unknown>
    if (typeof em !== "object" || typeof cl !== "object") throw new ErreurSaisie("Données invalides.")

    const emetteur: Partie = {
      nom: texte(em.nom, LIMITES.nom, "Nom de l'émetteur"),
      adresse: texte(em.adresse, LIMITES.adresse, "Adresse de l'émetteur"),
      siret: texte(em.siret, LIMITES.courts, "SIRET de l'émetteur"),
      email: texte(em.email, LIMITES.email, "Email de l'émetteur"),
      tva: texte(em.tva, LIMITES.courts, "N° de TVA de l'émetteur"),
    }
    const client = {
      nom: texte(cl.nom, LIMITES.nom, "Nom du client"),
      adresse: texte(cl.adresse, LIMITES.adresse, "Adresse du client"),
      siret: texte(cl.siret, LIMITES.courts, "SIRET du client"),
    }
    if (!emetteur.nom) throw new ErreurSaisie("Nom de l'émetteur manquant.")
    if (!client.nom) throw new ErreurSaisie("Nom du client manquant.")

    const numero = texte(b.numero, LIMITES.courts, "Numéro")
    if (type === "facture" && !numero) throw new ErreurSaisie("Numéro de facture manquant (numéro unique, CGI, ann. II, art. 242 nonies A, I-7°).")

    const date = texte(b.date, 10, "Date")
    if (!dateValide(date)) throw new ErreurSaisie(type === "facture" ? "Date d'émission invalide ou manquante." : "Date du devis invalide ou manquante.")
    const date2 = texte(type === "facture" ? b.echeance : b.validite, 10, type === "facture" ? "Échéance" : "Validité")
    if (date2 && !dateValide(date2)) throw new ErreurSaisie(type === "facture" ? "Date d'échéance invalide." : "Date de validité invalide.")
    if (date2 && date2 < date) throw new ErreurSaisie(type === "facture" ? "L'échéance précède la date d'émission." : "La fin de validité précède la date du devis.")

    if (!Array.isArray(b.lignes)) throw new ErreurSaisie("Au moins une ligne est requise.")
    if (b.lignes.length > LIMITES.lignes) throw new ErreurSaisie(`${LIMITES.lignes} lignes au plus.`)
    const remises = b.remises === true
    const lignes: Ligne[] = []
    b.lignes.forEach((brute: unknown, i: number) => {
      if (!brute || typeof brute !== "object") throw new ErreurSaisie(`Ligne ${i + 1} : données invalides.`)
      if (ligneVierge(brute as LigneBrute)) return
      const { ligne, erreurs } = validerLigne(brute as LigneBrute, { remises })
      if (!ligne) {
        const [champ, message] = Object.entries(erreurs)[0] as [keyof ErreursLigne, string]
        throw new ErreurSaisie(`Ligne ${i + 1} (${LIBELLE_LIGNE[champ]}) : ${message}`)
      }
      lignes.push(ligne)
    })
    if (!lignes.length) throw new ErreurSaisie("Au moins une ligne avec une désignation et un prix est requise.")

    // Borne avant calcul : chaque ligne ≤ 10^15 centimes, la somme ne doit pas dériver
    let cumul = 0
    for (const l of lignes) {
      cumul += Math.abs(totalLigneCentimes(l.quantite, l.prixHT))
      if (cumul > LIMITES.totalHT * 100) throw new ErreurSaisie(`Total trop élevé (${LIMITES.totalHT.toLocaleString("fr-FR")} € HT au plus).`)
    }
    const totaux = calculerTotaux(lignes)
    if (totaux.htCentimes < 0) throw new ErreurSaisie("Le total ne peut pas être négatif : pour annuler une facture, émettez un avoir.")

    return {
      ok: true,
      document: {
        type,
        emetteur,
        client,
        numero,
        date,
        date2,
        mentionTVA: texte(b.mentionTVA, LIMITES.texte, "Mention TVA"),
        mentions: texte(b.mentions, LIMITES.texte, "Mentions"),
        assurance: texte(b.assurance, LIMITES.texte, "Assurance professionnelle"),
        notes: texte(b.notes, LIMITES.texte, "Notes"),
        totaux,
      },
    }
  } catch (e) {
    if (e instanceof ErreurSaisie) return { ok: false, erreur: e.message }
    throw e
  }
}

/** Nom de fichier sûr pour l'en-tête Content-Disposition et l'attribut download. */
export function nomFichier(type: TypeDocument, numero: string): string {
  const base = numero.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60)
  return `${type}-${base || "brouillon"}.pdf`
}
