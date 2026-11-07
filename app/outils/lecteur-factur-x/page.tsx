"use client"

/**
 * Lecteur Factur-X (outil gratuit) : une facture électronique déposée (PDF
 * Factur-X, XML CII ou UBL) est lue dans le navigateur par les lecteurs de
 * l'import des factures reçues (lib/outils/lecteur-facture.ts). Le fichier
 * n'est envoyé nulle part ; seul un événement sans contenu part vers la mesure
 * (format reconnu, nombre de lignes).
 */
import { useCallback, useId, useRef, useState } from "react"
import Link from "next/link"
import { AlertTriangle, FileSearch, FileUp, Info, Loader2, RotateCcw, ShieldCheck } from "lucide-react"
import { OutilsHero } from "@/components/outils/OutilsHero"
import { OutilsCtaBar } from "@/components/outils/OutilsCtaBar"
import { Callout, JsonLd, Prose, ToolArea, ToolCta, ToolFaq, ToolGuide, ToolLinks, ToolPanel, ToolShell, faqJsonLd, toolJsonLd } from "@/components/outils/kit"
import { ChecksList } from "@/components/reception/ChecksList"
import { ReceivedInvoiceDocument } from "@/components/reception/ReceivedInvoiceDocument"
import { captureEvent } from "@/components/shared/PostHogProvider"
import { MAX_UPLOAD_BYTES } from "@/lib/reception/bytes"
import { FORMAT_LABELS } from "@/lib/reception/types"
import { LECTEUR_FAQ, type LectureFacture } from "@/lib/outils/lecteur-facture"
import { cn } from "@/lib/utils"

const EXAMPLE_URL = "/outils/exemple-facture-factur-x.pdf"

type State = { status: "idle" } | { status: "busy"; name: string } | { status: "done"; name: string; result: LectureFacture }

export default function LecteurFacturXPage() {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<State>({ status: "idle" })
  const [dragOver, setDragOver] = useState(false)

  const read = useCallback(async (file: File | null | undefined, source: "fichier" | "exemple" = "fichier") => {
    if (!file) return
    if (file.size > MAX_UPLOAD_BYTES) {
      setState({ status: "done", name: file.name, result: { ok: false, message: "Fichier trop lourd : 4 Mo au maximum." } })
      return
    }
    if (typeof DecompressionStream === "undefined") {
      setState({ status: "done", name: file.name, result: { ok: false, message: "Votre navigateur est trop ancien pour lire ce fichier. Mettez-le à jour, puis réessayez." } })
      return
    }
    setState({ status: "busy", name: file.name })
    let result: LectureFacture
    try {
      const { lireFactureElectronique } = await import("@/lib/outils/lecteur-facture")
      result = await lireFactureElectronique(new Uint8Array(await file.arrayBuffer()))
    } catch {
      result = { ok: false, message: "Le fichier n'a pas pu être lu. Vérifiez qu'il s'agit bien d'un PDF ou d'un XML de facture, puis réessayez." }
    }
    setState({ status: "done", name: file.name, result })
    // Mesure sans contenu : format reconnu et nombre de lignes, jamais le fichier ni ses données
    captureEvent("tool_einvoice_read", {
      source,
      result: !result.ok ? "error" : result.kind === "pdf_only" ? "pdf_simple" : result.format,
      ...(result.ok && result.kind === "structured" ? { lines: result.invoice.lines.length } : {}),
    })
  }, [])

  const tryExample = async () => {
    setState({ status: "busy", name: "exemple-facture-factur-x.pdf" })
    try {
      const res = await fetch(EXAMPLE_URL)
      if (!res.ok) throw new Error(String(res.status))
      const blob = await res.blob()
      await read(new File([blob], "exemple-facture-factur-x.pdf", { type: "application/pdf" }), "exemple")
    } catch {
      setState({ status: "done", name: "exemple-facture-factur-x.pdf", result: { ok: false, message: "L'exemple n'a pas pu être chargé. Vérifiez votre connexion, puis réessayez." } })
    }
  }

  const reset = () => {
    setState({ status: "idle" })
    if (inputRef.current) inputRef.current.value = ""
  }

  const result = state.status === "done" ? state.result : null

  return (
    <ToolShell ctaBar={<OutilsCtaBar text="Recevez vos factures électroniques directement dans Qonforme." />}>
      <OutilsHero
        crumb="Lecteur Factur-X"
        icon={<FileSearch />}
        badge="Factur-X · UBL · CII"
        title="Lecteur de facture"
        accent="électronique."
        subtitle="Déposez une facture Factur-X, UBL ou CII : vendeur, client, lignes, TVA et totaux s'affichent en clair, avec les contrôles de cohérence."
        checks={["Gratuit", "Sans inscription", "Le fichier reste sur votre appareil"]}
      />

      <ToolArea width="md">
        <ToolPanel>
          <label
            htmlFor={inputId}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragOver(false)
              void read(e.dataTransfer.files?.[0])
            }}
            className={cn(
              "flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-5 py-10 text-center transition-colors",
              dragOver ? "border-q-accent bg-q-wash" : "border-q-line hover:border-q-wash-line hover:bg-q-surface-2",
            )}
          >
            {state.status === "busy"
              ? <Loader2 className="h-8 w-8 animate-spin text-q-accent motion-reduce:animate-none" aria-hidden />
              : <FileUp className="h-8 w-8 text-q-accent" strokeWidth={1.75} aria-hidden />}
            <span className="text-[16px] font-semibold text-q-ink">
              {state.status === "busy" ? `Lecture de ${state.name}…` : "Déposez votre facture ici"}
            </span>
            <span className="text-[14px] text-q-text-3">ou cliquez pour choisir un fichier : PDF Factur-X, XML CII ou UBL, 4 Mo au plus.</span>
            <input
              id={inputId}
              ref={inputRef}
              type="file"
              accept=".pdf,.xml,application/pdf,application/xml,text/xml"
              className="sr-only"
              onChange={(e) => void read(e.target.files?.[0])}
            />
          </label>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-1.5 text-[13px] text-q-text-4">
              <ShieldCheck className="h-4 w-4 shrink-0 text-q-ok" aria-hidden />
              Lu dans votre navigateur : le fichier n&apos;est envoyé nulle part.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={tryExample} disabled={state.status === "busy"} className="q-btn q-btn-secondary q-btn-sm max-sm:!h-11">
                Essayer avec un exemple
              </button>
              {state.status === "done" && (
                <button type="button" onClick={reset} className="q-btn q-btn-ghost q-btn-sm max-sm:!h-11">
                  <RotateCcw aria-hidden />
                  Autre fichier
                </button>
              )}
            </div>
          </div>
        </ToolPanel>

        <div aria-live="polite" className="flex flex-col gap-4">
          {result && !result.ok && (
            <Callout tone="danger" icon={AlertTriangle} title="Lecture impossible">
              {result.message}
            </Callout>
          )}

          {result?.ok && result.kind === "pdf_only" && (
            <Callout tone="warn" icon={Info} title="Facture PDF simple">
              {result.note}
            </Callout>
          )}

          {result?.ok && result.kind === "structured" && (
            <>
              <ToolPanel>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="q-pill q-pill-ok">{FORMAT_LABELS[result.format]} lu</span>
                  <span className="text-[13px] text-q-text-4">
                    {result.has_pdf ? "PDF avec ses données de facture électronique" : "Fichier XML de facture électronique"}
                  </span>
                </div>
                <h2 className="q-h2 mt-4">Contrôles</h2>
                <ChecksList checks={result.checks} className="mt-3" />
                <p className="mt-4 text-[12px] text-q-text-4">
                  Contrôles de cohérence (totaux, TVA, identifiants) d&apos;après la norme EN 16931 : ils ne valent pas attestation de conformité.
                </p>
              </ToolPanel>
              <ReceivedInvoiceDocument invoice={result.invoice} />
            </>
          )}
        </div>

        <ToolCta
          title="Vos factures fournisseurs, lues toutes seules"
          text="Avec Essentiel, vos factures fournisseurs arrivent dans Qonforme par la plateforme agréée Super PDP, déjà lues et contrôlées comme ici. Vos factures partent au format Factur-X. Les devis sont gratuits."
          cta="Créer mon compte"
        />
      </ToolArea>

      <ToolGuide title="Factur-X :" accent="ce qu'il faut savoir.">
        <Prose>
          <p>
            Une <strong>facture électronique</strong> n&apos;est pas une facture PDF envoyée par email : c&apos;est un fichier dont les données (vendeur, client, lignes, TVA, totaux) sont lisibles par un logiciel, sans ressaisie.
          </p>
          <h3>Trois formats admis par la réforme</h3>
          <ul>
            <li><strong>Factur-X</strong> : un PDF lisible à l&apos;œil qui joint un fichier XML (factur-x.xml) au format CII. C&apos;est le plus courant chez les artisans et les TPE, parce qu&apos;il reste une facture qu&apos;on peut imprimer.</li>
            <li><strong>CII</strong> : le même XML, seul, sans PDF.</li>
            <li><strong>UBL</strong> : un autre XML, très utilisé en Europe du Nord et sur le réseau Peppol.</li>
          </ul>
          <p>
            Les trois suivent la norme européenne <strong>EN 16931</strong>. Les profils Factur-X MINIMUM et BASIC WL ne portent que les totaux, sans lignes de détail : ils ne suffisent pas, seuls, pour la réforme.
          </p>
          <h3>Le calendrier</h3>
          <ul>
            <li><strong>Depuis le 1er septembre 2026</strong> : toutes les entreprises doivent pouvoir recevoir des factures électroniques ; les grandes entreprises et les ETI doivent en émettre.</li>
            <li><strong>À partir du 1er septembre 2027</strong> : les PME, TPE et micro-entreprises émettent à leur tour leurs factures entre entreprises en facture électronique, par une plateforme agréée.</li>
          </ul>
          <h3>Comment reconnaître une facture Factur-X</h3>
          <p>
            Ouvrez le panneau des pièces jointes de votre lecteur PDF : une facture Factur-X joint un fichier <strong>factur-x.xml</strong>. Ou déposez-la dans le lecteur ci-dessus, qui vous le dit tout de suite.
          </p>
          <p>
            Pour aller plus loin : <Link href="/guide/facture-electronique-2026" className="q-link">la facture électronique en 2026-2027</Link> et <Link href="/guide/plateforme-agreee" className="q-link">le rôle de la plateforme agréée</Link>.
          </p>
        </Prose>

        <ToolFaq items={LECTEUR_FAQ} />

        <ToolLinks
          links={[
            { href: "/outils/verificateur-conformite-facture", label: "Vérificateur conformité facture" },
            { href: "/outils/verificateur-mentions-facture", label: "Vérificateur mentions facture" },
            { href: "/outils/generateur-facture-gratuite", label: "Générateur de facture gratuit" },
            { href: "/outils/verification-siret", label: "Vérificateur SIREN/SIRET" },
          ]}
        />
      </ToolGuide>

      <JsonLd data={toolJsonLd("Lecteur Factur-X : lire une facture électronique", "/outils/lecteur-factur-x", "Lit une facture électronique Factur-X, UBL ou CII dans le navigateur : vendeur, client, lignes, TVA, totaux et contrôles de cohérence.")} />
      <JsonLd data={faqJsonLd(LECTEUR_FAQ)} />
    </ToolShell>
  )
}
