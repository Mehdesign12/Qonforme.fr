'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check } from 'lucide-react'
import { toast } from 'sonner'

interface ErrorActionsProps {
  id:         string
  resolvedAt: string | null
}

export function ErrorActions({ id, resolvedAt }: ErrorActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  if (resolvedAt) {
    return (
      <span className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[11px] font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
        <Check className="w-3 h-3" />
        Résolu le {new Date(resolvedAt).toLocaleDateString('fr-FR', {
          day: 'numeric', month: 'short', year: 'numeric',
        })}
      </span>
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
        toast.error('Impossible de marquer comme résolu')
      }
    })
  }

  return (
    <button
      onClick={resolve}
      disabled={isPending}
      className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[11px] font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors disabled:opacity-50"
    >
      <Check className="w-3 h-3" />
      Marquer résolu
    </button>
  )
}
