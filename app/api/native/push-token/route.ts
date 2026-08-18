import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"

/**
 * Enregistrement des appareils pour les notifications push.
 *
 * Appelé par `lib/native/push.ts` depuis l'app iOS/Android une fois le jeton
 * APNs obtenu. Le web n'appelle jamais cette route : Safari iOS ne délivre pas
 * de jeton push à une PWA installée de manière fiable.
 */

const registerSchema = z.object({
  token: z.string().min(16).max(512),
  platform: z.enum(["ios", "android"]),
  deviceModel: z.string().max(120).optional(),
  appVersion: z.string().max(40).optional(),
})

const unregisterSchema = z.object({
  token: z.string().min(16).max(512),
})

/** Enregistre ou rafraîchit le jeton de l'appareil courant. */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const parsed = registerSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload invalide" }, { status: 422 })
  }

  const { token, platform, deviceModel, appVersion } = parsed.data

  /*
   * `onConflict: token` couvre le cas d'un appareil revendu ou d'un changement
   * de compte : APNs réattribue le même jeton, la ligne doit alors basculer
   * vers le nouvel utilisateur plutôt que de rester rattachée à l'ancien.
   */
  const { error } = await supabase
    .from("push_tokens")
    .upsert(
      {
        user_id: user.id,
        token,
        platform,
        device_model: deviceModel ?? null,
        app_version: appVersion ?? null,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "token" },
    )

  if (error) {
    console.error(`[push-token] Enregistrement échoué pour user ${user.id}: ${error.message}`)
    return NextResponse.json({ error: "Enregistrement impossible" }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

/** Retire le jeton — déconnexion ou refus des notifications dans les réglages. */
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const parsed = unregisterSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload invalide" }, { status: 422 })
  }

  // Le filtre sur `user_id` est redondant avec la RLS, mais rend l'intention
  // explicite : on ne supprime jamais le jeton d'un autre compte.
  const { error } = await supabase
    .from("push_tokens")
    .delete()
    .eq("token", parsed.data.token)
    .eq("user_id", user.id)

  if (error) {
    console.error(`[push-token] Suppression échouée pour user ${user.id}: ${error.message}`)
    return NextResponse.json({ error: "Suppression impossible" }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
