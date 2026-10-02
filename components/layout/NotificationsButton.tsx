'use client'

/**
 * Cloche de la barre supérieure : ce qui demande votre attention.
 * Première version : renvoie vers les factures en retard.
 */
import Link from "next/link"
import { Bell, Clock } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { ShellIdentity } from "@/components/layout/shell"

export function NotificationsButton({ identity }: { identity: ShellIdentity }) {
  const invoicesHref = identity.mode === "demo" ? "/demo/invoices" : "/invoices"
  return (
    <Popover>
      <PopoverTrigger
        className="grid size-[38px] place-items-center rounded-[10px] text-[var(--q-text-2)] transition-colors hover:bg-[var(--q-hover)]"
        aria-label="À surveiller"
      >
        <Bell className="size-[18px]" strokeWidth={1.75} aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={10} className="w-[320px] rounded-[14px] border border-[var(--q-line)] bg-[var(--q-surface)] p-2 shadow-[var(--q-shadow-pop)]">
        <p className="px-2 pb-2 pt-1 text-sm font-semibold text-[var(--q-ink)]">À surveiller</p>
        <Link href={invoicesHref} className="flex items-center gap-3 rounded-[10px] px-2 py-2.5 hover:bg-[var(--q-hover)]">
          <span className="grid size-8 place-items-center rounded-[9px] bg-[var(--q-warn-bg)] text-[var(--q-warn)]">
            <Clock className="size-4" aria-hidden />
          </span>
          <span className="flex flex-col">
            <span className="text-sm font-semibold text-[var(--q-ink)]">Factures en retard</span>
            <span className="text-xs text-[var(--q-text-4)]">Voir les factures à relancer</span>
          </span>
        </Link>
      </PopoverContent>
    </Popover>
  )
}
