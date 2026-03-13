'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Eye, Mail } from 'lucide-react'
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
        toast.success(`Message marqué comme "${status === 'read' ? 'lu' : 'résolu'}"`)
        router.refresh()
      } catch {
        toast.error('Impossible de mettre à jour le statut')
      }
    })
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {currentStatus === 'new' && (
        <button
          onClick={() => updateStatus('read')}
          disabled={isPending}
          className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[11px] font-medium border border-border text-foreground hover:bg-muted transition-colors disabled:opacity-50"
        >
          <Eye className="w-3 h-3" />
          Marquer comme lu
        </button>
      )}
      {currentStatus !== 'resolved' && (
        <button
          onClick={() => updateStatus('resolved')}
          disabled={isPending}
          className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[11px] font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors disabled:opacity-50"
        >
          <Check className="w-3 h-3" />
          Résoudre
        </button>
      )}
      {email && (
        <a
          href={`mailto:${email}`}
          className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[11px] font-medium border border-[#2563EB] text-[#2563EB] hover:bg-[#EFF6FF] dark:hover:bg-[#1E3A5F] transition-colors"
        >
          <Mail className="w-3 h-3" />
          Répondre
        </a>
      )}
    </div>
  )
}
