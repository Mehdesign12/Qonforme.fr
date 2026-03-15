import { cookies } from 'next/headers'
import { verifyAdminSession, ADMIN_COOKIE } from '@/lib/admin-auth'

/**
 * À utiliser dans les API routes admin (Node.js runtime).
 * Retourne true si le cookie admin_session est valide.
 */
export async function isAdminAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies()
  const token  = cookieStore.get(ADMIN_COOKIE)?.value
  const secret = process.env.ADMIN_COOKIE_SECRET ?? ''
  if (!token || !secret) return false
  return verifyAdminSession(token, secret)
}
