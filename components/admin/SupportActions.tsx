'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Eye, Loader2, Mail } from 'lucide-react'
import { toast } from 'sonner'

interface SupportActionsProps {
  id:            string
  currentStatus: string
  email?:        string | null
}

export function SupportActions({ id, currentStatus, email }: SupportActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const updateStatus = async (status: string) => {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/support/${id}`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ status }),
        })
        if (!res.ok) throw new Error()
        toast.success(status === 'read' ? 'Message marqué comme lu' : 'Message marqué comme résolu')
        router.refresh()
      } catch {
        toast.error('Impossible de mettre à jour le statut')
      }
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {currentStatus === 'new' && (
        <button type="button" onClick={() => updateStatus('read')} disabled={isPending} className="q-btn q-btn-secondary q-btn-sm">
          {isPending ? <Loader2 className="animate-spin" aria-hidden /> : <Eye aria-hidden />}
          Marquer comme lu
        </button>
      )}
      {currentStatus !== 'resolved' && (
        <button type="button" onClick={() => updateStatus('resolved')} disabled={isPending} className="q-btn q-btn-secondary q-btn-sm">
          <Check aria-hidden />
          Résoudre
        </button>
      )}
      {email && (
        <a href={`mailto:${email}`} className="q-btn q-btn-ghost q-btn-sm">
          <Mail aria-hidden />
          Répondre
        </a>
      )}
      {currentStatus === 'resolved' && !email && (
        <span className="text-[13px] text-[var(--q-text-4)]">Aucune action en attente.</span>
      )}
    </div>
  )
}
