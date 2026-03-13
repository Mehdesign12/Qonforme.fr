import { NextResponse } from 'next/server'
import { getUserSubscription } from '@/lib/stripe/subscription'

export async function GET() {
  const sub = await getUserSubscription()
  if (!sub) {
    return NextResponse.json({ status: null, plan: null })
  }
  return NextResponse.json({ status: sub.status, plan: sub.plan })
}
