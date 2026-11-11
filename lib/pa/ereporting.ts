/**
 * E-reporting (CGI art. 290 et 290 A) : transmission à l'administration des
 * ventes aux particuliers et des encaissements, par la plateforme agréée.
 * Obligation des TPE et micro-entreprises au 1er septembre 2027. Réservé à la
 * formule Essentiel (décision du fondateur, 11/11/2026).
 *
 * UN SEUL réglage : `EREPORTING_LIVE`. Tant qu'il vaut false, les textes publics
 * disent que la transmission est prévue avant le 1er septembre 2027 (engagement
 * validé par le fondateur le 11/11/2026) ; à true, ils la présentent comme livrée.
 * Ne le passer à true qu'une fois la transmission codée et essayée.
 * Module pur, sans dépendance serveur.
 */
export const EREPORTING_LIVE = false

export function ereportingTexts(live: boolean) {
  return {
    /** Phrase autonome (FAQ, guides, llms.txt, écran Facturation électronique). */
    sentence: live
      ? "Avec Essentiel, Qonforme transmet votre e-reporting : ventes aux particuliers et encaissements, au rythme de votre régime de TVA."
      : "E-reporting : vos ventes aux particuliers et vos encaissements seront transmis à l'administration par la plateforme agréée à laquelle Qonforme est raccordé, avec Essentiel, avant le 1er septembre 2027, date de l'obligation pour les TPE et les micro-entreprises.",
    /** Ligne de la formule Essentiel. */
    feature: "E-reporting : ventes aux particuliers et encaissements transmis à l'administration",
    upcoming: "E-reporting de vos ventes aux particuliers et encaissements, avant le 1er septembre 2027",
  }
}

const TEXTS = ereportingTexts(EREPORTING_LIVE)
export const EREPORTING_SENTENCE = TEXTS.sentence
export const EREPORTING_FEATURE = TEXTS.feature
export const EREPORTING_UPCOMING = TEXTS.upcoming
