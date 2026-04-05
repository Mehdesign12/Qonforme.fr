"use client"

import { PublicHeader } from "@/components/layout/PublicHeader"

/**
 * Thin client wrapper for PublicHeader.
 * Import this in Server Components that need the public header.
 */
export default function PublicHeaderWrapper() {
  return <PublicHeader />
}
