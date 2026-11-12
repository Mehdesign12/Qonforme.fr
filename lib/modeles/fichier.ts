/**
 * Fichiers de devis à télécharger : registre des modèles et construction du
 * format demandé. Route : GET /api/outils/modeles/[nom].[format].
 *
 * Un fichier = un modèle + un format. Le contenu est déterministe (date fixe
 * dans l'archive, aucune donnée de l'utilisateur) : la réponse se met en cache
 * côté réseau sans risque.
 */
import { getModeleBySlug } from "@/lib/pseo/modeles"
import type { ExempleDevis } from "@/lib/pseo/guides"
import { construireDocx } from "./devis-docx"
import { construirePdf } from "./devis-pdf"
import { construireXlsx } from "./devis-xlsx"
import { FORMATS_MODELE, MODELE_VIERGE, TYPES_MIME, nomFichierModele, type FormatModele, type OptionsModele } from "./devis"

/** Un exemple chiffré de la page (mêmes lignes, mêmes taux) devient un fichier : le fichier et la page ne peuvent pas se contredire. */
function depuisExemple(nom: string, exemple: ExempleDevis, mentionsMetier: string[] = []): OptionsModele {
  return {
    nom,
    titre: "DEVIS",
    exempleFictif: true,
    objet: exemple.titre,
    lignes: exemple.lignes.map((l) => ({ designation: l.designation, quantite: l.quantite, unite: l.unite, prixHT: l.prixUnitaireHT, tva: l.tauxTva ?? exemple.tauxTva })),
    conditions: exemple.conditions,
    mentionsMetier,
  }
}

/** Exemple chiffré d'une page modèle ; une page sans exemple est une erreur de construction. */
function exempleDe(slug: string): ExempleDevis {
  const e = getModeleBySlug(slug)?.exemple
  if (!e) throw new Error(`Le modèle « ${slug} » doit porter un exemple chiffré`)
  return e
}

const exempleElectricien = exempleDe("devis-electricien")

/** Exemples par métier (lib/pseo/modeles-metiers.ts) : nom du fichier, page, mentions propres au métier. */
const EXEMPLES_METIERS: [string, string, string[]][] = [
  ["exemple-devis-auto-entrepreneur", "devis-auto-entrepreneur", ["Auto-entrepreneur en franchise de TVA : prix sans TVA, mention « TVA non applicable, art. 293 B du CGI », « EI » après votre nom."]],
  ["exemple-devis-paysagiste", "devis-paysagiste", ["Espaces verts (plantations, gazon) : TVA à 20 %, exclus des taux réduits. Allée, clôture ou terrasse rattachées à un logement de plus de deux ans : 10 %."]],
  ["exemple-devis-peinture", "devis-peinture", ["Peinture : produit, finition et nombre de couches. Façade : déclaration préalable en mairie si la couleur ou l'aspect change ; autorisation de la commune pour un échafaudage sur la voie publique."]],
  ["exemple-devis-maconnerie", "devis-maconnerie", ["Mur porteur : linteau ou poutre dimensionné par un bureau d'études ou une note de calcul ; accord de la copropriété le cas échéant."]],
  ["exemple-devis-plomberie", "devis-plomberie", ["Frais de déplacement annoncés avant les travaux. Chaudière au gaz ou au fioul : TVA à 20 % depuis le 1er mars 2025."]],
  ["exemple-devis-climatisation", "devis-climatisation", ["Climatisation réversible à 5,5 % : classe A++ en mono-split ou A+ en multi-split jusqu'à 12 kW, fluide conforme au règlement (UE) 2024/573, gestion à distance (arrêté du 13 juillet 2026). Sinon : appareil à 20 %, pose à 10 %. Mise en service par une entreprise titulaire de l'attestation de capacité."]],
  ["exemple-devis-placo", "devis-placo", ["Doublage isolant à 5,5 % : rénovation énergétique et résistance thermique d'au moins 3,7 m².K/W pour un mur en façade ou en pignon, indiquée sur la ligne."]],
]

/** Modèles téléchargeables, par nom de fichier sans extension. */
export const MODELES_TELECHARGEABLES: Record<string, OptionsModele> = {
  [MODELE_VIERGE.nom]: MODELE_VIERGE,
  "exemple-devis-electricien": depuisExemple("exemple-devis-electricien", exempleElectricien, [
    "Installation électrique : indiquez la norme appliquée (NF C 15-100). Neuve ou entièrement rénovée avec coupure du réseau : attestation de conformité visée par le Consuel avant la mise en service.",
  ]),
  ...Object.fromEntries(EXEMPLES_METIERS.map(([nom, slug, mentions]) => [nom, depuisExemple(nom, exempleDe(slug), mentions)])),
}

export interface FichierModele {
  data: Uint8Array
  type: string
  nom: string
}

/** « modele-devis-artisan.docx » → { modèle, format }, ou null si le nom n'existe pas. */
export function analyserNomFichier(fichier: string): { options: OptionsModele; format: FormatModele } | null {
  const point = fichier.lastIndexOf(".")
  if (point < 1) return null
  const nom = fichier.slice(0, point)
  const format = fichier.slice(point + 1)
  if (!(FORMATS_MODELE as readonly string[]).includes(format)) return null
  // Object.hasOwn : « constructor », « __proto__ » et consorts ne sont pas des modèles
  if (!Object.hasOwn(MODELES_TELECHARGEABLES, nom)) return null
  return { options: MODELES_TELECHARGEABLES[nom], format: format as FormatModele }
}

export async function genererFichierModele(options: OptionsModele, format: FormatModele): Promise<FichierModele> {
  const data = format === "docx" ? construireDocx(options) : format === "xlsx" ? construireXlsx(options) : await construirePdf(options)
  return { data, type: TYPES_MIME[format], nom: nomFichierModele(options, format) }
}
