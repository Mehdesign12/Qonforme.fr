"use client"

/**
 * Paramètres › Modèles de documents › « Modèle de mise en page » : cinq
 * habillages des PDF (lib/pdf/theme.ts), le même pour tous les documents ou un
 * par type (devis, facture, avoir, bon de commande). Vignettes aux couleurs de
 * l'entreprise ; « Voir un exemple » ouvre un vrai PDF du modèle (devis ou
 * facture fictifs, filigranés).
 *
 * Masquée tant que la migration 20261010_document_templates.sql n'est pas
 * appliquée. Démo (`mode="demo"`) : le choix change à l'écran, rien n'est
 * enregistré.
 */
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Check, ExternalLink, Loader2 } from "lucide-react"
import { Switch } from "@/components/app/kit"
import { SettingsCard } from "@/components/settings/ui"
import type { ShellMode } from "@/components/layout/nav"
import { cn } from "@/lib/utils"
import {
  DOC_TEMPLATES, TEMPLATE_DOCS, parseDocumentTemplates, type DocTemplate, type DocumentTemplates, type TemplateDoc,
} from "@/lib/pdf/theme"

const allSame = (t: DocumentTemplates) => new Set(TEMPLATE_DOCS.map((d) => t[d.id] ?? "classique")).size === 1

export function DocumentTemplatesCard({ mode = "app", accent = "#2563EB" }: { mode?: ShellMode; accent?: string }) {
  const demo = mode === "demo"
  const [available, setAvailable] = useState<boolean | null>(demo ? true : null)
  const [templates, setTemplates] = useState<DocumentTemplates>({})
  const [same, setSame] = useState(true)
  const [doc, setDoc] = useState<TemplateDoc>("invoice")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (demo) return
    fetch("/api/document-templates")
      .then((r) => r.json())
      .then((json) => {
        if (!json.available) { setAvailable(false); return }
        const t = parseDocumentTemplates(json.templates)
        setTemplates(t)
        setSame(allSame(t))
        setAvailable(true)
      })
      .catch(() => setAvailable(false))
  }, [demo])

  const current: DocTemplate = templates[doc] ?? "classique"
  const usedBy = useMemo(() => {
    const map = new Map<DocTemplate, string[]>()
    for (const d of TEMPLATE_DOCS) {
      const t = templates[d.id] ?? "classique"
      map.set(t, [...(map.get(t) ?? []), d.label])
    }
    return map
  }, [templates])

  if (!available) return null

  const save = async (next: DocumentTemplates, name: string, scope: string) => {
    const previous = templates
    setTemplates(next)
    if (demo) { toast(`Modèle « ${name} » appliqué ${scope} (démonstration)`); return }
    setSaving(true)
    try {
      const res = await fetch("/api/document-templates", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ templates: next }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { setTemplates(previous); toast.error(json.error ?? "Modèle non enregistré"); return }
      setTemplates(parseDocumentTemplates(json.templates))
      toast.success(`Modèle « ${name} » appliqué ${scope}`)
    } catch {
      setTemplates(previous)
      toast.error("Erreur réseau")
    } finally {
      setSaving(false)
    }
  }

  const pick = (id: DocTemplate) => {
    const name = DOC_TEMPLATES.find((t) => t.id === id)!.name
    if (same) {
      void save(Object.fromEntries(TEMPLATE_DOCS.map((d) => [d.id, id])) as DocumentTemplates, name, "à tous vos documents")
    } else {
      void save({ ...templates, [doc]: id }, name, `à vos ${TEMPLATE_DOCS.find((d) => d.id === doc)!.plural}`)
    }
  }

  const toggleSame = (v: boolean) => {
    setSame(v)
    if (v && !allSame(templates)) {
      const name = DOC_TEMPLATES.find((t) => t.id === current)!.name
      void save(Object.fromEntries(TEMPLATE_DOCS.map((d) => [d.id, current])) as DocumentTemplates, name, "à tous vos documents")
    }
  }

  const sampleDoc = doc === "quote" || doc === "purchase_order" ? "quote" : "invoice"
  const sampleHref = `/api/document-templates/sample?doc=${sampleDoc}&template=${current}`

  return (
    <SettingsCard
      id="modele"
      title="Modèle de mise en page"
      description="L'habillage de vos PDF. Les mentions, les montants et le Factur-X restent les mêmes : seul le style change."
    >
      {!same && (
        <div className="q-seg self-start flex-wrap" role="radiogroup" aria-label="Document à régler">
          {TEMPLATE_DOCS.map((d) => (
            <button key={d.id} type="button" role="radio" aria-checked={doc === d.id} className={doc === d.id ? "is-active" : undefined} onClick={() => setDoc(d.id)}>
              {d.label}
            </button>
          ))}
        </div>
      )}

      <div role="radiogroup" aria-label="Modèles de mise en page" className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {DOC_TEMPLATES.map((t) => {
          const on = current === t.id
          const used = usedBy.get(t.id) ?? []
          return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={`Modèle ${t.name}`}
              disabled={saving}
              onClick={() => pick(t.id)}
              className={cn(
                "relative flex min-w-0 flex-col gap-2 rounded-2xl border bg-[var(--q-surface)] p-2 pb-3 text-left transition-shadow",
                on ? "border-2 border-[var(--q-accent)] shadow-[0_0_0_4px_rgba(37,99,235,.12)]" : "border-[var(--q-line)] hover:border-[var(--q-field)]",
              )}
            >
              <span className="relative block h-[150px] overflow-hidden rounded-[10px] bg-[#E9EDF4]">
                <Thumb id={t.id} accent={accent} />
              </span>
              <span className="flex items-center justify-between gap-1.5 px-1">
                <strong className="text-[14px] font-semibold">{t.name}</strong>
                {t.badge && <span className="rounded-full bg-[var(--q-warn-bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--q-warn)]">{t.badge}</span>}
              </span>
              <span className="px-1 text-[12px] leading-snug text-[var(--q-text-4)]">{t.desc}</span>
              <span className={cn("px-1 text-[11px] font-semibold", used.length ? "text-[var(--q-accent-strong)]" : "text-[var(--q-text-4)]")}>
                {used.length === TEMPLATE_DOCS.length ? "Tous les documents" : used.length ? used.join(", ") : "Non utilisé"}
              </span>
              {on && (
                <span className="absolute right-3.5 top-3.5 grid size-6 place-items-center rounded-full bg-[var(--q-accent)] text-white shadow">
                  <Check className="size-3.5" strokeWidth={3} aria-hidden />
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-[var(--q-surface-2)] px-3.5 py-3">
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[14px] font-semibold">Même modèle pour tous les documents</span>
          <span className="text-[13px] text-[var(--q-text-4)]">
            {same ? "Devis, factures, avoirs et bons de commande partagent le modèle choisi." : `Choisissez le document ci-dessus, puis son modèle : ici, vos ${TEMPLATE_DOCS.find((d) => d.id === doc)!.plural}.`}
          </span>
        </span>
        <Switch checked={same} onCheckedChange={toggleSame} label="Même modèle pour tous les documents" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[13px] text-[var(--q-text-4)]">
          {saving ? <span className="inline-flex items-center gap-1.5"><Loader2 className="size-3.5 animate-spin" aria-hidden />Enregistrement…</span> : "Enregistré à chaque choix."}
        </span>
        {demo ? (
          <button type="button" className="q-btn q-btn-secondary q-btn-sm" onClick={() => toast("Créez un compte pour voir un exemple à vos couleurs", { action: { label: "S'inscrire", onClick: () => { window.location.href = "/signup" } } })}>
            <ExternalLink aria-hidden />
            Voir un exemple (PDF)
          </button>
        ) : (
          <a href={sampleHref} target="_blank" rel="noopener" className="q-btn q-btn-secondary q-btn-sm">
            <ExternalLink aria-hidden />
            Voir un exemple de {sampleDoc === "quote" ? "devis" : "facture"} (PDF)
          </a>
        )}
      </div>
    </SettingsCard>
  )
}

/* ------------------------------------------------------------------ */
/* Vignettes : schémas de page aux couleurs de l'entreprise            */
/* ------------------------------------------------------------------ */

const Bar = ({ w, h = 4, c = "#E2E8F0", className }: { w: string; h?: number; c?: string; className?: string }) => (
  <span className={cn("block rounded-[2px]", className)} style={{ width: w, height: h, background: c }} />
)

function Rows({ n = 3 }: { n?: number }) {
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className="flex justify-between gap-1.5">
          <Bar w={i % 2 ? "52%" : "62%"} h={3} />
          <Bar w="18%" h={3} />
        </span>
      ))}
    </>
  )
}

function Thumb({ id, accent }: { id: DocTemplate; accent: string }) {
  const tintBg = `color-mix(in srgb, ${accent} 12%, white)`
  const paper = "absolute inset-x-4 inset-y-2.5 flex flex-col gap-1.5 overflow-hidden rounded-[3px] bg-white p-2.5 shadow-[0_1px_2px_rgba(10,17,34,.1),0_8px_18px_-10px_rgba(10,17,34,.35)]"
  switch (id) {
    case "chantier":
      return (
        <span className={paper} aria-hidden>
          <span className="-mx-2.5 -mt-2.5 flex items-center justify-between bg-[#0A1122] px-2.5 py-2">
            <Bar w="40px" c="#FFFFFF" /><Bar w="22px" h={5} c="#8FB0FF" />
          </span>
          <Bar w="45%" h={3} c="#94A3B8" />
          <span className="mt-1 block h-px bg-[#0A1122]" />
          <Rows />
          <span className="mt-auto self-end"><Bar w="46px" h={9} c="#0A1122" /></span>
        </span>
      )
    case "moderne":
      return (
        <span className={paper} aria-hidden>
          <span className="flex items-center justify-between"><Bar w="34px" c={accent} /><Bar w="28px" h={6} c={accent} /></span>
          <span className="block rounded-[3px] p-1.5" style={{ background: tintBg }}><Bar w="70%" h={3} c="#64748B" /></span>
          <Rows />
          <span className="mt-auto self-end"><Bar w="46px" h={9} c={accent} /></span>
        </span>
      )
    case "epure":
      return (
        <span className={paper} aria-hidden>
          <span className="flex items-center justify-between"><Bar w="38px" h={3} c="#0F172A" /><Bar w="30px" h={3} c="#0F172A" /></span>
          <span className="block h-px bg-[#0F172A]" />
          <Bar w="36%" h={3} c="#CBD5E1" />
          <Rows />
          <span className="mt-auto flex flex-col items-end gap-1"><span className="block h-px w-12 bg-[#0F172A]" /><Bar w="40px" h={4} c="#0F172A" /></span>
        </span>
      )
    case "prestige":
      return (
        <span className={paper} aria-hidden>
          <span className="flex items-center justify-between"><Bar w="36px" c="#475569" /><Bar w="28px" h={5} c={accent} /></span>
          <span className="block border-t-[3px] border-double border-[#0F172A]" />
          <Bar w="40%" h={3} c="#CBD5E1" />
          <Rows />
          <span className="mt-auto self-end rounded-[3px] border-[1.5px] px-2 py-1" style={{ borderColor: accent }}><Bar w="30px" h={3} c={accent} /></span>
        </span>
      )
    default:
      return (
        <span className={paper} aria-hidden>
          <span className="flex items-center justify-between"><Bar w="38px" c={accent} /><Bar w="28px" h={5} c="#0F172A" /></span>
          <Bar w="100%" h={3} c={accent} />
          <span className="block rounded-[2px] bg-[#EEF3FF] p-1"><Bar w="30%" h={3} c="#94A3B8" /></span>
          <Rows />
          <span className="mt-auto flex flex-col items-end gap-1"><span className="block h-[1.5px] w-12" style={{ background: accent }} /><Bar w="40px" h={4} c={accent} /></span>
        </span>
      )
  }
}
