import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton"

/** Tableau de bord : le squelette arrive avant la lecture du compte (identité, entreprise, inscription). */
export default function Loading() {
  return <DashboardSkeleton />
}
