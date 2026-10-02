"use client"

import { useRef } from "react"
import { cn } from "@/lib/utils"
import { motion, useInView, useScroll, useTransform, type MotionValue } from "motion/react"

/**
 * Animations de l'accueil, déclenchées par le défilement.
 *
 * - Seules des propriétés composées par le GPU sont animées (opacity, transform) :
 *   pas de saccade, pas de recalcul de mise en page.
 * - Ni backdrop-filter ni will-change (règle iOS de CLAUDE.md). Motion n'ajoute
 *   will-change que si on le lui demande (useWillChange), ce qu'on ne fait pas.
 * - « Réduire les animations » du système est respecté sans jamais changer le
 *   rendu selon ce réglage (le HTML du serveur ne le connaît pas : un rendu
 *   différent au client laisserait des styles périmés, React ne les corrige
 *   pas à l'hydratation). Deux mécanismes à la place :
 *     · <MotionConfig reducedMotion="user"> autour de la page : les
 *       déplacements deviennent instantanés, seuls les fondus restent ;
 *     · la classe .lp-motion (globals.css) annule les transformations liées
 *       au défilement (inclinaison, profondeur, trait qui se remplit).
 */

const EASE = [0.22, 1, 0.36, 1] as const

/** Apparition douce quand l'élément entre à l'écran (une seule fois). */
export function Reveal({
  children,
  delay = 0,
  y = 28,
  className,
  as = "div",
}: {
  children: React.ReactNode
  delay?: number
  y?: number
  className?: string
  as?: "div" | "li" | "section"
}) {
  const Tag = motion[as]
  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.8, ease: EASE, delay }}
    >
      {children}
    </Tag>
  )
}

/**
 * Titre qui se révèle mot à mot, chaque mot montant depuis une ligne masquée.
 * Le texte reste lisible par les lecteurs d'écran (aria-label sur le titre).
 *
 * `immediate` (héros) : animation en CSS pur (.lp-word, globals.css), jouée dès
 * le premier affichage, sans attendre le JavaScript. Sinon, au défilement.
 */
export function RevealWords({
  text,
  className,
  style,
  as = "h2",
  delay = 0,
  immediate = false,
}: {
  text: string
  className?: string
  style?: React.CSSProperties
  as?: "h1" | "h2" | "h3" | "p"
  delay?: number
  immediate?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.4 })
  const Tag = as
  const lines = text.split("\n")
  let index = 0

  return (
    <div ref={ref}>
      <Tag className={className} style={style} aria-label={text.replace(/\n/g, " ")}>
        {lines.map((line, li) => {
          const words = line.split(" ")
          return (
            <span key={li} aria-hidden className="block">
              {words.map((word, wi) => {
                const i = index++
                const wordDelay = delay + i * 0.055
                return (
                  <span key={wi}>
                    <span className="inline-block overflow-hidden pb-[0.12em] -mb-[0.12em] align-top">
                      {immediate ? (
                        <span className="lp-word" style={{ animationDelay: `${wordDelay}s` }}>{word}</span>
                      ) : (
                        <motion.span
                          className="inline-block"
                          initial={{ y: "105%" }}
                          animate={inView ? { y: "0%" } : undefined}
                          transition={{ duration: 0.9, ease: EASE, delay: wordDelay }}
                        >
                          {word}
                        </motion.span>
                      )}
                    </span>
                    {wi < words.length - 1 && " "}
                  </span>
                )
              })}
              {li < lines.length - 1 && " "}
            </span>
          )
        })}
      </Tag>
    </div>
  )
}

/** Progression du défilement d'un élément, de son entrée à sa sortie de l'écran. */
export function useSectionProgress(offset: ["start end", "end start"] | ["start start", "end end"] | ["start end", "end end"] | ["start end", "center center"] = ["start end", "end start"]) {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset })
  return { ref, progress: scrollYProgress }
}

/** Décalage vertical proportionnel au défilement (effet de profondeur). */
export function Parallax({
  children,
  distance = 60,
  className,
}: {
  children: React.ReactNode
  /** Déplacement total en pixels sur la traversée de l'écran. Négatif : l'élément monte plus vite. */
  distance?: number
  className?: string
}) {
  const { ref, progress } = useSectionProgress()
  const y = useTransform(progress, [0, 1], [distance / 2, -distance / 2])
  return (
    <motion.div ref={ref} className={cn("lp-motion", className)} style={{ y }}>
      {children}
    </motion.div>
  )
}

/** Barre ou trait qui se remplit avec le défilement (échelle 0 → 1). */
export function ScrollLine({ progress, className, axis = "y" }: { progress: MotionValue<number>; className?: string; axis?: "x" | "y" }) {
  return (
    <motion.span
      aria-hidden
      className={cn("lp-motion", className)}
      style={axis === "y" ? { scaleY: progress, originY: 0 } : { scaleX: progress, originX: 0 }}
    />
  )
}
