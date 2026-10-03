/**
 * Mentions imprimées d'office sur les devis, factures, bons de commande et
 * avoirs, à partir du profil légal de l'entreprise (lib/legal/profile.ts), puis
 * les mentions libres de l'artisan (Paramètres › Modèles, `legal_notice`) sans
 * ce qu'un réglage dédié couvre déjà : jamais deux fois la même mention.
 *
 * Mentions générées (sources vérifiées le 03/10/2026) :
 * - Entrepreneur individuel (micro-entreprise comprise) : le nom suivi de
 *   « entrepreneur individuel (EI) », sauf si la raison sociale le porte déjà
 *   (code de commerce, art. R526-27).
 * - Société : forme juridique et capital social (art. R123-238) ; « RCS » et la
 *   ville du greffe si l'entreprise est immatriculée au RCS (art. R123-237, 2°).
 * - Franchise en base : « TVA non applicable, art. 293 B du CGI » (CGI,
 *   art. 293 B ; service-public.gouv.fr, F31808).
 * - Assurance professionnelle : l'assurance souscrite, les coordonnées de
 *   l'assureur, la couverture géographique (code de l'artisanat, art. L132-1,
 *   en vigueur depuis le 01/07/2023, ex-art. 22-2 de la loi n° 96-603), et les
 *   références du contrat (service-public.gouv.fr, F31808). Pour la garantie
 *   décennale, le code des assurances (art. L243-2, al. 2) demande en plus de
 *   joindre l'attestation d'assurance aux devis et factures : Qonforme ne la
 *   joint pas, l'écran de réglage le dit.
 *   https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000047362294
 *   https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000031010272
 *
 * Document émis : ses mentions restent celles de son émission. Un déclencheur
 * SQL fige à l'émission le nom, les mentions libres et le profil dans
 * `legal_snapshot` (migration 20261003_legal_profile_btp.sql) ; un document
 * émis avant ce déclencheur garde ses mentions libres d'alors, sans profil.
 */
import {
  isCompletePolicy, isIndividual, parseLegalProfile,
  type InsurancePolicy, type LegalProfile, type VatRegime,
} from "@/lib/legal/profile"

export type MentionKey = "identity" | "decennale" | "rc_pro" | "vat"

export interface GeneratedMention {
  key: MentionKey
  text: string
}

export const FRANCHISE_MENTION = "TVA non applicable, art. 293 B du CGI"

/** Montant du capital : « 5 000 », « 1 500,50 » (espaces insécables, comme les PDF). */
export function formatCapital(n: number): string {
  const [int, dec] = (Math.round(n * 100) / 100).toFixed(2).split(".")
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, " ")
  return dec === "00" ? grouped : `${grouped},${dec}`
}

const EI_IN_NAME = /\bEI\b|entrepreneur individuel/i

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function identityMention(p: LegalProfile, name: string): { text: string; covers: Set<Topic> } | null {
  const covers = new Set<Topic>()
  const parts: string[] = []
  if (isIndividual(p.legal_form)) {
    covers.add("ei")
    if (!EI_IN_NAME.test(name)) parts.push(`${name || "Entreprise"}, entrepreneur individuel (EI)`)
  } else if (p.legal_form === "societe" && p.company_type) {
    const typeInName = new RegExp(`(^|[^\\p{L}])${escapeRegExp(p.company_type)}($|[^\\p{L}])`, "iu").test(name)
    let s = name ? (typeInName ? name : `${name}, ${p.company_type}`) : p.company_type
    if (p.share_capital != null) {
      s += ` au capital de ${formatCapital(p.share_capital)} €`
      covers.add("capital")
    }
    parts.push(s)
  }
  if (p.rcs_city) {
    parts.push(`RCS ${p.rcs_city}`)
    covers.add("rcs")
  }
  return parts.length ? { text: parts.join(" — "), covers } : null
}

function policyMention(label: string, p: InsurancePolicy): string {
  const head = [p.insurer, p.address].filter(Boolean).join(", ")
  return [
    `${label} : ${head}`,
    p.policy_number ? `contrat n° ${p.policy_number}` : "",
    p.coverage ? `couverture géographique : ${p.coverage}` : "",
  ].filter(Boolean).join(" — ")
}

/**
 * Mentions tirées du profil, dans l'ordre d'impression : identité, assurances,
 * TVA. Une assurance n'est imprimée que complète (assureur, coordonnées,
 * contrat, couverture) : une mention à moitié remplie serait fausse.
 */
export function generateMentions(profile: LegalProfile | null | undefined, companyName?: string | null): GeneratedMention[] {
  if (!profile) return []
  const name = (companyName ?? "").replace(/\s+/g, " ").trim()
  const out: GeneratedMention[] = []
  const identity = identityMention(profile, name)
  if (identity) out.push({ key: "identity", text: identity.text })
  if (isCompletePolicy(profile.decennale)) out.push({ key: "decennale", text: policyMention("Assurance décennale", profile.decennale!) })
  if (isCompletePolicy(profile.rc_pro)) out.push({ key: "rc_pro", text: policyMention("Responsabilité civile professionnelle", profile.rc_pro!) })
  if (profile.vat_regime === "franchise") out.push({ key: "vat", text: FRANCHISE_MENTION })
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// Mentions libres : ce que les réglages dédiés remplacent
// ─────────────────────────────────────────────────────────────────────────────

/** Sujets qu'une ligne de mentions libres peut aborder. */
type Topic = "vat" | "decennale" | "rc_pro" | "capital" | "rcs" | "ei"

const TOPICS: Record<Topic, RegExp> = {
  vat: /\b293\s*B\b|TVA\s+non\s+applicable/i,
  decennale: /d[ée]cennale/i,
  rc_pro: /responsabilit[ée]\s+civile|\bRC\s*pro\b/i,
  capital: /\bcapital\b/i,
  rcs: /\bR\.?\s?C\.?\s?S\b|registre du commerce/i,
  ei: /\bEI\b|entrepreneur individuel/i,
}

const TOPIC_KEY: Record<Topic, MentionKey> = {
  vat: "vat", decennale: "decennale", rc_pro: "rc_pro", capital: "identity", rcs: "identity", ei: "identity",
}

export interface SupersededLine {
  line: string
  /** Réglage qui la remplace. */
  by: MentionKey
  /** Vrai si la ligne contredit le réglage (ex. franchise écrite, TVA facturée). */
  contradiction: boolean
}

export interface ComposedMentions {
  /** Lignes imprimées : mentions générées, puis mentions libres gardées. */
  lines: string[]
  generated: GeneratedMention[]
  /** Lignes des mentions libres imprimées telles quelles. */
  kept: string[]
  /** Lignes des mentions libres remplacées par un réglage dédié (non imprimées). */
  superseded: SupersededLine[]
  /** Régime de TVA déclaré, ou null (le Factur-X lit alors la mention 293 B). */
  vatRegime: VatRegime | null
}

/**
 * Mentions d'un document : celles du profil, puis les mentions libres sans les
 * lignes qu'un réglage rempli couvre déjà (une ligne n'est retirée que si
 * chacun de ses sujets est couvert). Sans profil : les mentions libres seules,
 * comme avant.
 */
export function composeMentions(
  profile: LegalProfile | null | undefined,
  legalNotice: string | null | undefined,
  companyName?: string | null,
): ComposedMentions {
  const generated = generateMentions(profile, companyName)
  const covered = new Set<Topic>()
  if (profile) {
    if (profile.vat_regime) covered.add("vat")
    if (isCompletePolicy(profile.decennale)) covered.add("decennale")
    if (isCompletePolicy(profile.rc_pro)) covered.add("rc_pro")
    const identity = identityMention(profile, (companyName ?? "").trim())
    identity?.covers.forEach((t) => covered.add(t))
    if (isIndividual(profile.legal_form)) covered.add("ei")
  }

  const kept: string[] = []
  const superseded: SupersededLine[] = []
  const generatedTexts = new Set(generated.map((g) => g.text.toLowerCase()))
  for (const raw of (legalNotice ?? "").split("\n")) {
    const line = raw.trim()
    if (!line) continue
    const topics = (Object.keys(TOPICS) as Topic[]).filter((t) => TOPICS[t].test(line))
    const duplicate = generatedTexts.has(line.toLowerCase())
    if (duplicate || (topics.length > 0 && topics.every((t) => covered.has(t)))) {
      const by = duplicate ? generated.find((g) => g.text.toLowerCase() === line.toLowerCase())!.key : TOPIC_KEY[topics[0]]
      superseded.push({
        line,
        by,
        contradiction: topics.includes("vat") && profile?.vat_regime === "assujetti",
      })
    } else {
      kept.push(line)
    }
  }

  return {
    lines: [...generated.map((g) => g.text), ...kept],
    generated,
    kept,
    superseded,
    vatRegime: profile?.vat_regime ?? null,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Documents : mentions figées à l'émission
// ─────────────────────────────────────────────────────────────────────────────

export type LegalDocKind = "invoice" | "quote" | "purchase_order" | "credit_note"

/** Ce que le déclencheur SQL fige à l'émission (colonne `legal_snapshot`). */
export interface LegalSnapshot {
  name: string | null
  legal_notice: string | null
  profile: LegalProfile | null
  frozen_at: string | null
}

export function parseLegalSnapshot(value: unknown): LegalSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const v = value as Record<string, unknown>
  return {
    name: typeof v.name === "string" ? v.name : null,
    legal_notice: typeof v.legal_notice === "string" ? v.legal_notice : null,
    profile: parseLegalProfile(v.profile),
    frozen_at: typeof v.frozen_at === "string" ? v.frozen_at : null,
  }
}

/**
 * Instantané tel que le déclencheur d'émission le pose, à partir de
 * l'entreprise chargée : pour l'affichage juste après un envoi, avant que la
 * page ne relise le document.
 */
export function snapshotOf(company: LegalCompany | null | undefined): LegalSnapshot {
  return {
    name: company?.name ?? null,
    legal_notice: company?.legal_notice ?? null,
    profile: parseLegalProfile(company?.legal_profile),
    frozen_at: null,
  }
}

/** Entreprise telle que la lisent les documents. */
export interface LegalCompany {
  name?: string | null
  legal_notice?: string | null
  /** Colonne JSON `legal_profile` (absente tant que la migration n'est pas appliquée). */
  legal_profile?: unknown
}

/** Document : statut (absent = brouillon ou aperçu) et instantané figé à l'émission. */
export interface LegalDoc {
  status?: string | null
  legal_snapshot?: unknown
}

export interface DocumentMentions extends ComposedMentions {
  /** Les lignes jointes : ce que lisent le PDF et le Factur-X à la place de `legal_notice`. */
  legalNotice: string
  /**
   * D'où viennent les mentions : instantané de l'émission, réglages actuels
   * (brouillon, aperçu) ou, pour un document émis avant l'instantané, ses
   * mentions libres seules.
   */
  source: "snapshot" | "live" | "legacy"
}

/** Un avoir est émis dès sa création ; les autres documents quand ils quittent le brouillon. */
export function isIssuedDocument(kind: LegalDocKind, doc: LegalDoc | null | undefined): boolean {
  if (kind === "credit_note") return true
  return !!doc?.status && doc.status !== "draft"
}

/**
 * Mentions à imprimer sur un document.
 * - Instantané présent : les mentions de l'émission, quels que soient les réglages actuels.
 * - Document émis sans instantané (émis avant la migration) : ses mentions
 *   libres seules, comme il l'a toujours été ; le profil, saisi après, ne s'y
 *   ajoute pas.
 * - Brouillon ou aperçu : les réglages actuels.
 */
export function resolveDocumentMentions(
  company: LegalCompany | null | undefined,
  doc: LegalDoc | null | undefined,
  kind: LegalDocKind,
): DocumentMentions {
  const snapshot = parseLegalSnapshot(doc?.legal_snapshot)
  let composed: ComposedMentions
  let source: DocumentMentions["source"]
  if (snapshot) {
    composed = composeMentions(snapshot.profile, snapshot.legal_notice, snapshot.name ?? company?.name)
    source = "snapshot"
  } else if (isIssuedDocument(kind, doc)) {
    composed = composeMentions(null, company?.legal_notice, company?.name)
    source = "legacy"
  } else {
    composed = composeMentions(parseLegalProfile(company?.legal_profile), company?.legal_notice, company?.name)
    source = "live"
  }
  // Document émis avant l'instantané : ses mentions libres telles quelles, au
  // caractère près, pour que son PDF et son XML restent ceux d'avant
  const legalNotice = source === "legacy" ? company?.legal_notice ?? "" : composed.lines.join("\n")
  return { ...composed, legalNotice, source }
}

/**
 * L'entreprise vue par un document : `legal_notice` remplacé par les mentions
 * résolues et `vat_regime` posé, pour que le PDF et le XML Factur-X
 * (lib/facturx) lisent les mêmes mentions et le même régime de TVA.
 */
export function withDocumentMentions<C extends LegalCompany>(
  company: C | null | undefined,
  doc: LegalDoc | null | undefined,
  kind: LegalDocKind,
): (C & { legal_notice: string; vat_regime: VatRegime | null }) | null {
  if (!company && !parseLegalSnapshot(doc?.legal_snapshot)) return null
  const resolved = resolveDocumentMentions(company, doc, kind)
  return { ...(company ?? ({} as C)), legal_notice: resolved.legalNotice, vat_regime: resolved.vatRegime }
}
