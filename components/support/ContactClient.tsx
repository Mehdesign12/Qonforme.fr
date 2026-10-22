"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ChevronRight, Paperclip, X } from "lucide-react"
import { PERSONA, HELP_LINKS } from "@/lib/support-chat/persona"
import { CATEGORIES, CATEGORY_LABELS, type ChatCategory } from "@/lib/support-chat/rules"
import { Avatar, Composer, MessageList, SentCard } from "@/components/support/parts"
import { ACCEPT, addFiles, fetchThread, isEmail, kib, rememberChat, sendMessage, type ThreadState } from "@/components/support/chat-api"

const FIELD = "h-12 w-full rounded-xl border border-q-field bg-q-surface px-3.5 text-base text-q-ink outline-none placeholder:text-q-text-4 focus-visible:ring-2 focus-visible:ring-q-accent md:text-[15px]"

/**
 * Page Contact : le formulaire (nom, email, sujet, message, pièce jointe) ou, quand la
 * personne a déjà écrit (cookie, lien de l'email), sa conversation avec Christophe.
 * Même route d'envoi que la bulle ; les réponses arrivent par email, sans délai promis.
 */
export function ContactClient() {
  const [thread, setThread] = useState<ThreadState | null>(null)
  const [ready, setReady] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [category, setCategory] = useState<ChatCategory | "">("")
  const [message, setMessage] = useState("")
  const [reply, setReply] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const [website, setWebsite] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fileNote, setFileNote] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    const asked = new URLSearchParams(window.location.search).get("conversation") === "1"
    fetchThread({ seen: true }).then((t) => {
      if (!alive) return
      if (t) { setThread(t); if (t.user?.email) setEmail(t.user.email) }
      setReady(true)
      void asked
    })
    return () => { alive = false }
  }, [])

  const known = !!thread?.user?.email
  const hasConversation = !!thread?.conversation

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (sending) return
    if (!message.trim()) { setError("Écrivez votre message."); return }
    if (!known && !isEmail(email)) { setError("Indiquez une adresse email valide pour recevoir la réponse."); return }
    setSending(true); setError(null)
    const result = await sendMessage({ message: message.trim(), email: known ? "" : email.trim(), name: name.trim(), category, source: "contact_page", path: "/contact", website }, files)
    setSending(false)
    if (!result.ok) { setError(result.error ?? "Impossible d'envoyer le message."); return }
    rememberChat()
    setMessage(""); setFiles([])
    setDone(known ? thread!.user!.email : email.trim())
    setThread(await fetchThread({ seen: true }))
  }

  async function sendReply() {
    if (sending || !reply.trim()) return
    setSending(true); setError(null)
    const result = await sendMessage({ message: reply.trim(), source: "contact_page", path: "/contact" }, files)
    setSending(false)
    if (!result.ok) { setError(result.error ?? "Impossible d'envoyer le message."); return }
    setReply(""); setFiles([])
    setThread(await fetchThread({ seen: true }))
  }

  async function pickFiles(list: FileList | null) {
    if (!list) return
    const result = await addFiles(files, Array.from(list))
    setFiles(result.files)
    setFileNote(result.error)
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section className="q-card min-w-0 overflow-hidden" aria-live="polite">
        {!ready ? (
          <p className="m-0 p-8 text-center text-[14px] text-q-text-4">Chargement…</p>
        ) : done ? (
          <div className="flex flex-col p-4 sm:p-8">
            <SentCard email={done} onView={() => setDone(null)} onWrite={() => setDone(null)} onClose={() => setDone(null)} />
          </div>
        ) : hasConversation ? (
          <div className="flex flex-col">
            <div className="flex items-center gap-3 border-b border-q-line px-5 py-4">
              <Avatar size={44} />
              <span className="leading-tight"><span className="q-display block text-[17px] font-bold text-q-ink">Votre conversation avec {PERSONA.name}</span><span className="block text-[13px] text-q-text-3">{PERSONA.name} vous répond par email.</span></span>
            </div>
            <div className="max-h-[520px] min-h-[200px] overflow-y-auto bg-q-bg px-5 py-5"><MessageList messages={thread!.messages} /></div>
            <Composer value={reply} onChange={setReply} onSend={() => void sendReply()} sending={sending} files={files} onFiles={setFiles} error={error} />
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-5 p-5 sm:p-8" noValidate>
            <div className="grid gap-5 sm:grid-cols-2">
              <div><label htmlFor="c-name" className="q-label mb-1.5 block">Votre nom</label><input id="c-name" className={FIELD} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={120} /></div>
              {!known && <div><label htmlFor="c-email" className="q-label mb-1.5 block">Votre email</label><input id="c-email" type="email" inputMode="email" className={FIELD} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></div>}
            </div>
            <div>
              <label htmlFor="c-cat" className="q-label mb-1.5 block">Votre sujet</label>
              <select id="c-cat" className={FIELD} value={category} onChange={(e) => setCategory(e.target.value as ChatCategory | "")}>
                <option value="">Choisissez un sujet</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="c-msg" className="q-label mb-1.5 block">Votre message</label>
              <textarea id="c-msg" value={message} onChange={(e) => setMessage(e.target.value)} rows={7} maxLength={5000} required className="w-full resize-y rounded-xl border border-q-field bg-q-surface px-3.5 py-3 text-base leading-[1.5] text-q-ink outline-none focus-visible:ring-2 focus-visible:ring-q-accent md:text-[15px]" />
            </div>
            <div>
              <label htmlFor="c-file" className="flex cursor-pointer items-center gap-3 rounded-[14px] border-[1.5px] border-dashed border-q-wash-line bg-q-wash px-4 py-3.5 text-[15px] text-q-accent-ink focus-within:ring-2 focus-within:ring-q-accent">
                <Paperclip className="size-5 shrink-0" aria-hidden />
                <span><strong className="font-semibold">Joindre une capture ou un PDF</strong> <span className="text-q-text-3">· 4 Mo au plus</span></span>
              </label>
              <input id="c-file" type="file" accept={ACCEPT} multiple className="sr-only" onChange={(e) => { void pickFiles(e.target.files); e.target.value = "" }} />
              {files.length > 0 && (
                <ul className="m-0 mt-2 flex list-none flex-wrap gap-1.5 p-0">
                  {files.map((f, i) => (
                    <li key={`${f.name}-${i}`} className="inline-flex items-center gap-1.5 rounded-full bg-q-sunken py-1 pl-3 pr-1 text-[13px] text-q-ink">
                      <span className="max-w-[220px] truncate">{f.name}</span><span className="text-q-text-4">{kib(f.size)}</span>
                      <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="inline-flex size-6 items-center justify-center rounded-full hover:bg-q-hover" aria-label={`Retirer ${f.name}`}><X className="size-3.5" aria-hidden /></button>
                    </li>
                  ))}
                </ul>
              )}
              {fileNote && <p role="alert" className="mb-0 mt-2 text-[13px] text-q-danger">{fileNote}</p>}
            </div>
            {/* Champ piège : invisible, jamais rempli par une personne */}
            <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden"><label>Ne pas remplir<input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} /></label></div>
            {error && <p role="alert" className="m-0 text-[14px] text-q-danger">{error}</p>}
            <p className="m-0 text-[13px] leading-[1.55] text-q-text-4">En envoyant ce message, vous acceptez que Qonforme utilise votre adresse pour vous répondre. <Link href="/confidentialite" className="text-q-accent-strong underline underline-offset-2">Politique de confidentialité</Link></p>
            <div><button type="submit" disabled={sending} className="q-btn q-btn-primary h-12 px-7 text-base disabled:opacity-60">{sending ? "Envoi…" : "Envoyer le message"}</button></div>
          </form>
        )}
      </section>

      <aside className="flex min-w-0 flex-col gap-4">
        <div className="q-card flex items-center gap-4 p-5">
          <Avatar size={72} ring={false} />
          <span className="leading-snug"><span className="q-display block text-xl font-bold text-q-ink">{PERSONA.name}</span><span className="block text-[14.5px] text-q-text-3">{PERSONA.role}</span></span>
        </div>
        <div className="q-card px-5 py-4">
          <p className="q-display m-0 text-lg font-bold text-q-ink">Avant d&apos;écrire</p>
          <p className="mb-2 mt-1 text-[14.5px] leading-[1.5] text-q-text-3">La réponse est peut-être déjà là.</p>
          <ul className="m-0 list-none p-0">
            {HELP_LINKS.map((l) => (
              <li key={l.href} className="border-t border-q-line"><Link href={l.href} className="flex items-center justify-between gap-2 py-3 text-[15px] font-medium text-q-ink hover:text-q-accent-strong"><span>{l.label}</span><ChevronRight className="size-4 shrink-0 text-q-text-4" aria-hidden /></Link></li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-q-wash-line bg-q-wash px-5 py-4">
          <p className="q-display m-0 text-lg font-bold text-q-accent-ink">Déjà un compte ?</p>
          <p className="mb-0 mt-1 text-[14.5px] leading-[1.5] text-q-accent-ink">Écrivez depuis l&apos;application, menu « Nous écrire » : votre compte est reconnu.</p>
        </div>
      </aside>
    </div>
  )
}
