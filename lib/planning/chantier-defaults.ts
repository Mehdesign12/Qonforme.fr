/**
 * « Planifier » depuis la fiche d'un chantier : le planning s'ouvre sur un
 * nouveau rendez-vous de type « chantier », rattaché au chantier, avec son
 * client et son adresse. Partagé par le planning réel et celui de la démo.
 */
import type { AppointmentFormValues } from "@/components/planning/PlanningView"

export interface ChantierOption {
  id: string
  name: string
  client_id?: string | null
  address?: string | null
  zip_code?: string | null
  city?: string | null
}

/** Valeurs de départ du rendez-vous, ou `undefined` si le chantier demandé est inconnu. */
export function chantierDefaults(chantiers: ChantierOption[], id: string | null): Partial<AppointmentFormValues> | undefined {
  if (!id) return undefined
  const c = chantiers.find((x) => x.id === id)
  if (!c) return undefined
  const place = [c.zip_code, c.city].filter(Boolean).join(" ")
  const address = [c.address, place].filter(Boolean).join(", ") || null
  return { kind: "chantier", chantier_id: c.id, client_id: c.client_id ?? null, title: `Chantier ${c.name}`, address }
}
