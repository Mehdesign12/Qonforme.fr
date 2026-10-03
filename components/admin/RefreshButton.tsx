'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, RefreshCw } from 'lucide-react'

/** Relance le rendu serveur de la page (nouvelles vérifications, nouvelles lectures). */
export function RefreshButton({ label = 'Actualiser' }: { label?: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  return (
    <button
      type="button"
      onClick={() => startTransition(() => router.refresh())}
      disabled={pending}
      className="q-btn q-btn-secondary q-btn-sm"
    >
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : <RefreshCw aria-hidden />}
      {label}
    </button>
  )
}
