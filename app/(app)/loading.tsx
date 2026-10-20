import { PageSkeleton } from "@/components/app/PageSkeleton"

/** Affiché dès le toucher d'un lien de la coque, pendant que la page arrive du serveur. */
export default function Loading() {
  return <PageSkeleton />
}
