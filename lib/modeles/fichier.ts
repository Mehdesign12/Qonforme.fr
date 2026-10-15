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

const exempleElectricien = getModeleBySlug("devis-electricien")?.exemple
if (!exempleElectricien) throw new Error("Le modèle « devis-electricien » doit porter un exemple chiffré")

/** Modèles téléchargeables, par nom de fichier sans extension. */
export const MODELES_TELECHARGEABLES: Record<string, OptionsModele> = {
  [MODELE_VIERGE.nom]: MODELE_VIERGE,
  "exemple-devis-electricien": depuisExemple("exemple-devis-electricien", exempleElectricien, [
    "Installation électrique : indiquez la norme appliquée (NF C 15-100). Neuve ou entièrement rénovée avec coupure du réseau : attestation de conformité visée par le Consuel avant la mise en service.",
  ]),
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
