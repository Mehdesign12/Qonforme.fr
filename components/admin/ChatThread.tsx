'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, FileText, Loader2, Mail, Paperclip, RotateCcw, Send, StickyNote, X } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader, StatusPill, type Tone } from '@/components/app/kit'
import { fmtDateTime } from '@/components/admin/ui'
import { SupportTabs } from '@/components/admin/SupportTabs'
import { CATEGORY_LABELS, MAX_FILES, SOURCE_LABELS, STATUS_LABELS, type ChatStatus } from '@/lib/support-chat/rules'
import { cn } from '@/lib/utils'

export type AdminConversation = {
  id: string; email: string; name: string | null; user_id: string | null; source: keyof typeof SOURCE_LABELS
  subject: string | null; category: keyof typeof CATEGORY_LABELS | null; status: ChatStatus; admin_unread: boolean
  origin_path: string | null; device: string | null; created_at: string; last_message_at: string
}
export type AdminMessage = {
  id: string; sender: 'visitor' | 'admin' | 'note'; body: string; createdAt: string; seenAt: string | null
  emailedAt: string | null; emailError: string | null
  attachments: { id: string; name: string; mime: string; size: number; url: string | null }[]
}

const TONE: Record<ChatStatus, Tone> = { open: 'warn', pending: 'info', resolved: 'ok' }
const size = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} Mo` : `${Math.max(1, Math.round(n / 1024))} Ko`)

export function ChatThread({ conversation: c, messages, canned }: { conversation: AdminConversation; messages: AdminMessage[]; canned: { id: string; title: string; body: string }[] }) {
  const router = useRouter()
  const [body, setBody] = useState('')
  const [note, setNote] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const call = async (init: RequestInit, ok: string) => {
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/support/chat/${c.id}`, init)
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(json.error ?? 'Action impossible')
        if (json.emailFailed) router.refresh()
        return false
      }
      toast.success(ok)
      router.refresh()
      return true
    } catch {
      toast.error('Action impossible : vérifiez votre connexion.')
      return false
    } finally {
      setBusy(false)
    }
  }

  const submit = async () => {
    if (!body.trim() || busy) return
    const form = new FormData()
    form.set('body', body)
    form.set('kind', note ? 'note' : 'reply')
    files.forEach((f) => form.append('files', f))
    if (await call({ method: 'POST', body: form }, note ? 'Note ajoutée' : 'Réponse envoyée par email')) {
      setBody('')
      setFiles([])
      setNote(false)
    }
  }
  const setStatus = (status: ChatStatus) => call({ method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) }, status === 'resolved' ? 'Conversation résolue' : 'Conversation rouverte')
  const resend = (messageId: string) => call({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'resend', messageId }) }, 'Email renvoyé')

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={c.name || c.email}
        subtitle={c.subject || (c.category ? CATEGORY_LABELS[c.category] : undefined)}
        backHref="/admin/support/chat"
        backLabel="Conversations"
        actions={
          c.status === 'resolved' ? (
            <button type="button" disabled={busy} onClick={() => setStatus('open')} className="q-btn q-btn-secondary q-btn-sm"><RotateCcw aria-hidden /> Rouvrir</button>
          ) : (
            <button type="button" disabled={busy} onClick={() => setStatus('resolved')} className="q-btn q-btn-secondary q-btn-sm"><Check aria-hidden /> Marquer résolue</button>
          )
        }
      />
      <SupportTabs active="chat" />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-w-0 flex-col gap-4">
          <ul className="flex flex-col gap-3" aria-label="Messages">
            {messages.map((m) => (
              <li key={m.id} className={cn('flex flex-col gap-1', m.sender === 'admin' && 'items-end')}>
                <div className={cn(
                  'max-w-[92%] rounded-2xl border px-4 py-3 text-[15px] leading-relaxed sm:max-w-[80%]',
                  m.sender === 'visitor' && 'border-[var(--q-line)] bg-[var(--q-surface)] text-[var(--q-text-2)]',
                  m.sender === 'admin' && 'border-transparent bg-[var(--q-accent)] text-white',
                  m.sender === 'note' && 'border-[var(--q-warn-line)] bg-[var(--q-warn-bg,#FFF8E6)] text-[var(--q-text-2)]',
                )}>
                  {m.sender === 'note' && <span className="mb-1 flex items-center gap-1 text-xs font-semibold text-[var(--q-warn)]"><StickyNote className="size-3.5" aria-hidden /> Note interne</span>}
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  {m.attachments.length > 0 && (
                    <ul className="mt-2 flex flex-col gap-1.5">
                      {m.attachments.map((a) => (
                        <li key={a.id}>
                          {a.url ? (
                            <a href={a.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 break-all text-sm underline underline-offset-2">
                              <FileText className="size-4 shrink-0" aria-hidden /> {a.name} ({size(a.size)})
                            </a>
                          ) : <span className="text-sm opacity-70">{a.name} (indisponible)</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <span className="flex flex-wrap items-center gap-2 px-1 text-xs text-[var(--q-text-4)]">
                  {fmtDateTime(m.createdAt)}
                  {m.sender === 'admin' && m.emailedAt && <span className="inline-flex items-center gap-1"><Mail className="size-3" aria-hidden /> Envoyé{m.seenAt ? ' · lu' : ''}</span>}
                  {m.sender === 'admin' && !m.emailedAt && (
                    <button type="button" disabled={busy} onClick={() => resend(m.id)} className="q-link inline-flex items-center gap-1 !text-[var(--q-danger)]">
                      <RotateCcw className="size-3" aria-hidden /> Email non parti{m.emailError ? ` (${m.emailError.slice(0, 60)})` : ''} : renvoyer
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>

          <div className="q-card flex flex-col gap-3 p-4">
            {canned.length > 0 && !note && (
              <div className="flex flex-wrap gap-2" aria-label="Réponses types">
                {canned.map((r) => (
                  <button key={r.id} type="button" onClick={() => setBody((b) => (b.trim() ? `${b.trimEnd()}\n\n${r.body}` : r.body))} className="rounded-full border border-[var(--q-line)] px-3 py-1 text-[13px] text-[var(--q-text-2)] hover:border-[var(--q-field)]">
                    {r.title}
                  </button>
                ))}
              </div>
            )}
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              maxLength={5000}
              aria-label={note ? 'Note interne' : 'Réponse au visiteur'}
              placeholder={note ? 'Note visible par l’équipe seulement…' : 'Votre réponse part par email, signée « Christophe de Qonforme »…'}
              className="w-full resize-y rounded-xl border border-[var(--q-field)] bg-[var(--q-surface)] p-3 text-base leading-relaxed text-[var(--q-ink)] md:text-sm"
            />
            {files.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {files.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--q-line)] px-3 py-1 text-[13px]">
                    {f.name}
                    <button type="button" aria-label={`Retirer ${f.name}`} onClick={() => setFiles((fs) => fs.filter((_, j) => j !== i))}><X className="size-3.5" aria-hidden /></button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-2 text-sm text-[var(--q-text-2)]">
                <input type="checkbox" checked={note} onChange={(e) => setNote(e.target.checked)} /> Note interne (rien n’est envoyé)
              </label>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple hidden onChange={(e) => { setFiles((fs) => [...fs, ...Array.from(e.target.files ?? [])].slice(0, MAX_FILES)); e.target.value = '' }} />
              {!note && <button type="button" onClick={() => fileRef.current?.click()} className="q-btn q-btn-ghost q-btn-sm"><Paperclip aria-hidden /> Joindre</button>}
              <button type="button" onClick={submit} disabled={busy || !body.trim()} className="q-btn q-btn-primary ml-auto">
                {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />} {note ? 'Ajouter la note' : 'Envoyer par email'}
              </button>
            </div>
          </div>
        </div>

        <aside className="q-card flex h-fit flex-col gap-3 p-4 text-sm" aria-label="Le visiteur">
          <StatusPill tone={TONE[c.status]}>{STATUS_LABELS[c.status]}</StatusPill>
          <dl className="flex flex-col gap-2.5 text-[var(--q-text-2)]">
            <div><dt className="text-xs text-[var(--q-text-4)]">Email</dt><dd><a href={`mailto:${c.email}`} className="q-link break-all">{c.email}</a></dd></div>
            {c.name && <div><dt className="text-xs text-[var(--q-text-4)]">Nom</dt><dd>{c.name}</dd></div>}
            <div><dt className="text-xs text-[var(--q-text-4)]">Compte</dt><dd>{c.user_id ? 'Utilisateur connecté' : 'Visiteur non connecté'}</dd></div>
            <div><dt className="text-xs text-[var(--q-text-4)]">Origine</dt><dd>{SOURCE_LABELS[c.source]}{c.origin_path ? ` · ${c.origin_path}` : ''}</dd></div>
            {c.device && <div><dt className="text-xs text-[var(--q-text-4)]">Appareil</dt><dd>{c.device}</dd></div>}
            <div><dt className="text-xs text-[var(--q-text-4)]">Première prise de contact</dt><dd>{fmtDateTime(c.created_at)}</dd></div>
          </dl>
        </aside>
      </div>
    </div>
  )
}
