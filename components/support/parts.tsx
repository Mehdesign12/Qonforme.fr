"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { ArrowUp, Check, FileText, Paperclip, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { PERSONA } from "@/lib/support-chat/persona"
import { ACCEPT, addFiles, formatTime, kib, type ChatMessage } from "@/components/support/chat-api"

/** Photo de Christophe ; sa lettre si l'image ne se charge pas. */
export function Avatar({ size = 40, ring = true, className }: { size?: number; ring?: boolean; className?: string }) {
  const [broken, setBroken] = useState(false)
  return (
    <span
      className={cn("relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-q-wash-line font-semibold text-q-accent-ink", ring && "ring-2 ring-white", className)}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      aria-hidden
    >
      {broken ? PERSONA.initial : (
        <Image src={PERSONA.photo} alt="" width={size * 2} height={size * 2} sizes={`${size}px`} className="size-full object-cover" onError={() => setBroken(true)} />
      )}
    </span>
  )
}

/** Les messages d'une conversation : le visiteur à droite en bleu, Christophe à gauche. */
export function MessageList({ messages, className }: { messages: ChatMessage[]; className?: string }) {
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }) }, [messages.length])
  return (
    <ul className={cn("m-0 flex list-none flex-col gap-2.5 p-0", className)} aria-label="Messages">
      {messages.map((m) => {
        const mine = m.sender === "visitor"
        return (
          <li key={m.id} className={cn("flex flex-col gap-1", mine ? "items-end" : "items-start")}>
            <div className={cn("flex max-w-[84%] items-end gap-2", mine && "flex-row-reverse")}>
              {!mine && <Avatar size={28} ring={false} />}
              <div
                className={cn(
                  "min-w-0 whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-[15px] leading-[1.45]",
                  mine ? "rounded-br-md bg-q-accent text-white" : "rounded-bl-md border border-q-line bg-q-surface text-q-ink",
                )}
              >
                {m.body}
                {m.attachments.length > 0 && (
                  <span className="mt-2 flex flex-col gap-1.5">
                    {m.attachments.map((a) => (
                      <a
                        key={a.id}
                        href={a.url ?? undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn("inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] font-medium underline-offset-2 hover:underline", mine ? "bg-white/15 text-white" : "bg-q-sunken text-q-ink")}
                      >
                        <FileText className="size-4 shrink-0" aria-hidden />
                        <span className="min-w-0 truncate">{a.name}</span>
                        <span className="shrink-0 opacity-75">{kib(a.size)}</span>
                      </a>
                    ))}
                  </span>
                )}
              </div>
            </div>
            <span className={cn("text-[11.5px] text-q-text-4", mine ? "pr-1" : "pl-9")}>
              {mine ? "Vous" : PERSONA.name} · {formatTime(m.createdAt)}
            </span>
          </li>
        )
      })}
      <div ref={end} />
    </ul>
  )
}

/** Zone de saisie : pièces jointes, texte, envoi. Le texte reste à 16 px sur téléphone (zoom iOS). */
export function Composer({
  value, onChange, onSend, sending, disabled, files, onFiles, error, placeholder = "Écrivez votre message…", className,
}: {
  value: string
  onChange: (v: string) => void
  onSend: () => void
  sending: boolean
  disabled?: boolean
  files: File[]
  onFiles: (files: File[]) => void
  error: string | null
  placeholder?: string
  className?: string
}) {
  const input = useRef<HTMLInputElement>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const canSend = !disabled && !sending && value.trim().length > 0

  async function pick(list: FileList | null) {
    if (!list || list.length === 0) return
    const result = await addFiles(files, Array.from(list))
    setFileError(result.error)
    onFiles(result.files)
    if (input.current) input.current.value = ""
  }

  return (
    <div className={cn("flex flex-col gap-2 border-t border-q-line bg-q-surface p-3", className)}>
      {files.length > 0 && (
        <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
          {files.map((file, i) => (
            <li key={`${file.name}-${i}`} className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-q-sunken py-1 pl-3 pr-1 text-[13px] text-q-ink">
              <span className="min-w-0 truncate">{file.name}</span>
              <span className="shrink-0 text-q-text-4">{kib(file.size)}</span>
              <button type="button" onClick={() => onFiles(files.filter((_, j) => j !== i))} className="inline-flex size-6 items-center justify-center rounded-full text-q-text-3 hover:bg-q-hover" aria-label={`Retirer ${file.name}`}>
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      {(error || fileError) && <p role="alert" className="m-0 text-[13px] leading-snug text-q-danger">{error ?? fileError}</p>}
      <div className="flex items-end gap-2">
        <input ref={input} type="file" accept={ACCEPT} multiple className="sr-only" tabIndex={-1} onChange={(e) => void pick(e.target.files)} aria-hidden />
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={disabled}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-q-sunken text-q-text-3 hover:bg-q-hover disabled:opacity-50"
          aria-label="Joindre une image ou un PDF"
        >
          <Paperclip className="size-5" aria-hidden />
        </button>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canSend) { e.preventDefault(); onSend() } }}
          rows={1}
          maxLength={5000}
          disabled={disabled}
          placeholder={placeholder}
          aria-label="Votre message"
          className="max-h-32 min-h-11 flex-1 resize-none rounded-[22px] border-0 bg-q-sunken px-4 py-[11px] text-base leading-[22px] text-q-ink outline-none placeholder:text-q-text-4 focus-visible:ring-2 focus-visible:ring-q-accent disabled:opacity-60 md:text-[15px]"
        />
        <button
          type="button"
          onClick={onSend}
          disabled={!canSend}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-q-accent text-white [box-shadow:inset_0_1px_0_rgba(255,255,255,.25),0_4px_12px_-4px_rgba(37,99,235,.6)] hover:bg-q-accent-strong disabled:opacity-45"
          aria-label="Envoyer le message"
        >
          <ArrowUp className="size-5" strokeWidth={2.25} aria-hidden />
        </button>
      </div>
    </div>
  )
}

/** « Où vous répondre ? » : demandé aux visiteurs non connectés avant leur premier message. */
export function EmailCard({ value, onChange, onContinue, error }: { value: string; onChange: (v: string) => void; onContinue: () => void; error: string | null }) {
  return (
    <form
      className="rounded-2xl border border-q-line bg-q-surface p-4"
      onSubmit={(e) => { e.preventDefault(); onContinue() }}
    >
      <p className="q-display m-0 text-base font-bold text-q-ink">Où vous répondre ?</p>
      <p className="mb-3 mt-1.5 text-[13.5px] leading-[1.5] text-q-text-3">{PERSONA.name} vous répond par email. Votre adresse ne sert qu&apos;à cela.</p>
      <label className="sr-only" htmlFor="support-email">Votre adresse email</label>
      <input
        id="support-email"
        type="email"
        inputMode="email"
        autoComplete="email"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="vous@exemple.fr"
        className="h-12 w-full rounded-xl border border-q-field bg-q-surface px-3.5 text-base text-q-ink outline-none focus-visible:ring-2 focus-visible:ring-q-accent md:text-[15px]"
      />
      {error && <p role="alert" className="mb-0 mt-2 text-[13px] text-q-danger">{error}</p>}
      <button type="submit" className="q-btn q-btn-primary mt-3 h-11 w-full text-[15px]">Continuer</button>
    </form>
  )
}

/** Confirmation d'un premier message : aucun délai promis, la suite se passe par email. */
export function SentCard({ email, onWrite, onClose, onView }: { email: string | null; onWrite: () => void; onClose: () => void; onView: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-1.5 bg-q-surface px-6 text-center">
      <Check className="size-11 text-q-ok" strokeWidth={2.25} aria-hidden />
      <p className="q-display m-0 mt-1.5 text-2xl font-bold text-q-ink">Message <span className="q-serif text-q-accent">envoyé.</span></p>
      <p className="mb-3 mt-1.5 text-[14.5px] leading-[1.55] text-q-text-3">
        {PERSONA.name} vous répondra par email{email ? <> à <strong className="font-semibold text-q-ink">{email}</strong></> : null}. Ce même message vous donne un lien pour reprendre la conversation.
      </p>
      <button type="button" onClick={onView} className="q-btn q-btn-primary h-11 w-full text-[15px]">Voir la conversation</button>
      <button type="button" onClick={onWrite} className="q-btn q-btn-secondary h-11 w-full text-[15px]">Écrire un autre message</button>
      <button type="button" onClick={onClose} className="q-btn q-btn-ghost h-10 w-full text-[14px]">Fermer</button>
    </div>
  )
}
