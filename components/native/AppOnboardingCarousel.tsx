'use client'

import { useRef, useState, type TouchEvent } from 'react'
import Image from 'next/image'
import { ShieldCheck, Zap, Bell, ArrowRight, Loader2 } from 'lucide-react'

const LOGO_URL =
  'https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Logo%20long%20bleu.webp'
const PICTO_Q =
  'https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Logo%20bleu%20Qonforme%20PNG.webp'

interface Step {
  Icon: React.ElementType
  title: string
  subtitle: string
}

const STEPS: Step[] = [
  {
    Icon: ShieldCheck,
    title: 'Conforme à la réforme 2026',
    subtitle:
      "Vos factures et devis au format Factur-X, reconnu par l'administration — sans rien configurer.",
  },
  {
    Icon: Zap,
    title: 'Facturez en quelques secondes',
    subtitle:
      "Devis, factures, avoirs, relances de paiement — tout ce qu'il faut pour être payé plus vite.",
  },
  {
    Icon: Bell,
    title: "Prévenu dès qu'un client tarde à payer",
    subtitle: "Recevez une alerte à l'échéance ou au retard, même quand l'app est fermée.",
  },
]

const LAST_STEP = STEPS.length - 1
/** Un swipe plus court que ça (px) est traité comme un tap manqué, pas un changement d'écran. */
const SWIPE_THRESHOLD = 48

interface AppOnboardingCarouselProps {
  /**
   * Onboarding terminé. `destination` route explicitement vers l'inscription
   * ou la connexion (CTA du 3ᵉ écran) ; sans destination (Passer, ou fin du
   * dernier "Suivant"), on se contente de démonter l'écran — la page déjà
   * chargée en dessous (login ou dashboard, selon le middleware) apparaît.
   */
  onFinish: (destination?: '/login' | '/signup') => void
}

/**
 * Carrousel d'accueil pour quelqu'un qui découvre l'app depuis l'App/Play
 * Store — distinct de `PushPrimingScreen`, qui lui cible les clients déjà
 * connectés pour amorcer la popup système de notifications.
 *
 * Montré une seule fois par appareil, avant même l'écran de connexion — voir
 * `hasSeenAppOnboarding`/`markAppOnboardingSeen` dans `lib/native/onboarding.ts`
 * et le séquencement dans `NativeAppInit.tsx`.
 *
 * Toujours en thème clair, pas de branchement `useTheme()` : c'est un premier
 * écran de découverte, pas une vue authentifiée, et l'app mobile démarre de
 * toute façon en thème clair par défaut.
 *
 * Même langage visuel que le vrai dashboard (`--dashboard-bg`, halos radiaux,
 * picto Q de la sidebar) mais aucun `backdrop-filter` ni `will-change`
 * (règle CLAUDE.md) — uniquement des dégradés et des ombres classiques.
 */
export function AppOnboardingCarousel({ onFinish }: AppOnboardingCarouselProps) {
  const [step, setStep] = useState(0)
  const [finishing, setFinishing] = useState<'skip' | 'signup' | 'login' | null>(null)
  const touchStart = useRef<{ x: number; y: number } | null>(null)

  const isLast = step === LAST_STEP

  const goNext = () => setStep((s) => Math.min(s + 1, LAST_STEP))

  const finish = (kind: 'skip' | 'signup' | 'login', destination?: '/login' | '/signup') => {
    if (finishing) return
    setFinishing(kind)
    onFinish(destination)
  }

  const handleTouchStart = (e: TouchEvent) => {
    const t = e.touches[0]
    touchStart.current = { x: t.clientX, y: t.clientY }
  }

  const handleTouchEnd = (e: TouchEvent) => {
    const start = touchStart.current
    touchStart.current = null
    if (!start) return

    const t = e.changedTouches[0]
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y

    // Diagonale trop verticale, ou déplacement trop court : pas un swipe de carrousel.
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy)) return

    if (dx < 0) setStep((s) => Math.min(s + 1, LAST_STEP))
    else setStep((s) => Math.max(s - 1, 0))
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-hidden overscroll-contain"
      style={{
        background:
          'linear-gradient(250deg, #EFF6FF 0%, #DBEAFE 20%, #F0F9FF 45%, #F8FAFC 70%, #ffffff 100%)',
        touchAction: 'pan-y',
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Halos — même dégradé que --dashboard-blob1 / --dashboard-blob2 du vrai dashboard */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(circle at 80% 8%, rgba(37,99,235,0.10) 0%, transparent 55%)' }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(circle at 20% 92%, rgba(99,102,241,0.08) 0%, transparent 55%)' }}
      />

      {/* Filigrane Q — même picto que la sidebar (bas-droit, fixe : seul le contenu central défile) */}
      <div
        aria-hidden
        className="pointer-events-none absolute select-none"
        style={{ bottom: -48, right: -70, width: 300, height: 275, opacity: 0.07, transform: 'rotate(-8deg)' }}
      >
        <Image src={PICTO_Q} alt="" width={300} height={275} className="h-full w-full object-contain" sizes="300px" />
      </div>

      {/* Logotype — ancrage de marque, fixe sur les 3 écrans */}
      <div
        className="relative z-10 flex shrink-0 items-center justify-center"
        style={{ paddingTop: 'max(20px, env(safe-area-inset-top, 20px))', paddingBottom: 10 }}
      >
        <Image src={LOGO_URL} alt="Qonforme" width={130} height={25} className="h-[19px] w-auto" sizes="130px" priority />
      </div>

      {/* Pagination + Passer */}
      <div className="relative z-10 flex shrink-0 items-center justify-between px-6">
        <div className="flex items-center gap-1.5">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className="block rounded-full transition-all duration-300"
              style={{
                width: i === step ? 20 : 6,
                height: 6,
                borderRadius: 3,
                background: i === step ? '#2563EB' : '#CBD5E1',
              }}
            />
          ))}
        </div>
        {!isLast && (
          <button
            type="button"
            onClick={() => finish('skip')}
            disabled={finishing !== null}
            className="touch-manipulation text-[13px] font-medium text-slate-400 disabled:opacity-40"
          >
            Passer
          </button>
        )}
      </div>

      {/* Contenu — un panneau par écran, translaté horizontalement au swipe/tap */}
      <div className="relative z-10 flex-1 overflow-hidden">
        <div
          className="flex h-full transition-transform duration-300 ease-out"
          style={{ width: `${STEPS.length * 100}%`, transform: `translateX(-${(step * 100) / STEPS.length}%)` }}
        >
          {STEPS.map(({ Icon, title, subtitle }, i) => (
            <div
              key={i}
              className="flex flex-col items-center justify-center gap-[30px] px-9"
              style={{ width: `${100 / STEPS.length}%`, flexShrink: 0 }}
            >
              <div className="relative h-[88px] w-[88px] shrink-0">
                {/* Halo doux derrière le badge — dégradé simple, pas de filter/backdrop-filter */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute -inset-[26px] rounded-full"
                  style={{
                    background:
                      'radial-gradient(circle, rgba(37,99,235,0.20) 0%, rgba(37,99,235,0.08) 45%, transparent 72%)',
                  }}
                />
                <div
                  className="relative flex h-[88px] w-[88px] items-center justify-center rounded-[24px] bg-[#EFF6FF]"
                  style={{ boxShadow: '0 14px 28px -10px rgba(37,99,235,0.35)' }}
                >
                  <Icon className="h-10 w-10 text-[#2563EB]" strokeWidth={2} />
                </div>
              </div>

              <div className="flex flex-col items-center gap-3">
                <h1
                  className="text-center text-[27px] font-extrabold leading-[1.15] tracking-tight text-[#0F172A]"
                  style={{ fontFamily: 'var(--font-bricolage, inherit)' }}
                >
                  {title}
                </h1>
                <p className="max-w-[290px] text-center text-[15px] leading-relaxed text-[#64748B]">
                  {subtitle}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action */}
      <div
        className="relative z-10 flex shrink-0 flex-col items-center gap-3.5 px-6"
        style={{ paddingBottom: 'max(40px, calc(env(safe-area-inset-bottom, 0px) + 24px))' }}
      >
        {!isLast ? (
          <button
            type="button"
            onClick={goNext}
            className="flex min-h-[52px] w-full touch-manipulation items-center justify-center gap-2 rounded-[14px] bg-[#2563EB] text-[15px] font-semibold text-white active:scale-[0.98]"
            style={{ boxShadow: '0 16px 28px -10px rgba(37,99,235,0.45)', transition: 'transform 150ms' }}
          >
            Suivant
            <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => finish('signup', '/signup')}
              disabled={finishing !== null}
              className="flex min-h-[52px] w-full touch-manipulation items-center justify-center gap-2 rounded-[14px] bg-[#2563EB] text-[15px] font-semibold text-white active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100"
              style={{ boxShadow: '0 16px 28px -10px rgba(37,99,235,0.45)', transition: 'transform 150ms' }}
            >
              {finishing === 'signup' && <Loader2 className="h-4 w-4 animate-spin" />}
              Créer un compte gratuitement
            </button>
            <button
              type="button"
              onClick={() => finish('login', '/login')}
              disabled={finishing !== null}
              className="touch-manipulation text-[14px] text-[#64748B] disabled:opacity-50"
            >
              {finishing === 'login' ? (
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Connexion…
                </span>
              ) : (
                "J'ai déjà un compte"
              )}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
