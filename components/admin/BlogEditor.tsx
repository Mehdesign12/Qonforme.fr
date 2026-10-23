'use client'

/**
 * Éditeur d'articles du blog (admin › Blog › Nouvel article / Modifier).
 *
 * Coque qui assemble les pièces de components/admin/blog :
 * - à gauche, une seule feuille : couverture, titre, chapeau, éditeur visuel
 *   (shell/DocumentSheet.tsx, editor/RichEditor.tsx) ;
 * - à droite (≥ 1 280 px), une colonne collante qui défile seule :
 *   Publication et « Enregistrer », Score SEO, Mot-clé principal, Résultat
 *   Google, Adresse, Mots-clés secondaires, Plan de l'article
 *   (shell/SideCards.tsx, seo/*) ; sous 1 280 px, trois onglets collants
 *   « Rédaction », « Référencement » (avec le score) et « Publication ».
 *
 * Enregistrement (shell/model.ts) :
 * - création : POST /api/admin/blog, puis l'adresse de la page devient
 *   /admin/blog/<id> (router.replace) : on reste dans l'éditeur ;
 * - modification : PATCH /api/admin/blog/<id> avec les seuls champs changés.
 *   Le texte n'est envoyé que s'il a changé : ouvrir un article ne réécrit
 *   jamais son contenu (l'éditeur visuel ne rend rien tant qu'on n'a rien
 *   touché) ;
 * - publication : brouillon, publié ou programmé (`is_published`,
 *   `scheduled_at`) ; 409 du contrôle → bannière avec les passages ;
 * - Ctrl+S (⌘S) ; messages précis ; erreurs renvoyées au bon champ.
 *
 * Sûreté : copie locale toutes les 2 s, et aussitôt quand la page disparaît
 * (restauration proposée au retour si elle est plus récente que
 * l'enregistrement), alerte à la fermeture de l'onglet, confirmation avant de
 * suivre un lien interne, fichier lâché hors des zones de dépôt sans effet
 * (shell/hooks.ts). Un seul enregistrement à la fois : Ctrl+S pendant un envoi
 * en relance un autre à la fin (ce qui a été tapé entre-temps). Après la
 * création, le changement de page remonte l'éditeur : le texte tapé pendant
 * l'envoi, l'onglet, le défilement et le curseur passent au nouvel éditeur
 * (relais de shell/hooks.ts).
 *
 * Programmation depuis le calendrier (?programmer=AAAA-MM-JJ, lu par la page) :
 * heure des Préférences ; aujourd'hui, si elle est passée, la prochaine heure
 * possible est proposée et doit être confirmée (bannière, ou fenêtre à
 * l'enregistrement).
 *
 * Liste de contrôle → champ : l'onglet voulu s'affiche (téléphone), la page
 * défile jusqu'au champ, qui reçoit le focus et un anneau d'accent bref.
 */
import { useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, LogOut, PenLine, Save, Search, Send, Trash2, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { slugify } from '@/lib/seo/articles/check'
import { analyzeOnPage, scoreTone } from '@/lib/seo/articles/onpage'
import { inferArticleType } from '@/lib/seo/articles/search-language'
import type { ArticleType } from '@/lib/seo/types'
import { api } from '@/components/admin/seo/articles/api'
import { useImageStudio } from '@/components/admin/blog/images/useImageStudio'
import { useSeoContext } from '@/components/admin/blog/seo/useSeoContext'
import { useSuggest } from '@/components/admin/blog/seo/SuggestButton'
import { scoreLabel } from '@/components/admin/blog/seo/SeoScore'
import type { PublicationValue } from '@/components/admin/blog/seo/PublicationPanel'
import type { RichEditorHandle } from '@/components/admin/blog/editor/RichEditor'
import type { EditorMode } from '@/components/admin/blog/editor/Toolbar'
import type { AssistResponse, SuggestField, SuggestRequest } from '@/lib/seo/articles/editor-types'
import { applyPassageEdits, excerptInText, type PassageEdit } from '@/lib/blog-editor/passages'
import { keywordKey } from '@/lib/seo/articles/secondary'
import type { IssueActions, IssueFixResult } from '@/components/admin/blog/shell/IssueItem'
import {
  buildSaveRequest,
  changedFields,
  DEFAULT_PUBLISH_TIME,
  describeFields,
  draftOfPost,
  isDirty,
  issuesOf,
  metaAfterSave,
  metaOfPost,
  newDraft,
  normalSlug,
  publicationMovedSince,
  relativeDay,
  restoreDraft,
  saveActionLabel,
  statusOfMeta,
  successMessage,
  tabOfTarget,
  targetOfError,
  type ArticleDraft,
  type BlockingIssue,
  type EditorPost,
  type EditorTab,
  type FocusTarget,
  type SavedMeta,
  type ScheduleSlot,
} from '@/components/admin/blog/shell/model'
import {
  captureEditorView,
  noteCreationHandoffView,
  offerCreationHandoff,
  peekCreationHandoff,
  restoreEditorView,
  takeCreationHandoff,
  useLeaveGuard,
  useLocalDraft,
  usePageDropGuard,
  useSaveShortcut,
  type ViewMemo,
} from '@/components/admin/blog/shell/hooks'
import { IdeasDialog } from '@/components/admin/seo/ideas/IdeasDialog'
import { BlockedBanner, ConfirmDialog, DraftOfferBanner, EditorTabs, flashElement, ScheduleProposalBanner, type SaveState } from '@/components/admin/blog/shell/parts'
import { EditorHeader } from '@/components/admin/blog/shell/EditorHeader'
import { DocumentSheet } from '@/components/admin/blog/shell/DocumentSheet'
import { AddressCard, GoogleCard, KeywordCard, LinksCard, OutlineCard, PublicationCard, ScoreCard, SecondaryCard } from '@/components/admin/blog/shell/SideCards'
import { useAutoLinks } from '@/components/admin/blog/seo/useAutoLinks'
import { KeywordFitDialog, type KeywordFitRequest } from '@/components/admin/blog/seo/KeywordFitDialog'
import type { CheckActionFor } from '@/components/admin/blog/seo/SeoScore'

interface BlogEditorProps {
  mode: 'create' | 'edit'
  post?: EditorPost
  /** Jour demandé par le calendrier (?programmer=AAAA-MM-JJ, déjà contrôlé par la page) : publication programmée ce jour-là. */
  initialSchedule?: string | null
  /** Heure de publication des Préférences (HH:MM, Paris) ; à défaut, celle du contexte de référencement, puis 08:00. */
  publishTime?: string | null
  /** Instant du rendu serveur (ISO) : même état initial au serveur et au navigateur. */
  renderedAt?: string | null
}

type Heading = { level: number; text: string }

/** Mot-clé secondaire ajouté à la main (Proposition IA › « Ajouter aux secondaires »). */
type ExtraSecondary = { keyword: string; volume: number | null }

const EXTRA_SECONDARY_MAX = 20
const extraKey = (articleId: string) => `q-blog-secondary:${articleId}`

/** Mots-clés secondaires gardés sur cet appareil pour l'article (relus sans confiance ; illisible : aucun). */
function readExtraSecondary(articleId: string | null): ExtraSecondary[] {
  if (!articleId) return []
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(extraKey(articleId)) ?? '[]')
    if (!Array.isArray(raw)) return []
    return raw
      .filter((e): e is ExtraSecondary => !!e && typeof e === 'object' && typeof (e as ExtraSecondary).keyword === 'string' && (e as ExtraSecondary).keyword.trim().length > 0)
      .map((e) => ({ keyword: e.keyword.trim().slice(0, 120), volume: typeof e.volume === 'number' && Number.isFinite(e.volume) ? e.volume : null }))
      .slice(0, EXTRA_SECONDARY_MAX)
  } catch {
    return []
  }
}

function writeExtraSecondary(articleId: string, list: ExtraSecondary[]) {
  try {
    if (list.length === 0) localStorage.removeItem(extraKey(articleId))
    else localStorage.setItem(extraKey(articleId), JSON.stringify(list))
  } catch {
    // Stockage indisponible (navigation privée) : la liste reste en mémoire
  }
}

/** Ce que l'éditeur de /admin/blog/new laisse à celui de la page de l'article (relais de shell/hooks.ts). */
type Carried = { id: string; draft: ArticleDraft; tab: EditorTab; highlighted: string[]; extraSecondary: ExtraSecondary[]; lastSaveAt: string; fromCalendar: boolean; editorMode: EditorMode }

/** Champs du brouillon que le contrôle de publication lit (le texte d'abord), et le champ à montrer pour chacun. */
type IssueField = 'content' | 'title' | 'seoTitle' | 'seoDescription' | 'excerpt' | 'coverAlt'
const ISSUE_FIELDS: IssueField[] = ['content', 'title', 'seoTitle', 'seoDescription', 'excerpt', 'coverAlt']
const ISSUE_TARGETS: Record<Exclude<IssueField, 'content'>, FocusTarget> = { title: 'title', seoTitle: 'seoTitle', seoDescription: 'seoDescription', excerpt: 'excerpt', coverAlt: 'cover' }

/** Champ du brouillon qui porte encore l'extrait refusé (le texte d'abord) ; null : il n'est plus nulle part. */
function issueFieldIn(draft: ArticleDraft, issue: BlockingIssue): IssueField | null {
  if (!issue.excerpt) return null
  for (const field of ISSUE_FIELDS) {
    if (draft[field].trim() && excerptInText(draft[field], issue.excerpt)) return field
  }
  return null
}
const issueKey = (issue: BlockingIssue) => `${issue.label}\u0000${issue.excerpt ?? ''}`

const FOCUS_IDS: Record<Exclude<FocusTarget, 'content' | 'publication'>, string> = {
  title: 'blog-title',
  excerpt: 'blog-excerpt',
  cover: 'blog-cover',
  keyword: 'blog-keyword',
  seoTitle: 'blog-seo-title',
  seoDescription: 'blog-seo-description',
  slug: 'blog-slug',
  links: 'blog-links-run',
}

const PANELS: Record<EditorTab, string> = {
  redaction: 'editeur-redaction',
  referencement: 'editeur-colonne',
  publication: 'editeur-colonne',
}

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

/**
 * Champ validé à sa sortie (adresse de la couverture, « Options avancées ») :
 * validé avant l'envoi (sinon Ctrl+S enregistrerait sans lui), puis le focus
 * y revient. L'attente laisse passer le rendu qui met l'article à jour.
 */
async function commitFieldBeingEdited(): Promise<void> {
  const active = typeof document !== 'undefined' ? document.activeElement : null
  if (!(active instanceof HTMLElement) || !active.matches('[data-commit-on-blur]')) return
  active.blur()
  await new Promise((resolve) => window.setTimeout(resolve, 0))
  active.focus({ preventScroll: true })
}

async function sendJson(method: 'POST' | 'PATCH', url: string, body: unknown): Promise<{ status: number; json: Record<string, unknown> | null }> {
  try {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store' })
    const json = (await res.json().catch(() => null)) as Record<string, unknown> | null
    return { status: res.status, json }
  } catch {
    return { status: 0, json: null }
  }
}

export function BlogEditor({ mode, post, initialSchedule = null, publishTime = null, renderedAt = null }: BlogEditorProps) {
  const router = useRouter()
  const editing = mode === 'edit' && Boolean(post)
  const [id, setId] = useState<string | null>(editing && post ? post.id : null)

  /* ---------------------------------------------------------------- */
  /* État                                                              */
  /* ---------------------------------------------------------------- */

  const [init] = useState<{ draft: ArticleDraft; saved: ArticleDraft; slot: ScheduleSlot | null; carried: Carried | null }>(() => {
    const now = renderedAt ? new Date(renderedAt) : new Date()
    const pref = publishTime || DEFAULT_PUBLISH_TIME
    if (editing && post) {
      const stored = draftOfPost(post, pref, now)
      // Article créé à l'instant par l'éditeur de /admin/blog/new : on reprend là où il en était,
      // seulement si la base a encore ce qui a été créé (rien de plus récent n'est écrasé)
      const h = peekCreationHandoff(post.id)
      const carried =
        h && !isDirty(h.saved, stored)
          ? { id: h.id, draft: h.latest(), tab: h.tab, highlighted: h.highlighted, extraSecondary: h.extraSecondary ?? [], lastSaveAt: h.lastSaveAt, fromCalendar: h.fromCalendar, editorMode: h.editorMode }
          : null
      return { draft: carried?.draft ?? stored, saved: stored, slot: null, carried }
    }
    const created = newDraft(initialSchedule, pref, now)
    return { draft: created.draft, saved: created.draft, slot: created.slot, carried: null }
  })
  const carried = init.carried
  const [draft, setDraft] = useState<ArticleDraft>(init.draft)
  const [saved, setSaved] = useState<ArticleDraft>(init.saved)
  const [meta, setMeta] = useState<SavedMeta>(() => metaOfPost(editing ? post : null))
  const [lastSaveAt, setLastSaveAt] = useState<string | null>(carried?.lastSaveAt ?? null)
  const [slugTouched, setSlugTouched] = useState(editing)
  const [slugError, setSlugError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [restored, setRestored] = useState(false)
  /**
   * Publication refusée par le contrôle ; `unscheduled` : la programmation d'avant a été retirée par le
   * serveur ; `notCreated` : création publiée refusée avant tout enregistrement (rien n'est créé).
   */
  const [blocked, setBlocked] = useState<{ issues: BlockingIssue[]; unscheduled: boolean; notCreated?: boolean } | null>(null)
  /** Passages refusés qui étaient dans le texte quand la bannière est apparue. */
  const foundIssues = useRef<Set<string>>(new Set())
  const [proposal, setProposal] = useState<ScheduleSlot | null>(init.slot && init.slot.adjusted !== 'none' ? init.slot : null)
  const [scheduleCheck, setScheduleCheck] = useState<{ then: string | null } | null>(null)
  const [leaveHref, setLeaveHref] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [tab, setTab] = useState<EditorTab>(carried?.tab ?? 'redaction')
  const [headings, setHeadings] = useState<Heading[]>([])
  const [highlighted, setHighlighted] = useState<string[]>(carried?.highlighted ?? [])
  // Mots-clés secondaires ajoutés depuis la Proposition IA : gardés sur cet appareil, par article (lus après l'affichage :
  // le rendu serveur et le premier rendu du navigateur doivent être identiques)
  const [extraSecondary, setExtraSecondary] = useState<ExtraSecondary[]>(carried?.extraSecondary ?? [])
  // « Proposition IA » : requêtes exactes pour cet article
  const [ideasOpen, setIdeasOpen] = useState(false)
  // « Intégrer avec l'IA » : mot-clé à placer dans le texte (secondaire absent, sous-titre, introduction)
  const [fit, setFit] = useState<KeywordFitRequest | null>(null)

  const editorRef = useRef<RichEditorHandle>(null)
  const tabsAnchorRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  // Valeurs courantes pour les fonctions stables (raccourci, propositions, enregistrement).
  // Mises à jour aussi tout de suite après un enregistrement : un Ctrl+S qui arrive avant le
  // rendu suivant voit l'article créé (PATCH, jamais un second POST) et ce qui est enregistré.
  const idRef = useRef(id)
  idRef.current = id
  const draftRef = useRef(draft)
  draftRef.current = draft
  const savedRef = useRef(saved)
  savedRef.current = saved
  const metaRef = useRef(meta)
  metaRef.current = meta
  const proposalRef = useRef(proposal)
  proposalRef.current = proposal
  const highlightedRef = useRef(highlighted)
  highlightedRef.current = highlighted
  const extraSecondaryRef = useRef(extraSecondary)
  extraSecondaryRef.current = extraSecondary
  const slugTouchedRef = useRef(slugTouched)
  slugTouchedRef.current = slugTouched
  const tabRef = useRef(tab)
  tabRef.current = tab
  const savingRef = useRef(false)
  /** Ctrl+S pendant un envoi : un autre enregistrement suit. */
  const queuedRef = useRef(false)
  const deletingRef = useRef(false)
  const mountedRef = useRef(false)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // Article relu après un enregistrement (router.refresh) : statut et dates du serveur
  const firstPost = useRef(post)
  useEffect(() => {
    if (post && post !== firstPost.current && post.id === id) setMeta(metaOfPost(post))
  }, [post, id])

  const changes = useMemo(() => changedFields(draft, saved), [draft, saved])
  const dirty = changes.length > 0
  const publicationChanged = changes.includes('publication')

  const patch = useCallback((next: Partial<ArticleDraft>) => setDraft((d) => ({ ...d, ...next })), [])

  /* ---------------------------------------------------------------- */
  /* Référencement                                                     */
  /* ---------------------------------------------------------------- */

  const seo = useSeoContext({ id, keyword: draft.keyword })
  const prefTime = publishTime || seo.data?.prefs.publishTime || DEFAULT_PUBLISH_TIME

  // Analyse sur des valeurs différées, texte et autres champs : une frappe dans le titre, le chapeau
  // ou la description ne relance pas tout de suite l'analyse de tout l'article (comparaison avec
  // jusqu'à 2 000 titres comprise) ; les compteurs de caractères suivent, eux, la saisie
  const deferredDraft = useDeferredValue(draft)
  const deferredHighlighted = useDeferredValue(highlighted)
  const otherTitles = useMemo(() => seo.data?.others.map((o) => ({ id: o.id, title: o.title, slug: o.slug })), [seo.data])
  // Type enregistré par le générateur ; sinon déduit du mot-clé et du titre (« comment … » = how-to)
  const savedType = post?.article_type
  const articleTypeOf = useCallback(
    (keyword: string | null, title: string): ArticleType =>
      savedType === 'howto' || savedType === 'guide' || savedType === 'news' || savedType === 'faq' ? savedType : inferArticleType(keyword, title),
    [savedType],
  )
  const analysis = useMemo(
    () =>
      analyzeOnPage({
        title: deferredDraft.title,
        seoTitle: deferredDraft.seoTitle,
        seoDescription: deferredDraft.seoDescription,
        slug: deferredDraft.slug,
        excerpt: deferredDraft.excerpt,
        content: deferredDraft.content,
        keyword: deferredDraft.keyword,
        articleType: articleTypeOf(deferredDraft.keyword, deferredDraft.title),
        secondary: deferredHighlighted,
        coverUrl: deferredDraft.coverUrl.trim() || null,
        coverAlt: deferredDraft.coverAlt.trim() || null,
        otherTitles,
        selfId: id,
        lengthMin: seo.data?.prefs.lengthMin,
        lengthMax: seo.data?.prefs.lengthMax,
        competitors: seo.data?.competitors,
      }),
    [deferredDraft.title, deferredDraft.seoTitle, deferredDraft.seoDescription, deferredDraft.slug, deferredDraft.excerpt, deferredDraft.content, deferredDraft.keyword, deferredHighlighted, deferredDraft.coverUrl, deferredDraft.coverAlt, otherTitles, seo.data, id, articleTypeOf],
  )

  const highlightTerms = useMemo(() => {
    const terms = [draft.keyword ?? '', ...highlighted].map((t) => t.trim()).filter(Boolean)
    return Array.from(new Set(terms))
  }, [draft.keyword, highlighted])

  // Propositions : contexte lu au clic ; sans mot-clé ni texte, le bouton explique ce qui manque
  const suggestReason = !draft.keyword
    ? "Choisissez d'abord le mot-clé principal : les propositions s'appuient dessus."
    : !draft.title.trim() && !draft.content.trim()
      ? "Écrivez d'abord le titre ou le texte de l'article."
      : null
  const requestFor = useMemo(() => {
    const base = (field: SuggestField) => (): Omit<SuggestRequest, 'field'> => {
      const d = draftRef.current
      const current = field === 'seoTitle' ? d.seoTitle : field === 'seoDescription' ? d.seoDescription : field === 'slug' ? d.slug : field === 'excerpt' ? d.excerpt : d.title
      return {
        keyword: d.keyword ?? '',
        articleType: articleTypeOf(d.keyword, d.title),
        secondary: Array.from(new Set([...highlightedRef.current, ...extraSecondaryRef.current.map((e) => e.keyword)])).slice(0, 20),
        title: d.title,
        excerpt: d.excerpt,
        content: d.content,
        ...(current.trim() ? { current: current.trim() } : {}),
      }
    }
    return { seoTitle: base('seoTitle'), seoDescription: base('seoDescription'), slug: base('slug'), excerpt: base('excerpt') }
  }, [articleTypeOf])
  const suggestSeoTitle = useSuggest({ field: 'seoTitle', getRequest: requestFor.seoTitle, onUse: (text) => patch({ seoTitle: text }), disabledReason: suggestReason })
  const suggestSeoDescription = useSuggest({ field: 'seoDescription', getRequest: requestFor.seoDescription, onUse: (text) => patch({ seoDescription: text }), disabledReason: suggestReason })
  const suggestSlug = useSuggest({
    field: 'slug',
    getRequest: requestFor.slug,
    onUse: (text) => {
      setSlugTouched(true)
      setSlugError(null)
      patch({ slug: text })
    },
    disabledReason: suggestReason,
  })
  const suggestExcerpt = useSuggest({ field: 'excerpt', getRequest: requestFor.excerpt, onUse: (text) => patch({ excerpt: text }), disabledReason: suggestReason })

  /* ---------------------------------------------------------------- */
  /* Images                                                            */
  /* ---------------------------------------------------------------- */

  const studio = useImageStudio({ title: draft.title, keyword: draft.keyword })

  /* ---------------------------------------------------------------- */
  /* Maillage interne                                                  */
  /* ---------------------------------------------------------------- */

  // Les liens posés passent par le même chemin qu'une modification du texte : l'éditeur recharge le texte, Ctrl+Z revient
  const autoLinks = useAutoLinks({
    getArticle: () => ({ markdown: draftRef.current.content, title: draftRef.current.title, keyword: draftRef.current.keyword, slug: draftRef.current.slug }),
    onApply: (markdown) => patch({ content: markdown }),
  })

  /* ---------------------------------------------------------------- */
  /* Liste de contrôle → champ                                         */
  /* ---------------------------------------------------------------- */

  const focusTarget = useCallback((target: FocusTarget) => {
    setTab(tabOfTarget(target))
    // Deux images : l'onglet voulu est affiché avant la mesure
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const wrap = document.querySelector<HTMLElement>(`[data-focus-target="${target}"]`)
        if (!wrap) return
        const behavior: ScrollBehavior = reducedMotion() ? 'auto' : 'smooth'
        if (target === 'content') {
          editorRef.current?.focus()
          wrap.scrollIntoView({ block: 'start', behavior })
          return
        }
        wrap.scrollIntoView({ block: 'center', behavior })
        const field =
          target === 'publication'
            ? wrap.querySelector<HTMLElement>('#blog-pub-heure') ?? wrap.querySelector<HTMLElement>("[aria-pressed='true']")
            : document.getElementById(FOCUS_IDS[target])
        field?.focus({ preventScroll: true })
        flashElement(wrap)
      }),
    )
  }, [])

  const changeTab = useCallback((next: EditorTab) => {
    setTab(next)
    // Panneau changé alors que la page avait défilé : retour en haut des panneaux, sous les onglets
    requestAnimationFrame(() => {
      const anchor = tabsAnchorRef.current
      if (!anchor) return
      const sticky = window.matchMedia('(min-width: 1024px)').matches ? 80 : 8
      if (anchor.getBoundingClientRect().top < sticky) anchor.scrollIntoView({ block: 'start' })
    })
  }, [])

  const goToHeading = useCallback((index: number) => {
    setTab('redaction')
    requestAnimationFrame(() => requestAnimationFrame(() => editorRef.current?.scrollToHeading(index)))
  }, [])

  /* ---------------------------------------------------------------- */
  /* Brouillon local, sortie de page, glisser-déposer                  */
  /* ---------------------------------------------------------------- */

  const [savedAtMs] = useState<number | null>(() => {
    const value = editing ? post?.updated_at ?? post?.created_at ?? null : null
    const t = value ? Date.parse(value) : Number.NaN
    return Number.isNaN(t) ? null : t
  })
  const local = useLocalDraft({ id, draft, saved, savedAt: savedAtMs, dirty })

  // Éditeur qui vient de créer l'article : sa vue (défilement, curseur) est relevée au démontage…
  useIsoLayoutEffect(
    () => () => noteCreationHandoffView(idRef.current, () => captureEditorView(rootRef.current, editorRef.current)),
    [],
  )
  // … et rendue par l'éditeur de la page de l'article, une fois la zone d'écriture prête
  const carriedView = useRef<ViewMemo | null | undefined>(undefined)
  useEffect(() => {
    if (!carried) return
    if (carriedView.current === undefined) carriedView.current = takeCreationHandoff(carried.id)?.view ?? null
    const view = carriedView.current
    if (!view) return
    let frame = 0
    let tries = 0
    const attempt = () => {
      if (restoreEditorView(view, editorRef.current) || ++tries > 180) {
        carriedView.current = null
        return
      }
      frame = requestAnimationFrame(attempt)
    }
    frame = requestAnimationFrame(attempt)
    return () => cancelAnimationFrame(frame)
  }, [carried])

  // Heure des Préférences connue après coup (lecture de la page en échec) : elle remplace 08:00
  // pour une programmation à venir, sans toucher à une programmation déjà choisie
  const lateTime = publishTime ? null : seo.data?.prefs.publishTime ?? null
  const lateTimeApplied = useRef(false)
  useEffect(() => {
    if (!lateTime || lateTimeApplied.current) return
    lateTimeApplied.current = true
    const withTime = (d: ArticleDraft): ArticleDraft =>
      d.publication.mode === 'schedule' || d.publication.time === lateTime ? d : { ...d, publication: { ...d.publication, time: lateTime } }
    setDraft(withTime)
    setSaved(withTime)
  }, [lateTime])

  const restoreLocal = () => {
    if (!local.offer) return
    // Publication gardée : jour demandé par le calendrier, ou publication changée sur le serveur
    // depuis la copie (publiée à l'heure prévue entre-temps)
    const keep = editing ? publicationMovedSince(local.offer, savedRef.current) : Boolean(initialSchedule)
    const next = restoreDraft(local.offer, draftRef.current, keep)
    setDraft(next)
    setSlugTouched(editing || next.slug !== slugify(next.title))
    setRestored(true)
    local.accept()
    toast.success('Version de cet appareil restaurée : enregistrez-la pour la garder.')
  }

  const dirtyRef = useRef(dirty)
  dirtyRef.current = dirty
  const requestLeave = useCallback(
    (href: string) => {
      if (dirtyRef.current) setLeaveHref(href)
      else router.push(href)
    },
    [router],
  )

  useLeaveGuard({ when: dirty && !deleting, onAttempt: (href) => setLeaveHref(href) })

  usePageDropGuard(() => {
    toast("Image non insérée : déposez-la sur la couverture, ou utilisez le bouton « Image » de la barre d'outils.")
  })

  /* ---------------------------------------------------------------- */
  /* Enregistrement                                                    */
  /* ---------------------------------------------------------------- */

  const saveFnRef = useRef<(opts?: { then?: string | null; confirmed?: boolean; quiet?: boolean }) => Promise<void>>()

  /**
   * Publication de l'article déjà enregistré, depuis les bandeaux : sans `force`, le contrôle s'applique
   * et ses passages s'affichent (avec « Corriger avec l'IA ») ; avec `force`, l'admin les a relus et publie.
   */
  const [forceOpen, setForceOpen] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const publishChecked = useCallback(
    async (force: boolean) => {
      const articleId = idRef.current
      if (!articleId || savingRef.current) return
      setForceOpen(false)
      setPublishing(true)
      // Ce qui est tapé et pas encore enregistré part d'abord : la mise en ligne publie le texte affiché
      if (isDirty(draftRef.current, savedRef.current)) {
        await saveFnRef.current?.({ quiet: true })
        while (savingRef.current) await new Promise((r) => setTimeout(r, 50))
      }
      const { status, json } = await sendJson('PATCH', `/api/admin/blog/${articleId}`, force ? { is_published: true, force_publish: true } : { is_published: true })
      setPublishing(false)
      if (status === 200) {
        const now = new Date().toISOString()
        setMeta((m) => ({ ...m, isPublished: true, publishedAt: m.publishedAt ?? now, scheduledAt: null, heldReason: null }))
        metaRef.current = { ...metaRef.current, isPublished: true, publishedAt: metaRef.current.publishedAt ?? now, scheduledAt: null, heldReason: null }
        setBlocked(null)
        toast.success(force ? 'Article publié, sans attendre le contrôle.' : 'Article publié.')
        router.refresh()
        return
      }
      if (status === 409 && json?.code === 'check_failed') {
        const issues = issuesOf(json)
        foundIssues.current = new Set(issues.filter((i) => issueFieldIn(draftRef.current, i)).map(issueKey))
        setBlocked({ issues, unscheduled: false })
        setTab('redaction')
        requestAnimationFrame(() => document.getElementById('editeur-alertes')?.scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' }))
        return
      }
      toast.error(typeof json?.error === 'string' ? json.error : 'La publication a échoué. Réessayez dans un instant.')
    },
    [router, setTab],
  )

  const save = useCallback(
    async (opts?: { then?: string | null; confirmed?: boolean; quiet?: boolean }) => {
      if (deletingRef.current) return
      if (savingRef.current) {
        // Un envoi est en cours : un autre suivra, avec ce qui aura été tapé entre-temps
        if (!opts?.then) queuedRef.current = true
        return
      }
      savingRef.current = true
      const then = opts?.then ?? null
      const done = () => {
        savingRef.current = false
        setSaving(false)
      }

      await commitFieldBeingEdited()
      const current = draftRef.current
      const articleId = idRef.current
      const creating = !articleId

      // Heure proposée par l'éditeur (celle des Préférences est passée) : confirmée avant de programmer
      const pending = proposalRef.current
      if (pending && !opts?.confirmed && current.publication.mode === 'schedule' && current.publication.day === pending.day && current.publication.time === pending.time) {
        done()
        queuedRef.current = false
        setScheduleCheck({ then })
        return
      }

      const request = buildSaveRequest({ mode: creating ? 'create' : 'edit', id: articleId, current, saved: creating ? null : savedRef.current, meta: metaRef.current })
      if (request.kind === 'nothing') {
        done()
        queuedRef.current = false
        if (!opts?.quiet) toast('Rien à enregistrer : tout est à jour.')
        if (then) router.push(then)
        return
      }
      if (request.kind === 'invalid') {
        done()
        queuedRef.current = false
        toast.error(request.error)
        if (request.target === 'slug') setSlugError(request.error)
        focusTarget(request.target)
        return
      }

      setSaving(true)
      const { status, json } = await sendJson(request.method, request.url, request.body)
      done()
      const message = typeof json?.error === 'string' ? json.error : null
      const queued = queuedRef.current
      queuedRef.current = false

      if (status === 200 || status === 201) {
        const now = new Date()
        const storedSlug = typeof json?.slug === 'string' ? json.slug : typeof request.body.slug === 'string' ? request.body.slug : normalSlug(current.slug)
        const nextSaved: ArticleDraft = { ...current, slug: storedSlug }
        const nextMeta = metaAfterSave(metaRef.current, request.change, request.scheduledAt, now)
        savedRef.current = nextSaved
        metaRef.current = nextMeta
        proposalRef.current = null
        setSaved(nextSaved)
        setMeta(nextMeta)
        setLastSaveAt(now.toISOString())
        setRestored(false)
        setBlocked(null)
        setSlugError(null)
        setProposal(null)
        // Adresse mise au propre par le serveur : le champ la montre, si rien n'a été retapé entre-temps
        setDraft((d) => (d.slug === current.slug && d.slug !== storedSlug ? { ...d, slug: storedSlug } : d))
        local.clear()
        toast.success(successMessage({ created: creating, change: request.change, scheduledAt: request.scheduledAt, now }))
        if (creating && typeof json?.id === 'string') {
          const newId = json.id
          idRef.current = newId
          setId(newId)
          // Les mots-clés secondaires ajoutés avant la création suivent l'article
          if (extraSecondaryRef.current.length > 0) writeExtraSecondary(newId, extraSecondaryRef.current)
          // Page quittée pendant l'envoi (« Quitter » sans enregistrer) : on n'y ramène pas
          if (!mountedRef.current) return
          // On reste dans l'éditeur : la page devient celle de l'article (nouvel éditeur, relais ci-dessous)
          offerCreationHandoff(
            then
              ? null
              : {
                  id: newId,
                  saved: nextSaved,
                  latest: () => draftRef.current,
                  tab: tabRef.current,
                  highlighted: highlightedRef.current,
                  extraSecondary: extraSecondaryRef.current,
                  lastSaveAt: now.toISOString(),
                  fromCalendar: !editing && Boolean(initialSchedule),
                  editorMode: rootRef.current?.querySelector('.q-editor')?.getAttribute('data-mode') === 'markdown' ? 'markdown' : 'visual',
                  view: null,
                  at: Date.now(),
                },
          )
          router.replace(`/admin/blog/${newId}`)
          if (then) router.push(then)
          return
        }
        // Tapé pendant l'envoi : la copie de l'appareil garde ce qui n'est pas encore enregistré
        if (isDirty(draftRef.current, nextSaved)) local.flush(nextSaved)
        if (then) {
          router.push(then)
          return
        }
        router.refresh()
        if (queued) window.setTimeout(() => void saveFnRef.current?.({ quiet: true }), 0)
        return
      }

      if (status === 409 && json?.code === 'check_failed' && creating) {
        // Création publiée refusée par le contrôle : rien n'est créé, le texte reste dans l'éditeur (et sur l'appareil)
        local.flush()
        const issues = issuesOf(json)
        foundIssues.current = new Set(issues.filter((i) => issueFieldIn(draftRef.current, i)).map(issueKey))
        setBlocked({ issues, unscheduled: false, notCreated: true })
        setTab('redaction')
        toast.error("Publication refusée : l'article n'est pas encore enregistré. Corrigez les passages signalés, ou enregistrez-le en brouillon.")
        requestAnimationFrame(() => document.getElementById('editeur-alertes')?.scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' }))
        return
      }

      if (status === 409 && json?.code === 'check_failed') {
        // Le serveur a enregistré les modifications, sans la mise en ligne (programmation retirée)
        const wasScheduled = Boolean(metaRef.current.scheduledAt) && Date.parse(metaRef.current.scheduledAt ?? '') > Date.now()
        const nextSaved: ArticleDraft = { ...current, slug: typeof request.body.slug === 'string' ? request.body.slug : current.slug, publication: { ...current.publication, mode: 'draft' } }
        savedRef.current = nextSaved
        metaRef.current = { ...metaRef.current, isPublished: false, scheduledAt: null }
        setSaved(nextSaved)
        setMeta((m) => ({ ...m, isPublished: false, scheduledAt: null }))
        setLastSaveAt(new Date().toISOString())
        setRestored(false)
        local.clear()
        // Tapé pendant l'envoi : gardé sur l'appareil (pas la seule demande de mise en ligne, refusée)
        if (changedFields(draftRef.current, nextSaved).some((f) => f !== 'publication')) local.flush(nextSaved)
        const issues = issuesOf(json)
        foundIssues.current = new Set(issues.filter((i) => issueFieldIn(draftRef.current, i)).map(issueKey))
        setBlocked({ issues, unscheduled: wasScheduled })
        setTab('redaction')
        toast.error('Publication refusée : les modifications sont enregistrées, corrigez les passages signalés.')
        requestAnimationFrame(() => document.getElementById('editeur-alertes')?.scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' }))
        router.refresh()
        return
      }

      if (status === 0) {
        toast.error("Connexion impossible : l'article n'est pas enregistré. Une copie reste sur cet appareil ; réessayez dans un instant.")
        local.flush()
        return
      }
      if (status === 401 || status === 403) {
        toast.error("Session expirée : reconnectez-vous (une copie de l'article reste sur cet appareil).")
        local.flush()
        return
      }
      const text = message ?? (status === 503 ? 'Enregistrement indisponible pour le moment. Réessayez dans un instant.' : "L'enregistrement a échoué. Réessayez dans un instant.")
      toast.error(text)
      // Rien d'enregistré : la copie de l'appareil est écrite tout de suite
      local.flush()
      if (status === 400 || status === 409) {
        const target = targetOfError(text)
        if (target === 'slug') setSlugError(text)
        if (target) focusTarget(target)
      }
    },
    [editing, initialSchedule, focusTarget, local, router],
  )
  saveFnRef.current = save

  useSaveShortcut(() => void save())

  /* ---------------------------------------------------------------- */
  /* Autres actions                                                    */
  /* ---------------------------------------------------------------- */

  const remove = async () => {
    const articleId = idRef.current
    if (!articleId || deletingRef.current) return
    deletingRef.current = true
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/blog/${articleId}`, { method: 'DELETE', cache: 'no-store' })
      if (!res.ok) throw new Error()
      setSaved(draftRef.current)
      // Plus aucune copie sur l'appareil d'un article qui n'existe plus
      local.stop()
      setConfirmDelete(false)
      toast.success('Article supprimé')
      router.push('/admin/blog')
      router.refresh()
    } catch {
      toast.error("Impossible de supprimer l'article. Réessayez dans un instant.")
      deletingRef.current = false
      setDeleting(false)
    }
  }

  const regenerate = async () => {
    if (!post || regenerating) return
    setRegenerating(true)
    const toastId = toast.loading("Rédaction d'un nouvel article par l'IA… Cet article reste tel quel.")
    const res = await api<{ post?: { id: string; title: string } }>('/api/admin/blog/generate', 'POST', { topic: draftRef.current.title, keywords: post.ai_keywords ?? [] })
    setRegenerating(false)
    const created = res.data?.post
    if (!res.ok || !created) {
      toast.error(res.error ?? 'La génération a échoué. Réessayez dans un instant.', { id: toastId })
      return
    }
    toast.success(`Nouvel article généré : « ${created.title} »`, {
      id: toastId,
      duration: 12_000,
      // Page quittée entre-temps : plus de confirmation à demander
      action: { label: 'Ouvrir', onClick: () => (mountedRef.current ? requestLeave(`/admin/blog/${created.id}`) : router.push(`/admin/blog/${created.id}`)) },
    })
  }

  /* ---------------------------------------------------------------- */
  /* Changements de champs                                             */
  /* ---------------------------------------------------------------- */

  const onTitleChange = useCallback((title: string) => {
    setDraft((d) => ({ ...d, title, slug: slugTouchedRef.current ? d.slug : slugify(title) }))
  }, [])
  const onExcerptChange = useCallback((excerpt: string) => patch({ excerpt }), [patch])
  const onContentChange = useCallback((content: string) => patch({ content }), [patch])
  const onCoverChange = useCallback((next: { url: string; alt: string }) => patch({ coverUrl: next.url, coverAlt: next.alt }), [patch])
  const onPublicationChange = useCallback((publication: PublicationValue) => {
    setProposal(null)
    patch({ publication })
  }, [patch])
  const onSlugChange = useCallback(
    (slug: string) => {
      setSlugTouched(true)
      setSlugError(null)
      patch({ slug })
    },
    [patch],
  )

  /* ---------------------------------------------------------------- */
  /* Passages refusés par le contrôle : aller au passage, corriger     */
  /* ---------------------------------------------------------------- */

  /** Champ qui porte encore l'extrait refusé (le texte d'abord) ; null : il n'est plus nulle part, donc corrigé. */
  const issueFieldOf = useCallback((issue: BlockingIssue): IssueField | null => issueFieldIn(draftRef.current, issue), [])
  // « Corrigé » seulement pour un passage qui était dans le texte à l'affichage de la bannière (un extrait tiré
  // d'ailleurs, mots-clés de l'article par exemple, ne devient pas « corrigé » faute d'être retrouvé)
  const isIssueCorrected = useCallback((issue: BlockingIssue) => foundIssues.current.has(issueKey(issue)) && issueFieldOf(issue) === null, [issueFieldOf])

  const issueActions = useMemo<IssueActions>(() => {
    const gone = "Ce passage n'est plus dans le texte : il a sans doute déjà été modifié."
    return {
      reveal: (issue) => {
        const field = issueFieldOf(issue)
        if (!field || !issue.excerpt) return false
        if (field === 'content') {
          const excerpt = issue.excerpt
          setTab('redaction')
          // Deux images : l'onglet Rédaction est affiché avant la mesure (téléphone)
          requestAnimationFrame(() => requestAnimationFrame(() => editorRef.current?.revealPassage(excerpt)))
        } else {
          focusTarget(ISSUE_TARGETS[field])
        }
        return true
      },
      fix: async (issue): Promise<IssueFixResult> => {
        const field = issueFieldOf(issue)
        const excerpt = issue.excerpt
        if (!field || !excerpt) return { ok: false, error: gone }
        const d = draftRef.current
        let text = ''
        let before: string | undefined
        let after: string | undefined
        if (field === 'content') {
          const info = editorRef.current?.findPassage(excerpt)
          if (!info) return { ok: false, error: editorRef.current ? gone : "L'éditeur n'est pas encore chargé : réessayez dans un instant." }
          if (info.kind === 'other') return { ok: false, error: "Ce passage est dans un tableau ou une citation : corrigez-le à la main (« Aller au passage »)." }
          text = info.markdown
          before = info.before
          after = info.after
        } else {
          text = d[field]
        }
        if (text.length > 4000) return { ok: false, error: 'Ce passage dépasse 4 000 caractères : corrigez-le à la main (« Aller au passage »).' }
        try {
          const res = await fetch('/api/admin/blog/assist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'resolve',
              text,
              issue: { label: issue.label.slice(0, 200), detail: issue.detail ? issue.detail.slice(0, 1500) : null },
              excerpt: excerpt.slice(0, 600),
              keyword: d.keyword ? d.keyword.slice(0, 120) : null,
              title: d.title.trim().slice(0, 200) || undefined,
              before,
              after,
            }),
            cache: 'no-store',
          })
          const json = (await res.json().catch(() => null)) as (AssistResponse & { error?: string }) | null
          if (!res.ok || !json || typeof json.text !== 'string') {
            return {
              ok: false,
              error:
                json?.error ??
                (res.status === 401 ? 'Session expirée : reconnectez-vous.' : res.status === 503 ? "La correction par l'IA n'est pas disponible pour le moment." : "La correction n'a pas pu être proposée. Réessayez dans un instant."),
            }
          }
          return { ok: true, text: json.text, warnings: Array.isArray(json.warnings) ? json.warnings : [] }
        } catch {
          return { ok: false, error: 'Connexion impossible. Vérifiez votre réseau puis réessayez.' }
        }
      },
      apply: (issue, text) => {
        const field = issueFieldOf(issue)
        if (!field || !issue.excerpt) return false
        if (field === 'content') {
          const result = editorRef.current?.replacePassages([{ excerpt: issue.excerpt, text }])
          return result?.applied === 1
        }
        const line = text.replace(/\s+/g, ' ').trim()
        if (!line) return false
        if (field === 'title') onTitleChange(line)
        else patch({ [field]: field === 'coverAlt' ? line.slice(0, 180) : line } as Partial<ArticleDraft>)
        return true
      },
    }
  }, [issueFieldOf, focusTarget, onTitleChange, patch])

  /* ---------------------------------------------------------------- */
  /* Mot-clé à placer dans le texte avec l'IA                          */
  /* ---------------------------------------------------------------- */

  const getFitArticle = useCallback(() => ({ markdown: draftRef.current.content, title: draftRef.current.title, mainKeyword: draftRef.current.keyword }), [])
  const applyFit = useCallback(
    (edits: PassageEdit[]) => {
      // L'éditeur remplace les passages d'un coup (un seul pas d'annulation) ; absent, le texte est réécrit ici
      if (editorRef.current) return editorRef.current.replacePassages(edits)
      const result = applyPassageEdits(draftRef.current.content, edits)
      if (result.applied > 0) patch({ content: result.markdown })
      return { applied: result.applied, missed: result.missed }
    },
    [patch],
  )
  const closeFit = useCallback(() => setFit(null), [])

  const updateExtraSecondary = useCallback((next: ExtraSecondary[]) => {
    extraSecondaryRef.current = next
    setExtraSecondary(next)
    if (idRef.current) writeExtraSecondary(idRef.current, next)
  }, [])
  /** Proposition IA › « Ajouter aux secondaires » : le mot-clé rejoint la liste, une seule fois. */
  const addExtraSecondary = useCallback(
    (idea: { keyword: string; volume: number | null }) => {
      const list = extraSecondaryRef.current
      const key = keywordKey(idea.keyword)
      if (!key || list.some((e) => keywordKey(e.keyword) === key) || list.length >= EXTRA_SECONDARY_MAX) return
      updateExtraSecondary([...list, { keyword: idea.keyword, volume: idea.volume }])
    },
    [updateExtraSecondary],
  )
  const removeExtraSecondary = useCallback(
    (keyword: string) => {
      const key = keywordKey(keyword)
      const list = extraSecondaryRef.current
      if (list.some((e) => keywordKey(e.keyword) === key)) updateExtraSecondary(list.filter((e) => keywordKey(e.keyword) !== key))
    },
    [updateExtraSecondary],
  )
  // Article déjà créé, ouvert sans relais : la liste gardée sur l'appareil est reprise (une fois, après l'affichage)
  useEffect(() => {
    if (carried || !idRef.current) return
    const stored = readExtraSecondary(idRef.current)
    if (stored.length > 0) updateExtraSecondary(stored)
    // Au montage seulement
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Bouton « avec l'IA » sous une ligne à corriger de la liste de contrôle. */
  const scoreActionFor: CheckActionFor = (check) => {
    const keyword = draft.keyword?.trim()
    if (!keyword) return null
    switch (check.id) {
      case 'kw-title':
      case 'kw-title-start':
        return {
          label: 'Proposer un titre avec le mot-clé',
          busy: suggestSeoTitle.status === 'loading',
          onClick: () => {
            focusTarget('seoTitle')
            suggestSeoTitle.run()
          },
        }
      case 'kw-description':
        return {
          label: 'Proposer une description avec le mot-clé',
          busy: suggestSeoDescription.status === 'loading',
          onClick: () => {
            focusTarget('seoDescription')
            suggestSeoDescription.run()
          },
        }
      case 'kw-slug':
        return {
          label: 'Proposer une adresse avec le mot-clé',
          busy: suggestSlug.status === 'loading',
          onClick: () => {
            focusTarget('slug')
            suggestSlug.run()
          },
        }
      case 'kw-intro':
        return { label: "Mettre le mot-clé dans l'introduction", onClick: () => setFit({ mode: 'intro', keyword }) }
      case 'kw-heading':
        return { label: 'Mettre le mot-clé dans un sous-titre', onClick: () => setFit({ mode: 'heading', keyword }) }
      case 'kw-density':
        // Trop répété : rien à ajouter
        return check.detail?.includes('trop souvent') ? null : { label: 'Placer le mot-clé dans le texte', onClick: () => setFit({ mode: 'secondary', keyword }) }
      default:
        return null
    }
  }

  /* ---------------------------------------------------------------- */
  /* Rendu                                                             */
  /* ---------------------------------------------------------------- */

  const status = id ? statusOfMeta(meta) : null
  const saveState: SaveState = saving
    ? { kind: 'saving' }
    : blocked && changes.length === 1 && publicationChanged
      ? { kind: 'blocked' }
      : dirty
        ? { kind: 'dirty', restored }
        : lastSaveAt
          ? { kind: 'saved', at: lastSaveAt }
          : { kind: 'clean', updatedAt: editing ? post?.updated_at ?? post?.created_at ?? null : null, isNew: !id }

  // Article retenu par la tâche planifiée (lib/seo/articles/publish.ts) : la raison, tant qu'il n'est pas en ligne
  const heldReason = !meta.isPublished && meta.heldReason?.trim() ? meta.heldReason.trim().replace(/([^.!?…])$/, '$1.') : null
  const fromCalendar = carried?.fromCalendar ?? (!editing && Boolean(initialSchedule))
  const backHref = fromCalendar ? '/admin/seo/articles' : '/admin/blog'
  const backLabel = fromCalendar ? 'Calendrier' : 'Blog'
  const liveHref = meta.isPublished && saved.slug ? `/blog/${saved.slug}` : null
  const tone = scoreTone(analysis.score)
  const serpDate = meta.isPublished ? meta.publishedAt : draft.publication.mode === 'schedule' ? draft.publication.day : null
  const saveLabel = saveActionLabel(draft.publication.mode, meta, !id || publicationChanged)
  const fromTitle = slugify(draft.title)

  const proposalText = proposal
    ? proposal.adjusted === 'later_today'
      ? (
          <>
            L&apos;heure habituelle de publication (<strong className="q-num font-semibold tabular-nums">{proposal.preferred}</strong>) est passée pour aujourd&apos;hui. Heure
            proposée : <strong className="font-semibold">aujourd&apos;hui à <span className="q-num tabular-nums">{proposal.time}</span></strong> (heure de Paris).
          </>
        )
      : (
          <>
            Plus aucune heure de publication possible aujourd&apos;hui. Publication proposée{' '}
            <strong className="font-semibold">
              {relativeDay(proposal.day)} à <span className="q-num tabular-nums">{proposal.time}</span>
            </strong>{' '}
            (heure de Paris).
          </>
        )
    : null

  return (
    <div ref={rootRef} className="flex w-full min-w-0 flex-col gap-5 [--q-editor-top:62px] lg:[--q-editor-top-lg:134px] xl:[--q-editor-top-lg:80px]">
      <EditorHeader
        title={id ? "Modifier l'article" : 'Nouvel article'}
        backHref={backHref}
        backLabel={backLabel}
        status={status}
        aiGenerated={Boolean(post?.ai_generated)}
        saveState={saveState}
        saving={saving}
        onSave={() => void save()}
        viewHref={liveHref}
        onRegenerate={id && post?.ai_generated ? () => void regenerate() : undefined}
        regenerating={regenerating}
        onDelete={id ? () => setConfirmDelete(true) : undefined}
      />

      <div ref={tabsAnchorRef} className="-mb-5 scroll-mt-2 lg:scroll-mt-[80px] xl:hidden" aria-hidden />
      <EditorTabs<EditorTab>
        value={tab}
        onChange={changeTab}
        controls={PANELS}
        tabs={[
          { value: 'redaction', label: 'Rédaction', icon: <PenLine /> },
          { value: 'referencement', label: 'Référencement', icon: <Search />, score: { value: analysis.score, tone, label: `score ${analysis.score} sur 100, ${scoreLabel(analysis.score).toLowerCase()}` } },
          { value: 'publication', label: 'Publication', icon: <Send /> },
        ]}
      />

      <div className="grid min-w-0 grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px] xl:gap-6">
        {/* Rédaction */}
        <div id={PANELS.redaction} className={tab === 'redaction' ? 'flex min-w-0 flex-col gap-4' : 'flex min-w-0 flex-col gap-4 max-xl:hidden'}>
          {(local.offer || blocked || proposal || heldReason) && (
            <div id="editeur-alertes" className="flex scroll-mt-20 flex-col gap-3 lg:scroll-mt-[150px] xl:scroll-mt-[92px]">
              {local.offer && (
                <DraftOfferBanner
                  savedAt={local.offer.savedAt}
                  changes={describeFields(
                    changedFields(local.offer.draft, saved).filter((f) => f !== 'publication' || !editing || !publicationMovedSince(local.offer!, saved)),
                  )}
                  onRestore={restoreLocal}
                  onDismiss={local.dismiss}
                />
              )}
              {blocked && (
                <BlockedBanner
                  issues={blocked.issues}
                  message={
                    blocked.notCreated
                      ? "L'article n'est pas encore enregistré. Corrigez ces passages, puis publiez à nouveau, ou enregistrez-le en brouillon."
                      : blocked.unscheduled
                        ? "Les modifications sont enregistrées, mais l'article n'est pas en ligne et sa programmation est retirée. Corrigez ces passages, puis publiez ou programmez à nouveau."
                        : "Les modifications sont enregistrées, mais l'article n'est pas en ligne. Corrigez ces passages, puis publiez à nouveau, ou publiez quand même si vous les avez relus."
                  }
                  onDismiss={() => setBlocked(null)}
                  onForce={!blocked.notCreated && id ? () => setForceOpen(true) : undefined}
                  actions={issueActions}
                  isCorrected={isIssueCorrected}
                />
              )}
              {heldReason && !blocked && (
                <div role="status" className="q-banner q-banner-warn flex-wrap items-center">
                  <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
                  <div className="flex min-w-0 flex-1 basis-[calc(100%-44px)] flex-col gap-3 md:basis-0">
                    <p className="m-0 text-[14px] leading-snug text-[var(--q-text-2)]">
                      <strong className="font-semibold text-[var(--q-warn)]">Pas publié automatiquement.</strong> À l&apos;heure prévue, le contrôle automatique a gardé cet article
                      en brouillon : {heldReason.replace(/^Retenu par le contrôle\s*:\s*/i, '')} Ce n&apos;est qu&apos;une vérification, vous gardez la main : voyez les passages
                      signalés (l&apos;IA peut les corriger), ou publiez quand même.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" disabled={publishing || !id} onClick={() => void publishChecked(false)} className="q-btn q-btn-secondary q-btn-sm max-md:h-11">
                        {publishing ? 'Vérification…' : 'Voir les passages'}
                      </button>
                      <button type="button" disabled={publishing || !id} onClick={() => setForceOpen(true)} className="q-btn q-btn-primary q-btn-sm max-md:h-11">
                        Publier quand même
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {proposal && proposalText && (
                <ScheduleProposalBanner
                  text={proposalText}
                  confirmLabel={proposal.adjusted === 'later_today' ? `Confirmer ${proposal.time}` : 'Confirmer'}
                  onConfirm={() => {
                    setProposal(null)
                    toast.success(`Publication programmée ${relativeDay(proposal.day)} à ${proposal.time} : elle sera enregistrée avec l'article.`)
                  }}
                  onChange={() => focusTarget('publication')}
                />
              )}
            </div>
          )}

          <DocumentSheet
            title={draft.title}
            excerpt={draft.excerpt}
            content={draft.content}
            coverUrl={draft.coverUrl}
            coverAlt={draft.coverAlt}
            keyword={draft.keyword}
            onTitleChange={onTitleChange}
            onExcerptChange={onExcerptChange}
            onContentChange={onContentChange}
            onCoverChange={onCoverChange}
            onOutline={setHeadings}
            highlightTerms={highlightTerms}
            editorRef={editorRef}
            onRequestImage={studio.requestImage}
            excerptSuggest={suggestExcerpt}
            editorMode={carried?.editorMode}
          />
        </div>

        {/* Référencement et publication */}
        <aside
          id={PANELS.referencement}
          aria-label="Référencement et publication"
          className={[
            'flex min-w-0 flex-col gap-3',
            'xl:sticky xl:top-[84px] xl:-mx-2 xl:-mt-1 xl:max-h-[calc(100dvh-96px)] xl:overflow-y-auto xl:overscroll-contain xl:px-2 xl:pb-4 xl:pt-1',
            '[scrollbar-color:var(--q-field)_transparent] [scrollbar-width:thin]',
            'max-xl:mx-auto max-xl:w-full max-xl:max-w-[680px]',
            tab === 'redaction' ? 'max-xl:hidden' : '',
          ].join(' ')}
        >
          <PublicationCard
            className={tab === 'publication' ? '' : 'max-xl:hidden'}
            value={draft.publication}
            onChange={onPublicationChange}
            isPublished={meta.isPublished}
            publishedAt={meta.publishedAt}
            slug={saved.slug}
            defaultTime={prefTime}
            saving={saving}
            saveLabel={saveLabel}
            onSave={() => void save()}
          />
          <ScoreCard className={tab === 'referencement' ? '' : 'max-xl:hidden'} result={analysis} onFocusTarget={focusTarget} actionFor={scoreActionFor} />
          <KeywordCard
            className={tab === 'referencement' ? '' : 'max-xl:hidden'}
            value={draft.keyword}
            onChange={(keyword) => patch({ keyword })}
            seo={seo}
            slug={draft.slug}
            selfId={id}
            onPropose={() => setIdeasOpen(true)}
            articleTitle={draft.title}
          />
          <LinksCard
            className={tab === 'referencement' ? '' : 'max-xl:hidden'}
            content={deferredDraft.content}
            state={autoLinks.state}
            onRun={() => void autoLinks.run()}
            onUndo={autoLinks.undo}
            onAddRelated={autoLinks.addRelatedBlock}
            onDismiss={autoLinks.dismiss}
          />
          <GoogleCard
            className={tab === 'referencement' ? '' : 'max-xl:hidden'}
            seoTitle={draft.seoTitle}
            seoDescription={draft.seoDescription}
            title={draft.title}
            excerpt={draft.excerpt}
            slug={draft.slug}
            date={serpDate}
            onSeoTitleChange={(seoTitle) => patch({ seoTitle })}
            onSeoDescriptionChange={(seoDescription) => patch({ seoDescription })}
            suggestTitle={suggestSeoTitle}
            suggestDescription={suggestSeoDescription}
          />
          <AddressCard
            className={tab === 'referencement' ? '' : 'max-xl:hidden'}
            slug={draft.slug}
            onSlugChange={onSlugChange}
            fromTitle={fromTitle}
            onRecreate={() => {
              setSlugTouched(!!id)
              setSlugError(null)
              patch({ slug: fromTitle })
            }}
            suggest={suggestSlug}
            error={slugError}
            changedWhileOnline={meta.isPublished && normalSlug(draft.slug) !== normalSlug(saved.slug)}
          />
          <SecondaryCard
            className={tab === 'referencement' ? '' : 'max-xl:hidden'}
            keyword={draft.keyword}
            seo={seo}
            title={draft.title}
            content={deferredDraft.content}
            highlighted={highlighted}
            onHighlightChange={setHighlighted}
            onIntegrate={(keyword) => setFit({ mode: 'secondary', keyword })}
            extra={extraSecondary}
            onRemoveExtra={removeExtraSecondary}
          />
          <OutlineCard className={tab === 'referencement' ? '' : 'max-xl:hidden'} headings={headings} onGo={goToHeading} />
        </aside>
      </div>

      {studio.dialog}

      {/* Intégrer un mot-clé dans le texte avec l'IA */}
      <KeywordFitDialog request={fit} getArticle={getFitArticle} onApply={applyFit} onClose={closeFit} />

      {/* Heure proposée à confirmer */}
      <ConfirmDialog
        open={scheduleCheck !== null}
        onOpenChange={(open) => !open && setScheduleCheck(null)}
        title={proposal ? `Programmer ${relativeDay(proposal.day)} à ${proposal.time} ?` : 'Programmer la publication ?'}
        description={
          proposal ? (
            <>
              L&apos;heure habituelle de publication ({proposal.preferred}) est passée pour aujourd&apos;hui. L&apos;article sera publié {relativeDay(proposal.day)} à{' '}
              {proposal.time} (heure de Paris), après le contrôle.
            </>
          ) : (
            ''
          )
        }
        actions={
          <>
            <button
              type="button"
              className="q-btn q-btn-ghost"
              onClick={() => {
                setScheduleCheck(null)
                focusTarget('publication')
              }}
            >
              Choisir une autre heure
            </button>
            <button
              type="button"
              className="q-btn q-btn-primary"
              onClick={() => {
                const then = scheduleCheck?.then ?? null
                setScheduleCheck(null)
                setProposal(null)
                void save({ then, confirmed: true })
              }}
            >
              <Save aria-hidden />
              {proposal ? `Programmer à ${proposal.time}` : 'Programmer'}
            </button>
          </>
        }
      />

      {/* Publier malgré le contrôle */}
      <ConfirmDialog
        open={forceOpen}
        onOpenChange={setForceOpen}
        title="Publier quand même ?"
        description="Le contrôle a signalé des passages (affirmation interdite, valeur périmée ou concurrent nommé). Si vous les avez relus et que l'article est juste, il sera mis en ligne tout de suite."
        actions={
          <>
            <button type="button" className="q-btn q-btn-ghost" onClick={() => setForceOpen(false)}>
              Annuler
            </button>
            <button type="button" className="q-btn q-btn-primary" onClick={() => void publishChecked(true)}>
              Publier maintenant
            </button>
          </>
        }
      />

      {/* Sortie avec des modifications non enregistrées */}
      <ConfirmDialog
        open={leaveHref !== null}
        onOpenChange={(open) => !open && setLeaveHref(null)}
        title="Quitter sans enregistrer ?"
        description="Vos modifications ne sont pas enregistrées. Une copie reste sur cet appareil : elle vous sera proposée à votre retour."
        actions={
          <>
            <button type="button" className="q-btn q-btn-ghost" onClick={() => setLeaveHref(null)}>
              Rester
            </button>
            <button
              type="button"
              className="q-btn q-btn-secondary"
              onClick={() => {
                const href = leaveHref
                setLeaveHref(null)
                local.flush()
                if (href) router.push(href)
              }}
            >
              <LogOut aria-hidden />
              Quitter
            </button>
            <button
              type="button"
              className="q-btn q-btn-primary"
              disabled={saving}
              onClick={() => {
                const href = leaveHref
                setLeaveHref(null)
                void save({ then: href })
              }}
            >
              <Save aria-hidden />
              Enregistrer et quitter
            </button>
          </>
        }
      />

      {/* Suppression */}
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={(open) => {
          if (!deleting) setConfirmDelete(open)
        }}
        title="Supprimer l'article ?"
        description={
          <>
            L&apos;article « {draft.title.trim() || saved.title.trim() || 'sans titre'} » sera supprimé définitivement{meta.isPublished ? ' et retiré du blog' : ''}. Cette action ne
            peut pas être annulée.
          </>
        }
        actions={
          <>
            <button type="button" onClick={() => setConfirmDelete(false)} disabled={deleting} className="q-btn q-btn-ghost">
              Annuler
            </button>
            <button type="button" onClick={() => void remove()} disabled={deleting} className="q-btn q-btn-danger">
              {deleting ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden /> : <Trash2 aria-hidden />}
              Supprimer
            </button>
          </>
        }
      />

      {/* Proposition IA : requêtes exactes pour cet article */}
      <IdeasDialog
        open={ideasOpen}
        onClose={() => setIdeasOpen(false)}
        mode="article"
        article={
          ideasOpen
            ? { title: draft.title.trim() || saved.title.trim(), content: draft.content, keyword: draft.keyword, articleType: articleTypeOf(draft.keyword, draft.title) }
            : undefined
        }
        onUse={(idea) => {
          patch({ keyword: idea.keyword })
          // Un mot-clé devenu principal ne reste pas dans les secondaires
          removeExtraSecondary(idea.keyword)
          seo.reload()
        }}
        onUseSecondary={addExtraSecondary}
        currentKeyword={draft.keyword}
        currentSecondary={extraSecondary.map((e) => e.keyword)}
      />
    </div>
  )
}
