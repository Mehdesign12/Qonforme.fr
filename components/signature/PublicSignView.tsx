"use client"

/**
 * Page publique du client : lire, signer ou refuser un devis ou un bon de
 * commande (canevas « Signer-devis », « Signer-bon-de-commande »,
 * « Signer-devis-mobile », « Signer-etats », « Signer-sur-place »).
 *
 * Mobile d'abord : une colonne (document, puis formulaire) ; à partir de
 * 1024 px, le formulaire se range à droite du document.
 *
 * Même composant pour la démo (`api` simulée, rien n'est enregistré).
 * Vocabulaire : « signature électronique simple », jamais « certifiée ».
 */
import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import {
  AlertTriangle, Ban, Check, CheckCircle2, Clock, Download, FileQuestion, Info, KeyRound, Loader2, PenLine, RefreshCw,
  Smartphone, Type, X, XCircle, type LucideIcon,
} from "lucide-react"
import { Initials } from "@/components/app/kit"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/utils/invoice"
import { longDate } from "@/components/quotes/QuoteListHelpers"
import { SignaturePad } from "@/components/signature/SignaturePad"
import { PublicDocument } from "@/components/signature/PublicDocument"
import { demoSignApi } from "@/components/signature/demo-api"
import { OFF_PREMISES_NO_PAYMENT_DAYS, WITHDRAWAL_DAYS, validateSignPayload, withdrawalDeadline } from "@/lib/signature/rules"
import { REFUSAL_REASONS, type RefusalReason, type SignatureMethod } from "@/lib/signature/types"
import type { PublicPageState, PublicSignViewData } from "@/lib/signature/view"

export interface PublicSignApi {
  post: (action: string, body?: Record<string, unknown>) => Promise<{ ok: boolean; status: number; json: Record<string, unknown> }>
}

function httpApi(id: string): PublicSignApi {
  return {
    async post(action, body = {}) {
      try {
        const res = await fetch(`/api/signature/public/${id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ ...body, action }),
        })
        const json = await res.json().catch(() => ({}))
        return { ok: res.ok, status: res.status, json }
      } catch {
        return { ok: false, status: 0, json: { error: "Connexion impossible. Vérifiez votre réseau, puis réessayez." } }
      }
    },
  }
}

const parisDateTime = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso))

export function PublicSignView({ data, api: apiProp }: { data: PublicSignViewData; api?: PublicSignApi }) {
  const api = useMemo(() => apiProp ?? (data.demo ? demoSignApi() : httpApi(data.id)), [apiProp, data.demo, data.id])
  const [state, setState] = useState<PublicPageState>(data.state)
  const [signedInfo, setSignedInfo] = useState(data.signed)
  const [refusedInfo, setRefusedInfo] = useState(data.refused)
  const [deadline, setDeadline] = useState(data.withdrawalDeadline)

  const doc = data.doc
  const company = data.company
  const isQuote = doc?.type === "quote"
  const docWord = isQuote ? "devis" : "bon de commande"
  const theDoc = isQuote ? "le devis" : "le bon de commande"
  const revoked = state === "superseded" || state === "disabled"

  // Consultation comptée une fois par ouverture (rien en démo)
  const viewed = useRef(false)
  useEffect(() => {
    if (viewed.current || data.demo || data.state === "not_found") return
    viewed.current = true
    void api.post("view")
  }, [api, data.demo, data.state])

  return (
    <div className="min-h-[100dvh] bg-[var(--q-bg)] text-[var(--q-ink)]">
      {/* En-tête : l'entreprise, pas Qonforme */}
      <header className="border-b border-[var(--q-line)] bg-[var(--q-surface)]">
        <div className="mx-auto flex max-w-[1180px] items-center gap-3 px-4 py-3 md:px-6">
          <Initials name={company?.name ?? "?"} ink />
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-[15px] font-semibold">{company?.name ?? "Signature en ligne"}</span>
            <span className="truncate text-[13px] text-[var(--q-text-4)]">Signature électronique simple · via Qonforme</span>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-[1180px] flex-col gap-4 px-4 pb-16 pt-5 md:px-6 lg:pt-8">
        {data.demo && (
          <div role="status" className="q-banner items-center">
            <Info className="size-5 shrink-0" aria-hidden />
            <span className="flex-1 text-[15px] leading-snug">
              <strong className="font-semibold">Démonstration.</strong> Voici la page que reçoit votre client. Rien n&apos;est enregistré ; le code de démonstration est 123456.
            </span>
          </div>
        )}

        {!doc || !company || state === "not_found" ? (
          <StateCard icon={FileQuestion} title="Lien introuvable" tone="neutral">
            Ce lien n&apos;existe pas ou n&apos;est pas complet. Ouvrez de nouveau le lien reçu par email, sans le modifier. S&apos;il ne fonctionne toujours pas, demandez un nouveau lien à l&apos;entreprise qui vous l&apos;a envoyé.
          </StateCard>
        ) : (
          <>
            {/* Titre et montant */}
            <section aria-label="Résumé" className="flex flex-col gap-1">
              <span className="q-eyebrow">{isQuote ? "Devis" : "Bon de commande"} · <span className="font-mono normal-case tracking-normal">{doc.number}</span></span>
              <h1 className="q-display text-[28px] leading-tight sm:text-[34px]">
                {stateTitle(state, docWord)}
              </h1>
              {!revoked && (
                <p className="text-[15px] text-[var(--q-text-3)]">
                  <span className="font-semibold tabular-nums text-[var(--q-ink)]">{formatCurrency(doc.total_ttc)} TTC</span>
                  {doc.valid_until && state === "sign" && <> · valable jusqu&apos;au {longDate(doc.valid_until)}</>}
                  {doc.client?.name && <> · pour {doc.client.name}</>}
                </p>
              )}
            </section>

            {data.onSite && state === "sign" && (
              <div role="note" className="q-banner items-start">
                <Smartphone className="mt-0.5 size-5 shrink-0" aria-hidden />
                <span className="flex-1 text-[15px] leading-snug">
                  <strong className="font-semibold">Signature sur place.</strong> Vous signez sur l&apos;appareil de {company.name}. Votre exemplaire signé vous est envoyé par email.
                  {data.clientKind === "consumer" && <> Contrat conclu hors établissement : délai de rétractation de {WITHDRAWAL_DAYS} jours, et aucun paiement ne peut vous être demandé avant {OFF_PREMISES_NO_PAYMENT_DAYS} jours.</>}
                </span>
              </div>
            )}

            <StateBanner state={state} data={data} signed={signedInfo} refused={refusedInfo} deadline={deadline} theDoc={theDoc} />

            {/* Lien désactivé ou remplacé : plus de document, seulement le message et le contact */}
            {!revoked && (
            <div className={cn("grid items-start gap-5", (state === "sign" || state === "view") && "lg:grid-cols-[minmax(0,1fr)_420px]")}>
              <div className="flex min-w-0 flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="q-h2">Le document en entier</h2>
                  {data.pdfUrl && (
                    <a href={data.pdfUrl} className="q-btn q-btn-secondary q-btn-sm min-h-[44px]" download>
                      <Download aria-hidden />
                      {state === "signed" ? "PDF signé" : "Télécharger le PDF"}
                    </a>
                  )}
                </div>
                <PublicDocument doc={doc} company={company} />
              </div>

              {state === "sign" && (
                <div className="lg:sticky lg:top-6">
                  <SignForm
                    data={data}
                    api={api}
                    onSigned={(info, dl) => {
                      setSignedInfo(info)
                      setDeadline(dl ?? (data.clientKind === "consumer" ? withdrawalDeadline(new Date(info.at)) : null))
                      setState("signed")
                      window.scrollTo({ top: 0, behavior: "smooth" })
                    }}
                    onRefused={(info) => { setRefusedInfo(info); setState("refused"); window.scrollTo({ top: 0, behavior: "smooth" }) }}
                    onStale={(s) => setState(s)}
                  />
                </div>
              )}
              {state === "view" && (
                <aside aria-label="Donner votre accord" className="q-card flex flex-col gap-3 p-5 lg:sticky lg:top-6">
                  <h2 className="q-h2">Pour donner votre accord</h2>
                  <p className="text-[15px] leading-relaxed text-[var(--q-text-3)]">
                    Téléchargez {theDoc}, datez-le et signez-le avec la mention «&nbsp;Bon pour accord&nbsp;», puis retournez-le à {company.name}
                    {company.email ? <> à l&apos;adresse <a className="q-link break-all" href={`mailto:${company.email}`}>{company.email}</a></> : <>, par exemple en répondant à son email</>}.
                  </p>
                  {data.pdfUrl && (
                    <a href={data.pdfUrl} className="q-btn q-btn-primary q-btn-lg w-full" download>
                      <Download aria-hidden />
                      Télécharger le PDF
                    </a>
                  )}
                </aside>
              )}
            </div>
            )}
          </>
        )}
      </main>

      <footer className="border-t border-[var(--q-line)] bg-[var(--q-surface)]">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-1 px-4 py-5 text-[13px] text-[var(--q-text-4)] md:px-6">
          <span>
            Signature électronique simple (règlement eIDAS, articles 1366 et 1367 du Code civil). Chaque signature est horodatée et
            accompagnée d&apos;un dossier de preuve joint au PDF signé.
          </span>
          <span>
            Propulsé par{" "}
            <Link href="/?source=signature" className="q-link font-semibold" target="_blank" rel="noopener">Qonforme</Link>
            , le logiciel de devis et de facturation des artisans du bâtiment.
          </span>
        </div>
      </footer>
    </div>
  )
}

function stateTitle(state: PublicPageState, docWord: string): string {
  switch (state) {
    case "sign": return `Consultez et signez votre ${docWord}`
    case "view": return `Votre ${docWord}`
    case "signed": return "C'est signé"
    case "refused": return `${docWord.charAt(0).toUpperCase()}${docWord.slice(1)} refusé`
    case "expired": return "Ce lien a expiré"
    case "superseded": return "Une version plus récente existe"
    case "disabled": return "Ce lien a été désactivé"
    case "closed": return `Ce ${docWord} n'attend plus de signature`
    default: return "Lien introuvable"
  }
}

/* ------------------------------------------------------------------ */
/* Bandeaux d'état                                                     */
/* ------------------------------------------------------------------ */

function StateBanner({
  state, data, signed, refused, deadline, theDoc,
}: {
  state: PublicPageState
  data: PublicSignViewData
  signed: PublicSignViewData["signed"]
  refused: PublicSignViewData["refused"]
  deadline: string | null
  theDoc: string
}) {
  const company = data.company?.name ?? "l'entreprise"
  const contact = data.company?.email
    ? <a className="q-link break-all" href={`mailto:${data.company.email}`}>{data.company.email}</a>
    : <>en répondant à son email</>

  if (state === "signed" && signed) {
    return (
      <StateCard icon={CheckCircle2} tone="ok" title={`Signé par ${signed.name}`}>
        <span className="block">
          Le {parisDateTime(signed.at)} (heure de Paris){signed.role ? `, en qualité de ${signed.role}` : ""}{signed.company ? ` pour ${signed.company}` : ""}.
          {signed.order_number && <> Numéro de commande : {signed.order_number}.</>} Votre exemplaire signé, avec son dossier de preuve, vous a été envoyé par email. {company} est prévenue.
        </span>
        {data.clientKind === "consumer" && (
          <span className="mt-2 block">
            Vous disposez d&apos;un délai de rétractation de {WITHDRAWAL_DAYS} jours{deadline ? <>, jusqu&apos;au {longDate(deadline)} inclus</> : null}.
            Pour l&apos;exercer, envoyez le formulaire de rétractation joint à l&apos;email de confirmation, ou toute déclaration sans ambiguïté, à {company} : {contact}.
          </span>
        )}
      </StateCard>
    )
  }
  if (state === "refused") {
    return (
      <StateCard icon={XCircle} tone="neutral" title="Votre refus est enregistré">
        {refused ? <>Le {parisDateTime(refused.at)} · motif : {refused.reason.toLowerCase()}. </> : null}
        {company} en est informée. Pour une nouvelle proposition, contactez-la : {contact}.
      </StateCard>
    )
  }
  if (state === "expired") {
    return (
      <StateCard icon={Clock} tone="warn" title="Ce lien a expiré">
        {data.doc?.valid_until ? <>{theDoc.charAt(0).toUpperCase() + theDoc.slice(1)} était valable jusqu&apos;au {longDate(data.doc.valid_until)}. </> : null}
        Pour le signer, demandez à {company} une version à jour : {contact}. Vous pouvez encore le consulter ci-dessous.
      </StateCard>
    )
  }
  if (state === "superseded") {
    return (
      <StateCard icon={RefreshCw} tone="neutral" title="Ce lien a été remplacé">
        {company} vous a envoyé une version plus récente, ou un nouveau lien. Utilisez le lien du dernier email reçu. En cas de doute : {contact}.
      </StateCard>
    )
  }
  if (state === "disabled") {
    return (
      <StateCard icon={Ban} tone="neutral" title="Ce lien a été désactivé">
        {company} a désactivé ce lien de signature. Pour toute question : {contact}.
      </StateCard>
    )
  }
  if (state === "closed") {
    return (
      <StateCard icon={Info} tone="neutral" title="Plus de signature attendue">
        {data.closedMessage ?? "Ce document n'attend plus de signature."} Pour toute question : {contact}.
      </StateCard>
    )
  }
  return null
}

function StateCard({ icon: Icon, title, tone, children }: { icon: LucideIcon; title: string; tone: "ok" | "warn" | "neutral"; children: React.ReactNode }) {
  return (
    <section role="status" className={cn("q-card flex items-start gap-3.5 p-5", tone === "ok" && "border-[var(--q-ok-line)]")}>
      <span className={cn(
        "grid size-11 shrink-0 place-items-center rounded-[14px]",
        tone === "ok" ? "bg-[var(--q-ok-bg)] text-[var(--q-ok)]" : tone === "warn" ? "bg-[var(--q-warn-bg)] text-[var(--q-warn)]" : "bg-[var(--q-wash)] text-[var(--q-accent-strong)]",
      )}>
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <h2 className="text-[17px] font-semibold text-[var(--q-ink)]">{title}</h2>
        <div className="text-[15px] leading-relaxed text-[var(--q-text-3)]">{children}</div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Formulaire de signature                                             */
/* ------------------------------------------------------------------ */

type Errors = Partial<Record<string, string>>

function SignForm({
  data, api, onSigned, onRefused, onStale,
}: {
  data: PublicSignViewData
  api: PublicSignApi
  onSigned: (info: NonNullable<PublicSignViewData["signed"]>, deadline: string | null) => void
  onRefused: (info: NonNullable<PublicSignViewData["refused"]>) => void
  onStale: (state: PublicPageState) => void
}) {
  const business = data.clientKind === "business"
  const consumer = !business
  const isQuote = data.doc?.type === "quote"
  const theDoc = isQuote ? "le devis" : "le bon de commande"

  const [name, setName] = useState(data.prefill.name)
  const [email, setEmail] = useState(data.prefill.email)
  const [signerCompany, setSignerCompany] = useState(data.prefill.company)
  const [role, setRole] = useState("")
  const [orderNo, setOrderNo] = useState("")
  const [acceptDoc, setAcceptDoc] = useState(false)
  const [vatCert, setVatCert] = useState(false)
  const [earlyStart, setEarlyStart] = useState(false)
  const [durable, setDurable] = useState(false)
  const [method, setMethod] = useState<SignatureMethod>("drawn")
  const [image, setImage] = useState<string | null>(null)
  const [typed, setTyped] = useState("")
  const [errors, setErrors] = useState<Errors>({})
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Code de vérification
  const [codeVerified, setCodeVerified] = useState(data.codeVerified)
  const [codeSentTo, setCodeSentTo] = useState<string | null>(null)
  const [code, setCode] = useState("")
  const [codeBusy, setCodeBusy] = useState(false)
  const [codeMsg, setCodeMsg] = useState<string | null>(null)
  const [retryIn, setRetryIn] = useState(0)
  useEffect(() => {
    if (retryIn <= 0) return
    const t = window.setTimeout(() => setRetryIn((n) => n - 1), 1000)
    return () => window.clearTimeout(t)
  }, [retryIn])

  // Refus
  const [refusing, setRefusing] = useState(false)

  const payload = () => ({
    signer_name: name,
    signer_email: email,
    signer_company: business ? signerCompany : null,
    signer_role: business ? role : null,
    client_order_number: business ? orderNo : null,
    method,
    image: method === "drawn" ? image : null,
    typed_name: method === "typed" ? typed : null,
    context: data.onSite ? "in_person" : "distance",
    consents: {
      accepted_document: acceptDoc,
      reduced_vat_certified: vatCert,
      early_start_requested: earlyStart,
      durable_medium_by_email: durable,
    },
  })

  const sendCode = async () => {
    setCodeBusy(true)
    setCodeMsg(null)
    const r = await api.post("send_code", { email })
    setCodeBusy(false)
    if (r.ok) {
      setCodeSentTo((r.json.sentTo as string) ?? data.codeTarget)
      setRetryIn(60)
      if (r.json.verified) setCodeVerified(true)
      return
    }
    if (typeof r.json.retryIn === "number") setRetryIn(r.json.retryIn)
    if (r.status === 409 && typeof r.json.state === "string") onStale(r.json.state as PublicPageState)
    if (r.json.field === "signer_email") setErrors((e) => ({ ...e, signer_email: String(r.json.error) }))
    setCodeMsg(String(r.json.error ?? "Le code n'a pas pu être envoyé."))
  }

  const verifyCode = async () => {
    if (!/^\d{6}$/.test(code)) { setCodeMsg("Le code compte 6 chiffres."); return }
    setCodeBusy(true)
    setCodeMsg(null)
    const r = await api.post("verify_code", { code })
    setCodeBusy(false)
    if (r.ok) { setCodeVerified(true); setCodeMsg(null); return }
    if (r.status === 409 && typeof r.json.state === "string") onStale(r.json.state as PublicPageState)
    setCodeMsg(String(r.json.error ?? "Code incorrect."))
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    const check = validateSignPayload(payload(), { clientKind: data.clientKind, reducedVat: data.reducedVat })
    if (!check.ok) {
      setErrors({ [check.field]: check.error })
      document.getElementById(`f-${check.field}`)?.focus()
      return
    }
    if (data.codeRequired && !codeVerified) {
      setErrors({ code: "Saisissez le code reçu par email." })
      document.getElementById("f-code")?.focus()
      return
    }
    setErrors({})
    setBusy(true)
    const r = await api.post("sign", payload())
    setBusy(false)
    if (r.ok) {
      onSigned(
        { name: check.value.signer_name, role: check.value.signer_role, company: check.value.signer_company, at: String(r.json.signed_at ?? new Date().toISOString()), method, order_number: check.value.client_order_number },
        (r.json.withdrawalDeadline as string | null) ?? null,
      )
      return
    }
    if (r.status === 409 && typeof r.json.state === "string") { onStale(r.json.state as PublicPageState); return }
    if (typeof r.json.field === "string") {
      setErrors({ [r.json.field]: String(r.json.error) })
      document.getElementById(`f-${r.json.field}`)?.focus()
    } else {
      setFormError(String(r.json.error ?? "La signature n'a pas pu être enregistrée. Réessayez."))
    }
  }

  if (refusing) {
    return <RefuseForm api={api} theDoc={theDoc} defaultName={name} onCancel={() => setRefusing(false)} onRefused={onRefused} onStale={onStale} />
  }

  const step = (n: number) => <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[var(--q-ink)] text-[12px] font-semibold text-[var(--q-surface)]">{n}</span>
  let n = 0

  return (
    <form onSubmit={submit} noValidate aria-label={`Signer ${theDoc}`} className="q-card flex flex-col gap-5 p-5">
      {/* 1. Identité */}
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 flex items-center gap-2 text-[17px] font-semibold">{step(++n)}Votre identité</legend>
        <TextField id="f-signer_name" label="Nom et prénom" value={name} onChange={setName} autoComplete="name" error={errors.signer_name} />
        <TextField
          id="f-signer_email" label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" error={errors.signer_email}
          hint="Votre exemplaire signé y sera envoyé."
        />
        {business && (
          <>
            <TextField id="f-signer_company" label="Société" value={signerCompany} onChange={setSignerCompany} autoComplete="organization" error={errors.signer_company} />
            <TextField id="f-signer_role" label="Votre fonction" value={role} onChange={setRole} autoComplete="organization-title" placeholder="Ex. gérant, conducteur de travaux" error={errors.signer_role} />
            <TextField id="f-client_order_number" label="Votre numéro de commande (facultatif)" value={orderNo} onChange={setOrderNo} hint="Il sera reporté sur les factures." error={errors.client_order_number} />
          </>
        )}
      </fieldset>

      {/* 2. Engagements */}
      <fieldset className="flex flex-col gap-3 border-t border-[var(--q-line-soft)] pt-4">
        <legend className="mb-1 flex items-center gap-2 text-[17px] font-semibold">{step(++n)}Votre accord</legend>
        <CheckField id="f-accepted_document" checked={acceptDoc} onChange={setAcceptDoc} error={errors.accepted_document}>
          <strong className="font-semibold text-[var(--q-ink)]">Bon pour accord.</strong> J&apos;ai lu {theDoc} {data.doc?.number} en entier et je l&apos;accepte, pour {formatCurrency(data.doc?.total_ttc ?? 0)} TTC.
        </CheckField>
        {data.reducedVat && data.reducedVatText && (
          <CheckField id="f-reduced_vat_certified" checked={vatCert} onChange={setVatCert} error={errors.reduced_vat_certified}>
            <strong className="font-semibold text-[var(--q-ink)]">Taux réduit de TVA.</strong> {data.reducedVatText}
          </CheckField>
        )}
        {consumer && (
          <div className="q-inset flex flex-col gap-2 p-3.5 text-[14px] leading-relaxed text-[var(--q-text-3)]">
            <p className="flex items-center gap-1.5 font-semibold text-[var(--q-ink)]"><Info className="size-4 shrink-0 text-[var(--q-accent-strong)]" aria-hidden />Votre droit de rétractation</p>
            <p>
              Vous pouvez changer d&apos;avis sans motif pendant {WITHDRAWAL_DAYS} jours après la signature. Le formulaire de rétractation vous est envoyé avec votre exemplaire signé.
              {data.onSite ? ` Aucun paiement ne peut vous être demandé avant ${OFF_PREMISES_NO_PAYMENT_DAYS} jours.` : " Un acompte éventuel vous est remboursé si vous vous rétractez."}
            </p>
            <CheckField id="f-early_start_requested" checked={earlyStart} onChange={setEarlyStart}>
              Je demande que les travaux commencent avant la fin de ce délai. Si je me rétracte ensuite, je paierai les travaux déjà réalisés.
            </CheckField>
          </div>
        )}
        {consumer && data.onSite && (
          <CheckField id="f-durable_medium_by_email" checked={durable} onChange={setDurable} error={errors.durable_medium_by_email}>
            J&apos;accepte de recevoir mon exemplaire daté et signé par email, à l&apos;adresse indiquée.
          </CheckField>
        )}
      </fieldset>

      {/* 3. Signature */}
      <fieldset className="flex flex-col gap-3 border-t border-[var(--q-line-soft)] pt-4">
        <legend id="sig-legend" className="mb-1 flex items-center gap-2 text-[17px] font-semibold">{step(++n)}Votre signature</legend>
        <div className="q-seg self-start" role="radiogroup" aria-label="Façon de signer">
          <button type="button" role="radio" aria-checked={method === "drawn"} onClick={() => setMethod("drawn")} className={cn("!h-10 !px-4 !text-[14px]", method === "drawn" && "is-active")}>
            <PenLine className="size-4" aria-hidden />Tracer
          </button>
          <button type="button" role="radio" aria-checked={method === "typed"} onClick={() => { setMethod("typed"); if (!typed) setTyped(name) }} className={cn("!h-10 !px-4 !text-[14px]", method === "typed" && "is-active")}>
            <Type className="size-4" aria-hidden />Taper mon nom
          </button>
        </div>
        {method === "drawn" ? (
          <div id="f-signature" tabIndex={-1} className="outline-none">
            <SignaturePad onChange={setImage} labelledBy="sig-legend" />
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <TextField id="f-signature" label="Votre nom, comme signature" value={typed} onChange={setTyped} autoComplete="name" error={undefined} />
            <div aria-hidden className="grid min-h-[84px] place-items-center rounded-[14px] border border-[var(--q-field)] bg-white px-4">
              <span className="truncate text-[34px] italic text-[#1D4ED8]" style={{ fontFamily: "var(--font-serif-accent), Georgia, serif" }}>{typed || "Votre nom"}</span>
            </div>
          </div>
        )}
        {errors.signature && <p className="q-field-error text-[13px]" role="alert">{errors.signature}</p>}
      </fieldset>

      {/* 4. Code de vérification */}
      {data.codeRequired && (
        <fieldset className="flex flex-col gap-3 border-t border-[var(--q-line-soft)] pt-4">
          <legend className="mb-1 flex items-center gap-2 text-[17px] font-semibold">{step(++n)}Code de vérification</legend>
          {codeVerified ? (
            <p className="q-field-ok text-[14px]"><Check className="size-4" strokeWidth={2.5} aria-hidden />Code vérifié</p>
          ) : (
            <>
              <p className="text-[14px] leading-relaxed text-[var(--q-text-3)]">
                Pour ce montant, {data.company?.name ?? "l'entreprise"} demande un code à 6 chiffres envoyé par email
                {codeSentTo ? <> à <strong className="font-semibold text-[var(--q-ink)]">{codeSentTo}</strong></> : data.codeTarget && !data.codeToSignerEmail ? <> à <strong className="font-semibold text-[var(--q-ink)]">{data.codeTarget}</strong></> : <> à l&apos;adresse indiquée plus haut</>}.
              </p>
              <button type="button" onClick={sendCode} disabled={codeBusy || retryIn > 0} className="q-btn q-btn-secondary q-btn-lg w-full">
                {codeBusy && !codeSentTo ? <Loader2 className="animate-spin" aria-hidden /> : <KeyRound aria-hidden />}
                {codeSentTo ? (retryIn > 0 ? `Renvoyer le code (${retryIn} s)` : "Renvoyer le code") : "Recevoir le code par email"}
              </button>
              {codeSentTo && (
                <div className="flex gap-2">
                  <input
                    id="f-code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    aria-label="Code à 6 chiffres"
                    aria-invalid={!!codeMsg || !!errors.code}
                    placeholder="000000"
                    className="q-input flex-1 text-center font-mono tracking-[0.4em]"
                  />
                  <button type="button" onClick={verifyCode} disabled={codeBusy || code.length !== 6} className="q-btn q-btn-primary h-[42px]">
                    {codeBusy ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
                    Valider
                  </button>
                </div>
              )}
              {(codeMsg || errors.code) && <p className="q-field-error text-[13px]" role="alert">{codeMsg ?? errors.code}</p>}
            </>
          )}
        </fieldset>
      )}

      {formError && (
        <div role="alert" className="q-banner q-banner-warn items-start">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
          <span className="text-[14px]">{formError}</span>
        </div>
      )}

      <div className="flex flex-col gap-2 border-t border-[var(--q-line-soft)] pt-4">
        <button type="submit" disabled={busy} className="q-btn q-btn-primary q-btn-xl w-full">
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : <PenLine aria-hidden />}
          {busy ? "Signature en cours…" : `Signer ${theDoc}`}
        </button>
        <p className="text-center text-[13px] leading-relaxed text-[var(--q-text-4)]">
          Signature électronique simple : date, heure, adresse IP et empreinte du document sont enregistrées dans un dossier de preuve.
        </p>
        <button type="button" onClick={() => setRefusing(true)} className="q-btn q-btn-ghost min-h-[44px] w-full">
          <X aria-hidden />
          Refuser {theDoc}
        </button>
      </div>
    </form>
  )
}

/* ------------------------------------------------------------------ */
/* Refus                                                               */
/* ------------------------------------------------------------------ */

function RefuseForm({
  api, theDoc, defaultName, onCancel, onRefused, onStale,
}: {
  api: PublicSignApi
  theDoc: string
  defaultName: string
  onCancel: () => void
  onRefused: (info: { at: string; reason: string }) => void
  onStale: (s: PublicPageState) => void
}) {
  const [reason, setReason] = useState<RefusalReason | null>(null)
  const [message, setMessage] = useState("")
  const [name, setName] = useState(defaultName)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reason) { setError("Choisissez un motif."); return }
    setBusy(true)
    setError(null)
    const r = await api.post("refuse", { reason, message, name })
    setBusy(false)
    if (r.ok) { onRefused({ at: new Date().toISOString(), reason: REFUSAL_REASONS.find((x) => x.value === reason)?.label ?? "" }); return }
    if (r.status === 409 && typeof r.json.state === "string") { onStale(r.json.state as PublicPageState); return }
    setError(String(r.json.error ?? "Le refus n'a pas pu être enregistré."))
  }

  return (
    <form onSubmit={submit} noValidate aria-label={`Refuser ${theDoc}`} className="q-card flex flex-col gap-4 p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-[17px] font-semibold">Refuser {theDoc}</h2>
        <p className="text-[14px] text-[var(--q-text-3)]">L&apos;entreprise sera prévenue de votre réponse.</p>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="q-label mb-1">Motif</legend>
        {REFUSAL_REASONS.map((r) => (
          <label key={r.value} className={cn(
            "flex min-h-[48px] cursor-pointer items-center gap-3 rounded-[12px] border px-3.5 text-[15px]",
            reason === r.value ? "border-[var(--q-accent)] bg-[var(--q-wash)]" : "border-[var(--q-field)] bg-[var(--q-surface)]",
          )}>
            <input type="radio" name="reason" value={r.value} checked={reason === r.value} onChange={() => setReason(r.value)} className="size-4 accent-[var(--q-accent)]" />
            {r.label}
          </label>
        ))}
      </fieldset>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="refuse-message" className="q-label">Message (facultatif)</label>
        <textarea id="refuse-message" rows={3} maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} className="q-input" placeholder="Précisez si vous le souhaitez" />
      </div>
      <TextField id="refuse-name" label="Votre nom (facultatif)" value={name} onChange={setName} autoComplete="name" />
      {error && <p className="q-field-error text-[13px]" role="alert">{error}</p>}
      <div className="flex flex-col gap-2">
        <button type="submit" disabled={busy} className="q-btn q-btn-danger q-btn-lg w-full">
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : <X aria-hidden />}
          Confirmer le refus
        </button>
        <button type="button" onClick={onCancel} className="q-btn q-btn-ghost min-h-[44px] w-full">Revenir à la signature</button>
      </div>
    </form>
  )
}

/* ------------------------------------------------------------------ */
/* Champs                                                              */
/* ------------------------------------------------------------------ */

function TextField({
  id, label, value, onChange, type = "text", autoComplete, placeholder, hint, error,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  autoComplete?: string
  placeholder?: string
  hint?: string
  error?: string
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="q-label">{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-invalid={!!error}
        aria-describedby={error || hint ? `${id}-help` : undefined}
        className="q-input"
      />
      {error ? <p id={`${id}-help`} className="q-field-error text-[13px]" role="alert">{error}</p>
        : hint ? <p id={`${id}-help`} className="q-field-hint text-[13px]">{hint}</p> : null}
    </div>
  )
}

function CheckField({
  id, checked, onChange, error, children,
}: {
  id: string
  checked: boolean
  onChange: (v: boolean) => void
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="flex cursor-pointer items-start gap-3 text-[14px] leading-relaxed text-[var(--q-text-3)]">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-invalid={!!error}
          className="mt-0.5 size-5 shrink-0 accent-[var(--q-accent)]"
        />
        <span>{children}</span>
      </label>
      {error && <p className="q-field-error pl-8 text-[13px]" role="alert">{error}</p>}
    </div>
  )
}
