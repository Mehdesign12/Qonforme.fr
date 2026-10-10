import { notFound } from "next/navigation"
import { FEATURES } from "@/lib/features"

// La démo reste le miroir du tableau de bord : masquée tant que la fonction l'est (lib/features.ts)
export default function DemoChantiersLayout({ children }: { children: React.ReactNode }) {
  if (!FEATURES.chantiers) notFound()
  return <>{children}</>
}
