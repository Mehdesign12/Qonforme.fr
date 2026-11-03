/**
 * Démo : parcours d'une facture envoyée par la plateforme agréée (planche D15),
 * construit à partir des données d'exemple. Affiché seulement quand l'émission
 * est ouverte en production (`PLATFORM_SENDING_LIVE`, lib/pa/sending.ts) : la
 * démo ne montre jamais une fonction que les vrais comptes n'ont pas.
 * Facture d'un client professionnel (SIREN), émise : déposée, émise, mise à
 * disposition, reçue ; payée : encaissement déclaré (fr:212).
 */
import { PLATFORM_SENDING_LIVE } from "@/lib/pa/sending"
import { OUTBOUND_STATUS_LABEL } from "@/lib/pa/outbound"
import type { PlatformInfo } from "@/lib/pa/outbound-view"

interface DemoInvoiceLike {
  status: string
  issue_date: string
  sent_at?: string | null
  paid_at?: string | null
  client: { siren?: string | null }
}

const at = (day: string, hhmm: string) => `${day.slice(0, 10)}T${hhmm}:00Z`

export function demoPlatformInfo(inv: DemoInvoiceLike, live = PLATFORM_SENDING_LIVE): PlatformInfo | null {
  const siren = (inv.client.siren ?? "").replace(/\D/g, "")
  if (!live || inv.status === "draft" || siren.length !== 9) return null
  const day = inv.sent_at ?? inv.issue_date
  const codes: [string, string][] = [["api:uploaded", "08:12"], ["fr:200", "08:12"], ["fr:201", "08:13"], ["fr:203", "08:14"], ["fr:202", "08:15"]]
  const events = codes.map(([code, hhmm], i) => ({ id: 9000 + i, code, at: at(day, hhmm), text: OUTBOUND_STATUS_LABEL[code] ?? null, reason: null }))
  if (inv.status === "paid" && inv.paid_at) events.push({ id: 9100, code: "fr:212", at: at(inv.paid_at, "09:00"), text: OUTBOUND_STATUS_LABEL["fr:212"] ?? null, reason: null })
  const last = events[events.length - 1]
  return {
    attempt: 1,
    phase: "sent",
    mode: "live",
    recipientAddress: `0225:${siren}`,
    lastStatus: last.code.startsWith("fr:") ? last.code : null,
    lastStatusAt: last.at,
    events,
    error: null,
    depositedAt: at(day, "08:12"),
    createdAt: at(day, "08:11"),
    paymentReportedAt: inv.status === "paid" && inv.paid_at ? at(inv.paid_at, "09:00") : null,
  }
}

/**
 * Démo : un avoir sur une facture d'un client professionnel suit le chemin de
 * sa facture. La démo propose la plateforme dans la fenêtre d'envoi (le clic
 * invite à créer un compte), seulement si l'émission est ouverte en production.
 */
export function demoCreditNotePlatform(client: { siren?: string | null } | null | undefined, live = PLATFORM_SENDING_LIVE) {
  const siren = (client?.siren ?? "").replace(/\D/g, "")
  if (!live || siren.length !== 9) return null
  return { offered: true, address: `0225:${siren}`, text: null, reason: null, outbound: null }
}
