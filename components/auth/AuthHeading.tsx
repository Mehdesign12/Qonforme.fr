import { cn } from "@/lib/utils"

/**
 * Titre des pages d'accès, en deux voix : Bricolage, puis un mot en
 * Instrument Serif italique bleu (enveloppé dans <em className="q-serif">).
 */
export function AuthTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h1
      className={cn(
        "q-display m-0 text-[30px] leading-[1.06] tracking-[-0.035em] text-q-ink-strong [text-wrap:balance] sm:text-[38px] lg:text-[44px]",
        className,
      )}
    >
      {children}
    </h1>
  )
}

/** Mot en seconde voix dans un titre. */
export function Serif({ children }: { children: React.ReactNode }) {
  return <em className="q-serif">{children}</em>
}

export function AuthLead({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("mt-3 text-[16px] leading-[1.6] text-q-text-3 [text-wrap:pretty] sm:mt-3.5 sm:text-[17px]", className)}>
      {children}
    </p>
  )
}
