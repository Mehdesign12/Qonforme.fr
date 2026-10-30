/** Raccordement du compte, réduit à ce qu'affichent les factures reçues (bandeau, note de la fiche). */
import type { ReceptionInfo } from "@/components/reception/PlatformNotice"
import type { EInvoicingView } from "@/lib/pa/view"

export function receptionInfo(view: EInvoicingView | null, hubHref: string): ReceptionInfo | null {
  if (!view) return null
  return {
    available: view.available,
    status: view.connection?.status ?? null,
    hasPlan: view.hasPlan,
    address: view.connection?.address ?? null,
    lastSyncAt: view.connection?.lastSyncAt ?? null,
    hubHref,
  }
}

/** Les décisions partent vers la plateforme : raccordé, avec une formule, autorisation valable. */
export function transmitsDecisions(view: EInvoicingView | null): boolean {
  const s = view?.connection?.status
  return Boolean(view?.hasPlan && s && s !== "expired" && s !== "refused")
}

/** Lecture côté navigateur, sans jamais bloquer la page : null si l'API ne répond pas. */
export async function fetchEInvoicingView(): Promise<EInvoicingView | null> {
  try {
    const res = await fetch("/api/e-invoicing", { cache: "no-store" })
    if (!res.ok) return null
    const json = await res.json()
    return (json.view ?? null) as EInvoicingView | null
  } catch {
    return null
  }
}
