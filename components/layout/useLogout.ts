"use client"

import { useMemo } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { purgePwaPageCache } from "@/lib/pwa/client"

/** Déconnexion commune (barre latérale, menu du compte, feuille « Plus »). */
export function useLogout() {
  const router = useRouter()
  // useMemo : une seule instance Supabase (plusieurs instances se disputent le rafraîchissement du jeton)
  const supabase = useMemo(() => createClient(), [])
  return async () => {
    await supabase.auth.signOut()
    // Vide le HTML retenu par le service worker : rien de la session précédente
    // ne doit pouvoir être resservi sur un appareil partagé.
    purgePwaPageCache()
    toast.success("À bientôt !")
    router.push("/login")
    router.refresh()
  }
}
