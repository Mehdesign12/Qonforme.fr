/**
 * Point d'accès unique à la plateforme agréée (voir lib/pa/types.ts pour le
 * contrat et la marche à suivre pour brancher le partenaire choisi).
 *
 * `PA_PROVIDER` choisit l'adaptateur ; absent, vide ou inconnu : « none ».
 */
import { createNoneAdapter } from "@/lib/pa/adapters/none"
import type { PlatformAdapter } from "@/lib/pa/types"

export type { PlatformAdapter } from "@/lib/pa/types"

/** Registre des adaptateurs : ajouter ici celui du partenaire choisi. */
const ADAPTERS: Record<string, () => PlatformAdapter> = {
  none: createNoneAdapter,
}

export function getPlatformAdapter(provider: string | undefined = process.env.PA_PROVIDER): PlatformAdapter {
  const id = (provider ?? "").trim().toLowerCase() || "none"
  const factory = Object.prototype.hasOwnProperty.call(ADAPTERS, id) ? ADAPTERS[id] : undefined
  if (!factory) {
    console.warn(`[pa] PA_PROVIDER « ${id} » inconnu : aucune plateforme agréée raccordée.`)
    return createNoneAdapter()
  }
  return factory()
}
