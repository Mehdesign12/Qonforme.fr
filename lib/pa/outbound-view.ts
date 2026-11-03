/**
 * Parcours d'une facture envoyée par la plateforme agréée (canevas, planche D15).
 * Module pur, partagé par la fiche réelle et les tests. N'affiche que ce que la
 * plateforme a renvoyé (« sans rien inventer ») ; l'étape suivante attendue est
 * dite « en attente », jamais datée.
 */
import { OUTBOUND_STATUS_LABEL, type OutboundEvent, type OutboundPhase, type OutboundRow } from "@/lib/pa/outbound"
import { REASON_LABELS } from "@/lib/reception/lifecycle"

/** Ce que renvoie `GET /api/invoices/[id]/platform` pour la tentative active. */
export interface PlatformInfo {
  attempt: number
  phase: OutboundPhase
  mode: "test" | "live"
  recipientAddress: string | null
  lastStatus: string | null
  lastStatusAt: string | null
  events: OutboundEvent[]
  error: string | null
  depositedAt: string | null
  createdAt: string
  paymentReportedAt: string | null
}

/** Ce que la fiche affiche : jamais les jetons ni les identifiants internes du compte. */
export function toPlatformInfo(row: OutboundRow): PlatformInfo {
  return {
    attempt: row.attempt,
    phase: row.phase,
    mode: row.mode,
    recipientAddress: row.recipient_address,
    lastStatus: row.last_status_code,
    lastStatusAt: row.last_status_at,
    events: row.events ?? [],
    error: row.error,
    depositedAt: row.deposited_at,
    createdAt: row.created_at,
    paymentReportedAt: row.payment_reported_at,
  }
}

export type PlatformState =
  | "sending" | "failed" | "rejected"
  | "in_transit" | "received" | "in_hand" | "approved" | "disputed" | "refused" | "paid"

const REJECT = new Set(["fr:213", "fr:501", "api:invalid", "api:rejected"])

export function platformState(p: Pick<PlatformInfo, "phase" | "lastStatus">): PlatformState {
  if (p.phase === "sending") return "sending"
  if (p.phase === "failed") return "failed"
  if (p.phase === "rejected") return "rejected"
  switch (p.lastStatus) {
    case "fr:212": return "paid"
    case "fr:210": return "refused"
    case "fr:207": return "disputed"
    case "fr:205": case "fr:206": case "fr:209": case "fr:211": return "approved"
    case "fr:204": case "fr:208": return "in_hand"
    case "fr:202": case "fr:203": return "received"
    default: return "in_transit"
  }
}

export const PLATFORM_STATE_LABEL: Record<PlatformState, string> = {
  sending: "Envoi en cours",
  failed: "Envoi non abouti",
  rejected: "Rejetée par la plateforme",
  in_transit: "Transmise à la plateforme",
  received: "Reçue par la plateforme du client",
  in_hand: "Prise en charge par le client",
  approved: "Approuvée par le client",
  disputed: "En litige",
  refused: "Refusée par le client",
  paid: "Encaissée",
}

export interface JourneyStep {
  code: string | null
  title: string
  at: string | null
  sub: string | null
  state: "done" | "todo" | "warn"
}

/** Motif d'un événement (code de refus, note du client ou du contrôle). */
export function reasonOf(e: Pick<OutboundEvent, "reason">): string | null {
  const raw = e.reason?.trim()
  if (!raw) return null
  // Le code de motif (« MONTANTTOTAL_ERR ») est remplacé par son libellé
  const [first, ...rest] = raw.split(" · ")
  const label = REASON_LABELS[first]
  return label ? [label, ...rest].join(" · ") : raw
}

/**
 * Étapes du parcours : chaque statut officiel reçu (fr:*), dans l'ordre, une
 * seule fois par code (le plus ancien), puis l'étape suivante attendue. Un
 * rejet technique (api:invalid…) apparaît comme « Rejetée ».
 */
export function journeySteps(p: Pick<PlatformInfo, "phase" | "events" | "lastStatus">): JourneyStep[] {
  const seen = new Set<string>()
  const steps: JourneyStep[] = []
  for (const e of p.events ?? []) {
    const official = /^fr:\d{3}$/.test(e.code)
    const reject = REJECT.has(e.code)
    if (!official && !reject) continue
    const key = reject ? "rejected" : e.code
    if (seen.has(key)) continue
    seen.add(key)
    const warn = reject || e.code === "fr:210" || e.code === "fr:207"
    steps.push({
      code: e.code,
      title: reject ? "Rejetée" : OUTBOUND_STATUS_LABEL[e.code] ?? e.text ?? e.code,
      at: e.at,
      sub: reasonOf(e),
      state: warn ? "warn" : "done",
    })
  }
  const state = platformState(p)
  const next: Partial<Record<PlatformState, [string, string]>> = {
    in_transit: ["Reçue par la plateforme du client", "En cours de transmission"],
    received: ["Prise en charge par le client", "En attente du client"],
    in_hand: ["Approuvée", "En attente de la décision du client"],
    approved: ["Encaissée", "Vous marquez la facture payée quand le règlement arrive"],
  }
  const n = next[state]
  if (n) steps.push({ code: null, title: n[0], at: null, sub: n[1], state: "todo" })
  return steps
}

/** Motif du refus, du litige ou du rejet le plus récent (bandeau de la fiche). */
export function latestProblem(p: Pick<PlatformInfo, "events" | "error">): string | null {
  const events = [...(p.events ?? [])].reverse()
  const ev = events.find((e) => REJECT.has(e.code) || e.code === "fr:210" || e.code === "fr:207")
  return (ev && (reasonOf(ev) ?? ev.text ?? null)) || p.error || null
}
