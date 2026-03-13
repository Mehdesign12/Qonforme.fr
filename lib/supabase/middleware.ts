import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl
  const ts = Date.now()
  console.log(`[MW] → ${pathname}  referer=${request.headers.get('referer') ?? '-'}  t=${ts}`)

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

  const pathname = request.nextUrl.pathname

  // ──────────────────────────────────────────────────────────────
  // Routes publiques — toujours accessibles, sans vérification
  // ──────────────────────────────────────────────────────────────
  const publicPaths = [
    '/',
    '/login',
    '/signup',
    '/forgot-password',
    '/reset-password',
    '/demo',
    '/pricing',
    '/api/webhooks/stripe', // webhook Stripe : ne doit jamais être bloqué
  ]

  const isPublic = publicPaths.some((path) =>
    pathname === path || pathname.startsWith(path + '/')
  )

  if (isPublic) {
    // Si l'utilisateur est connecté et va sur /login ou /signup (pas /signup/company)
    // → le rediriger vers le dashboard ou la page de pricing
    const authOnlyPaths = ['/login', '/signup']
    const isAuthPage =
      authOnlyPaths.some((p) => pathname.startsWith(p)) &&
      !pathname.startsWith('/signup/company')

    if (isAuthPage && user) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      console.log(`[MW] ↩ redirect public-auth → /dashboard  t=${ts}`)
      return NextResponse.redirect(url)
    }

    console.log(`[MW] ✓ public pass-through  t=${ts}`)
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
  ]

  const isProtected = protectedPaths.some((path) =>
    pathname.startsWith(path)
  )

  if (isProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    console.log(`[MW] ↩ redirect no-user → /login  t=${ts}`)
    return NextResponse.redirect(url)
  }

  // ──────────────────────────────────────────────────────────────
  // Vérification de l'abonnement pour les routes protégées
  // ──────────────────────────────────────────────────────────────
  if (isProtected && user) {
    // /settings/billing est toujours accessible (pour régulariser)
    const billingExempt =
      pathname.startsWith('/settings/billing') ||
      pathname.startsWith('/api/stripe/')

    if (!billingExempt) {
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('status')
        .eq('user_id', user.id)
        .single()

      console.log(`[MW] sub=${sub?.status ?? 'null'}  user=${user.id.slice(0, 8)}  t=${ts}`)

      if (!sub) {
        // Pas d'abonnement → page de sélection de plan
        const url = request.nextUrl.clone()
        url.pathname = '/pricing'
        console.log(`[MW] ↩ redirect no-sub → /pricing  t=${ts}`)
        return NextResponse.redirect(url)
      }

      if (sub.status === 'canceled' || sub.status === 'past_due' || sub.status === 'incomplete') {
        // Abonnement inactif → page de gestion d'abonnement
        const url = request.nextUrl.clone()
        url.pathname = '/settings/billing'
        console.log(`[MW] ↩ redirect inactive-sub(${sub.status}) → /settings/billing  t=${ts}`)
        return NextResponse.redirect(url)
      }
    }
  }

  console.log(`[MW] ✓ next()  t=${ts}`)
  return supabaseResponse
}
