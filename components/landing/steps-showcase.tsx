"use client"

import { useEffect, useState } from "react"
import { Check, MousePointer2, Plus, Search, Send } from "lucide-react"
import { PlayPause, Progress, useCarousel } from "@/components/landing/carousels"
import { formatCurrency } from "@/lib/utils/invoice"
import { cn } from "@/lib/utils"

/**
 * « Trois étapes, et votre premier devis est parti » : les trois premiers gestes
 * dans Qonforme, joués dans une fenêtre d'application (demande du fondateur,
 * 17/10/2026, à la place de trois petites maquettes fixes).
 *
 *  1. Votre SIREN : le numéro se tape, la recherche part, l'entreprise revient
 *     avec son adresse et son numéro de TVA ;
 *  2. Vos prestations : le catalogue se remplit, une prestation s'ajoute ;
 *  3. Votre premier devis : les lignes s'additionnent, le total se calcule, le
 *     devis part par email.
 *
 * Les écrans existent (recherche par SIREN à l'inscription, catalogue, devis
 * envoyé par email) et montrent les données d'exemple de la démo
 * (lib/demo/data.ts), annoncées comme telles dans la barre de la fenêtre.
 *
 * Comportement : chaque scène se rejoue à chaque fois qu'elle devient l'écran
 * actif et qu'elle est à l'écran ; défilement automatique rythmé par la barre
 * de l'onglet, pause hors de l'écran, au survol, au clavier et par le bouton
 * (components/landing/carousels.tsx). « Réduire les animations », le rendu
 * serveur et l'absence de JavaScript montrent chaque scène terminée.
 * Opacité et transformations seulement, ni backdrop-filter ni will-change, ni
 * animation infinie (règle iOS de CLAUDE.md).
 */

const STEP_MS = 7600
const EASE = "cubic-bezier(.22,1,.36,1)"

const sirenGroups = (s: string) => s.replace(/(\d{3})(?=\d)/g, "$1 ")

/**
 * Données d'exemple des trois scènes, extraites de la démo (lib/demo/data.ts)
 * par la page : ce composant client n'embarque pas la démo entière.
 */
export interface StepsData {
  company: { name: string; siren: string; address: string; zip_code: string; city: string; vat_number: string }
  /** Prestations déjà au catalogue. */
  products: Product[]
  /** Prestation ajoutée pendant la scène. */
  newProduct: Product
  quote: {
    quote_number: string
    client: { name: string; email: string }
    lines: { id: string; description: string; quantity: number; unit: string; unit_price_ht: number; vat_rate: number; total_ht: number }[]
    subtotal_ht: number
    total_vat: number
    total_ttc: number
  }
}

interface Product {
  id: string
  name: string
  unit: string
  unit_price_ht: number
  vat_rate: number
}

const STEPS = [
  { title: "Votre SIREN", text: "Le nom, l'adresse et le numéro de TVA de votre entreprise se remplissent seuls." },
  { title: "Vos prestations", text: "Votre catalogue, avec vos unités et vos prix, prêt pour tous vos devis." },
  { title: "Votre premier devis", text: "Envoyé par email, gratuit, sans carte bancaire." },
] as const

/** Ce que montre chaque scène, pour la lecture d'écran. */
function stepLabels(d: StepsData): string[] {
  return [
    `Étape 1 : le numéro SIREN ${sirenGroups(d.company.siren)} remplit le nom, l'adresse et le numéro de TVA de ${d.company.name}.`,
    "Étape 2 : le catalogue de prestations, avec leur unité, leur prix hors taxes et leur taux de TVA.",
    `Étape 3 : le devis ${d.quote.quote_number} pour ${d.quote.client.name}, total calculé, envoyé par email.`,
  ]
}

/* ─────────────────────────────────────────────────────────
   Mécanique des scènes
───────────────────────────────────────────────────────── */

/**
 * Nombre de repères franchis depuis le début de la scène (0 à marks.length),
 * remis à zéro et rejoué chaque fois que `run` repasse à vrai. Rendu serveur,
 * sans JavaScript et « Réduire les animations » : la scène terminée.
 */
function useTimeline(run: boolean, marks: readonly number[], reduced: boolean): number {
  const total = marks.length
  const [n, setN] = useState(total)
  useEffect(() => {
    if (reduced) {
      setN(total)
      return
    }
    setN(0)
    if (!run) return
    const timers = marks.map((ms, i) => setTimeout(() => setN(i + 1), ms))
    return () => timers.forEach((t) => clearTimeout(t))
  }, [run, reduced, marks, total])
  return n
}

/** Texte tapé caractère par caractère à partir de `start`. */
function useTyped(text: string, start: boolean, reduced: boolean, speed = 85): string {
  const [len, setLen] = useState(text.length)
  useEffect(() => {
    if (reduced) {
      setLen(text.length)
      return
    }
    setLen(0)
    if (!start) return
    let i = 0
    const id = setInterval(() => {
      i += 1
      setLen(i)
      if (i >= text.length) clearInterval(id)
    }, speed)
    return () => clearInterval(id)
  }, [text, start, reduced, speed])
  return text.slice(0, len)
}

/** Nombre qui monte de 0 à `target` en `duration` ms (décélération), une fois `start` vrai. */
function useCountUp(target: number, start: boolean, reduced: boolean, duration = 1100): number {
  const [value, setValue] = useState(target)
  useEffect(() => {
    if (reduced) {
      setValue(target)
      return
    }
    setValue(0)
    if (!start) return
    let raf = 0
    const t0 = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration)
      setValue(target * (1 - Math.pow(1 - p, 3)))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, start, reduced, duration])
  return Math.round(value * 100) / 100
}

/** Apparition d'un élément (fondu et léger glissement) quand `on` passe à vrai. */
const appear = (on: boolean, from = "translate-y-3") =>
  cn(
    "transition-[opacity,transform] duration-500 ease-out motion-reduce:transition-none",
    on ? "translate-x-0 translate-y-0 opacity-100" : cn("opacity-0", from),
  )

/** Pointeur de souris qui rejoint un bouton, clique, puis repart. À placer dans un parent `relative`. */
function Cursor({ here, click }: { here: boolean; click: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute left-[58%] top-[52%] z-10 transition-[transform,opacity] duration-700 ease-out motion-reduce:transition-none",
        here ? "translate-x-0 translate-y-0 opacity-100" : "translate-x-12 translate-y-9 opacity-0",
        click && "scale-[.82]",
      )}
    >
      <MousePointer2 className="h-6 w-6 fill-q-ink-strong stroke-q-surface" strokeWidth={1.5} />
    </span>
  )
}

/** Le bouton s'enfonce et s'entoure d'un halo quand il est cliqué. */
const pressable = (pressed: boolean) =>
  cn(
    "transition-[transform,box-shadow] duration-200 motion-reduce:transition-none",
    pressed ? "scale-[.95] shadow-[0_0_0_6px_var(--q-focus)]" : "scale-100 shadow-none",
  )

interface SceneProps {
  data: StepsData
  run: boolean
  reduced: boolean
}

/**
 * Ligne d'une liste qui s'ouvre en hauteur puis se révèle (la liste ne montre
 * jamais de case vide). `first` : pas de filet au-dessus.
 */
function Grow({ on, first, children, className }: { on: boolean; first?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <li
      className={cn(
        "grid transition-[grid-template-rows,opacity] duration-500 ease-out motion-reduce:transition-none",
        on ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
      )}
    >
      <div className="min-h-0 overflow-hidden">
        <div className={cn("flex items-center gap-3 px-4", !first && "border-t border-q-line-soft", className)}>{children}</div>
      </div>
    </li>
  )
}

/* ─────────────────────────────────────────────────────────
   1 — Le SIREN remplit l'entreprise
───────────────────────────────────────────────────────── */
// Repères : 1 saisie · 2 le pointeur arrive · 3 clic · 4 résultat · 5 à 7 champs repris
const COMPANY_MARKS = [350, 1500, 2000, 2350, 3100, 3450, 3800] as const
const PREFILLED = ["Nom", "Adresse", "N° de TVA"] as const

function CompanyScene({ data, run, reduced }: SceneProps) {
  const { company } = data
  const n = useTimeline(run, COMPANY_MARKS, reduced)
  const siren = sirenGroups(company.siren)
  const typed = useTyped(siren, n >= 1, reduced)
  const focus = n >= 1 && n < 3
  return (
    <div className="flex h-full flex-col gap-5 p-5 sm:p-7">
      <p className="text-[16px] font-semibold text-q-ink-strong">Votre entreprise</p>

      <div className="flex flex-col gap-1.5">
        <span className="text-[12.5px] font-semibold text-q-text-3">Numéro SIREN</span>
        <div className="flex items-center gap-2.5">
          <div
            className={cn(
              "flex h-12 min-w-0 flex-1 items-center rounded-xl border bg-q-surface px-4 font-mono text-[16px] tabular-nums text-q-ink-strong transition-[border-color,box-shadow] duration-300 motion-reduce:transition-none",
              focus ? "border-q-accent shadow-[0_0_0_4px_var(--q-focus)]" : "border-q-field",
            )}
          >
            {typed || <span className="font-sans text-[14px] text-q-placeholder">9 chiffres</span>}
            {n >= 1 && n < 4 && typed.length > 0 && <span className="ml-px h-5 w-[2px] bg-q-accent" />}
          </div>
          <div className="relative shrink-0">
            <span className={cn("inline-flex h-12 items-center gap-2 rounded-xl bg-q-accent px-4 text-[14px] font-semibold text-white", pressable(n === 3))}>
              <Search className="h-4 w-4" strokeWidth={2} />
              Rechercher
            </span>
            <Cursor here={n === 2 || n === 3} click={n === 3} />
          </div>
        </div>
      </div>

      <div className={cn("rounded-2xl border border-q-line bg-q-surface p-4", appear(n >= 4))}>
        <div className="flex items-start gap-3.5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-q-ink-strong text-[13px] font-semibold text-q-surface">GP</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 break-words text-[15px] font-semibold leading-snug text-q-ink-strong">{company.name}</span>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-q-ok-bg px-2.5 py-0.5 text-[11.5px] font-semibold text-q-ok">
                <Check className="h-3 w-3" strokeWidth={2.5} />
                Trouvée
              </span>
            </div>
            <p className="mt-0.5 text-[13px] text-q-text-3">
              {company.address}, {company.zip_code} {company.city}
            </p>
            <p className="mt-0.5 font-mono text-[11.5px] text-q-text-4">TVA {company.vat_number}</p>
          </div>
        </div>
      </div>

      <div className="mt-auto flex flex-col gap-2.5">
        <p className={cn("text-[12.5px] text-q-text-3", appear(n >= 5, "translate-y-1"))}>Repris pour tous vos devis et vos factures :</p>
        <ul className="flex flex-wrap gap-2">
          {PREFILLED.map((label, i) => (
            <li
              key={label}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-full border border-q-line bg-q-surface px-3 text-[13px] font-medium text-q-ink-strong",
                appear(n >= 5 + i, "translate-y-2"),
              )}
            >
              <Check className="h-3.5 w-3.5 text-q-ok" strokeWidth={2.5} />
              {label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────
   2 — Le catalogue de prestations
───────────────────────────────────────────────────────── */
// Repères : 1 à 3 les prestations arrivent · 4 le pointeur arrive · 5 clic · 6 ajout · 7 l'ajout se pose
const CATALOGUE_MARKS = [300, 700, 1100, 1900, 2400, 2750, 3600] as const
const pct = (v: number) => `${String(v).replace(".", ",")} %`

function ProductRow({ name, unit, price, vat, badge }: { name: string; unit: string; price: number; vat: number; badge?: React.ReactNode }) {
  return (
    <>
      <span className="min-w-0 flex-1 py-3">
        <span className="block truncate text-[14px] font-medium text-q-ink-strong">{name}</span>
        <span className="mt-0.5 flex items-center gap-2 text-[12px] text-q-text-4">
          TVA {pct(vat)}
          {badge}
        </span>
      </span>
      <span className="shrink-0 rounded-md bg-q-sunken px-1.5 py-0.5 text-[12px] text-q-text-3">{unit}</span>
      <span className="w-[74px] shrink-0 text-right text-[14px] font-semibold tabular-nums text-q-ink-strong">{formatCurrency(price)}</span>
    </>
  )
}

function CatalogueScene({ data, run, reduced }: SceneProps) {
  const { products, newProduct } = data
  const n = useTimeline(run, CATALOGUE_MARKS, reduced)
  const count = n >= 6 ? products.length + 1 : products.length
  return (
    <div className="flex h-full flex-col gap-4 p-5 sm:p-7">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[16px] font-semibold text-q-ink-strong">Vos prestations</p>
        <span className="text-[12.5px] tabular-nums text-q-text-4">{count} prestations</span>
      </div>

      <ul className={cn("flex flex-col rounded-2xl border border-q-line bg-q-surface", appear(n >= 1, "translate-y-0"))}>
        {products.map((p, i) => (
          <Grow key={p.id} on={n >= i + 1} first={i === 0}>
            <ProductRow name={p.name} unit={p.unit} price={p.unit_price_ht} vat={p.vat_rate} />
          </Grow>
        ))}
        <Grow on={n >= 6} className={cn("transition-colors duration-[1400ms] motion-reduce:transition-none", n >= 6 && n < 7 ? "bg-q-wash" : "bg-transparent")}>
          <ProductRow
            name={newProduct.name}
            unit={newProduct.unit}
            price={newProduct.unit_price_ht}
            vat={newProduct.vat_rate}
            badge={<span className="inline-flex items-center rounded-full bg-q-info-bg px-1.5 py-px text-[11px] font-semibold text-q-info">Ajoutée</span>}
          />
        </Grow>
      </ul>

      <div className="relative mt-auto w-fit">
        <span className={cn("inline-flex h-11 items-center gap-2 rounded-xl border border-dashed border-q-wash-line bg-q-wash px-4 text-[14px] font-semibold text-q-accent-strong", pressable(n === 5))}>
          <Plus className="h-4 w-4" strokeWidth={2.25} />
          Ajouter une prestation
        </span>
        <Cursor here={n === 4 || n === 5} click={n === 5} />
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────
   3 — Le devis se calcule et part par email
───────────────────────────────────────────────────────── */
// Repères : 1 à 3 les lignes · 4 le total se calcule · 5 le pointeur arrive · 6 clic · 7 envoyé
const QUOTE_MARKS = [300, 700, 1100, 1600, 3200, 3650, 4100] as const

function QuoteScene({ data, run, reduced }: SceneProps) {
  const { quote } = data
  const n = useTimeline(run, QUOTE_MARKS, reduced)
  const ttc = useCountUp(quote.total_ttc, n >= 4, reduced)
  const sent = n >= 7
  return (
    <div className="flex h-full flex-col gap-4 p-5 sm:p-7">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[16px] font-semibold text-q-ink-strong">{quote.client.name}</p>
          <p className="mt-0.5 font-mono text-[11.5px] text-q-text-4">{quote.quote_number}</p>
        </div>
        <span className="relative h-7 w-[92px] shrink-0">
          <span className={cn("absolute inset-0 inline-flex items-center justify-center rounded-full bg-q-sunken text-[12px] font-semibold text-q-text-3 transition-opacity duration-500 motion-reduce:transition-none", sent ? "opacity-0" : "opacity-100")}>
            Brouillon
          </span>
          <span className={cn("absolute inset-0 inline-flex items-center justify-center gap-1 rounded-full bg-q-info-bg text-[12px] font-semibold text-q-info transition-opacity duration-500 motion-reduce:transition-none", sent ? "opacity-100" : "opacity-0")}>
            <Send className="h-3 w-3" strokeWidth={2} />
            Envoyé
          </span>
        </span>
      </div>

      <ul className={cn("flex flex-col rounded-2xl border border-q-line bg-q-surface", appear(n >= 1, "translate-y-0"))}>
        {quote.lines.map((l, i) => (
          <Grow key={l.id} on={n >= i + 1} first={i === 0}>
            <span className="min-w-0 flex-1 py-2">
              <span className="block truncate text-[14px] font-medium text-q-ink-strong">{l.description}</span>
              <span className="mt-0.5 block text-[12px] tabular-nums text-q-text-4">
                {String(l.quantity).replace(".", ",")} {l.unit} × {formatCurrency(l.unit_price_ht)} · TVA {pct(l.vat_rate)}
              </span>
            </span>
            <span className="shrink-0 text-[14px] font-semibold tabular-nums text-q-ink-strong">{formatCurrency(l.total_ht)}</span>
          </Grow>
        ))}
      </ul>

      <div className={cn("flex items-end justify-between gap-4 rounded-2xl bg-q-surface px-4 py-3", appear(n >= 4, "translate-y-2"))}>
        <span className="flex flex-col gap-0.5 text-[12.5px] tabular-nums text-q-text-3">
          <span>Total HT {formatCurrency(quote.subtotal_ht)}</span>
          <span>TVA {formatCurrency(quote.total_vat)}</span>
        </span>
        <span className="flex flex-col items-end">
          <span className="text-[12px] font-semibold text-q-text-3">Total TTC</span>
          <span className="text-[24px] font-semibold leading-none tabular-nums tracking-[-0.02em] text-q-ink-strong">{formatCurrency(ttc)}</span>
        </span>
      </div>

      <div className="relative mt-auto h-11 shrink-0">
        <span
          className={cn(
            "absolute inset-y-0 left-0 inline-flex items-center gap-2 rounded-xl bg-q-accent px-4 text-[14px] font-semibold text-white transition-opacity duration-500 motion-reduce:transition-none",
            pressable(n === 6),
            sent ? "pointer-events-none opacity-0" : "opacity-100",
          )}
        >
          <Send className="h-4 w-4" strokeWidth={2} />
          Envoyer par email
          <Cursor here={n === 5 || n === 6} click={n === 6} />
        </span>
        <span
          className={cn(
            "absolute inset-0 flex items-center gap-3 rounded-xl border border-q-ok/30 bg-q-ok-bg px-4 text-[13.5px] font-semibold text-q-ok transition-[opacity,transform] duration-500 motion-reduce:transition-none",
            sent ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
          )}
        >
          <Check className="h-4 w-4 shrink-0" strokeWidth={2.5} />
          <span className="flex min-w-0 flex-col leading-tight">
            <span>Devis envoyé</span>
            <span className="truncate text-[12px] font-normal opacity-90">à {quote.client.email}</span>
          </span>
        </span>
      </div>
    </div>
  )
}

const SCENES = [CompanyScene, CatalogueScene, QuoteScene] as const

/* ─────────────────────────────────────────────────────────
   Le sélecteur d'étapes et la fenêtre
───────────────────────────────────────────────────────── */
export function StepsShowcase({ data }: { data: StepsData }) {
  const c = useCarousel(STEPS.length)
  const labels = stepLabels(data)

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault()
      c.next()
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault()
      c.prev()
    }
  }

  return (
    <div
      ref={c.rootRef}
      role="group"
      aria-roledescription="carrousel"
      aria-label="Les trois étapes pour envoyer votre premier devis"
      className="mt-12 grid items-center gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14"
      {...c.handlers}
    >
      <div data-reveal="">
        <div role="tablist" aria-label="Étapes" onKeyDown={onKeyDown} className="grid grid-cols-3 gap-2 lg:flex lg:flex-col lg:gap-3">
          {STEPS.map((s, i) => {
            const on = c.active === i
            return (
              <button
                key={s.title}
                type="button"
                role="tab"
                aria-selected={on}
                tabIndex={on ? 0 : -1}
                onClick={() => c.go(i)}
                className={cn(
                  "lp-clip relative flex flex-col items-start gap-2 rounded-2xl border p-3 text-left transition-[background-color,border-color,opacity,box-shadow] duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-q-accent lg:p-5 lg:pb-6",
                  on
                    ? "border-q-line bg-q-surface opacity-100 shadow-[shadow:var(--q-shadow-card)]"
                    : "border-transparent opacity-60 hover:opacity-90 lg:hover:bg-q-surface",
                )}
              >
                <span className="flex items-center gap-3 max-lg:flex-col max-lg:items-start max-lg:gap-2">
                  <span
                    className={cn(
                      "grid size-8 shrink-0 place-items-center rounded-full text-[14px] font-semibold transition-colors duration-300",
                      on ? "bg-q-accent text-white" : "bg-q-ink-strong text-q-surface",
                    )}
                  >
                    {i + 1}
                  </span>
                  <span className="text-[14px] font-semibold leading-tight text-q-ink-strong lg:text-[18px]">{s.title}</span>
                </span>
                <span className="text-[15px] leading-[1.55] text-q-text-3 max-lg:hidden lg:pl-11">{s.text}</span>
                <Progress on={on} running={c.running} autoplay={c.autoplay} onDone={c.next} tone="light" duration={STEP_MS} />
              </button>
            )
          })}
        </div>
      </div>

      <div data-reveal="right" className="min-w-0">
        <div className="lp-clip rounded-[22px] border border-q-line bg-q-surface shadow-[0_1px_2px_rgba(10,17,34,.04),0_40px_80px_-48px_rgba(10,17,34,.45)]">
          <div className="flex h-11 items-center gap-1.5 border-b border-q-line bg-q-sunken pl-4 pr-2.5">
            <span aria-hidden className="flex items-center gap-1.5">
              <span className="h-[10px] w-[10px] rounded-full bg-q-field" />
              <span className="h-[10px] w-[10px] rounded-full bg-q-field" />
              <span className="h-[10px] w-[10px] rounded-full bg-q-field" />
            </span>
            <span className="ml-auto mr-1.5 text-[11.5px] text-q-text-4">Données d&apos;exemple</span>
            {!c.reduced && <PlayPause compact playing={c.playing} onToggle={() => c.setPlaying((p) => !p)} tone="light" />}
          </div>
          <div role="tabpanel" aria-label={STEPS[c.active].title} className="relative h-[436px] bg-q-bg sm:h-[444px]">
            <p className="sr-only">{labels[c.active]}</p>
            {SCENES.map((Scene, i) => {
              const on = c.active === i
              return (
                <div
                  key={i}
                  aria-hidden
                  className={cn("absolute inset-0", !on && "pointer-events-none")}
                  style={{
                    opacity: on ? 1 : 0,
                    transform: on ? "none" : "translateY(10px)",
                    transition: c.reduced ? "none" : `opacity .5s ${EASE}, transform .7s ${EASE}`,
                  }}
                >
                  <Scene data={data} run={c.visible && on} reduced={c.reduced} />
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <p className="text-[15px] leading-[1.55] text-q-text-3 lg:hidden" aria-live={c.running ? "off" : "polite"}>
        {STEPS[c.active].text}
      </p>
    </div>
  )
}
