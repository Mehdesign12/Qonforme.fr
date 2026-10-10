"use client"

/** Sélecteur du relevé affiché dans le détail d'une question (`?releve=`). */
import { useRouter } from "next/navigation"

export function RunSelect({
  basePath,
  current,
  options,
}: {
  basePath: string
  current: string
  options: { value: string; label: string }[]
}) {
  const router = useRouter()
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
      <label htmlFor="geo-run" className="q-label">Relevé affiché</label>
      <select
        id="geo-run"
        className="q-input sm:w-auto"
        value={current}
        onChange={(e) => router.push(`${basePath}?releve=${encodeURIComponent(e.target.value)}`, { scroll: false })}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}
