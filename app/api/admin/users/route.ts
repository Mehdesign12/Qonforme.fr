/**
 * POST /api/admin/users   crée un compte (testeur) avec son email et son mot de
 * passe, email déjà confirmé, et lui offre au besoin une formule (lib/admin/grant.ts).
 * Aucun email n'est envoyé au compte. Admin seulement.
 */
import { NextRequest, NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { createAdminClient } from "@/lib/supabase/server"
import { grantPlan, parseNewUser } from "@/lib/admin/grant"
import { addTestAccount } from "@/lib/stripe/test-accounts"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
  const body = await request.json().catch(() => null)
  const input = parseNewUser(body)
  if ("error" in input) return NextResponse.json({ error: input.error }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      ...(input.firstName ? { first_name: input.firstName } : {}),
      // Même accueil qu'une inscription : la fenêtre « Bienvenue » s'ouvre au premier passage
      signup_wizard: true,
      created_by_admin: true,
    },
  })
  if (error || !data?.user) {
    const msg = (error?.message ?? "").toLowerCase()
    if (msg.includes("already") || msg.includes("registered") || msg.includes("exists") || error?.status === 422) {
      return NextResponse.json({ error: "Un compte existe déjà avec cette adresse email." }, { status: 409 })
    }
    if (msg.includes("password")) return NextResponse.json({ error: "Mot de passe refusé par Supabase : choisissez-en un plus long ou plus varié." }, { status: 400 })
    console.error("[admin/users] Création impossible:", error)
    return NextResponse.json({ error: "Le compte n'a pas pu être créé. Réessayez." }, { status: 500 })
  }
  const userId = data.user.id

  // Le compte existe : une étape suivante qui échoue est dite, jamais un 500 qui laisserait croire à un échec total
  const warnings: string[] = []
  let until: string | null = null
  if (input.grant) {
    const g = await grantPlan(admin, userId, input.grant)
    if (g.ok) until = g.until
    else warnings.push(`Compte créé, mais la formule n'a pas été offerte : ${g.error}`)
  }
  if (input.testAccount) {
    const t = await addTestAccount(input.email)
    if (!t.ok) warnings.push(`Compte créé, mais pas marqué compte d'essai : ${t.error}`)
  }

  console.log(`[admin/users] Compte créé par l'admin : ${userId}${input.grant ? ` (formule ${input.grant.plan} offerte)` : ""}`)
  return NextResponse.json({ userId, email: input.email, plan: input.grant?.plan ?? null, until, warnings }, { status: 201 })
}
