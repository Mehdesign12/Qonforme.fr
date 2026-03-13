'use client'

import { useState } from 'react'
import { Bug, MessageSquare, CheckCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

/* ------------------------------------------------------------------ */
/* Shared trigger button style (matches Sidebar nav items)             */
/* ------------------------------------------------------------------ */

function SidebarButton({
  icon: Icon,
  label,
  collapsed,
  onClick,
}: {
  icon: React.ElementType
  label: string
  collapsed: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium',
        'text-slate-500 dark:text-slate-400',
        'hover:bg-[#F8FAFC] dark:hover:bg-[#162032]',
        'hover:text-[#0F172A] dark:hover:text-[#E2E8F0]',
        'transition-colors duration-100 w-full',
        collapsed && 'justify-center px-2',
      )}
    >
      <Icon className="w-4 h-4 shrink-0 text-slate-400 dark:text-slate-500" />
      {!collapsed && <span>{label}</span>}
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* Shared form label                                                    */
/* ------------------------------------------------------------------ */

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-sm font-medium text-foreground mb-1">
      {children}
    </label>
  )
}

/* ------------------------------------------------------------------ */
/* Success state                                                        */
/* ------------------------------------------------------------------ */

function SuccessState({ message, onReset }: { message: string; onReset: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30">
        <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
      </div>
      <p className="text-sm text-muted-foreground max-w-[280px]">{message}</p>
      <DialogClose render={
        <Button variant="outline" size="sm" onClick={onReset}>
          Fermer
        </Button>
      } />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* BugReportModal                                                       */
/* ------------------------------------------------------------------ */

export function BugReportModal({ collapsed }: { collapsed: boolean }) {
  const [open, setOpen]           = useState(false)
  const [title, setTitle]         = useState('')
  const [description, setDesc]    = useState('')
  const [page, setPage]           = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess]     = useState(false)

  const reset = () => {
    setTitle('')
    setDesc('')
    setPage('')
    setSuccess(false)
  }

  const handleOpenChange = (val: boolean) => {
    setOpen(val)
    if (!val) setTimeout(reset, 200)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !description.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/support/bug-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, page }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data?.error ?? 'Erreur lors de l\'envoi')
      }
      setSuccess(true)
      toast.success('Bug signalé — merci pour votre retour !')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Impossible d\'envoyer le rapport.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={
        <SidebarButton icon={Bug} label="Rapporter un bug" collapsed={collapsed} />
      } />

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/30 shrink-0">
              <Bug className="w-4 h-4 text-red-600 dark:text-red-400" />
            </div>
            <DialogTitle className="text-base font-semibold">Rapporter un bug</DialogTitle>
          </div>
          <DialogDescription>
            Décrivez le problème rencontré et nous le corrigerons rapidement.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <SuccessState
            message="Votre signalement a bien été reçu. Nous analysons le problème et reviendrons vers vous si nécessaire."
            onReset={reset}
          />
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <FieldLabel>Titre <span className="text-destructive">*</span></FieldLabel>
              <Input
                placeholder="Ex : La facture ne s'enregistre pas"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div>
              <FieldLabel>Description <span className="text-destructive">*</span></FieldLabel>
              <Textarea
                placeholder="Décrivez les étapes pour reproduire le bug, ce que vous attendiez et ce qui s'est passé…"
                value={description}
                onChange={(e) => setDesc(e.target.value)}
                className="min-h-[100px] resize-none"
                required
              />
            </div>

            <div>
              <FieldLabel>Page concernée <span className="text-muted-foreground text-xs font-normal">(optionnel)</span></FieldLabel>
              <Input
                placeholder="Ex : /invoices/new"
                value={page}
                onChange={(e) => setPage(e.target.value)}
              />
            </div>

            <DialogFooter className="flex-row gap-2 sm:flex-row sm:justify-end">
              <DialogClose render={<Button variant="outline" type="button">Annuler</Button>} />
              <Button
                type="submit"
                disabled={submitting || !title.trim() || !description.trim()}
                className="gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {submitting ? 'Envoi…' : 'Envoyer'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ */
/* ContactModal                                                         */
/* ------------------------------------------------------------------ */

export function ContactModal({ collapsed }: { collapsed: boolean }) {
  const [open, setOpen]           = useState(false)
  const [name, setName]           = useState('')
  const [email, setEmail]         = useState('')
  const [message, setMessage]     = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess]     = useState(false)

  const reset = () => {
    setName('')
    setEmail('')
    setMessage('')
    setSuccess(false)
  }

  const handleOpenChange = (val: boolean) => {
    setOpen(val)
    if (!val) setTimeout(reset, 200)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !email.trim() || !message.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/support/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data?.error ?? 'Erreur lors de l\'envoi')
      }
      setSuccess(true)
      toast.success('Message envoyé — nous vous répondrons sous 24 h !')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Impossible d\'envoyer le message.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={
        <SidebarButton icon={MessageSquare} label="Nous contacter" collapsed={collapsed} />
      } />

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 shrink-0">
              <MessageSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <DialogTitle className="text-base font-semibold">Nous contacter</DialogTitle>
          </div>
          <DialogDescription>
            Une question ? Une suggestion ? Nous vous répondons sous 24 h.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <SuccessState
            message="Votre message a bien été envoyé. Nous vous répondrons dans les plus brefs délais."
            onReset={reset}
          />
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <FieldLabel>Nom <span className="text-destructive">*</span></FieldLabel>
              <Input
                placeholder="Votre nom"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div>
              <FieldLabel>Email <span className="text-destructive">*</span></FieldLabel>
              <Input
                type="email"
                placeholder="votre@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <FieldLabel>Message <span className="text-destructive">*</span></FieldLabel>
              <Textarea
                placeholder="Comment pouvons-nous vous aider ?"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="min-h-[100px] resize-none"
                required
              />
            </div>

            <DialogFooter className="flex-row gap-2 sm:flex-row sm:justify-end">
              <DialogClose render={<Button variant="outline" type="button">Annuler</Button>} />
              <Button
                type="submit"
                disabled={submitting || !name.trim() || !email.trim() || !message.trim()}
                className="gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {submitting ? 'Envoi…' : 'Envoyer'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
