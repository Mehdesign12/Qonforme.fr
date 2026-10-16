/**
 * Mentions valant certification du client pour les taux réduits de TVA des travaux
 * (CGI, art. 279-0 bis pour 10 %, art. 278-0 bis A pour 5,5 %).
 *
 * Depuis la loi de finances pour 2025 (art. 41), les attestations papier 1300-SD et
 * 1301-SD n'existent plus : le client certifie sur le devis ou la facture que les
 * conditions sont remplies. Textes repris des modèles de l'administration fiscale :
 * BOFiP, BOI-LETTRE-000280, version en vigueur depuis le 9 septembre 2026
 * (https://bofip.impots.gouv.fr/bofip/14834-PGP.html), vérifiés le 16/10/2026.
 * Les pointillés du modèle deviennent « [nom et prénom] ».
 *
 * Ces textes servent aux contenus publics et aux modèles téléchargeables. La
 * signature en ligne garde son propre texte (lib/signature/rules.ts), qui reprend
 * les mêmes conditions.
 */

const CONDITIONS =
  "que les travaux réalisés concernent des locaux à usage d'habitation achevés depuis plus de deux ans"

const IMMEUBLE_NEUF_DEVIS =
  "sur une période de deux ans au plus, de concourir à la production d'un immeuble neuf au sens du 2° du 2 du I de l'article 257 du CGI, " +
  "ni d'entraîner une augmentation de la surface de plancher des locaux existants supérieure à 10 %"

const ENERGIE = "et qu'ils ont la nature de travaux de rénovation énergétique"

/** Sur un devis, taux de 10 %. */
export const CERTIFICATION_DEVIS_10 =
  `Je soussigné(e) [nom et prénom] certifie ${CONDITIONS} et qu'ils n'auront pas pour effet, ${IMMEUBLE_NEUF_DEVIS}.`

/** Sur un devis, taux de 5,5 %. */
export const CERTIFICATION_DEVIS_5_5 =
  `Je soussigné(e) [nom et prénom] certifie, en qualité de preneur de la prestation, ${CONDITIONS}, qu'ils n'auront pas pour effet, ${IMMEUBLE_NEUF_DEVIS} ${ENERGIE}.`

/** Sur une facture, taux de 10 %. */
export const CERTIFICATION_FACTURE_10 =
  `Par le règlement de la présente facture, le client certifie, en qualité de preneur de la prestation, ${CONDITIONS}, qu'ils n'ont pas eu pour effet, ${IMMEUBLE_NEUF_DEVIS}.`

/** Sur une facture, taux de 5,5 %. */
export const CERTIFICATION_FACTURE_5_5 =
  `Par le règlement de la présente facture, le client certifie, en qualité de preneur de la prestation, ${CONDITIONS}, qu'ils n'ont pas eu pour effet, ${IMMEUBLE_NEUF_DEVIS} ${ENERGIE}.`

/** Résumé d'une ligne pour les conditions des devis d'exemple. */
export const CERTIFICATION_RESUME =
  "Le client certifie, avec la mention prévue par l'administration fiscale, que le logement est achevé depuis plus de deux ans et que les travaux ne le rendront pas neuf ni n'augmenteront sa surface de plancher de plus de 10 %."
