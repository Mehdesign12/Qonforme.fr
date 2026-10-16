"use client"

/**
 * Aperçu du résultat Google d'un article (panneau Référencement de
 * l'éditeur), sur ordinateur ou sur téléphone.
 *
 * Fidèle aux mesures de Google plutôt qu'à la largeur du panneau : le
 * résultat est dessiné à sa vraie largeur (600 px sur ordinateur, 328 px sur
 * téléphone), puis réduit pour tenir dans la colonne (transform: scale, sans
 * will-change). On voit donc exactement où Google coupe : titre sur une ligne
 * à 600 px sur ordinateur, deux lignes sur téléphone ; description sur deux
 * lignes (ordinateur) ou trois (téléphone). Un titre coupé est signalé sous
 * l'aperçu.
 *
 * Par défaut, l'aperçu montre le téléphone dans une colonne étroite (le
 * panneau de l'éditeur) et l'ordinateur ailleurs ; le choix reste libre.
 *
 * Le titre reçoit « | Qonforme » comme sur la page article (googleTitleOf,
 * lib/seo/articles/onpage.ts) ; une description vide laisse Google choisir un
 * passage, ce que l'aperçu dit.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { Monitor, Smartphone, TriangleAlert } from "lucide-react"
import { cn } from "@/lib/utils"
import { googleTitleOf } from "@/lib/seo/articles/onpage"
import { SUFFIX } from "@/lib/seo/meta"

type Device = "desktop" | "mobile"

/** Largeur réelle d'un résultat Google (px). */
const WIDTH: Record<Device, number> = { desktop: 600, mobile: 328 }

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect

const GOOGLE_FONT = { fontFamily: "Arial, Helvetica, sans-serif" }

/** « 16 oct. 2026 » (heure de Paris), à partir d'un jour AAAA-MM-JJ ou d'un instant ISO. */
export function serpDate(value: string): string | null {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00Z`) : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Paris" }).format(date)
}

/** Titre tel que Google l'affiche (« | Qonforme » ajouté s'il tient, jamais en double). */
export function serpTitle(title: string): string {
  const clean = title.replace(/\s+/g, " ").trim()
  if (!clean) return ""
  return clean.endsWith(SUFFIX.trim()) ? clean : googleTitleOf(clean)
}

export function SerpPreview({
  title,
  description,
  slug,
  date,
  defaultDevice = "auto",
  className,
}: {
  /** Titre Google saisi (ou titre de l'article), sans « | Qonforme ». */
  title: string
  /** Description Google (ou chapeau) ; vide : Google choisit un passage. */
  description: string
  slug: string
  /** Date affichée devant la description (publication ou date prévue) ; null : aucune. */
  date?: string | null
  /**
   * « auto » : téléphone dans une colonne étroite (moins de 480 px : l'aperçu
   * ordinateur y serait réduit de moitié), ordinateur sinon.
   */
  defaultDevice?: "auto" | Device
  className?: string
}) {
  const [chosen, setChosen] = useState<Device | null>(defaultDevice === "auto" ? null : defaultDevice)
  const device: Device = chosen ?? "mobile"
  const setDevice = setChosen
  const rootRef = useRef<HTMLDivElement>(null)
  const outerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const [box, setBox] = useState<{ scale: number; height: number | null }>({ scale: 1, height: null })
  const [titleCut, setTitleCut] = useState(false)

  const width = WIDTH[device]
  const shownTitle = serpTitle(title)
  const shownDescription = description.replace(/\s+/g, " ").trim()
  const shownDate = date ? serpDate(date) : null
  const cleanSlug = slug.trim() || "adresse-de-l-article"

  // Choix automatique de l'appareil, une fois, d'après la largeur disponible
  useIsoLayoutEffect(() => {
    if (chosen !== null) return
    const w = rootRef.current?.clientWidth ?? 0
    setChosen(w > 0 && w >= 480 ? "desktop" : "mobile")
  }, [chosen])

  // Réduction à la largeur de la colonne, hauteur réservée en conséquence
  useIsoLayoutEffect(() => {
    const outer = outerRef.current
    const inner = innerRef.current
    if (!outer || !inner) return
    const measure = () => {
      const available = outer.clientWidth
      const scale = available > 0 ? Math.min(1, available / width) : 1
      const height = inner.offsetHeight * scale
      setBox((b) => (Math.abs(b.scale - scale) < 0.001 && b.height !== null && Math.abs(b.height - height) < 0.5 ? b : { scale, height }))
      const t = titleRef.current
      if (t) setTitleCut(device === "desktop" ? t.scrollWidth > t.clientWidth + 1 : t.scrollHeight > t.clientHeight + 1)
    }
    measure()
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(measure)
    observer.observe(outer)
    observer.observe(inner)
    return () => observer.disconnect()
  }, [width, device, shownTitle, shownDescription, shownDate, cleanSlug])

  const mobile = device === "mobile"

  return (
    <div ref={rootRef} className={cn("flex flex-col gap-2.5", className)}>
      <div className="q-seg grid w-full grid-cols-2" role="group" aria-label="Aperçu du résultat Google sur ordinateur ou sur téléphone">
        <button type="button" aria-pressed={!mobile} onClick={() => setDevice("desktop")} className="max-md:!h-11">
          <Monitor className="size-3.5" aria-hidden />
          Ordinateur
        </button>
        <button type="button" aria-pressed={mobile} onClick={() => setDevice("mobile")} className="max-md:!h-11">
          <Smartphone className="size-3.5" aria-hidden />
          Téléphone
        </button>
      </div>

      <div
        className={cn(
          "rounded-xl border border-[var(--q-line)] bg-[var(--q-surface)]",
          mobile ? "mx-auto w-full max-w-[360px] rounded-[20px] px-4 py-3.5 shadow-[shadow:var(--q-shadow-card)]" : "px-4 py-3.5",
        )}
      >
        <div ref={outerRef} className="w-full overflow-hidden" style={box.height !== null ? { height: box.height } : undefined}>
          <div
            ref={innerRef}
            role="img"
            aria-label={`Aperçu du résultat Google : ${shownTitle || "titre manquant"}. ${shownDescription || "Description choisie par Google."}`}
            style={{ ...GOOGLE_FONT, width, transform: box.scale < 1 ? `scale(${box.scale})` : undefined, transformOrigin: "top left" }}
          >
            {/* Site */}
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className="grid size-[26px] shrink-0 place-items-center rounded-full border border-[#dadce0] bg-white text-[13px] font-bold leading-none text-[#1d4ed8] dark:border-[#3c4043]"
              >
                Q
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="text-[14px] leading-[20px] text-[#202124] dark:text-[#dadce0]">Qonforme</span>
                <span className="truncate text-[12px] leading-[18px] text-[#4d5156] dark:text-[#bdc1c6]">
                  https://qonforme.fr › blog › {cleanSlug}
                </span>
              </span>
            </div>

            {/* Titre */}
            <h3
              ref={titleRef}
              className={cn(
                "m-0 mt-[7px] text-[20px] font-normal leading-[26px] text-[#1a0dab] dark:text-[#99c3ff]",
                mobile ? "line-clamp-2" : "overflow-hidden text-ellipsis whitespace-nowrap",
                !shownTitle && "italic text-[#70757a] dark:text-[#9aa0a6]",
              )}
            >
              {shownTitle || "Titre de l'article"}
            </h3>

            {/* Description */}
            <p className={cn("m-0 mt-[3px] text-[14px] leading-[22px] text-[#4d5156] dark:text-[#bdc1c6]", mobile ? "line-clamp-3" : "line-clamp-2")}>
              {shownDate && <span className="text-[#70757a] dark:text-[#9aa0a6]">{shownDate} — </span>}
              {shownDescription || <span className="italic text-[#70757a] dark:text-[#9aa0a6]">Sans description, Google choisit lui-même un passage de l&apos;article.</span>}
            </p>
          </div>
        </div>
      </div>

      {!mobile && box.scale < 0.95 && (
        <p className="m-0 text-[11.5px] leading-snug text-[var(--q-text-4)]">
          Réduit à {Math.round(box.scale * 100)} % pour tenir ici : les coupures restent celles de Google sur ordinateur.
        </p>
      )}

      {titleCut && (
        <p className="flex items-start gap-1.5 text-[12px] leading-snug text-[var(--q-warn)]">
          <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
          {mobile
            ? "Google coupe ce titre après deux lignes sur téléphone : gardez l'essentiel au début."
            : "Google coupe ce titre sur ordinateur : gardez le mot-clé et l'essentiel au début."}
        </p>
      )}
    </div>
  )
}
