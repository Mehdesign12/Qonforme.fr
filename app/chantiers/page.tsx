'use client'

export const dynamic = "force-dynamic"

import { useEffect, useState } from "react"
import { ChantiersListView } from "@/components/chantiers/ChantiersListView"
import type { Chantier } from "@/lib/chantiers/metrics"

export default function ChantiersPage() {
  const [chantiers, setChantiers] = useState<Chantier[] | null>(null)
  const [error, setError]         = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    fetch("/api/chantiers")
      .then(async (res) => {
        const json = await res.json()
        if (!alive) return
        if (!res.ok) setError(json.error || "Erreur de chargement")
        else setChantiers(json.chantiers ?? [])
      })
      .catch(() => alive && setError("Connexion impossible, réessayez dans un instant"))
    return () => { alive = false }
  }, [])

  return <ChantiersListView chantiers={chantiers} error={error} detailHref={(id) => `/chantiers/${id}`} newHref="/chantiers/new" />
}
