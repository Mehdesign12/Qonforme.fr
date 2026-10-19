import { AppLayout } from "@/components/layout/AppLayout"

/**
 * Coque de l'application, commune à toutes ses rubriques (tableau de bord,
 * factures, devis, clients, catalogue, réglages…). Groupe de routes : les
 * adresses ne changent pas. La coque reste en place quand on passe d'une
 * rubrique à l'autre au lieu d'être relue côté serveur à chaque navigation
 * (identité, entreprise, formule : trois lectures de base) : le toucher d'un
 * lien change l'écran tout de suite, `loading.tsx` montrant le squelette de la
 * page le temps qu'elle arrive. Après un changement qui touche la coque
 * (entreprise, prénom), la page appelle `router.refresh()`.
 */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <AppLayout>{children}</AppLayout>
}
