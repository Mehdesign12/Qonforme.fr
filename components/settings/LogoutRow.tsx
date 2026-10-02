"use client"

/** Dernière ligne de l'accueil des paramètres : se déconnecter (application) ou quitter la démo. */
import Link from "next/link"
import { House, LogOut } from "lucide-react"
import { useLogout } from "@/components/layout/useLogout"
import type { ShellMode } from "@/components/layout/nav"

export function LogoutRow({ mode, email }: { mode: ShellMode; email: string }) {
  if (mode === "demo") {
    return (
      <Link href="/" className="q-list-row !px-3.5 !py-2.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-[var(--q-sunken)] text-[var(--q-text-3)]">
          <House className="size-[18px]" strokeWidth={1.75} aria-hidden />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-[15px] font-semibold">Quitter la démo</span>
          <span className="truncate text-[13px] text-[var(--q-text-4)]">Retour à l&apos;accueil de Qonforme</span>
        </span>
      </Link>
    )
  }
  return <AppLogoutRow email={email} />
}

function AppLogoutRow({ email }: { email: string }) {
  const logout = useLogout()
  return (
    <button type="button" onClick={() => void logout()} className="q-list-row w-full !px-3.5 !py-2.5 text-left">
      <span className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-[var(--q-danger-bg)] text-[var(--q-danger)]">
        <LogOut className="size-[18px]" strokeWidth={1.75} aria-hidden />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[15px] font-semibold text-[var(--q-danger)]">Se déconnecter</span>
        {email && <span className="truncate text-[13px] text-[var(--q-text-4)]">{email}</span>}
      </span>
    </button>
  )
}
