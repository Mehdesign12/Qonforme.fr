/**
 * Règles de la signature en ligne — fonctions pures, sans réseau ni base,
 * utilisables côté serveur comme dans le navigateur (panneau, démo).
 *
 * Sources des règles juridiques (vérifiées le 03/10/2026) :
 * - Signature électronique simple : Code civil art. 1366
 *   (https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032042461) et 1367
 *   (https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032042456) ;
 *   règlement (UE) n° 910/2014 « eIDAS », art. 3 et 25. La présomption de
 *   fiabilité de l'art. 1367 ne vaut que pour la signature qualifiée (décret
 *   n° 2017-1416) : une signature simple se prouve par son dossier de preuve.
 * - Taux réduit de TVA des travaux (10 % et 5,5 %) : depuis la loi n° 2025-127
 *   du 14 février 2025 (art. 41), l'attestation est supprimée ; « le preneur
 *   certifie sur le devis ou la facture » que les conditions sont remplies.
 *   CGI art. 279-0 bis, version en vigueur depuis le 01/03/2025
 *   (https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000051215062),
 *   recodifié au 01/01/2027 par l'ordonnance n° 2025-1247 (références à revoir
 *   à cette date) ; BOFiP BOI-TVA-LIQ-30-20-90-40 § 60 à 90
 *   (https://bofip.impots.gouv.fr/bofip/1742-PGP.html/identifiant=BOI-TVA-LIQ-30-20-90-40-20260909).
 * - Particulier : délai de rétractation de 14 jours à compter de la conclusion
 *   d'un contrat de prestation de services conclu à distance ou hors
 *   établissement (C. consom. art. L221-18), décompté selon l'art. L221-19
 *   (https://legifrance.gouv.fr/affichCodeArticle.do?cidTexte=LEGITEXT000006069565&idArticle=LEGIARTI000032226840) ;
 *   démarrage avant la fin du délai
 *   sur demande expresse du consommateur (art. L221-25) ; confirmation sur
 *   support durable avec le formulaire de rétractation (art. L221-13 et
 *   annexe à l'art. R221-1) ; hors établissement, exemplaire daté sur papier
 *   ou, avec l'accord du consommateur, sur un autre support durable
 *   (art. L221-9) et aucun paiement avant 7 jours (art. L221-10).
 */
import { canTransition } from "@/lib/utils/document-status"
import type {
  ClientKind, LinkState, RefusalReason, SignatureContext, SignatureDocType, SignatureMethod,
  SignatureMode, SignatureSettings, SignatureStatus, SignDocLine,
} from "@/lib/signature/types"
import { REFUSAL_REASONS } from "@/lib/signature/types"

/* ------------------------------------------------------------------ */
/* Constantes                                                          */
/* ------------------------------------------------------------------ */

/** Durée de vie d'un code de vérification. */
export const CODE_TTL_MINUTES = 10
/** Essais permis par code ; au-delà, il faut en demander un nouveau. */
export const CODE_MAX_ATTEMPTS = 5
/** Délai minimal entre deux envois de code. */
export const CODE_RESEND_SECONDS = 60
/** Codes envoyés au plus par lien. */
export const CODE_MAX_SENDS = 5
/** Taille maximale de l'image d'une signature tracée (PNG). */
export const SIGNATURE_IMAGE_MAX_BYTES = 200_000
/** Validité d'un lien de consultation (compte gratuit). */
export const VIEW_LINK_DAYS = 90
/** Délai légal de rétractation d'un particulier (C. consom. art. L221-18). */
export const WITHDRAWAL_DAYS = 14
/** Hors établissement : aucun paiement avant ce délai (C. consom. art. L221-10). */
export const OFF_PREMISES_NO_PAYMENT_DAYS = 7

/* ------------------------------------------------------------------ */
/* Client et contenu                                                   */
/* ------------------------------------------------------------------ */

/** Professionnel si la fiche client porte un SIREN ou un numéro de TVA, particulier sinon. */
export function clientKindOf(client: { siren?: string | null; vat_number?: string | null } | null | undefined): ClientKind {
  return client?.siren?.trim() || client?.vat_number?.trim() ? "business" : "consumer"
}

/** Taux réduits présents dans le document (travaux dans des logements). */
export function reducedVatRates(lines: { vat_rate: number | string }[] | null | undefined): { ten: boolean; fivePointFive: boolean } {
  let ten = false
  let fivePointFive = false
  for (const l of lines ?? []) {
    const r = Number(l.vat_rate)
    if (r === 10) ten = true
    if (r === 5.5) fivePointFive = true
  }
  return { ten, fivePointFive }
}

export function needsReducedVatCertification(lines: { vat_rate: number | string }[] | null | undefined): boolean {
  const r = reducedVatRates(lines)
  return r.ten || r.fivePointFive
}

/**
 * Texte que le client certifie à la signature quand le document applique un
 * taux réduit. Reprend les éléments du BOFiP BOI-TVA-LIQ-30-20-90-40 § 80.
 */
export function reducedVatCertificationText(lines: { vat_rate: number | string }[] | null | undefined): string {
  const { fivePointFive } = reducedVatRates(lines)
  const base =
    "Je certifie que les travaux portent sur des locaux affectés à l'habitation à l'issue des travaux et achevés depuis plus de deux ans, " +
    "et que, sur une période de deux ans au plus, ils n'ont pas pour effet de surélever l'immeuble, de le remettre à l'état neuf " +
    "ni d'augmenter sa surface de plancher de plus de 10 %"
  return fivePointFive
    ? `${base} ; les prestations au taux de 5,5 % sont des travaux de rénovation énergétique au sens de l'article 278-0 bis A du CGI.`
    : `${base}.`
}

/** Code de vérification exigé pour ce montant, selon le réglage de l'artisan. */
export function needsVerificationCode(settings: Pick<SignatureSettings, "code_mode" | "code_threshold_ttc">, totalTtc: number): boolean {
  if (settings.code_mode === "always") return true
  if (settings.code_mode === "never") return false
  return Number(totalTtc) > Number(settings.code_threshold_ttc)
}

/* ------------------------------------------------------------------ */
/* Dates                                                               */
/* ------------------------------------------------------------------ */

/** Décalage de l'heure de Paris (en minutes) à un instant donné. */
function parisOffsetMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Paris", hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(at)
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"))
  return Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / 60000)
}

/** Dernière seconde d'un jour (AAAA-MM-JJ) à l'heure de Paris. */
export function parisEndOfDay(day: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(day)
  if (!m) throw new Error(`Date invalide : ${day}`)
  const naive = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59)
  const offset = parisOffsetMinutes(new Date(naive))
  return new Date(naive - offset * 60000)
}

/**
 * Date d'expiration d'un nouveau lien.
 * - Devis à signer : la fin du jour de validité (« il expire avec la validité du devis ») ;
 *   null si le devis a déjà expiré (on ne fait pas signer un devis périmé).
 * - Bon de commande à signer : la durée réglée par l'artisan.
 * - Consultation seule : VIEW_LINK_DAYS jours.
 */
export function linkExpiry(params: {
  docType: SignatureDocType
  mode: SignatureMode
  validUntil?: string | null
  linkValidityDays: number
  now: Date
}): Date | null {
  const { docType, mode, validUntil, linkValidityDays, now } = params
  if (mode === "view") return new Date(now.getTime() + VIEW_LINK_DAYS * 86_400_000)
  if (docType === "quote") {
    if (!validUntil) return new Date(now.getTime() + linkValidityDays * 86_400_000)
    const end = parisEndOfDay(validUntil)
    return end.getTime() > now.getTime() ? end : null
  }
  const days = Math.min(365, Math.max(1, Math.round(linkValidityDays) || 30))
  return new Date(now.getTime() + days * 86_400_000)
}

/** Jour (AAAA-MM-JJ) d'un instant, à l'heure de Paris. */
export function parisDay(at: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(at)
}

function addDaysISO(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

/** Jours fériés en France métropolitaine (Pâques par l'algorithme grégorien anonyme). */
export function frenchHolidays(year: number): string[] {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1
  const easter = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
  return [
    `${year}-01-01`, addDaysISO(easter, 1), `${year}-05-01`, `${year}-05-08`, addDaysISO(easter, 39), addDaysISO(easter, 50),
    `${year}-07-14`, `${year}-08-15`, `${year}-11-01`, `${year}-11-11`, `${year}-12-25`,
  ]
}

/**
 * Dernier jour du délai de rétractation (C. consom. art. L221-19) : le jour
 * de la signature ne compte pas ; 14 jours ; un délai qui finit un samedi,
 * un dimanche ou un jour férié est prolongé au premier jour ouvrable suivant.
 */
export function withdrawalDeadline(signedAt: Date): string {
  let day = addDaysISO(parisDay(signedAt), WITHDRAWAL_DAYS)
  for (let guard = 0; guard < 10; guard++) {
    const weekday = new Date(`${day}T12:00:00Z`).getUTCDay()
    const holiday = frenchHolidays(Number(day.slice(0, 4))).includes(day)
    if (weekday !== 0 && weekday !== 6 && !holiday) break
    day = addDaysISO(day, 1)
  }
  return day
}

/* ------------------------------------------------------------------ */
/* État du lien                                                        */
/* ------------------------------------------------------------------ */

export function computeLinkState(
  row: { status: SignatureStatus; expires_at: string; sent_at?: string | null; view_count?: number | null },
  now: Date,
): LinkState {
  if (row.status === "signed") return "signed"
  if (row.status === "refused") return "refused"
  if (row.status === "disabled") return "disabled"
  if (row.status === "superseded") return "superseded"
  if (new Date(row.expires_at).getTime() <= now.getTime()) return "expired"
  if ((row.view_count ?? 0) > 0) return "viewed"
  return row.sent_at ? "sent" : "ready"
}

/** Le lien accepte-t-il encore une signature ou un refus ? */
export function isLinkActionable(state: LinkState): boolean {
  return state === "ready" || state === "sent" || state === "viewed"
}

/** Libellés du journal (dossier de preuve, panneau de l'artisan). */
export const EVENT_LABELS: Record<string, string> = {
  created: "Lien créé",
  sent: "Lien envoyé par email",
  viewed: "Document consulté",
  code_sent: "Code de vérification envoyé",
  code_failed: "Code de vérification erroné",
  code_verified: "Code de vérification validé",
  signed: "Document signé",
  refused: "Document refusé",
  disabled: "Lien désactivé",
  superseded: "Lien remplacé",
  email_failed: "Échec d'envoi d'un email",
}

export const LINK_STATE_LABELS: Record<LinkState, string> = {
  ready: "Lien prêt",
  sent: "Envoyé",
  viewed: "Consulté",
  signed: "Signé",
  refused: "Refusé",
  expired: "Expiré",
  superseded: "Remplacé",
  disabled: "Désactivé",
}

/* ------------------------------------------------------------------ */
/* Statut du document (lib/utils/document-status.ts)                   */
/* ------------------------------------------------------------------ */

/** Statut que prend le document signé : devis « accepté », bon de commande « confirmé ». */
export function signedStatusFor(docType: SignatureDocType): "accepted" | "confirmed" {
  return docType === "quote" ? "accepted" : "confirmed"
}

/** Statut que prend le document refusé : devis « refusé » ; un bon de commande garde son statut. */
export function refusedStatusFor(docType: SignatureDocType): "rejected" | null {
  return docType === "quote" ? "rejected" : null
}

/**
 * Le document peut-il être signé dans son état actuel ? Seul un document
 * envoyé l'est : la transition vers « accepté » ou « confirmé » doit exister
 * dans la liste blanche, et le document ne doit pas l'avoir déjà prise.
 */
export function canSignDocument(docType: SignatureDocType, status: string): boolean {
  const target = signedStatusFor(docType)
  return status !== target && status !== "draft" && canTransition(docType, status, target)
}

/**
 * Un lien de signature peut être créé pour un brouillon (il passe alors à
 * « envoyé ») ou un document envoyé ; un lien de consultation, pour tout document.
 */
export function canCreateLink(docType: SignatureDocType, status: string, mode: SignatureMode): boolean {
  if (mode === "view") return true
  return status === "draft" || canSignDocument(docType, status)
}

/* ------------------------------------------------------------------ */
/* Empreinte du contenu                                                */
/* ------------------------------------------------------------------ */

const num = (v: unknown) => {
  const n = Math.round((Number(v) || 0) * 10000) / 10000
  return Object.is(n, -0) ? 0 : n
}
const str = (v: unknown) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v))

export interface FingerprintDoc {
  number: string
  issue_date: string
  valid_until?: string | null
  delivery_date?: string | null
  reference?: string | null
  client_id?: string | null
  lines: Partial<SignDocLine>[] | null
  subtotal_ht: number | string
  total_vat: number | string
  total_ttc: number | string
  notes?: string | null
}

/**
 * Texte canonique du contenu d'un document (lignes, montants, client, dates) :
 * son empreinte SHA-256 identifie la version signée. Une modification du
 * document change l'empreinte et rend le lien caduc (« remplacé »).
 * Les coordonnées du client (fiche client) n'en font pas partie : les
 * corriger ne doit pas annuler un lien envoyé.
 */
export function contentFingerprintSource(docType: SignatureDocType, doc: FingerprintDoc): string {
  const canonical = {
    t: docType,
    n: str(doc.number),
    d: str(doc.issue_date).slice(0, 10),
    v: docType === "quote" ? str(doc.valid_until).slice(0, 10) : "",
    l: docType === "purchase_order" ? str(doc.delivery_date).slice(0, 10) : "",
    r: docType === "purchase_order" ? str(doc.reference) : "",
    c: str(doc.client_id),
    lines: (doc.lines ?? []).map((l) => [str(l.description), num(l.quantity), str(l.unit), num(l.unit_price_ht), num(l.vat_rate), num(l.total_ht)]),
    ht: num(doc.subtotal_ht),
    tva: num(doc.total_vat),
    ttc: num(doc.total_ttc),
    notes: str(doc.notes),
  }
  return JSON.stringify(canonical)
}

/* ------------------------------------------------------------------ */
/* Code de vérification                                                */
/* ------------------------------------------------------------------ */

export type CodeCheck = "ok" | "none" | "expired" | "locked"

/** Peut-on encore essayer le code en cours ? */
export function codeAttemptState(
  row: { code_hash: string | null; code_expires_at: string | null; code_attempts: number },
  now: Date,
): CodeCheck {
  if (!row.code_hash || !row.code_expires_at) return "none"
  if (new Date(row.code_expires_at).getTime() <= now.getTime()) return "expired"
  if (row.code_attempts >= CODE_MAX_ATTEMPTS) return "locked"
  return "ok"
}

/** Un nouveau code peut-il partir ? Sinon, combien de secondes attendre (ou plus aucun envoi). */
export function canSendCode(
  row: { code_sent_count: number; code_last_sent_at: string | null },
  now: Date,
): { ok: true } | { ok: false; reason: "too_soon"; retryIn: number } | { ok: false; reason: "limit" } {
  if (row.code_sent_count >= CODE_MAX_SENDS) return { ok: false, reason: "limit" }
  if (row.code_last_sent_at) {
    const elapsed = (now.getTime() - new Date(row.code_last_sent_at).getTime()) / 1000
    if (elapsed < CODE_RESEND_SECONDS) return { ok: false, reason: "too_soon", retryIn: Math.ceil(CODE_RESEND_SECONDS - elapsed) }
  }
  return { ok: true }
}

/** « jean.dupont@exemple.fr » → « je•••@exemple.fr » (affichage sur la page publique). */
export function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null
  const at = email.indexOf("@")
  if (at < 1) return null
  const local = email.slice(0, at)
  const keep = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2)
  return `${keep}•••${email.slice(at)}`
}

/* ------------------------------------------------------------------ */
/* Validation des saisies de la page publique                          */
/* ------------------------------------------------------------------ */

const EMAIL_RE = /^[^\s@<>"']{1,64}@[^\s@<>"']{1,190}\.[^\s@<>"']{2,}$/

export function isValidEmail(v: unknown): v is string {
  return typeof v === "string" && v.length <= 254 && EMAIL_RE.test(v)
}

/** Texte libre : espaces normalisés, caractères de contrôle retirés, longueur bornée. */
export function cleanText(v: unknown, max: number): string {
  if (typeof v !== "string") return ""
  // eslint-disable-next-line no-control-regex
  return v.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max)
}

/** Texte libre sur plusieurs lignes (message de refus). */
export function cleanMultiline(v: unknown, max: number): string {
  if (typeof v !== "string") return ""
  // eslint-disable-next-line no-control-regex
  return v.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0009\u000b-\u001f\u007f]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, max)
}

export interface SignPayloadContext {
  clientKind: ClientKind
  /** Le document contient un taux réduit : certification obligatoire. */
  reducedVat: boolean
}

export interface SignPayload {
  signer_name: string
  signer_email: string
  signer_role: string | null
  signer_company: string | null
  client_order_number: string | null
  method: SignatureMethod
  /** Signature tracée : image PNG (data URL), décodée côté serveur. */
  image: string | null
  /** Signature tapée : le nom saisi. */
  typed_name: string | null
  context: SignatureContext
  consents: {
    accepted_document: true
    reduced_vat_certified?: boolean
    withdrawal_information_shown?: boolean
    early_start_requested?: boolean
    durable_medium_by_email?: boolean
  }
}

type Fail = { ok: false; field: string; error: string }

/** Vérifie la demande de signature envoyée par la page publique. */
export function validateSignPayload(input: unknown, ctx: SignPayloadContext): { ok: true; value: SignPayload } | Fail {
  const b = (input && typeof input === "object" ? input : {}) as Record<string, unknown>
  const consents = (b.consents && typeof b.consents === "object" ? b.consents : {}) as Record<string, unknown>

  const signer_name = cleanText(b.signer_name, 120)
  if (signer_name.length < 2) return { ok: false, field: "signer_name", error: "Indiquez votre nom et votre prénom." }

  const signer_email = cleanText(b.signer_email, 254).toLowerCase()
  if (!isValidEmail(signer_email)) return { ok: false, field: "signer_email", error: "Indiquez une adresse email valide : votre exemplaire signé y sera envoyé." }

  const signer_role = cleanText(b.signer_role, 80) || null
  const signer_company = cleanText(b.signer_company, 160) || null
  if (ctx.clientKind === "business" && !signer_role) {
    return { ok: false, field: "signer_role", error: "Indiquez votre fonction dans l'entreprise." }
  }
  const client_order_number = ctx.clientKind === "business" ? cleanText(b.client_order_number, 60) || null : null

  // Dans l'ordre du formulaire : identité, accord, puis signature
  if (consents.accepted_document !== true) {
    return { ok: false, field: "accepted_document", error: "Cochez « Bon pour accord » pour accepter le document." }
  }
  if (ctx.reducedVat && consents.reduced_vat_certified !== true) {
    return { ok: false, field: "reduced_vat_certified", error: "Le taux réduit de TVA demande votre certification. Sans elle, contactez l'entreprise pour un devis au taux normal." }
  }
  const context: SignatureContext = b.context === "in_person" ? "in_person" : "distance"
  const consumer = ctx.clientKind === "consumer"
  if (consumer && context === "in_person" && consents.durable_medium_by_email !== true) {
    return { ok: false, field: "durable_medium_by_email", error: "Acceptez de recevoir votre exemplaire par email, ou demandez un exemplaire papier signé." }
  }

  const method = b.method === "drawn" || b.method === "typed" ? b.method : null
  if (!method) return { ok: false, field: "method", error: "Signez en traçant votre signature ou en tapant votre nom." }
  let image: string | null = null
  let typed_name: string | null = null
  if (method === "drawn") {
    if (typeof b.image !== "string" || !b.image.startsWith("data:image/png;base64,")) {
      return { ok: false, field: "signature", error: "Tracez votre signature dans le cadre." }
    }
    image = b.image
  } else {
    typed_name = cleanText(b.typed_name, 120)
    if (typed_name.length < 2) return { ok: false, field: "signature", error: "Tapez votre nom pour signer." }
  }

  return {
    ok: true,
    value: {
      signer_name, signer_email, signer_role, signer_company, client_order_number, method, image, typed_name, context,
      consents: {
        accepted_document: true,
        ...(ctx.reducedVat ? { reduced_vat_certified: true } : {}),
        ...(consumer ? {
          withdrawal_information_shown: true,
          early_start_requested: consents.early_start_requested === true,
        } : {}),
        ...(consumer && context === "in_person" ? { durable_medium_by_email: true } : {}),
      },
    },
  }
}

/** Vérifie un refus : motif de la liste, message facultatif. */
export function validateRefusePayload(input: unknown): { ok: true; value: { reason: RefusalReason; message: string | null; name: string | null } } | Fail {
  const b = (input && typeof input === "object" ? input : {}) as Record<string, unknown>
  const reason = REFUSAL_REASONS.find((r) => r.value === b.reason)?.value
  if (!reason) return { ok: false, field: "reason", error: "Choisissez un motif." }
  const message = cleanMultiline(b.message, 1000) || null
  const name = cleanText(b.name, 120) || null
  return { ok: true, value: { reason, message, name } }
}

export function refusalLabel(reason: RefusalReason | null | undefined): string {
  return REFUSAL_REASONS.find((r) => r.value === reason)?.label ?? "Autre raison"
}

/* ------------------------------------------------------------------ */
/* Échappement HTML (emails)                                           */
/* ------------------------------------------------------------------ */

export function escapeHtml(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
