/**
 * Repérage des affirmations obsolètes ou interdites dans les articles du blog.
 *
 * Les articles générés avant octobre 2026 reprennent d'anciens seuils et un
 * calcul faux des pénalités de retard. Ce module ne corrige rien : il signale,
 * avec la valeur juste, ce qu'un humain doit relire (page /admin/blog/verification),
 * et retient en brouillon un nouvel article généré qui en contient.
 *
 * Valeurs de référence : lib/outils/franchise-tva.ts, lib/outils/penalites.ts,
 * lib/outils/charges.ts (sources officielles citées dans ces fichiers).
 */
import { SEUILS_FRANCHISE_TVA } from "@/lib/outils/franchise-tva"
import { SEMESTRE_REFERENCE, TAUX_PENALITES_DEFAUT, TAUX_PENALITES_PLANCHER } from "@/lib/outils/penalites"

/** Espace normale, insécable ou fine insécable, ou point de milliers. */
const SP = "[\\s\\u00a0\\u202f.]?"
const montants = (...valeurs: string[]) =>
  new RegExp(`\\b(?:${valeurs.map((v) => v.replace(" ", SP)).join("|")})${SP}(?:€|euros?)`, "gi")

const fmt = (n: number) => n.toLocaleString("fr-FR")
const pct = (n: number) => `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} %`
const services = SEUILS_FRANCHISE_TVA.find((s) => s.id === "services")!
const vente = SEUILS_FRANCHISE_TVA.find((s) => s.id === "vente")!

export interface AuditRule {
  id: string
  label: string
  pattern: RegExp
  /** Ce qu'il faut écrire à la place. */
  correction: string
}

export const AUDIT_RULES: AuditRule[] = [
  {
    id: "franchise-anciens-seuils",
    label: "Anciens seuils de franchise de TVA",
    pattern: montants("36 800", "91 900", "39 100", "101 000", "34 400", "82 800", "42 900", "94 300"),
    correction: `Seuils 2026 (art. 293 B du CGI) : ${fmt(services.seuilBase)} € pour les services et ${fmt(vente.seuilBase)} € pour la vente, seuils majorés ${fmt(services.seuilMajore)} € et ${fmt(vente.seuilMajore)} €.`,
  },
  {
    id: "franchise-regle-mois",
    label: "Ancienne règle de dépassement de la franchise",
    pattern: /1er jour du mois (?:de|du|où) (?:dépassement|vous dépassez)/gi,
    correction: "Depuis le 1er mars 2025, la TVA s'applique aux opérations réalisées à partir de la date du dépassement du seuil majoré ; le seul seuil de base dépassé la fait appliquer au 1er janvier suivant.",
  },
  {
    id: "micro-anciens-plafonds",
    label: "Anciens plafonds de la micro-entreprise",
    pattern: montants("77 700", "188 700", "72 600", "176 200"),
    correction: "Plafonds 2026 : 203 100 € pour la vente et l'hébergement, 83 600 € pour les services et les professions libérales.",
  },
  {
    id: "micro-anciens-taux",
    label: "Ancien taux de cotisations en libéral",
    pattern: /\b(?:21,1|23,1|24,6)\s?%/g,
    correction: "Libéral non réglementé : 25,6 % du chiffre d'affaires en 2026 (décret n° 2025-943).",
  },
  {
    id: "penalites-bce-x3",
    label: "Calcul faux des pénalités de retard (« BCE × 3 »)",
    pattern: /(?:BCE|taux directeur)[^.\n]{0,40}(?:×|x|fois)\s?3\b|(?:3|trois) fois le taux (?:directeur|de (?:la )?BCE|d'intérêt (?:de la|appliqué par la) (?:BCE|Banque))/gi,
    correction: `Sans taux prévu : taux de refinancement de la BCE majoré de 10 points (${pct(TAUX_PENALITES_DEFAUT)} au ${SEMESTRE_REFERENCE.libelle}). Un taux prévu ne peut pas être inférieur à 3 fois le taux d'intérêt légal (${pct(TAUX_PENALITES_PLANCHER)}). Code de commerce, art. L441-10.`,
  },
  {
    id: "autoliquidation-283-1",
    label: "Article 283-1 du CGI cité pour une vente à l'étranger",
    pattern: /283[\s-]?1\b/g,
    correction: "Vente de biens à un professionnel de l'UE : « Exonération de TVA, article 262 ter I du CGI ». Prestation de services : mention « Autoliquidation ». L'article 283-1 vise un fournisseur non établi en France.",
  },
  {
    id: "promesse-certification",
    label: "Logiciel présenté comme certifié ou homologué",
    pattern: /(?:Qonforme|logiciel|solution|outil)[^.\n]{0,40}(?:certifi|homologu)/gi,
    correction: "Qonforme n'est ni certifié ni homologué, et n'est pas une plateforme agréée : ne pas l'affirmer.",
  },
  {
    id: "faux-avis",
    label: "Avis ou note invérifiable",
    pattern: /Trustpilot|\b[3-5],\d\s?\/\s?5\b|\d+\s+avis (?:clients|vérifiés)/gi,
    correction: "Aucun avis ni note ne doit être cité sans source vérifiable.",
  },
  {
    id: "pdp",
    label: "Ancien nom des plateformes agréées (PDP)",
    pattern: /\bPDP\b|plateformes? de dématérialisation partenaires?/g,
    correction: "On parle désormais de « plateformes agréées ».",
  },
]

export interface AuditFinding {
  rule: AuditRule
  /** Passage du texte autour de la valeur trouvée. */
  excerpt: string
}

/** Liste les passages à relire d'un texte (Markdown ou texte brut). */
export function auditArticle(text: string): AuditFinding[] {
  const findings: AuditFinding[] = []
  for (const rule of AUDIT_RULES) {
    const re = new RegExp(rule.pattern.source, rule.pattern.flags.includes("g") ? rule.pattern.flags : rule.pattern.flags + "g")
    for (const m of Array.from(text.matchAll(re))) {
      const start = Math.max(0, (m.index ?? 0) - 70)
      const end = Math.min(text.length, (m.index ?? 0) + m[0].length + 70)
      const excerpt = `${start > 0 ? "…" : ""}${text.slice(start, end).replace(/\s+/g, " ").trim()}${end < text.length ? "…" : ""}`
      findings.push({ rule, excerpt })
      if (findings.filter((f) => f.rule.id === rule.id).length >= 3) break
    }
  }
  return findings
}
