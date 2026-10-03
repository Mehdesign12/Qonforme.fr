'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { StatusPill } from '@/components/app/kit'
import { fmtDate } from '@/components/admin/ui'

interface ErrorActionsProps {
  id:         string
  resolvedAt: string | null
}

export function ErrorActions({ id, resolvedAt }: ErrorActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  if (resolvedAt) {
    return (
      <StatusPill tone="ok" icon={<Check strokeWidth={2.75} aria-hidden />}>
        Résolue le {fmtDate(resolvedAt)}
      </StatusPill>
    )
  }

  const resolve = () => {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/errors/${id}`, { method: 'PATCH' })
        if (!res.ok) throw new Error()
        toast.success('Erreur marquée comme résolue')
        router.refresh()
      } catch {
        toast.error('Impossible de marquer l\'erreur comme résolue')
      }
    })
  }

  return (
    <button type="button" onClick={resolve} disabled={isPending} className="q-btn q-btn-secondary q-btn-sm">
      {isPending ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
      Marquer comme résolue
    </button>
  )
}
