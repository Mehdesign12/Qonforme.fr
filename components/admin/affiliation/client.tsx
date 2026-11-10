"use client"

/**
 * Admin › Affiliation : parties interactives (fenêtres, contrôle des pages,
 * générateur de liens, recommandations, lien de statistiques, versement).
 * Les pages sont rendues sur le serveur ; ces composants appellent
 * /api/admin/affiliation/* puis rafraîchissent la page.
 */
import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Check, Copy, ExternalLink, Plus, RefreshCw, Search, Trash2 } from "lucide-react"
import { StatusPill, type Tone } from "@/components/app/kit"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { DEFAULT_MONTHS, DEFAULT_RATE, partnerLink, partnerLinkHtml, slugCode } from "@/lib/affiliation/model"
import { requestMessage, type Recommendation } from "@/lib/affiliation/recommend"
import type { PageRow, PartnerRow } from "@/lib/affiliation/data"

async function api<T = Record<string, unknown>>(url: string, init: RequestInit = {}): Promise<{ ok: boolean; data: T & { error?: string } }> {
  try {
    const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init.headers ?? {}) } })
    const data = (await res.json().catch(() => ({}))) as T & { error?: string }
    return { ok: res.ok, data }
  } catch {
    return { ok: false, data: { error: "Connexion impossible. Réessayez." } as T & { error?: string } }
  }
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

function CopyButton({ text, label = "Copier", className }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false)
  return (
    <Button
      type="button"
      className={className}
      onClick={async () => {
        if (await copyText(text)) {
          setDone(true)
          setTimeout(() => setDone(false), 1800)
        } else toast.error("Copie impossible : sélectionnez le texte à la main.")
      }}
    >
      {done ? <Check aria-hidden /> : <Copy aria-hidden />}
      {done ? "Copié" : label}
    </Button>
  )
}

const fr = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 1 })

/* ------------------------------------------------------------------ */
/* Recommandations                                                     */
/* ------------------------------------------------------------------ */

function RecoLine({ r }: { r: Recommendation }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
      <span className="truncate font-medium text-[var(--q-ink)]">{r.page}</span>
      <span className="text-[13px] text-[var(--q-text-3)]">
        « {r.keyword} »{r.rank ? ` · ${r.rank}ᵉ sur Google` : ""} · ~{fr(r.traffic)} visites/mois (estimation)
      </span>
      <span className="text-[13px]">
        <span className="font-semibold text-[var(--q-accent-strong)]">→ {r.targetTitle}</span>{" "}
        <span className="text-[var(--q-text-4)]">{r.reason}</span>
      </span>
    </span>
  )
}

export function RecommendationsSource({ at }: { at: string | null }) {
  return (
    <p className="q-field-hint">
      Classement Google France (OpenSEO{at ? `, ${new Date(at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}` : ""}) · notre Search Console, 28 jours.
      Trafic : estimation d&apos;OpenSEO, pas une mesure.
    </p>
  )
}

/* ------------------------------------------------------------------ */
/* Nouveau partenaire                                                  */
/* ------------------------------------------------------------------ */

export function NewPartnerButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [site, setSite] = useState("")
  const [code, setCode] = useState("")
  const [codeTouched, setCodeTouched] = useState(false)
  const [email, setEmail] = useState("")
  const [rate, setRate] = useState(String(DEFAULT_RATE))
  const [months, setMonths] = useState(String(DEFAULT_MONTHS))
  const [pages, setPages] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [analysis, setAnalysis] = useState<"idle" | "loading" | "done">("idle")
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [recos, setRecos] = useState<Recommendation[]>([])
  const [picked, setPicked] = useState<Set<number>>(new Set())

  const reset = () => {
    setName(""); setSite(""); setCode(""); setCodeTouched(false); setEmail(""); setRate(String(DEFAULT_RATE)); setMonths(String(DEFAULT_MONTHS))
    setPages(""); setError(null); setAnalysis("idle"); setAnalysisError(null); setRecos([]); setPicked(new Set())
  }

  async function analyze() {
    if (!site.trim()) {
      setAnalysisError("Indiquez d'abord le site du partenaire.")
      return
    }
    setAnalysis("loading")
    setAnalysisError(null)
    const { ok, data } = await api<{ recommendations: Recommendation[] }>("/api/admin/affiliation/analyze", { method: "POST", body: JSON.stringify({ site }) })
    if (!ok) {
      setAnalysis("idle")
      setAnalysisError(data.error ?? "L'analyse n'a pas abouti.")
      return
    }
    setRecos(data.recommendations ?? [])
    setPicked(new Set((data.recommendations ?? []).slice(0, 2).map((_, i) => i)))
    setAnalysis("done")
  }

  async function create() {
    setBusy(true)
    setError(null)
    const { ok, data } = await api<{ id: string }>("/api/admin/affiliation/partners", {
      method: "POST",
      body: JSON.stringify({
        name,
        site,
        code: code || slugCode(name),
        contact_email: email,
        commission_rate: rate.replace(",", "."),
        commission_months: months,
        pages: pages.split("\n").map((p) => p.trim()).filter(Boolean),
        proposed: recos.filter((_, i) => picked.has(i)).map((r) => ({ page: r.page, targetPath: r.targetPath })),
        recommendations: recos.length ? recos : undefined,
      }),
    })
    setBusy(false)
    if (!ok) {
      setError(data.error ?? "Le partenaire n'a pas pu être créé.")
      return
    }
    toast.success("Partenaire créé : donnez-lui son lien")
    setOpen(false)
    reset()
    router.push(`/admin/affiliation/${data.id}?onglet=lien`)
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus aria-hidden />
        Nouveau partenaire
      </Button>
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset() }}>
        <DialogContent className="max-h-[92dvh] gap-4 overflow-y-auto sm:max-w-xl">
          <div className="flex flex-col gap-1 pr-8">
            <DialogTitle>Nouveau partenaire</DialogTitle>
            <DialogDescription>Un site qui cite Qonforme. Son code sert à suivre ses liens (?ref=).</DialogDescription>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="q-label">Nom</span>
              <Input value={name} onChange={(e) => { setName(e.target.value); if (!codeTouched) setCode(slugCode(e.target.value)) }} placeholder="Le Mag du Bâtiment" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="q-label">Site</span>
              <Input value={site} onChange={(e) => setSite(e.target.value)} placeholder="mag-batiment.fr" inputMode="url" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="q-label">Code du lien</span>
              <Input value={code} onChange={(e) => { setCode(slugCode(e.target.value)); setCodeTouched(true) }} className="font-mono" />
              <span className="q-field-hint">?ref={code || "code"}</span>
            </label>
            <label className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="q-label">Email du contact</span>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="redaction@…" />
              <span className="q-field-hint">Il reçoit le lien de ses statistiques. Jamais affiché sur sa page.</span>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="q-label">Commission (%)</span>
              <Input value={rate} onChange={(e) => setRate(e.target.value)} inputMode="decimal" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="q-label">Pendant (mois)</span>
              <Input value={months} onChange={(e) => setMonths(e.target.value)} inputMode="numeric" />
              <span className="q-field-hint">après l&apos;inscription du client</span>
            </label>

            <div className="flex flex-col gap-2 rounded-xl border border-[var(--q-wash-line)] bg-[var(--q-wash)] p-3 sm:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-[var(--q-ink)]">Où demander le lien ?</span>
                {analysis !== "done" && (
                  <Button size="sm" onClick={analyze} disabled={analysis === "loading"}>
                    <Search aria-hidden />
                    {analysis === "loading" ? "Analyse…" : "Analyser le site"}
                  </Button>
                )}
                {analysis === "done" && <StatusPill tone="ok">{recos.length} page{recos.length > 1 ? "s" : ""} recommandée{recos.length > 1 ? "s" : ""}</StatusPill>}
              </div>
              {analysis === "idle" && !analysisError && (
                <p className="q-field-hint">
                  Lit le classement Google France des pages du site (OpenSEO) et les rapproche de nos pages et de notre Search Console.
                  Un appel payant d&apos;OpenSEO ; le résultat est gardé 30 jours.
                </p>
              )}
              {analysis === "loading" && <p className="text-sm text-[var(--q-text-3)]">Pages classées, mots-clés, trafic estimé…</p>}
              {analysisError && <p className="q-field-error">{analysisError}</p>}
              {analysis === "done" && recos.length === 0 && (
                <p className="text-sm text-[var(--q-text-3)]">Aucune page de ce site n&apos;est classée sur un sujet proche des nôtres.</p>
              )}
              {analysis === "done" && recos.length > 0 && (
                <>
                  <ul className="flex flex-col gap-2">
                    {recos.map((r, i) => {
                      const on = picked.has(i)
                      return (
                        <li key={r.page}>
                          <button
                            type="button"
                            aria-pressed={on}
                            onClick={() => setPicked((prev) => { const n = new Set(prev); if (n.has(i)) n.delete(i); else n.add(i); return n })}
                            className={cn(
                              "flex w-full items-start gap-3 rounded-xl border bg-[var(--q-surface)] p-3 text-sm",
                              on ? "border-[var(--q-accent)]" : "border-[var(--q-line)]",
                            )}
                          >
                            <span
                              aria-hidden
                              className={cn(
                                "mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-[5px] border-2 text-white",
                                on ? "border-[var(--q-accent)] bg-[var(--q-accent)]" : "border-[var(--q-field)]",
                              )}
                            >
                              {on && <Check className="size-3" strokeWidth={3} />}
                            </span>
                            <RecoLine r={r} />
                            <StatusPill tone="info">{r.score}/100</StatusPill>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                  <p className="q-field-hint">Cochées : enregistrées comme « pages à proposer ».</p>
                  <RecommendationsSource at={null} />
                </>
              )}
            </div>

            <label className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="q-label">Pages qui citent déjà Qonforme</span>
              <Textarea value={pages} onChange={(e) => setPages(e.target.value)} placeholder="Une adresse par ligne" rows={3} />
              <span className="q-field-hint">Vérifiées chaque semaine : présence du lien et attribut (suivi, nofollow…).</span>
            </label>
          </div>
          {error && <p className="q-field-error">{error}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={create} disabled={busy || !name.trim()}>{busy ? "Création…" : "Créer le partenaire"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Modifier                                                            */
/* ------------------------------------------------------------------ */

export function EditPartnerButton({ partner }: { partner: Pick<PartnerRow, "id" | "name" | "site" | "contact_email" | "commission_rate" | "commission_months" | "status" | "notes"> }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(partner.name)
  const [site, setSite] = useState(partner.site)
  const [email, setEmail] = useState(partner.contact_email ?? "")
  const [rate, setRate] = useState(String(partner.commission_rate))
  const [months, setMonths] = useState(String(partner.commission_months))
  const [notes, setNotes] = useState(partner.notes ?? "")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function save(extra: Record<string, unknown> = {}) {
    setBusy(true)
    setError(null)
    const { ok, data } = await api(`/api/admin/affiliation/partners/${partner.id}`, {
      method: "PATCH",
      body: JSON.stringify({ name, site, contact_email: email || null, commission_rate: rate.replace(",", "."), commission_months: months, notes: notes || null, ...extra }),
    })
    setBusy(false)
    if (!ok) {
      setError(data.error ?? "Enregistrement impossible.")
      return
    }
    toast.success(extra.status === "archived" ? "Partenaire archivé" : extra.status === "active" ? "Partenaire réactivé" : "Enregistré")
    setOpen(false)
    router.refresh()
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>Modifier</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92dvh] gap-4 overflow-y-auto sm:max-w-lg">
          <div className="flex flex-col gap-1 pr-8">
            <DialogTitle>Modifier {partner.name}</DialogTitle>
            <DialogDescription>Le code du lien ne change pas : les liens déjà publiés continuent de compter.</DialogDescription>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 sm:col-span-2"><span className="q-label">Nom</span><Input value={name} onChange={(e) => setName(e.target.value)} /></label>
            <label className="flex flex-col gap-1.5"><span className="q-label">Site</span><Input value={site} onChange={(e) => setSite(e.target.value)} /></label>
            <label className="flex flex-col gap-1.5"><span className="q-label">Email du contact</span><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <label className="flex flex-col gap-1.5"><span className="q-label">Commission (%)</span><Input value={rate} onChange={(e) => setRate(e.target.value)} inputMode="decimal" /></label>
            <label className="flex flex-col gap-1.5">
              <span className="q-label">Pendant (mois)</span>
              <Input value={months} onChange={(e) => setMonths(e.target.value)} inputMode="numeric" />
            </label>
            <p className="q-field-hint sm:col-span-2">Un nouveau taux vaut pour les paiements à venir ; une commission déjà enregistrée garde le sien.</p>
            <label className="flex flex-col gap-1.5 sm:col-span-2"><span className="q-label">Notes (privées)</span><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} /></label>
          </div>
          {error && <p className="q-field-error">{error}</p>}
          <div className="flex flex-wrap justify-between gap-2">
            {partner.status === "active" ? (
              <Button variant="destructive" onClick={() => save({ status: "archived" })} disabled={busy}>Archiver</Button>
            ) : (
              <Button variant="outline" onClick={() => save({ status: "active" })} disabled={busy}>Réactiver</Button>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
              <Button onClick={() => save()} disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer"}</Button>
            </div>
          </div>
          {partner.status === "active" && <p className="q-field-hint">Archiver : ses liens ne comptent plus et son lien de statistiques est coupé. Ses chiffres restent.</p>}
        </DialogContent>
      </Dialog>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Pages et liens                                                      */
/* ------------------------------------------------------------------ */

const STATUS_PILL: Record<PageRow["status"], { label: string; tone: Tone }> = {
  found: { label: "Lien trouvé", tone: "ok" },
  missing: { label: "Lien introuvable", tone: "danger" },
  proposed: { label: "À proposer", tone: "info" },
  unchecked: { label: "À vérifier", tone: "neutral" },
  error: { label: "Page injoignable", tone: "warn" },
}

const REL_PILL: Record<NonNullable<PageRow["rel"]>, { label: string; tone: Tone }> = {
  follow: { label: "Suivi", tone: "ok" },
  nofollow: { label: "nofollow", tone: "warn" },
  sponsored: { label: "sponsored", tone: "warn" },
  ugc: { label: "ugc", tone: "warn" },
}

function checkedText(p: PageRow): string {
  if (p.status === "proposed" && !p.last_checked_at) return "Proposée au partenaire"
  if (!p.last_checked_at) return "Pas encore vérifiée"
  const d = new Date(p.last_checked_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "Europe/Paris" })
  if (p.check_error) return `${p.check_error} (le ${d})`
  if (p.status === "missing" && p.last_found_at) {
    return `Lien absent le ${d} (présent le ${new Date(p.last_found_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "Europe/Paris" })})`
  }
  return `Vérifiée le ${d}`
}

export function PagesPanel({ partnerId, pages, visitsByPath }: { partnerId: string; pages: PageRow[]; visitsByPath: { path: string; count: number }[] }) {
  const router = useRouter()
  const [url, setUrl] = useState("")
  const [busy, setBusy] = useState<string | null>(null)
  const visits = new Map(visitsByPath.map((v) => [v.path, v.count]))

  async function add() {
    if (!url.trim()) return
    setBusy("add")
    const { ok, data } = await api<{ page: PageRow }>(`/api/admin/affiliation/partners/${partnerId}/pages`, { method: "POST", body: JSON.stringify({ url }) })
    setBusy(null)
    if (!ok) return toast.error(data.error ?? "La page n'a pas pu être ajoutée.")
    const p = data.page
    toast.success(p.status === "found" ? `Page ajoutée : lien trouvé${p.rel && p.rel !== "follow" ? ` (${p.rel})` : ""}` : p.status === "error" ? "Page ajoutée, mais injoignable pour le moment" : "Page ajoutée : aucun lien vers Qonforme pour l'instant")
    setUrl("")
    router.refresh()
  }

  async function check(id: string) {
    setBusy(id)
    const { ok, data } = await api<{ page: PageRow }>(`/api/admin/affiliation/partners/${partnerId}/pages?page=${id}`, { method: "PATCH" })
    setBusy(null)
    if (!ok) return toast.error(data.error ?? "Contrôle impossible.")
    toast.success(data.page.status === "found" ? "Lien trouvé" : data.page.status === "missing" ? "Lien introuvable sur la page" : data.page.status === "proposed" ? "Pas encore de lien : la page reste à proposer" : "Page vérifiée")
    router.refresh()
  }

  async function remove(id: string) {
    if (!window.confirm("Retirer cette page du suivi ?")) return
    setBusy(id)
    const { ok, data } = await api(`/api/admin/affiliation/partners/${partnerId}/pages?page=${id}`, { method: "DELETE" })
    setBusy(null)
    if (!ok) return toast.error(data.error ?? "Retrait impossible.")
    router.refresh()
  }

  const notFollowed = pages.some((p) => p.status === "found" && p.rel && p.rel !== "follow")
  return (
    <div className="flex flex-col gap-4">
      <div className="q-card overflow-x-auto">
        {pages.length === 0 ? (
          <p className="p-6 text-center text-sm text-[var(--q-text-4)]">Aucune page enregistrée. Ajoutez celles qui citent Qonforme, ou analysez le site dans « Générer un lien ».</p>
        ) : (
          <table className="q-table">
            <thead>
              <tr><th>Page du partenaire</th><th>Lien vers</th><th>État</th><th>Attribut</th><th className="q-num">Visites 30 j</th><th /></tr>
            </thead>
            <tbody>
              {pages.map((p) => {
                const st = STATUS_PILL[p.status]
                const rel = p.status === "found" && p.rel ? REL_PILL[p.rel] : null
                return (
                  <tr key={p.id}>
                    <td className="max-w-[340px]">
                      <a href={`https://${p.url}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 truncate font-medium text-[var(--q-ink)] hover:text-[var(--q-accent-strong)]">
                        <span className="truncate">{p.url}</span>
                        <ExternalLink className="size-3.5 shrink-0" aria-hidden />
                      </a>
                      <span className="text-xs text-[var(--q-text-4)]">{checkedText(p)}</span>
                    </td>
                    <td><span className="font-mono text-[13px] text-[var(--q-text-2)]">{p.target_path ?? "—"}</span></td>
                    <td><StatusPill tone={st.tone}>{st.label}</StatusPill></td>
                    <td>{rel ? <StatusPill tone={rel.tone}>{rel.label}</StatusPill> : <span className="text-[var(--q-text-4)]">—</span>}</td>
                    <td className="q-num">{p.target_path ? (visits.get(p.target_path) ?? 0).toLocaleString("fr-FR") : "—"}</td>
                    <td className="whitespace-nowrap text-right">
                      <Button size="sm" variant="outline" onClick={() => check(p.id)} disabled={busy === p.id}>
                        <RefreshCw aria-hidden className={cn(busy === p.id && "animate-spin")} />
                        Vérifier
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(p.id)} disabled={busy === p.id} aria-label={`Retirer ${p.url}`}>
                        <Trash2 aria-hidden />
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
      {notFollowed && <p className="text-[13px] text-[var(--q-warn)]">« nofollow », « sponsored » ou « ugc » : la visite est comptée, mais le lien ne transmet pas de valeur SEO.</p>}
      <div className="q-card flex flex-wrap items-end gap-3 p-4">
        <label className="flex min-w-0 flex-1 basis-[320px] flex-col gap-1.5">
          <span className="q-label">Ajouter une page qui cite Qonforme</span>
          <Input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" onKeyDown={(e) => { if (e.key === "Enter") add() }} />
        </label>
        <Button onClick={add} disabled={busy === "add" || !url.trim()}>{busy === "add" ? "Vérification…" : "Ajouter et vérifier"}</Button>
      </div>
      <p className="q-field-hint">
        Visites par page de Qonforme visée. Chaque semaine, la tâche planifiée ouvre ces pages, cherche le lien vers qonforme.fr et lit son attribut.
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Générer un lien                                                     */
/* ------------------------------------------------------------------ */

export function LinkGenerator({
  partnerId,
  code,
  site,
  targets,
  recommendations,
  recommendationsAt,
}: {
  partnerId: string
  code: string
  site: string
  targets: { title: string; path: string }[]
  recommendations: Recommendation[]
  recommendationsAt: string | null
}) {
  const router = useRouter()
  const [target, setTarget] = useState(recommendations[0]?.targetPath ?? targets[0]?.path ?? "/")
  const [selected, setSelected] = useState<number | null>(null)
  const [recos, setRecos] = useState(recommendations)
  const [at, setAt] = useState(recommendationsAt)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const allTargets = [...targets]
  for (const r of recos) if (!allTargets.some((t) => t.path === r.targetPath)) allTargets.push({ title: r.targetTitle, path: r.targetPath })
  const url = partnerLink(target, code)
  const anchor = selected !== null ? recos[selected]?.anchor ?? "Qonforme" : allTargets.find((t) => t.path === target)?.title ?? "Qonforme"
  const html = partnerLinkHtml(target, code, anchor)
  const message = selected !== null && recos[selected] ? requestMessage(recos[selected], partnerLink(recos[selected].targetPath, code)) : ""

  async function analyze(force: boolean) {
    if (!site) {
      setError("Ajoutez d'abord le site du partenaire (Modifier).")
      return
    }
    setLoading(true)
    setError(null)
    const { ok, data } = await api<{ recommendations: Recommendation[]; analyzedAt: string; cached: boolean }>("/api/admin/affiliation/analyze", {
      method: "POST",
      body: JSON.stringify({ site, partnerId, force }),
    })
    setLoading(false)
    if (!ok) {
      setError(data.error ?? "L'analyse n'a pas abouti.")
      return
    }
    setRecos(data.recommendations ?? [])
    setAt(data.analyzedAt)
    setSelected(null)
    if (data.cached) toast.message("Analyse de moins de 30 jours : résultat gardé")
    router.refresh()
  }

  async function propose(r: Recommendation) {
    const { ok, data } = await api(`/api/admin/affiliation/partners/${partnerId}/pages`, { method: "POST", body: JSON.stringify({ url: r.page, proposedTarget: r.targetPath }) })
    if (!ok) return toast.error(data.error ?? "La page n'a pas pu être enregistrée.")
    toast.success("Page enregistrée « à proposer »")
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="q-card flex flex-col gap-3 p-4 md:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="q-h2">Pages recommandées chez ce partenaire</h2>
          {recos.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => analyze(true)} disabled={loading}>
              <RefreshCw aria-hidden className={cn(loading && "animate-spin")} />
              Relancer l&apos;analyse
            </Button>
          )}
        </div>
        {recos.length === 0 ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="flex-1 basis-[280px] text-sm text-[var(--q-text-3)]">
              {at
                ? "La dernière analyse n'a trouvé aucune page de ce site classée sur un sujet proche des nôtres."
                : `Pas encore d'analyse pour ${site || "ce partenaire"}. Elle classe ses pages par trafic estimé et par proximité avec nos sujets (un appel payant d'OpenSEO).`}
            </p>
            <Button size="sm" onClick={() => analyze(!!at)} disabled={loading}>
              <Search aria-hidden />
              {loading ? "Analyse…" : `Analyser ${site || "le site"}`}
            </Button>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {recos.map((r, i) => (
              <li key={r.page} className={cn("flex flex-wrap items-center gap-3 rounded-xl border p-3", selected === i ? "border-[var(--q-accent)] bg-[var(--q-wash)]" : "border-[var(--q-line)]")}>
                <StatusPill tone="info">{r.score}/100</StatusPill>
                <span className="flex min-w-0 flex-1 basis-[320px]"><RecoLine r={r} /></span>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => propose(r)}>À proposer</Button>
                  <Button size="sm" variant={selected === i ? "default" : "outline"} onClick={() => { setSelected(i); setTarget(r.targetPath) }}>Utiliser</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {error && <p className="q-field-error">{error}</p>}
        {(recos.length > 0 || at) && <RecommendationsSource at={at} />}
        {message && (
          <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-1.5">
              <span className="q-label">Message à envoyer au partenaire</span>
              <Textarea readOnly value={message} rows={6} />
            </label>
            <CopyButton text={message} label="Copier le message" className="self-start" />
          </div>
        )}
      </section>

      <div className="flex flex-wrap items-start gap-4">
        <section className="q-card flex flex-1 basis-[300px] flex-col gap-2 p-4 md:p-5" aria-label="Page de Qonforme visée">
          <h2 className="q-h2 mb-1">Page de Qonforme visée</h2>
          {allTargets.map((t) => (
            <button
              key={t.path}
              type="button"
              aria-pressed={target === t.path}
              onClick={() => { setTarget(t.path); setSelected(null) }}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm",
                target === t.path ? "border-[var(--q-accent)] bg-[var(--q-wash)]" : "border-[var(--q-line)] bg-[var(--q-surface)] hover:bg-[var(--q-hover)]",
              )}
            >
              <span aria-hidden className={cn("size-4 shrink-0 rounded-full border-2", target === t.path ? "border-[5px] border-[var(--q-accent)]" : "border-[var(--q-field)]")} />
              <span className="flex-1 text-[var(--q-ink)]">{t.title}</span>
              <span className="font-mono text-xs text-[var(--q-text-4)]">{t.path}</span>
            </button>
          ))}
        </section>
        <section className="q-card flex min-w-0 flex-[999_1_420px] flex-col gap-3 p-4 md:p-5">
          <h2 className="q-h2">Lien à donner au partenaire</h2>
          <div className="flex flex-wrap gap-2">
            <code className="min-w-0 flex-1 basis-[260px] overflow-x-auto whitespace-nowrap rounded-[10px] border border-[var(--q-field)] bg-[var(--q-surface-2)] px-3 py-2.5 font-mono text-[13px] text-[var(--q-ink)]">{url}</code>
            <CopyButton text={url} />
          </div>
          <p className="q-banner items-start text-[13.5px]">
            Le lien mène directement à la page, sans redirection : le backlink garde sa valeur. La balise canonique de la page retire ?ref=, aucune page en double n&apos;est créée.
          </p>
          <label className="flex flex-col gap-1.5">
            <span className="q-label">Code à coller dans l&apos;article</span>
            <Textarea readOnly value={html} rows={2} className="font-mono text-[13px]" />
          </label>
          <CopyButton text={html} label="Copier le code" className="self-start" />
        </section>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Lien de statistiques                                                */
/* ------------------------------------------------------------------ */

export function StatsLinkButton({ partnerId, partnerName, contact, createdAt, views }: { partnerId: string; partnerName: string; contact: string | null; createdAt: string | null; views: number }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function create(send: boolean) {
    setBusy(true)
    const { ok, data } = await api<{ url: string; sent: boolean }>(`/api/admin/affiliation/partners/${partnerId}/stats-link`, { method: "POST", body: JSON.stringify({ send }) })
    setBusy(false)
    if (!ok) return toast.error(data.error ?? "Le lien n'a pas pu être créé.")
    setUrl(data.url)
    if (data.error) toast.error(data.error)
    else toast.success(data.sent ? `Lien envoyé à ${contact}` : "Nouveau lien créé")
    router.refresh()
  }

  async function revoke() {
    if (!window.confirm("Révoquer le lien ? Le partenaire ne pourra plus ouvrir ses statistiques tant qu'un nouveau lien n'est pas créé.")) return
    setBusy(true)
    const { ok, data } = await api(`/api/admin/affiliation/partners/${partnerId}/stats-link`, { method: "DELETE" })
    setBusy(false)
    if (!ok) return toast.error(data.error ?? "Révocation impossible.")
    setUrl(null)
    toast.success("Lien révoqué")
    router.refresh()
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>Lien de statistiques</Button>
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setUrl(null) }}>
        <DialogContent className="gap-4 sm:max-w-lg">
          <div className="flex flex-col gap-1 pr-8">
            <DialogTitle>Statistiques de {partnerName}</DialogTitle>
            <DialogDescription>
              Un lien privé, sans compte à créer. Le partenaire y voit ses visites, ses inscrits, ses abonnés et sa commission, en chiffres seulement.
            </DialogDescription>
          </div>
          {url ? (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-2">
                <code className="min-w-0 flex-1 basis-[240px] overflow-x-auto whitespace-nowrap rounded-[10px] border border-[var(--q-field)] bg-[var(--q-surface-2)] px-3 py-2.5 font-mono text-[13px]">{url}</code>
                <CopyButton text={url} />
              </div>
              <p className="q-field-hint">Copiez-le maintenant : il ne sera plus affiché (seule son empreinte est gardée).</p>
            </div>
          ) : (
            <p className="text-sm text-[var(--q-text-3)]">
              {createdAt
                ? `Un lien est actif depuis le ${new Date(createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })} · ouvert ${views} fois. Un nouveau lien remplace l'ancien.`
                : "Aucun lien actif."}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => create(false)} disabled={busy}>{createdAt ? "Créer un nouveau lien" : "Créer le lien"}</Button>
            {contact && <Button variant="outline" onClick={() => create(true)} disabled={busy}>Créer et envoyer à {contact}</Button>}
            {createdAt && <Button variant="destructive" onClick={revoke} disabled={busy}>Révoquer</Button>}
          </div>
          {!contact && <p className="q-field-hint">Ajoutez l&apos;email du contact (Modifier) pour l&apos;envoyer par email.</p>}
        </DialogContent>
      </Dialog>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Versement                                                           */
/* ------------------------------------------------------------------ */

export function PayoutButton({ partnerId, amount, partnerName, size = "default" }: { partnerId: string; amount: string; partnerName: string; size?: "default" | "sm" }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  async function pay() {
    if (!window.confirm(`Avez-vous viré ${amount} à ${partnerName} ? Les commissions dues seront notées comme versées.`)) return
    setBusy(true)
    const { ok, data } = await api<{ count: number; cents: number }>("/api/admin/affiliation/payout", { method: "POST", body: JSON.stringify({ partnerId }) })
    setBusy(false)
    if (!ok) return toast.error(data.error ?? "Enregistrement impossible.")
    toast.success(data.count ? `${(data.cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })} notés comme versés` : "Rien à verser")
    router.refresh()
  }
  return (
    <Button size={size} onClick={pay} disabled={busy}>
      {size === "sm" ? "Versé" : `Marquer ${amount} comme versés`}
    </Button>
  )
}
