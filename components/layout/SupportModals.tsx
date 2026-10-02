'use client'

import { useState } from 'react'
import { Bug, MessageSquare, CheckCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
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
/* Shared form label                                                    */
/* ------------------------------------------------------------------ */

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-[13px] font-semibold text-[var(--q-ink)]">
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
      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-[var(--q-ok-bg)]">
        <CheckCircle className="w-6 h-6 text-[var(--q-ok)]" />
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

/** Fenêtre « Signaler un problème », ouverte depuis la barre latérale, le menu du compte ou la feuille « Plus ». */
export function BugReportModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
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
    onOpenChange(val)
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
      toast.success('Problème signalé, merci pour votre retour.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Impossible d\'envoyer le rapport.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--q-danger-bg)] shrink-0">
              <Bug className="w-4 h-4 text-[var(--q-danger)]" />
            </div>
            <DialogTitle className="text-base font-semibold">Signaler un problème</DialogTitle>
          </div>
          <DialogDescription>
            Décrivez ce qui s’est passé et sur quelle page.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <SuccessState
            message="Votre signalement a bien été reçu. Merci, il nous aide à corriger le problème."
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

/** Fenêtre « Nous écrire » (formulaire, réponse par email, sans promesse de délai). */
export function ContactModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
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
    onOpenChange(val)
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
      toast.success('Message envoyé, merci.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Impossible d\'envoyer le message.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--q-wash)] shrink-0">
              <MessageSquare className="w-4 h-4 text-[var(--q-accent-strong)]" />
            </div>
            <DialogTitle className="text-base font-semibold">Nous écrire</DialogTitle>
          </div>
          <DialogDescription>
            Une question, une suggestion ? Écrivez-nous, la réponse arrive par email.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <SuccessState
            message="Votre message a bien été envoyé. La réponse arrivera à l’adresse indiquée."
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
