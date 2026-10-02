"use client"

/**
 * Libellé de la page courante dans le fil d'Ariane de la barre supérieure
 * (« Factures / F-2026-0142 »). La barre est rendue par la mise en page,
 * avant que la page connaisse le numéro du document : la page le déclare
 * avec <SetCrumb label="F-2026-0142" />.
 */
import { createContext, useContext, useEffect, useState } from "react"

type CrumbState = { label: string | null; setLabel: (label: string | null) => void }

const CrumbContext = createContext<CrumbState>({ label: null, setLabel: () => {} })

export function CrumbProvider({ children }: { children: React.ReactNode }) {
  const [label, setLabel] = useState<string | null>(null)
  return <CrumbContext.Provider value={{ label, setLabel }}>{children}</CrumbContext.Provider>
}

export function useCrumbLabel(): string | null {
  return useContext(CrumbContext).label
}

/** À placer dans une page de détail ou de modification : fixe le dernier maillon du fil d'Ariane. */
export function SetCrumb({ label }: { label: string | null | undefined }) {
  const { setLabel } = useContext(CrumbContext)
  useEffect(() => {
    setLabel(label ?? null)
    return () => setLabel(null)
  }, [label, setLabel])
  return null
}
