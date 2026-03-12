import { createClient } from "@/lib/supabase/server"
import { Header } from "@/components/layout/Header"

/**
 * Wrapper Server Component.
 * Récupère first_name / last_name depuis user_metadata Supabase
 * et les transmet au Header (client component).
 */
export async function HeaderServer() {
  let firstName = ""
  let lastName  = ""

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user?.user_metadata) {
      firstName = (user.user_metadata.first_name as string) || ""
      lastName  = (user.user_metadata.last_name  as string) || ""
    }
  } catch {
    // Non bloquant — le Header s'affiche quand même
  }

  return <Header firstName={firstName} lastName={lastName} />
}
