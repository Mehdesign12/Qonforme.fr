import { createClient } from "@/lib/supabase/server"
import { PLANS, isPlanId } from "@/lib/stripe/plans"
import { canIssueInvoices } from "@/lib/stripe/access"
import type { ShellIdentity } from "@/components/layout/shell"

/**
 * Identité affichée par la coque de l'application (Server Component) :
 * prénom, nom, email, formule active et entreprise, lus une seule fois par
 * page pour la barre latérale, la barre supérieure et la feuille « Plus ».
 *
 * Non bloquant : une erreur de lecture laisse des valeurs vides, la coque
 * s'affiche quand même. La formule n'est montrée que si elle permet d'émettre
 * (résiliée → version gratuite) ; une erreur réseau ne retire aucun accès,
 * le mur de paiement est vérifié à l'émission côté serveur (CLAUDE.md).
 */
export async function getShellIdentity(): Promise<ShellIdentity> {
  const identity: ShellIdentity = {
    mode: "app",
    firstName: "",
    lastName: "",
    email: "",
    planName: null,
    companyName: null,
    siren: null,
  }
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return identity
    const [{ data: sub }, { data: company }] = await Promise.all([
      supabase.from("subscriptions").select("plan, status").eq("user_id", user.id).maybeSingle(),
      supabase.from("companies").select("name, siren").eq("user_id", user.id).maybeSingle(),
    ])
    identity.firstName = (user.user_metadata?.first_name as string) || ""
    identity.lastName = (user.user_metadata?.last_name as string) || ""
    identity.email = user.email ?? ""
    if (sub && canIssueInvoices(sub.status) && isPlanId(sub.plan)) {
      identity.planName = PLANS[sub.plan].name
    }
    identity.companyName = company?.name || null
    identity.siren = company?.siren || null
  } catch {
    // Non bloquant
  }
  return identity
}
