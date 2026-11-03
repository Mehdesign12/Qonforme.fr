"use client"

import Link from "next/link"
import { X } from "lucide-react"
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import type { ConsentChoice } from "@/lib/consent"

const BUTTON =
  "min-h-[46px] flex-1 rounded-full px-5 text-center text-sm font-semibold transition-colors " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-q-accent"

const LABEL = "text-[11px] font-bold uppercase tracking-[0.07em] text-q-text-3"
const COPY = "mt-1.5 text-sm leading-[1.55] text-q-text-2"

/**
 * Fenêtre « En savoir + » du bandeau de cookies (maquette validée le 02/11/2026) : ce que
 * mesure PostHog (toujours actif, CGU art. 7), ce que demande la publicité (pixel Meta,
 * facultative), ce qui est nécessaire. Ordinateur : fenêtre centrée ; téléphone : feuille
 * qui monte du bas. « Non merci » ne refuse que la publicité, et la fenêtre le dit.
 * Fermer (croix, Échap, clic à côté) ne choisit rien : le bandeau reste.
 */
export function CookieDetails({
  open,
  onOpenChange,
  onChoose,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onChoose: (choice: ConsentChoice) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-cookie-details=""
        showCloseButton={false}
        className={cn(
          "z-[80] max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto p-6 sm:max-w-[580px] md:p-8",
          // Téléphone : feuille qui monte du bas, pleine largeur
          "max-md:!top-auto max-md:!bottom-0 max-md:!left-0 max-md:!max-w-none max-md:!translate-x-0 max-md:!translate-y-0",
          "max-md:max-h-[86dvh] max-md:rounded-b-none max-md:rounded-t-[20px] max-md:pb-[calc(env(safe-area-inset-bottom,0px)_+_1.5rem)]",
        )}
      >
        <DialogClose
          aria-label="Fermer"
          className="absolute right-2 top-2 flex size-11 items-center justify-center rounded-full text-q-text-2 hover:bg-q-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-q-accent"
        >
          <X aria-hidden className="size-5" strokeWidth={1.75} />
        </DialogClose>

        <DialogTitle className="q-display mb-5 mr-10 text-[26px] leading-[1.1] text-[var(--q-ink)] md:text-[30px]">
          Vos cookies, <em className="q-serif">en clair.</em>
        </DialogTitle>

        <div className="flex flex-col gap-[18px]">
          <section>
            <h3 className={LABEL}>Mesure du site · toujours active</h3>
            <p className={COPY}>
              Pages vues, étapes de l&apos;inscription, et un enregistrement de vos parcours pour repérer ce qui bloque.
              Les champs de saisie, les noms de clients et les montants sont masqués. Conservé 30 jours. Vous pouvez vous
              y opposer en écrivant à privacy@qonforme.fr.
            </p>
          </section>
          <section>
            <h3 className={LABEL}>Publicité · facultative</h3>
            <p className={COPY}>
              Le pixel Meta mesure l&apos;efficacité de nos annonces. Il n&apos;est activé que si vous cliquez sur
              «&nbsp;Accepter&nbsp;».
            </p>
          </section>
          <section>
            <h3 className={LABEL}>Nécessaires</h3>
            <p className={COPY}>Connexion, thème d&apos;affichage, mémorisation de ce choix, paiement sécurisé.</p>
          </section>
        </div>

        <p className="mt-5 border-t border-q-line pt-4 text-[13px] leading-[1.5] text-q-text-2">
          «&nbsp;Non merci&nbsp;» refuse seulement la publicité. La mesure du site reste active.{" "}
          <Link
            href="/confidentialite#cookies"
            onClick={() => onOpenChange(false)}
            className="font-medium text-q-accent-strong underline decoration-q-wash-line underline-offset-2 hover:decoration-current"
          >
            Politique de confidentialité
          </Link>
        </p>

        <div className="mt-4 flex gap-2.5">
          <button
            type="button"
            onClick={() => onChoose("refused")}
            className={cn(BUTTON, "border border-q-line bg-q-surface text-q-ink hover:bg-q-hover")}
          >
            Non merci
          </button>
          <button
            type="button"
            onClick={() => onChoose("accepted")}
            className={cn(BUTTON, "border border-q-accent-strong bg-q-accent text-white hover:bg-q-accent-strong")}
          >
            Accepter
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
