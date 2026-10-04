"use client"

import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { purgePwaPageCache } from "@/lib/pwa/client"

/**
 * Déconnexion commune (barre latérale, menu du compte, feuille « Plus »).
 *
 * Le client Supabase n'est chargé qu'au clic : la coque est partagée avec la
 * démo, qui n'en a pas besoin (~53 Ko de JavaScript en moins, PushRank). Dans
 * le navigateur, createBrowserClient renvoie toujours la même instance.
 */
export function useLogout() {
  const router = useRouter()
  return async () => {
    const { createClient } = await import("@/lib/supabase/client")
    await createClient().auth.signOut()
    // Vide le HTML retenu par le service worker : rien de la session précédente
    // ne doit pouvoir être resservi sur un appareil partagé.
    purgePwaPageCache()
    toast.success("À bientôt !")
    router.push("/login")
    router.refresh()
  }
}
