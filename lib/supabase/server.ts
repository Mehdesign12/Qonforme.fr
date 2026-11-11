import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// Client standard avec cookies (Server Components, API Routes avec session cookie)
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Ignoré dans les Server Components (read-only)
          }
        },
      },
    }
  )
}

/**
 * Requêtes du client service_role jamais gardées dans le cache de données de Next.
 *
 * Piège de Next 14.2 : `export const dynamic = "force-dynamic"` ne coupe PAS ce cache
 * (il ne pose que `forceDynamic`, pas `revalidate = 0`). Une page ou une route GET qui
 * ne lit jamais `cookies()` (pages de l'admin, tâches planifiées, page du partenaire)
 * gardait donc la première réponse de Supabase indéfiniment : liste des partenaires
 * vide alors que le partenaire existe, colonne « Dernier email » figée (10/11/2026).
 */
const noStoreFetch: typeof fetch = (input, init) => fetch(input, { ...init, cache: "no-store" })

// Client Admin avec service_role (accès complet, côté serveur uniquement)
// ATTENTION : ne jamais exposer ce client côté client/navigateur
// `allowCache` : seulement pour les pages publiques rafraîchies à intervalle fixe
// (`export const revalidate = …` : blog, plan du site), qui veulent le cache.
export function createAdminClient(opts: { allowCache?: boolean } = {}) {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      ...(opts.allowCache ? {} : { global: { fetch: noStoreFetch } }),
    }
  )
}

// Client avec Bearer token (pour les appels API juste après signUp,
// avant que les cookies de session soient synchronisés)
export function createClientWithToken(accessToken: string) {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  )
}
