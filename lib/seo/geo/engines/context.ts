/**
 * Contexte commun aux moteurs : marché et langue du suivi (réglages geo.market et
 * geo.language). La même consigne courte est donnée à chaque moteur conversationnel,
 * pour comparer des réponses obtenues dans les mêmes conditions ; elle ne nomme
 * jamais la marque ni un concurrent (la question est posée telle quelle).
 */
import type { GeoAskOptions } from "@/lib/seo/geo/types"

/** Marchés proposés dans « Gérer le suivi » : pays (ISO 3166-1) et code de lieu DataForSEO. */
export const GEO_MARKETS: { label: string; where: string; country: string; dataforseoLocation: number; timezone: string }[] = [
  { label: "France", where: "en France", country: "FR", dataforseoLocation: 2250, timezone: "Europe/Paris" },
  { label: "Belgique", where: "en Belgique", country: "BE", dataforseoLocation: 2056, timezone: "Europe/Brussels" },
  { label: "Suisse", where: "en Suisse", country: "CH", dataforseoLocation: 2756, timezone: "Europe/Zurich" },
  { label: "Luxembourg", where: "au Luxembourg", country: "LU", dataforseoLocation: 2442, timezone: "Europe/Luxembourg" },
  { label: "Canada", where: "au Canada", country: "CA", dataforseoLocation: 2124, timezone: "America/Toronto" },
]

/** Langues proposées : libellé du réglage et code ISO 639-1. */
export const GEO_LANGUAGES: { label: string; code: string }[] = [{ label: "français", code: "fr" }]

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase()

/** Marché connu (France par défaut). */
export function marketOf(label: string): (typeof GEO_MARKETS)[number] {
  return GEO_MARKETS.find((m) => norm(m.label) === norm(label)) ?? GEO_MARKETS[0]
}

/** Vrai si le marché fait partie de la liste (sinon les moteurs reçoivent le libellé tel quel). */
export function isKnownMarket(label: string): boolean {
  return GEO_MARKETS.some((m) => norm(m.label) === norm(label))
}

/** Code de langue (fr par défaut). */
export function languageCodeOf(label: string): string {
  return GEO_LANGUAGES.find((l) => norm(l.label) === norm(label))?.code ?? "fr"
}

/** Consigne commune : répondre comme à un utilisateur du marché, en s'appuyant sur le web. */
export function systemContext(opts: Pick<GeoAskOptions, "market" | "language">): string {
  const label = opts.market.trim() || "France"
  const where = isKnownMarket(label) ? marketOf(label).where : `dans ce pays : ${label}`
  const language = opts.language.trim() || "français"
  return `Réponds en ${language} à un utilisateur situé ${where}, en t'appuyant sur une recherche web récente.`
}
