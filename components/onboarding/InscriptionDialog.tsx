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
import { tradeLabel, type TradeId, type VatRegime } from "@/lib/legal/profile"
import type { CompanyInput, InscriptionPatch, InscriptionStep, TradeInput } from "@/lib/onboarding/inscription"
import type { SireneCandidate } from "@/lib/utils/sirene"
import { CompanyStep } from "@/components/onboarding/inscription/CompanyStep"
import { TradeStep } from "@/components/onboarding/inscription/TradeStep"
import { NameStep } from "@/components/onboarding/inscription/NameStep"
import { DoneStep } from "@/components/onboarding/inscription/DoneStep"
import {
  displayFirstName, nextView, previousStep, sameCompany, stepProgress,
  type InscriptionCompany, type InscriptionView,
} from "@/components/onboarding/inscription/model"

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
}: InscriptionDialogProps) {
  const router = useRouter()
  const titleId = useId()
  const panelRef = useRef<HTMLElement>(null)
  const closingRef = useRef(false)

  const [mounted, setMounted] = useState(false)
  const [view, setView] = useState<InscriptionView>(initialStep)
  const [company, setCompany] = useState<InscriptionCompany | null>(initialCompany)
  const [picked, setPicked] = useState<SireneCandidate | null>(null)
  const [trade, setTrade] = useState<TradeId | null>(initialTrade)
  const [vatRegime, setVatRegime] = useState<VatRegime | null>(initialVat)
  const [firstName, setFirstName] = useState(initialFirstName.trim())
  const [busy, setBusy] = useState(false)
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

  /** Enregistre une étape (rien en démo), puis rafraîchit la page derrière la fenêtre. */
  const send = useCallback(async (body: InscriptionPatch): Promise<PatchResult> => {
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
      router.refresh()
      return { ok: true, json: json && typeof json === "object" ? json : {} }
    } catch {
      return { ok: false, error: "Erreur réseau\u00a0: vérifiez votre connexion, puis réessayez." }
    }
  }, [mode, router])

  /**
   * « Passer au tableau de bord », Échap, « Explorer le tableau de bord » :
   * ferme tout de suite, puis enregistre la fermeture et recharge le tableau
   * de bord sans `?bienvenue` ni `?inscription` (tuile « Terminer votre inscription »).
   */
  const close = useCallback(() => {
    if (closingRef.current) return
    closingRef.current = true
    onClose()
    if (mode === "demo") {
      // Comme le vrai : la fenêtre se ferme sur le tableau de bord du compte
      // neuf, avec la tuile « Terminer votre inscription » pour la rouvrir
      router.replace("/demo/bienvenue?ferme=1", { scroll: false })
      return
    }
    const body: InscriptionPatch = { step: "close" }
    void fetch(PATCH_URL, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    })
      .catch(() => undefined)
      .finally(() => {
        const url = new URL(window.location.href)
        const hadParams = url.searchParams.has("bienvenue") || url.searchParams.has("inscription")
        url.searchParams.delete("bienvenue")
        url.searchParams.delete("inscription")
        if (hadParams) router.replace(`${url.pathname}${url.search}`, { scroll: false })
        else router.refresh()
      })
  }, [mode, onClose, router])

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
    setView(next)
  }

  const submitCompany = async (input: CompanyInput, candidate: SireneCandidate | null): Promise<string | null> => {
    // Même entreprise que celle enregistrée : rien à réécrire
    if (sameCompany(company, input)) {
      if (candidate) setPicked(candidate)
      goTo(nextView("company", profileAvailable))
      return null
    }
    setBusy(true)
    const result = await send({ step: "company", company: input })
    setBusy(false)
    if (!result.ok) return result.error
    const saved = (result.json.company ?? {}) as Partial<Record<keyof InscriptionCompany, string | null>>
    setCompany({
      name: saved.name || input.name,
      siren: (saved.siren ?? input.siren ?? "") || null,
      address: saved.address || input.address,
      zip_code: saved.zip_code || input.zip_code,
      city: saved.city || input.city,
    })
    setPicked(candidate)
    const withProfile = result.json.profileAvailable === false ? false : profileAvailable
    setProfileAvailable(withProfile)
    goTo(nextView("company", withProfile))
    return null
  }

  const submitTrade = async (input: TradeInput): Promise<string | null> => {
    setBusy(true)
    const result = await send({ step: "trade", trade: input })
    setBusy(false)
    if (!result.ok) return result.error
    setTrade(input.trade)
    setVatRegime(input.vat_regime)
    goTo(nextView("trade", profileAvailable))
    return null
  }

  const submitName = async (value: string): Promise<string | null> => {
    setBusy(true)
    const result = await send({ step: "name", first_name: value })
    setBusy(false)
    if (!result.ok) return result.error
    setFirstName(value)
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
        busy={busy}
        onSkip={close}
        onSubmit={submitCompany}
        onKeep={() => goTo(nextView("company", profileAvailable))}
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
        busy={busy}
        onSkip={close}
        onBack={() => goTo("company")}
        onSubmit={submitTrade}
      />
    )
  } else if (view === "name") {
    content = (
      <NameStep
        titleId={titleId}
        progress={stepProgress("name", profileAvailable)}
        initialValue={firstName || displayFirstName(picked?.first_name)}
        busy={busy}
        onSkip={close}
        onBack={backFrom("name")}
        onSubmit={submitName}
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
            "sm:h-auto sm:max-h-[calc(100dvh-48px)] sm:rounded-[20px] sm:border sm:border-[var(--q-line)] sm:shadow-[var(--q-shadow-pop)]",
            view === "done" ? "sm:max-w-[620px]" : "sm:max-w-[560px]",
          )}
        >
          <div className="q-sheet-grip shrink-0 sm:hidden" aria-hidden />
          <div data-dialog-scroll className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
            {content}
          </div>
        </section>
      </div>
    </div>,
    document.body,
  )
}
