"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ArrowRight, BookOpen, ChevronDown, ChevronLeft, ChevronRight, Home, MessageCircle, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { HELP_LINKS, PERSONA } from "@/lib/support-chat/persona"
import { chatSurface } from "@/lib/support-chat/surface"
import { SheetGrip } from "@/components/ui/sheet-grip"
import { useConsent } from "@/components/consent/use-consent"
import { Avatar, Composer, EmailCard, MessageList, SentCard } from "@/components/support/parts"
import { fetchThread, formatTime, hasChat, isEmail, rememberChat, sendMessage, type ThreadState } from "@/components/support/chat-api"

type View = "home" | "thread" | "history" | "help" | "sent"

const INTRO_KEY = "q_support_intro"
/** La bulle reste grande ce temps-là, puis se réduit pour ne rien cacher. */
const INTRO_MS = 6000
/**
 * Bulle de discussion pleine, trois points évidés : plus nette et plus « produit » que le
 * pictogramme au trait. Les points sont des trous (fill-rule evenodd), donc de la couleur du bouton.
 */
function ChatGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round">
      <path d="M12 3c-5.1 0-9 3.5-9 8.1 0 2.3 1 4.3 2.7 5.8-.1 1.2-.6 2.4-1.5 3.4-.3.3-.1.8.3.8 2.2-.1 3.9-.8 5.1-1.7.8.2 1.6.3 2.4.3 5.1 0 9-3.5 9-8.1S17.1 3 12 3Z" />
      <path d="M8 11.2h.01M12 11.2h.01M16 11.2h.01" strokeWidth="2.4" />
    </svg>
  )
}

const BLUE_RELIEF = "[box-shadow:inset_0_1px_0_rgba(255,255,255,.25),0_10px_28px_-8px_rgba(37,99,235,.65)]"

/**
 * Bulle de contact et panneau de discussion avec Christophe (pages publiques).
 * Ordinateur : bulle en bas à droite, grande 6 secondes puis ronde, panneau flottant.
 * Téléphone : un bouton rond en bas à droite (la languette au bord, essayée le 22/10/2026, a été refusée), feuille pleine hauteur.
 * Réponses par email : aucun délai n'est promis. Ni `backdrop-filter` ni `will-change`
 * (règle iOS de CLAUDE.md) ; seules la largeur du libellé et l'opacité sont animées.
 */
export function SupportChat() {
  const pathname = usePathname() ?? "/"
  const surface = chatSurface(pathname)
  const consent = useConsent()
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)
  // Le panneau reste monté le temps de son animation de fermeture (`shown` pilote la transition)
  const [rendered, setRendered] = useState(false)
  const [shown, setShown] = useState(false)
  const [view, setView] = useState<View>("home")
  const [thread, setThread] = useState<ThreadState | null>(null)
  const [loading, setLoading] = useState(false)
  const [unread, setUnread] = useState(0)
  const [intro, setIntro] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [text, setText] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const [email, setEmail] = useState("")
  const [emailOk, setEmailOk] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)

  // Montage : la bulle n'existe pas au rendu serveur (stockage de session, aucune différence d'hydratation)
  useEffect(() => {
    setMounted(true)
    let seen = false
    try { seen = sessionStorage.getItem(INTRO_KEY) === "1" } catch { /* stockage indisponible */ }
    if (seen) return
    setIntro(true)
    const id = window.setTimeout(() => {
      setIntro(false)
      try { sessionStorage.setItem(INTRO_KEY, "1") } catch { /* idem */ }
    }, INTRO_MS)
    return () => window.clearTimeout(id)
  }, [])

  // Seuls ceux qui ont déjà écrit interrogent le serveur pour de nouvelles réponses
  useEffect(() => {
    if (!mounted || !surface || !hasChat()) return
    let alive = true
    const check = () => fetchThread().then((t) => { if (alive && t) setUnread(t.unread) })
    void check()
    window.addEventListener("focus", check)
    return () => { alive = false; window.removeEventListener("focus", check) }
  }, [mounted, surface])

  const load = useCallback(async (opts: { seen?: boolean; id?: string } = {}) => {
    setLoading(true)
    const next = await fetchThread({ history: true, ...opts })
    setLoading(false)
    if (next) {
      setThread(next)
      setUnread(opts.seen ? 0 : next.unread)
      if (next.user?.email) { setEmail(next.user.email); setEmailOk(true) }
    }
    return next
  }, [])

  const openPanel = useCallback(async () => {
    setOpen(true)
    setRendered(true)
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => setShown(true)))
    setError(null)
    const next = await load()
    if (next && next.unread > 0) {
      setView("thread")
      void load({ seen: true })
    } else {
      setView("home")
    }
  }, [load])

  const closePanel = useCallback(() => {
    setOpen(false)
    setShown(false)
    window.setTimeout(() => setRendered(false), 320)
    window.setTimeout(() => trigger.current?.focus(), 0)
  }, [])

  useEffect(() => {
    if (!open) return
    panel.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closePanel() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, closePanel])

  if (!mounted || !surface) return null

  const hasConversation = !!thread?.conversation
  const needsEmail = !thread?.user && !hasConversation && !emailOk

  async function openThread(id?: string) {
    setView("thread")
    await load({ seen: true, id })
  }

  function confirmEmail() {
    if (!isEmail(email)) { setEmailError("Indiquez une adresse email valide."); return }
    setEmailError(null)
    setEmailOk(true)
  }

  async function send() {
    if (sending || !text.trim()) return
    setSending(true)
    setError(null)
    const result = await sendMessage(
      { message: text.trim(), email: hasConversation || thread?.user ? "" : email.trim(), source: surface === "app" ? "app" : "bubble", path: window.location.pathname },
      files,
    )
    setSending(false)
    if (!result.ok) { setError(result.error ?? "Impossible d'envoyer le message."); return }
    rememberChat()
    setText("")
    setFiles([])
    await load({ seen: true })
    if (result.attachmentsFailed) setError("Message envoyé, mais une pièce jointe n'a pas pu être enregistrée.")
    setView(result.isNew ? "sent" : "thread")
  }

  const bannerShown = consent === null
  // Dans l'application : toujours ronde. Sur les pages publiques : grande 6 s, puis au survol ou au clavier seulement
  const wide = surface === "bubble" && (intro || hovered || focused) && !open
  const label = unread > 0 ? `Ouvrir la discussion, ${unread} nouveau${unread > 1 ? "x" : ""} message${unread > 1 ? "s" : ""}` : "Discuter avec Christophe"
  const badge = unread > 0 && (
    <span className="absolute -right-1 -top-1 flex h-[22px] min-w-[22px] items-center justify-center rounded-full border-2 border-white bg-[#DC2626] px-1 text-[12px] font-bold leading-none text-white" aria-hidden>{unread}</span>
  )

  const tabs = view === "home" || view === "history" || view === "help"
  const lastReply = thread?.messages.filter((m) => m.sender === "admin").at(-1)

  return (
    <div className="print:hidden">
      {/* Ordinateur : la bulle */}
      <button
        ref={trigger}
        type="button"
        onClick={() => (open ? closePanel() : void openPanel())}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={(e) => setFocused(e.currentTarget.matches(":focus-visible"))}
        onBlur={() => setFocused(false)}
        aria-label={open ? "Fermer la discussion" : label}
        aria-expanded={open}
        className={cn(
          "fixed right-6 z-[60] hidden h-[60px] items-center overflow-hidden rounded-full bg-q-accent text-white outline-none md:flex",
          "transition-[width,bottom,background-color] duration-500 ease-[cubic-bezier(.22,1,.36,1)] motion-reduce:transition-none hover:bg-q-accent-strong focus-visible:ring-4 focus-visible:ring-[#BFD3FB]",
          BLUE_RELIEF,
          bannerShown ? "bottom-[5.5rem]" : "bottom-6",
          wide ? "w-[304px]" : "w-[60px]",
        )}
      >
        {/* Avatar et texte apparaissent en fondu pendant que la bulle s'élargit */}
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute left-1 top-1/2 flex -translate-y-1/2 items-center gap-3 whitespace-nowrap transition-[opacity,translate] duration-500 ease-[cubic-bezier(.22,1,.36,1)] motion-reduce:transition-none",
            wide ? "opacity-100 [translate:0_0]" : "opacity-0 [translate:-12px_0]",
          )}
        >
          <Avatar size={52} />
          <span className="flex flex-col text-left leading-tight">
            <span className="q-display text-[17px] font-bold">Une question ?</span>
            <span className="text-[14px] font-medium">Écrivez à {PERSONA.name}</span>
          </span>
        </span>
        <span className="relative ml-auto grid size-[60px] shrink-0 place-items-center">
          {open ? <ChevronDown className="size-6" aria-hidden /> : <ChatGlyph className="size-7" />}
          {!open && badge}
        </span>
      </button>

      {/* Téléphone : un bouton rond, au-dessus du bandeau de cookies tant qu'il est affiché */}
      {!open && surface === "bubble" && (
        <button
          type="button"
          onClick={() => void openPanel()}
          aria-label={label}
          className={cn(
            "fixed right-4 z-[60] flex size-14 items-center justify-center rounded-full bg-q-accent text-white outline-none transition-[bottom] duration-300 hover:bg-q-accent-strong focus-visible:ring-4 focus-visible:ring-[#BFD3FB] md:hidden",
            BLUE_RELIEF,
            bannerShown ? "bottom-[calc(env(safe-area-inset-bottom,0px)+8.5rem)]" : "bottom-[calc(env(safe-area-inset-bottom,0px)+1.25rem)]",
          )}
        >
          <ChatGlyph className="size-7" />
          {unread > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-[#DC2626] px-1 text-[11px] font-bold leading-none text-white" aria-hidden>{unread}</span>}
        </button>
      )}

      {rendered && (
        <>
          <div className={cn("fixed inset-0 z-[200] bg-black/50 transition-opacity duration-300 md:hidden", shown ? "opacity-100" : "opacity-0")} onClick={closePanel} aria-hidden />
          <div
            ref={panel}
            role="dialog"
            aria-label={`Discussion avec ${PERSONA.name}`}
            tabIndex={-1}
            className={cn(
              "fixed inset-x-0 bottom-0 top-9 z-[210] flex flex-col overflow-hidden rounded-t-3xl border border-q-line bg-q-bg outline-none",
              // Glissement du bas sur téléphone, fondu et léger zoom depuis la bulle sur ordinateur (propriétés `translate` et `scale`, sans `will-change`)
              "transition-[translate,scale,opacity] duration-[380ms] ease-[cubic-bezier(.22,1,.36,1)] motion-reduce:transition-none md:origin-bottom-right md:duration-300",
              shown ? "opacity-100 [translate:0_0] [scale:1]" : "opacity-0 [translate:0_100%] md:[translate:0_14px] md:[scale:.96]",
              "md:inset-x-auto md:bottom-[6.5rem] md:right-6 md:top-auto md:h-[min(640px,calc(100dvh-8rem))] md:w-[380px] md:rounded-[20px] md:[box-shadow:0_24px_60px_-20px_rgba(10,17,34,.35)]",
            )}
          >
            {/* En-tête */}
            <div className="shrink-0 bg-[#2563EB] text-white">
              <div className="md:hidden"><SheetGrip onDismiss={closePanel} /></div>
              {view === "home" ? (
                <div className="px-[18px] pb-12 pt-4">
                  <div className="flex items-center justify-between">
                    <span className="q-display text-base font-bold">Qonforme</span>
                    <HeaderButton label="Fermer" onClick={closePanel}><X className="size-5" aria-hidden /></HeaderButton>
                  </div>
                  <p className="q-display m-0 mt-4 text-[30px] font-bold leading-[1.1]">Bonjour,</p>
                  <p className="m-0 mt-1.5 text-base font-medium">Comment pouvons-nous vous aider ?</p>
                </div>
              ) : (
                <div className="flex h-[68px] items-center gap-2.5 px-3">
                  {tabs ? <span className="pl-1.5"><span className="q-display text-xl font-bold">{view === "history" ? "Messages" : "Aide"}</span></span> : (
                    <>
                      <HeaderButton label="Retour" onClick={() => setView("home")}><ChevronLeft className="size-5" aria-hidden /></HeaderButton>
                      <Avatar size={40} />
                      <span className="min-w-0 flex-1 leading-tight">
                        <span className="q-display block text-base font-bold">{PERSONA.name}</span>
                        <span className="block truncate text-[12.5px]">{PERSONA.role}</span>
                      </span>
                    </>
                  )}
                  {tabs && <span className="flex-1" />}
                  <HeaderButton label="Fermer" onClick={closePanel}><X className="size-5" aria-hidden /></HeaderButton>
                </div>
              )}
            </div>

            {/* Accueil */}
            {view === "home" && (
              <div className="-mt-9 flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-3.5 pb-3">
                <button
                  type="button"
                  onClick={() => void openThread()}
                  className="flex items-center gap-3 rounded-2xl border border-q-line bg-q-surface p-3.5 text-left [box-shadow:0_8px_24px_-12px_rgba(10,17,34,.25)] hover:bg-q-row-hover"
                >
                  <Avatar size={44} />
                  <span className="min-w-0 flex-1 leading-[1.3]">
                    <span className="q-display block text-base font-bold text-q-ink">{unread > 0 ? `${PERSONA.name} vous a répondu` : `Écrire à ${PERSONA.name}`}</span>
                    <span className="block text-[13px] text-q-text-3">{unread > 0 && lastReply ? lastReply.body.slice(0, 70) : <>{PERSONA.role}<br />Il vous répond par email</>}</span>
                  </span>
                  <ArrowRight className="size-5 shrink-0 text-q-accent" aria-hidden />
                </button>
                <HelpList title="Articles utiles" count={3} />
              </div>
            )}

            {/* Messages */}
            {view === "history" && (
              <div className="flex min-h-0 flex-1 flex-col bg-q-surface">
                <ul className="m-0 min-h-0 flex-1 list-none overflow-y-auto p-0">
                  {(thread?.history ?? []).length === 0 && !hasConversation && !loading && (
                    <li className="px-6 py-10 text-center text-[14.5px] text-q-text-3">Aucun message pour le moment.</li>
                  )}
                  {((thread?.history?.length ? thread.history : thread?.conversation ? [{ id: thread.conversation.id, subject: null, status: thread.conversation.status as "open", lastMessageAt: thread.messages.at(-1)?.createdAt ?? "", preview: thread.messages.at(-1) ? { sender: thread.messages.at(-1)!.sender, body: thread.messages.at(-1)!.body } : null, unread: thread.unread }] : []) as NonNullable<ThreadState["history"]>).map((item) => (
                    <li key={item.id}>
                      <button type="button" onClick={() => void openThread(thread?.user ? item.id : undefined)} className="flex w-full items-center gap-3 border-b border-q-line px-4 py-3.5 text-left hover:bg-q-row-hover">
                        <Avatar size={40} ring={false} />
                        <span className="min-w-0 flex-1 leading-[1.35]">
                          <span className="block truncate text-[14.5px] font-semibold text-q-ink">{item.subject ?? "Conversation avec " + PERSONA.name}</span>
                          <span className="block truncate text-[13px] text-q-text-3">{item.preview ? `${item.preview.sender === "admin" ? PERSONA.name : "Vous"} : ${item.preview.body}` : ""}</span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1">
                          {item.lastMessageAt && <span className="text-[12px] text-q-text-4">{formatTime(item.lastMessageAt)}</span>}
                          <StatusPill status={item.status} unread={item.unread} />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="p-3.5"><button type="button" onClick={() => void openThread()} className="q-btn q-btn-primary h-11 w-full text-[15px]">{hasConversation ? "Écrire un message" : "Nouveau message"}</button></div>
              </div>
            )}

            {/* Aide */}
            {view === "help" && (
              <div className="min-h-0 flex-1 overflow-y-auto p-3.5">
                <HelpList title="Guides et réponses" count={HELP_LINKS.length} />
                <p className="mx-1 mb-0 mt-3 text-[13px] leading-[1.5] text-q-text-3">Votre question n&apos;y est pas ? <button type="button" onClick={() => void openThread()} className="font-semibold text-q-accent-strong underline underline-offset-2">Écrivez à {PERSONA.name}</button>.</p>
              </div>
            )}

            {/* Conversation */}
            {view === "thread" && (
              <>
                <p className="m-0 shrink-0 border-b border-q-wash-line bg-q-wash px-3.5 py-2 text-[12.5px] leading-[1.45] text-q-accent-ink">{PERSONA.name} vous répond par email. Vous pouvez fermer cette fenêtre.</p>
                <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-3.5 py-3.5">
                  {!hasConversation && (
                    <div className="max-w-[84%] self-start rounded-2xl rounded-bl-md border border-q-line bg-q-surface px-3.5 py-2.5 text-[15px] leading-[1.45] text-q-ink">Bonjour, c&apos;est {PERSONA.name}. Dites-moi ce que je peux faire pour vous.</div>
                  )}
                  {loading && !thread && <p className="m-0 text-center text-[13px] text-q-text-4">Chargement…</p>}
                  {hasConversation && <MessageList messages={thread!.messages} />}
                  {needsEmail && <EmailCard value={email} onChange={setEmail} onContinue={confirmEmail} error={emailError} />}
                </div>
                <Composer value={text} onChange={setText} onSend={() => void send()} sending={sending} disabled={needsEmail} files={files} onFiles={setFiles} error={error} />
              </>
            )}

            {view === "sent" && (
              <SentCard email={thread?.conversation?.email ?? (email || null)} onView={() => setView("thread")} onWrite={() => setView("thread")} onClose={closePanel} />
            )}

            {/* Onglets */}
            {tabs && (
              <nav className="flex h-[60px] shrink-0 border-t border-q-line bg-q-surface" aria-label="Sections de la discussion">
                <TabButton on={view === "home"} onClick={() => setView("home")} icon={<Home className="size-5" aria-hidden />} label="Accueil" />
                <TabButton on={view === "history"} onClick={() => { setView("history"); void load() }} icon={<MessageCircle className="size-5" aria-hidden />} label="Messages" badge={unread} />
                <TabButton on={view === "help"} onClick={() => setView("help")} icon={<BookOpen className="size-5" aria-hidden />} label="Aide" />
              </nav>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function HeaderButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[#3C70EE] text-white hover:bg-[#4A7BF5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
      {children}
    </button>
  )
}

function TabButton({ on, onClick, icon, label, badge = 0 }: { on: boolean; onClick: () => void; icon: React.ReactNode; label: string; badge?: number }) {
  return (
    <button type="button" onClick={onClick} aria-current={on ? "page" : undefined} className={cn("relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[12px] font-semibold", on ? "text-q-accent" : "text-q-text-4 hover:text-q-ink")}>
      <span className="relative">{icon}{badge > 0 && <span className="absolute -right-2 -top-1 size-2.5 rounded-full bg-[#DC2626]" aria-hidden />}</span>
      {label}
    </button>
  )
}

function HelpList({ title, count }: { title: string; count: number }) {
  return (
    <div className="rounded-2xl border border-q-line bg-q-surface px-3.5 py-1.5">
      <p className="m-0 pb-1 pt-2 text-[12px] font-bold uppercase tracking-[0.06em] text-q-text-4">{title}</p>
      <ul className="m-0 list-none p-0">
        {HELP_LINKS.slice(0, count).map((link) => (
          <li key={link.href} className="border-t border-q-line">
            <Link href={link.href} className="flex items-center justify-between gap-2 py-2.5 text-[14.5px] font-medium text-q-ink hover:text-q-accent-strong">
              <span>{link.label}</span>
              <ChevronRight className="size-4 shrink-0 text-q-text-4" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

function StatusPill({ status, unread }: { status: "open" | "pending" | "resolved"; unread: number }) {
  if (unread > 0) return <span className="rounded-full bg-q-wash px-2 py-0.5 text-[12px] font-semibold text-q-accent-ink">{unread} nouveau{unread > 1 ? "x" : ""}</span>
  const map = { open: ["En attente", "bg-q-warn-bg text-q-warn"], pending: ["Répondu", "bg-q-ok-bg text-q-ok"], resolved: ["Résolu", "bg-q-sunken text-q-text-3"] } as const
  const [text, cls] = map[status] ?? map.open
  return <span className={cn("rounded-full px-2 py-0.5 text-[12px] font-semibold", cls)}>{text}</span>
}
