/**
 * Lien « Propulsé par Qonforme » des emails et des PDF envoyés aux clients des
 * artisans, avec sa provenance (`?source=email-facture`, `?source=pdf-devis`…) :
 * le bouche-à-oreille se mesure dans l'audience du site (DECISIONS § 10,
 * « Accès, offre et conversion »), sans traceur (ni pixel, ni identifiant du
 * destinataire, ni du document).
 */
export function poweredByUrl(source: string): string {
  const site = (process.env.NEXT_PUBLIC_APP_URL ?? "https://qonforme.fr").replace(/\/+$/, "")
  const safe = source.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "email"
  return `${site}/?source=${safe}`
}
