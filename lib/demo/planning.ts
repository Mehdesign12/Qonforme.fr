/**
 * Données fictives du planning de la démo (miroir de /planning).
 * Les horaires suivent DEMO_TODAY (jeudi 1er octobre 2026) : semaine du 28 sept. au 4 oct.
 */
import { DEMO_CLIENTS, DEMO_TODAY } from "@/lib/demo/data"
import { DEMO_SUB_CHANTIER_ID } from "@/lib/demo/data"
import { addDays } from "@/lib/utils/paris-date"
import { parisToIso, type Appointment, type AppointmentKind } from "@/lib/planning/appointments"

const clientName = (id: string) => DEMO_CLIENTS.find((c) => c.id === id)?.name ?? null

function appt(
  id: string, kind: AppointmentKind, title: string, offset: number, start: string, minutes: number,
  clientId: string | null, address: string | null, status: Appointment["status"] = "planned", chantierId: string | null = null,
): Appointment {
  const day = addDays(DEMO_TODAY, offset)
  const starts_at = parisToIso(day, start)
  return {
    id, kind, title, starts_at, ends_at: new Date(new Date(starts_at).getTime() + minutes * 60_000).toISOString(),
    address, notes: null, status, client_id: clientId, client_name: clientId ? clientName(clientId) : null, chantier_id: chantierId,
  }
}

export const DEMO_APPOINTMENTS: Appointment[] = [
  appt("rdv-1", "visite", "Visite : salle de bain", -2, "14:00", 60, "fontaine", "7 rue des Lilas, 49240 Avrillé", "done"),
  appt("rdv-2", "visite", "Visite : remplacement du tableau électrique", 0, "08:00", 120, "lambert", "28 chemin des Vignes, 49130 Les Ponts-de-Cé"),
  appt("rdv-3", "chantier", "Chantier Le Clos Fleuri : cloisons bâtiment B", 0, "13:30", 240, "arvel", "ZAC des Hauts de Saint-Aubin, 49000 Angers", "planned", DEMO_SUB_CHANTIER_ID),
  appt("rdv-4", "livraison", "Livraison carrelage et colle", 1, "09:00", 60, "habitat-loire", "3 rue du Port, 49400 Saumur"),
  appt("rdv-5", "visite", "Visite : devis menuiseries", 1, "14:30", 90, "morel", "12 rue de la Roë, 49100 Angers"),
  appt("rdv-6", "chantier", "Chantier Le Clos Fleuri : pose des huisseries", 2, "08:00", 480, "arvel", "ZAC des Hauts de Saint-Aubin, 49000 Angers", "planned", DEMO_SUB_CHANTIER_ID),
  appt("rdv-7", "visite", "Visite : reprise d'enduit", 4, "10:00", 60, "pichon", "5 impasse des Saules, 49070 Beaucouzé"),
]
