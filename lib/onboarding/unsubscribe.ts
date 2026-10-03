/**
 * Lien de désinscription des conseils de démarrage, signé, utilisable sans
 * connexion (côté serveur uniquement : node:crypto et secret).
 *
 * Règles (vérifiées le 03/10/2026) :
 * - Code des postes et des communications électroniques, art. L34-5 (version
 *   du 26/07/2020, Légifrance LEGIARTI000042155961) : « Dans tous les cas, il
 *   est interdit d'émettre, à des fins de prospection directe, des messages […]
 *   sans indiquer de coordonnées valables auxquelles le destinataire puisse
 *   utilement transmettre une demande tendant à obtenir que ces communications
 *   cessent sans frais autres que ceux liés à la transmission de celle-ci. »
 * - CNIL, « La prospection commerciale par courrier électronique » (cnil.fr) :
 *   « La prospection à l'égard de professionnels peut être fondée sur l'intérêt
 *   légitime de l'organisme lorsque l'objet de la sollicitation est en rapport
 *   avec la profession de la personne démarchée », la personne étant informée
 *   au moment de la collecte (mention ajoutée au formulaire d'inscription) ; et
 *   « chaque sollicitation doit obligatoirement permettre à la personne
 *   concernée de prendre connaissance de l'identité de l'organisation qui
 *   l'émet ainsi que d'exprimer, si elle le souhaite et par un moyen simple,
 *   son refus ». Auprès d'un particulier, « la simple création d'un compte ne
 *   signifie pas qu'il y aura une commande éventuelle » : l'exception « client »
 *   ne jouerait pas. Les inscrits de Qonforme sont des entreprises qui
 *   s'équipent pour leur activité ; les emails parlent de cette activité.
 * - RFC 8058 : désinscription en un clic depuis le logiciel de messagerie
 *   (en-têtes List-Unsubscribe et List-Unsubscribe-Post, requête POST sans
 *   cookie ni connexion).
 *
 * Jeton : « <identifiant du compte>.<HMAC-SHA256 base64url> », sans expiration
 * (un lien de désinscription doit marcher longtemps après l'envoi). Il ne permet
 * que de changer cette préférence.
 *
 * Secret : EMAIL_UNSUBSCRIBE_SECRET, à défaut la clé service_role de Supabase
 * (déjà présente sur le serveur, jamais envoyée au navigateur). Changer ce
 * secret invalide les liens déjà envoyés.
 */
import { createHmac, timingSafeEqual } from "node:crypto"

const SCOPE = "onboarding-emails:v1"
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAC = /^[A-Za-z0-9_-]{43}$/

export function unsubscribeSecret(): string | null {
  const secret = process.env.EMAIL_UNSUBSCRIBE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  return secret && secret.length >= 16 ? secret : null
}

function mac(secret: string, userId: string): string {
  return createHmac("sha256", secret).update(`${SCOPE}:${userId.toLowerCase()}`).digest("base64url")
}

/** Jeton du compte, ou null si aucun secret n'est configuré. */
export function unsubscribeToken(userId: string, secret = unsubscribeSecret()): string | null {
  if (!secret || !UUID.test(userId)) return null
  return `${userId.toLowerCase()}.${mac(secret, userId)}`
}

/** Identifiant du compte si le jeton est valable, sinon null. */
export function verifyUnsubscribeToken(token: unknown, secret = unsubscribeSecret()): string | null {
  if (!secret || typeof token !== "string" || token.length > 100) return null
  const [userId, signature, ...rest] = token.split(".")
  if (rest.length || !userId || !signature || !UUID.test(userId) || !MAC.test(signature)) return null
  const expected = Buffer.from(mac(secret, userId))
  const given = Buffer.from(signature)
  return expected.length === given.length && timingSafeEqual(expected, given) ? userId.toLowerCase() : null
}

export function appBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "https://qonforme.fr").replace(/\/+$/, "")
}

/** Page de désinscription (lien dans le corps de l'email). */
export function unsubscribePageUrl(userId: string, base = appBaseUrl()): string | null {
  const token = unsubscribeToken(userId)
  return token ? `${base}/desinscription?t=${encodeURIComponent(token)}` : null
}

/** En-têtes de désinscription en un clic (RFC 2369 et RFC 8058). */
export function listUnsubscribeHeaders(userId: string, base = appBaseUrl()): Record<string, string> | null {
  const token = unsubscribeToken(userId)
  if (!token) return null
  return {
    "List-Unsubscribe": `<${base}/api/emails/unsubscribe?t=${encodeURIComponent(token)}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  }
}
