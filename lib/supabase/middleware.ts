import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { ADMIN_COOKIE, verifyAdminSession } from '@/lib/admin-auth'

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ──────────────────────────────────────────────────────────────
  // Routes purement publiques — retour immédiat SANS appel Supabase
  // Cela évite que supabase.auth.getUser() déclenche des Set-Cookie
  // qui provoquent des erreurs de redirection pour Googlebot.
  // ──────────────────────────────────────────────────────────────
  const purePublicPaths = [
    '/blog',
    '/cgu',
    '/mentions-legales',
    '/confidentialite',
    '/facturation',
    '/guide',
    '/modele',
    '/glossaire',
    '/pricing',
    '/demo',
    '/outils',
    '/api/webhooks/stripe',
    '/api/og',
    '/api/cron',
    '/api/outils',
  ]

  const isPurePublic = purePublicPaths.some((path) =>
    pathname === path || pathname.startsWith(path + '/')
  )

  if (isPurePublic) {
    return NextResponse.next()
  }

  // ──────────────────────────────────────────────────────────────
  // Routes nécessitant Supabase (auth check)
  // ──────────────────────────────────────────────────────────────
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // ──────────────────────────────────────────────────────────────
  // Routes publiques — toujours accessibles, sans vérification
  // ──────────────────────────────────────────────────────────────
  // Routes publiques qui nécessitent quand même le check user
  // (pour rediriger les utilisateurs connectés vers /dashboard)
  const publicPaths = [
    '/',
    '/login',
    '/signup',
    '/forgot-password',
    '/reset-password',
  ]

  const isPublic = publicPaths.some((path) =>
    pathname === path || pathname.startsWith(path + '/')
  )

  if (isPublic) {
    // Si l'utilisateur est connecté et va sur /login ou /signup (pas /signup/company
    // ni /signup/plan, le choix de formule) → le rediriger vers le dashboard
    const authOnlyPaths = ['/login', '/signup']
    const isAuthPage =
      authOnlyPaths.some((p) => pathname.startsWith(p)) &&
      !pathname.startsWith('/signup/company') &&
      !pathname.startsWith('/signup/plan')

    if (isAuthPage && user) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }

    // Landing page : rediriger les utilisateurs connectés vers le dashboard
    if (pathname === '/' && user) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }

    return supabaseResponse
  }

  // ──────────────────────────────────────────────────────────────
  // Routes admin — cookie HMAC-SHA256 indépendant de Supabase
  // ──────────────────────────────────────────────────────────────
  if (pathname.startsWith('/admin')) {
    // La page de connexion admin est toujours accessible
    if (pathname === '/admin/login') return supabaseResponse

    // Vérifier le cookie signé
    const token  = request.cookies.get(ADMIN_COOKIE)?.value
    const secret = process.env.ADMIN_COOKIE_SECRET ?? ''
    const valid  = token ? await verifyAdminSession(token, secret) : false

    if (!valid) {
      const url = request.nextUrl.clone()
      url.pathname = '/admin/login'
      return NextResponse.redirect(url)
    }

    return supabaseResponse
  }

  // ──────────────────────────────────────────────────────────────
  // Routes protégées : l'utilisateur doit être connecté
  // ──────────────────────────────────────────────────────────────
  const protectedPaths = [
    '/dashboard',
    '/invoices',
    '/quotes',
    '/clients',
    '/settings',
    '/products',
    '/credit-notes',
    '/purchase-orders',
    '/received-invoices',
  ]

  const isProtected = protectedPaths.some((path) =>
    pathname.startsWith(path)
  )

  if (isProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // ──────────────────────────────────────────────────────────────
  // Pas de vérification d'abonnement ici : « devis gratuits, factures
  // payantes ». Un compte sans formule (jamais abonné, résilié, impayé) garde
  // l'accès à toute l'application et à ses documents. Le mur de paiement est
  // dans les routes qui émettent une facture : requireIssuingAccess()
  // (lib/stripe/subscription.ts).
  // ──────────────────────────────────────────────────────────────

  return supabaseResponse
}
