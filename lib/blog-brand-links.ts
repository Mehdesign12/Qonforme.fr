/**
 * Liens d'article vers un faux domaine de la marque.
 *
 * L'ancien générateur d'articles (Gemini, 2026) avait inventé « qonforme.com »
 * pour le bouton « Essayez Qonforme… » de 10 articles : c'est le site d'un
 * autre éditeur (gestion de la qualité, en espagnol), pas le nôtre
 * (qonforme.fr). Le texte est corrigé en base par
 * supabase/one-off/20261019_corriger_liens_qonforme_com.sql ; cette fonction
 * garde la page publique juste même avant ce correctif, et pour tout article
 * importé ou écrit à la main avec la même faute.
 *
 * Seuls les liens Markdown « ](adresse) » sont réécrits : ils mènent à la
 * création de compte (/signup), la même destination que les autres boutons
 * « Essayez Qonforme ». Le texte du lien ne change pas.
 *
 * Module pur : page publique du blog et tests.
 */

/** Autre extension que « .fr » collée au nom de la marque, avec son chemin éventuel. */
const FOREIGN_BRAND_LINK = /\]\(\s*https?:\/\/(?:www\.)?qonforme\.(?:com|net|org|io|eu|app|co)(?:\/[^)\s]*)?\s*\)/gi

export const BRAND_SIGNUP_PATH = "/signup"

export function fixForeignBrandLinks(markdown: string): string {
  return markdown.replace(FOREIGN_BRAND_LINK, `](${BRAND_SIGNUP_PATH})`)
}
