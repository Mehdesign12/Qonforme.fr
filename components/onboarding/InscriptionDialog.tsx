"use client"

/**
 * Fenêtre « Bienvenue » de l'inscription en deux champs (validée par le
 * fondateur le 06/10/2026, canevas « Inscription en deux champs ») : après
 * l'email et le mot de passe, le tableau de bord l'ouvre pour renseigner
 * l'entreprise, le métier avec le régime de TVA, puis le prénom, et finit sur
 * « Par quoi voulez-vous commencer ? ».
 *
 * - Chaque étape s'enregistre par PATCH /api/onboarding/inscription, puis
 *   `router.refresh()` met à jour la barre latérale et l'en-tête derrière la
 *   fenêtre (lib/onboarding/inscription.ts : étapes, contrôles, messages).
 * - « Passer au tableau de bord » (et Échap) ferme la fenêtre et l'enregistre
 *   (`signup_window_closed`) : le tableau de bord montre alors la tuile
 *   « Terminer votre inscription », qui la rouvre à l'étape restante
 *   (`/dashboard?inscription=reprendre`). Un clic sur le voile ne fait rien.
 * - Ordinateur : carte centrée de 560 px (620 px pour la fin). Téléphone
 *   (< 640 px) : feuille du bas sur toute la hauteur, pied dans le flux.
 *   Voile .q-veil : aucun backdrop-filter sous 768 px (règle iOS de CLAUDE.md).
 * - Accessibilité : role="dialog", aria-modal, titre de l'étape en
 *   aria-labelledby, focus gardé dans la fenêtre, premier champ au focus sur
 *   ordinateur seulement, défilement de la page bloqué.
 * - Démo (`mode="demo"`, /demo/bienvenue) : aucune requête, rien n'est
 *   enregistré ; fermer ramène au tableau de bord de la démo.
 */
import { useCallback, useEffect, useId, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { trackEvent } from "@/lib/meta-pixel"
import { tradeLabel, type TradeId, type VatRegime } from "@/lib/legal/profile"
import {
  mergeSignupDraft,
  type CompanyInput, type InscriptionPatch, type InscriptionStep, type SignupDraft, type SignupDraftPatch, type TradeInput,
} from "@/lib/onboarding/inscription"
import type { SireneCandidate } from "@/lib/utils/sirene"
import { CompanyStep } from "@/components/onboarding/inscription/CompanyStep"
import { TradeStep } from "@/components/onboarding/inscription/TradeStep"
import { NameStep } from "@/components/onboarding/inscription/NameStep"
import { DoneStep } from "@/components/onboarding/inscription/DoneStep"
import {
  displayFirstName, nextView, previousStep, sameCompany, stepProgress,
  type InscriptionCompany, type InscriptionView, type SnapshotRef,
} from "@/components/onboarding/inscription/model"
import { SheetGrip } from "@/components/ui/sheet-grip"

export type { InscriptionCompany }

export interface InscriptionDialogProps {
  mode: "app" | "demo"
  open: boolean
  onClose: () => void
  /** Ouverture juste après l'inscription (`?bienvenue=1`) : « Compte créé » au-dessus du titre. */
  justCreated: boolean
  /** Étape d'ouverture : la première qui reste à faire (pendingInscriptionStep). */
  initialStep: InscriptionStep
  /** Colonne `companies.legal_profile` présente : étape métier et TVA. */
  profileAvailable: boolean
  /** Devis d'essai et rappel disponibles (migration des emails de démarrage appliquée). */
  startAvailable: boolean
  email: string
  firstName: string
  company: InscriptionCompany | null
  trade: TradeId | null
  vatRegime: VatRegime | null
  /** Saisies non validées gardées à la dernière fermeture (`user_metadata.signup_draft`) : reprises dans les champs. */
  draft?: SignupDraft | null
}

const PATCH_URL = "/api/onboarding/inscription"

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

type PatchResult = { ok: true; json: Record<string, unknown> } | { ok: false; error: string }

/** Fenêtre montée seulement quand elle est ouverte : chaque ouverture repart des données de la page. */
export function InscriptionDialog(props: InscriptionDialogProps) {
  if (!props.open) return null
  return <InscriptionWindow {...props} />
}

export default InscriptionDialog

function InscriptionWindow({
  mode, onClose, justCreated, initialStep, profileAvailable: profileAtOpen, startAvailable,
  firstName: initialFirstName, company: initialCompany, trade: initialTrade, vatRegime: initialVat,
  draft: initialDraft = null,
}: InscriptionDialogProps) {
  const router = useRouter()
  const titleId = useId()
  const panelRef = useRef<HTMLElement>(null)
  const closingRef = useRef(false)
  // Saisies non validées : le brouillon de la page, tenu à jour à chaque étape validée, et ce que l'étape affichée enregistre à la fermeture
  const draftRef = useRef<SignupDraft | null>(initialDraft)
  const snapshotRef: SnapshotRef = useRef(null)

  const [mounted, setMounted] = useState(false)
  const [view, setView] = useState<InscriptionView>(initialStep)
  const viewRef = useRef<InscriptionView>(initialStep)
  viewRef.current = view
  const [company, setCompany] = useState<InscriptionCompany | null>(initialCompany)
  const [picked, setPicked] = useState<SireneCandidate | null>(null)
  const [trade, setTrade] = useState<TradeId | null>(initialTrade)
  const [vatRegime, setVatRegime] = useState<VatRegime | null>(initialVat)
  const [firstName, setFirstName] = useState(initialFirstName.trim())
  // Enregistrements en arrière-plan : l'étape suivante s'affiche tout de suite, les envois partent dans l'ordre
  const queueRef = useRef<Promise<void>>(Promise.resolve())
  const failedStepRef = useRef<InscriptionStep | null>(null)
  const [stepError, setStepError] = useState<{ step: InscriptionStep; message: string } | null>(null)
  // Colonne du profil légal : la route la confirme à l'étape entreprise (sans elle, pas d'étape métier)
  const [profileAvailable, setProfileAvailable] = useState(profileAtOpen)
  // « Compte créé » : seulement au premier affichage de l'étape entreprise
  const [created, setCreated] = useState(justCreated && initialStep === "company")

  useEffect(() => setMounted(true), [])

  // Défilement de la page bloqué tant que la fenêtre est ouverte ; focus rendu en partant
  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    const previous = { html: html.style.overflow, body: body.style.overflow }
    const focused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    html.style.overflow = "hidden"
    body.style.overflow = "hidden"
    return () => {
      html.style.overflow = previous.html
      body.style.overflow = previous.body
      if (focused && document.contains(focused)) focused.focus({ preventScroll: true })
    }
  }, [])

  /** Enregistre une étape (rien en démo), puis rafraîchit la page derrière la fenêtre (sauf `refresh: false`). */
  const send = useCallback(async (body: InscriptionPatch, refresh = true): Promise<PatchResult> => {
    if (mode === "demo") return { ok: true, json: {} }
    try {
      const res = await fetch(PATCH_URL, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => ({}))
      if (res.status === 401) return { ok: false, error: "Votre session a expiré\u00a0: reconnectez-vous pour continuer." }
      if (!res.ok) {
        return {
          ok: false,
          error: typeof json?.error === "string" && json.error ? json.error : "L'enregistrement n'a pas abouti. Réessayez.",
        }
      }
      if (refresh) router.refresh()
      return { ok: true, json: json && typeof json === "object" ? json : {} }
    } catch {
      return { ok: false, error: "Erreur réseau\u00a0: vérifiez votre connexion, puis réessayez." }
    }
  }, [mode, router])

  /**
   * « Passer au tableau de bord », Échap, glisser vers le bas, « Explorer le
   * tableau de bord » : ferme tout de suite, puis enregistre. L'étape affichée
   * s'enregistre si elle est complète, sinon ses saisies partent en brouillon
   * (`signup_draft`) et la tuile « Terminer votre inscription » les reprend ;
   * ensuite la fermeture est enregistrée et le tableau de bord rechargé sans
   * `?bienvenue` ni `?inscription`.
   */
  const close = useCallback(() => {
    if (closingRef.current) return
    closingRef.current = true
    const snapshot = snapshotRef.current?.() ?? null
    onClose()
    if (mode === "demo") {
      // Comme le vrai : la fenêtre se ferme sur le tableau de bord du compte
      // neuf, avec la tuile « Terminer votre inscription » pour la rouvrir
      router.replace("/demo/bienvenue?ferme=1", { scroll: false })
      return
    }
    void (async () => {
      // Les enregistrements déjà partis finissent d'abord : la fermeture vient après, dans l'ordre
      await queueRef.current
      let draft = mergeSignupDraft(draftRef.current, snapshot?.draft ?? {})
      if (snapshot?.save) {
        if (failedStepRef.current) {
          if (snapshot.ifSaveFails) draft = mergeSignupDraft(draft, snapshot.ifSaveFails)
        } else {
          const saved = await send(snapshot.save, false)
          if (!saved.ok && snapshot.ifSaveFails) draft = mergeSignupDraft(draft, snapshot.ifSaveFails)
        }
      }
      const body: InscriptionPatch = { step: "close", draft }
      try {
        await fetch(PATCH_URL, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          keepalive: true,
        })
      } catch {
        // La fermeture se rejouera : la tuile reste affichée
      }
      const url = new URL(window.location.href)
      const hadParams = url.searchParams.has("bienvenue") || url.searchParams.has("inscription")
      url.searchParams.delete("bienvenue")
      url.searchParams.delete("inscription")
      if (hadParams) router.replace(`${url.pathname}${url.search}`, { scroll: false })
      else router.refresh()
    })()
  }, [mode, onClose, router, send])

  // Échap = « Passer au tableau de bord » ; le focus ne quitte pas la fenêtre
  useEffect(() => {
    if (!mounted) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      e.preventDefault()
      close()
    }
    const onFocusIn = (e: FocusEvent) => {
      const panel = panelRef.current
      if (panel && e.target instanceof Node && !panel.contains(e.target)) {
        panel.querySelector<HTMLElement>("[data-dialog-title]")?.focus({ preventScroll: true })
      }
    }
    document.addEventListener("keydown", onKey)
    document.addEventListener("focusin", onFocusIn)
    return () => {
      document.removeEventListener("keydown", onKey)
      document.removeEventListener("focusin", onFocusIn)
    }
  }, [mounted, close])

  // Tab et Maj+Tab tournent dans la fenêtre
  const trapTab = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key !== "Tab") return
    const panel = panelRef.current
    if (!panel) return
    const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.getClientRects().length > 0)
    if (!items.length) return
    const first = items[0]
    const last = items[items.length - 1]
    const active = document.activeElement
    if (e.shiftKey && (active === first || !panel.contains(active))) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && active === last) {
      e.preventDefault()
      first.focus()
    }
  }

  const goTo = (next: InscriptionView) => {
    if (next !== "company") setCreated(false)
    setStepError(null)
    setView(next)
  }

  /**
   * Enregistre une étape en arrière-plan, dans l'ordre. En cas d'échec (réseau,
   * session), la fenêtre revient à cette étape avec le message, les saisies
   * reprises du brouillon (`keep`) ; les étapes suivantes ne s'enregistrent pas
   * dans le désordre : leurs saisies restent aussi en brouillon.
   */
  const saveInBackground = (
    patch: Exclude<InscriptionPatch, { step: "close" }>,
    { keep, onOk, onFail }: {
      keep: SignupDraftPatch
      onOk?: (json: Record<string, unknown>) => void
      onFail: (message: string) => void
    },
  ) => {
    const step = patch.step
    if (failedStepRef.current === step) failedStepRef.current = null
    queueRef.current = queueRef.current.then(async () => {
      if (failedStepRef.current) {
        draftRef.current = mergeSignupDraft(draftRef.current, keep)
        return
      }
      const result = await send(patch, false)
      if (result.ok) {
        onOk?.(result.json)
        return
      }
      failedStepRef.current = step
      draftRef.current = mergeSignupDraft(draftRef.current, keep)
      onFail(result.error)
    })
  }

  const submitCompany = async (input: CompanyInput, candidate: SireneCandidate | null): Promise<string | null> => {
    // Même entreprise que celle enregistrée : rien à réécrire
    if (sameCompany(company, input)) {
      draftRef.current = mergeSignupDraft(draftRef.current, { company: null })
      if (candidate) setPicked(candidate)
      goTo(nextView("company", profileAvailable))
      return null
    }
    const previous = company
    const firstCompany = previous === null
    // L'étape suivante s'affiche tout de suite ; l'enregistrement part en arrière-plan
    setCompany({ name: input.name, siren: input.siren ?? null, address: input.address, zip_code: input.zip_code, city: input.city })
    setPicked(candidate)
    draftRef.current = mergeSignupDraft(draftRef.current, { company: null })
    saveInBackground({ step: "company", company: input }, {
      keep: {
        company: {
          name: input.name, address: input.address, zip_code: input.zip_code, city: input.city,
          ...(input.siren ? { siren: input.siren } : {}), manual: true,
        },
      },
      onOk: (json) => {
        // Conversion « inscription terminée » du pixel Meta, comme l'ancien formulaire d'entreprise
        if (mode === "app" && firstCompany) trackEvent("CompleteRegistration", { currency: "EUR", value: 0 })
        const saved = (json.company ?? {}) as Partial<Record<keyof InscriptionCompany, string | null>>
        setCompany({
          name: saved.name || input.name,
          siren: (saved.siren ?? input.siren ?? "") || null,
          address: saved.address || input.address,
          zip_code: saved.zip_code || input.zip_code,
          city: saved.city || input.city,
        })
        if (json.profileAvailable === false) {
          setProfileAvailable(false)
          if (viewRef.current === "trade") goTo(nextView("company", false))
        }
      },
      onFail: (message) => {
        setCompany(previous)
        setPicked(null)
        goTo("company")
        setStepError({ step: "company", message })
      },
    })
    goTo(nextView("company", profileAvailable))
    return null
  }

  const submitTrade = async (input: TradeInput): Promise<string | null> => {
    const previous = { trade, vatRegime }
    setTrade(input.trade)
    setVatRegime(input.vat_regime)
    draftRef.current = mergeSignupDraft(draftRef.current, { trade: null })
    saveInBackground({ step: "trade", trade: input }, {
      keep: { trade: { trade: input.trade, vat_regime: input.vat_regime } },
      onFail: (message) => {
        setTrade(previous.trade)
        setVatRegime(previous.vatRegime)
        goTo("trade")
        setStepError({ step: "trade", message })
      },
    })
    goTo(nextView("trade", profileAvailable))
    return null
  }

  const submitName = async (value: string): Promise<string | null> => {
    const previous = firstName
    setFirstName(value)
    draftRef.current = mergeSignupDraft(draftRef.current, { first_name: null })
    saveInBackground({ step: "name", first_name: value }, {
      keep: { first_name: value },
      // Une seule mise à jour de la page derrière la fenêtre, quand tout est enregistré
      onOk: () => { if (mode === "app") router.refresh() },
      onFail: (message) => {
        setFirstName(previous)
        goTo("name")
        setStepError({ step: "name", message })
      },
    })
    goTo("done")
    return null
  }

  const backFrom = (step: InscriptionStep) => {
    const previous = previousStep(step, profileAvailable)
    return previous ? () => goTo(previous) : undefined
  }

  const summary = [
    company?.name?.trim(),
    tradeLabel(trade),
    vatRegime === "assujetti" ? "TVA facturée" : vatRegime === "franchise" ? "Franchise de TVA" : null,
  ].filter((part): part is string => !!part)

  let content: React.ReactNode
  if (view === "company") {
    content = (
      <CompanyStep
        mode={mode}
        titleId={titleId}
        progress={stepProgress("company", profileAvailable)}
        justCreated={created}
        saved={company}
        picked={picked}
        onPick={setPicked}
        busy={false}
        onSkip={close}
        onSubmit={submitCompany}
        onKeep={() => goTo(nextView("company", profileAvailable))}
        snapshotRef={snapshotRef}
        draft={draftRef.current?.company ?? null}
        initialError={stepError?.step === "company" ? stepError.message : null}
      />
    )
  } else if (view === "trade") {
    content = (
      <TradeStep
        mode={mode}
        titleId={titleId}
        progress={stepProgress("trade", profileAvailable)}
        trade={trade}
        vatRegime={vatRegime}
        siren={company?.siren ?? picked?.siren ?? null}
        activityCode={picked?.activity_code ?? null}
        legalForm={picked?.legal_form ?? null}
        busy={false}
        onSkip={close}
        onBack={() => goTo("company")}
        onSubmit={submitTrade}
        snapshotRef={snapshotRef}
        draft={draftRef.current?.trade ?? null}
        initialError={stepError?.step === "trade" ? stepError.message : null}
      />
    )
  } else if (view === "name") {
    content = (
      <NameStep
        titleId={titleId}
        progress={stepProgress("name", profileAvailable)}
        initialValue={firstName || draftRef.current?.first_name || displayFirstName(picked?.first_name)}
        savedName={firstName}
        busy={false}
        onSkip={close}
        onBack={backFrom("name")}
        onSubmit={submitName}
        snapshotRef={snapshotRef}
        initialError={stepError?.step === "name" ? stepError.message : null}
      />
    )
  } else {
    content = (
      <DoneStep
        mode={mode}
        titleId={titleId}
        firstName={firstName}
        summary={summary}
        startAvailable={startAvailable}
        onExplore={close}
      />
    )
  }

  if (!mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-[60] print:hidden">
      {/* Voile : sans flou sous 768 px ; un clic dessus ne ferme pas la fenêtre */}
      <div className="q-veil absolute inset-0" aria-hidden />
      <div className="absolute inset-0 flex items-end justify-center sm:items-center sm:p-6">
        <section
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onKeyDown={trapTab}
          className={cn(
            "relative flex w-full flex-col overflow-hidden bg-[var(--q-surface)] text-[var(--q-ink)]",
            // Téléphone : feuille du bas, 12 px sous le haut de l'écran (la fin, à sa hauteur)
            "rounded-t-[24px] shadow-[0_-12px_40px_-12px_rgba(10,17,34,.35)]",
            view === "done" ? "max-h-[calc(100dvh-12px)]" : "h-[calc(100dvh-12px)]",
            // Ordinateur : carte centrée
            "sm:h-auto sm:max-h-[calc(100dvh-48px)] sm:rounded-[20px] sm:border sm:border-[var(--q-line)] sm:shadow-[shadow:var(--q-shadow-pop)]",
            view === "done" ? "sm:max-w-[620px]" : "sm:max-w-[560px]",
          )}
        >
          <SheetGrip className="shrink-0 sm:hidden" onDismiss={close} />
          <div data-dialog-scroll className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
            {content}
          </div>
        </section>
      </div>
    </div>,
    document.body,
  )
}
