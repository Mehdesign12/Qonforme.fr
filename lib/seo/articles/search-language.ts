/**
 * Le langage de la recherche : comment le client final tape sa requête, et
 * ce qu'un titre doit en reprendre selon le type d'article.
 *
 * - un how-to répond à « comment faire … » : le titre reprend la phrase
 *   tapée (« Comment facturer un chantier »), il ne préfixe pas un mot-clé
 *   générique (« Logiciel devis facturation : … ») ;
 * - une FAQ est la question telle qu'on la pose ;
 * - un guide nomme le sujet avec les mots de la recherche ;
 * - une actualité dit ce qui change et depuis quand.
 *
 * Un mot-clé d'achat (« logiciel devis facturation ») rattaché à un article
 * « comment faire » est une erreur de choix : la liste de contrôle le signale
 * (keywordArticleMismatch) et la consigne des titres n'en fait pas un préfixe.
 *
 * La règle sur « gratuit » (FREE_RULE) est commune aux consignes de titres, de
 * descriptions et de rédaction : seulement pour ce qui l'est vraiment.
 *
 * Module pur : serveur, navigateur et tests.
 */
import type { ArticleType } from "@/lib/seo/types"

/** Début d'une requête en forme de question (comment, pourquoi, peut-on…). */
const QUESTION_START =
  /^(?:comment|pourquoi|quand|combien|quels?|quelles?|o[ùu]|que faire|peut-on|puis-je|faut-il|doit-on|est-ce|qu['’]est-ce|a-t-on|y a-t-il|[àa] quoi|quoi)\b/i

/** Mots d'une recherche d'achat de logiciel. */
const BUY_WORDS = /\b(?:logiciels?|applications?|applis?|comparatifs?|alternatives?|abonnements?|avis)\b/i

/** Mots d'une recherche de fichier ou d'exemple. */
const MODEL_WORDS = /\b(?:exemples?|mod[èe]les?|templates?|pdf|word|excel|vierges?|[àa] imprimer|[àa] t[ée]l[ée]charger)\b/i

export type KeywordForm = "question" | "buy" | "model" | "other"

/** Forme d'une requête : question, achat de logiciel, modèle ou exemple, autre. */
export function keywordForm(keyword: string | null | undefined): KeywordForm {
  const k = (keyword ?? "").trim()
  if (!k) return "other"
  if (QUESTION_START.test(k)) return "question"
  if (BUY_WORDS.test(k)) return "buy"
  if (MODEL_WORDS.test(k)) return "model"
  return "other"
}

const NEWS_WORDS = /\b(?:20(?:2[5-9])|r[ée]forme|loi de finances|nouveaut[ée]s?|ce qui change|change(?:nt|ment)?|d[èe]s le \d)\b/i

/**
 * Type d'article déduit quand il n'est pas enregistré (article écrit à la
 * main) : « comment … » → how-to, autre question → FAQ, règle datée → actualité,
 * sinon guide. Une déduction : l'éditeur ne l'enregistre pas.
 */
export function inferArticleType(keyword: string | null | undefined, title: string | null | undefined): ArticleType {
  const k = (keyword ?? "").trim()
  const t = (title ?? "").trim()
  if (/^comment\b/i.test(k) || /^comment\b/i.test(t)) return "howto"
  if (QUESTION_START.test(k) || QUESTION_START.test(t) || /\?\s*$/.test(t)) return "faq"
  if (NEWS_WORDS.test(t) || NEWS_WORDS.test(k)) return "news"
  return "guide"
}

/**
 * Message de la liste de contrôle quand le mot-clé est une recherche d'achat
 * et l'article un « comment faire », une FAQ ou une actualité ; null sinon.
 */
export function keywordArticleMismatch(keyword: string | null | undefined, type: ArticleType | null | undefined): string | null {
  if (!type || type === "guide") return null
  if (keywordForm(keyword) !== "buy") return null
  const what = type === "howto" ? "un « comment faire »" : type === "faq" ? "une FAQ" : "une actualité"
  return `Recherche d'achat de logiciel sur ${what} : la personne qui cherche cet article tape une autre phrase. Choisissez la requête exacte (par exemple « comment … »).`
}

/** Règle commune sur « gratuit » : jamais une promesse que le produit ne tient pas. */
export const FREE_RULE =
  "« Gratuit » seulement pour ce qui l'est vraiment : les devis (gratuits et illimités), le générateur de devis et de facture en ligne, les modèles à télécharger. L'envoi des factures, les relances et l'export FEC font partie de la formule Essentiel (payante) : n'écrivez jamais que facturer avec Qonforme est gratuit. « Facture gratuite » ne sert qu'à parler du générateur ou du modèle gratuit, en disant ce qui est payant à côté."

/**
 * Consignes de titre selon le type d'article et la forme du mot-clé : le titre
 * parle comme la personne qui cherche.
 */
export function titleDirectives(type: ArticleType | null | undefined, form: KeywordForm): string[] {
  const rules: string[] = []
  const t = type ?? "guide"
  if (t === "howto") {
    rules.push(
      "C'est un how-to : la personne tape « comment … ». Le titre reprend sa phrase, avec « Comment » en premier, puis le verbe et l'objet (« Comment faire un devis de plomberie »).",
      "Après la phrase de la recherche, une précision est permise si l'article la tient : « étape par étape », « avec un modèle », « en 5 étapes », « sans erreur ».",
    )
  } else if (t === "faq") {
    rules.push(
      "C'est une FAQ : le titre est la question telle qu'on la pose (« Peut-on facturer sans numéro de TVA ? », « Quel taux de TVA pour des travaux de rénovation ? »).",
    )
  } else if (t === "news") {
    rules.push(
      "C'est une actualité : le titre dit ce qui change et pour qui, avec la règle nommée, et la date seulement si l'article la donne (« Facture électronique : ce qui change pour un artisan »).",
    )
  } else {
    rules.push(
      "C'est un guide : le titre nomme le sujet avec les mots de la recherche, puis ce que le guide apporte (« TVA des travaux : 20 %, 10 % ou 5,5 %, comment choisir »).",
    )
  }
  if (form === "question") {
    rules.push("Le mot-clé est déjà une question : reprenez-le mot pour mot en début de titre.")
  } else if (form === "model") {
    rules.push("Le mot-clé cherche un exemple ou un modèle : gardez « exemple » ou « modèle » dans le titre, et le format si l'article le donne (PDF, Word, Excel).")
  } else if (form === "buy" && t !== "guide") {
    rules.push(
      "Le mot-clé est une recherche d'achat de logiciel, mais l'article est un contenu pratique : ne placez PAS le mot-clé en préfixe suivi de deux-points. Écrivez le titre que taperait la personne qui cherche cet article ; le mot-clé n'apparaît que s'il est naturel.",
    )
  }
  rules.push(
    "Les mots de la personne d'abord (« comment », « exemple », « modèle », « pdf », « gratuit » quand c'est vrai), pas de vocabulaire de marketing.",
    "Pas de préfixe générique suivi de deux-points (« Logiciel devis facturation : … ») qui ne décrit pas le sujet.",
  )
  return rules
}
