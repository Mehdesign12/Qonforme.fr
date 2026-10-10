"use client"

/**
 * Fenêtre « Ajouter » d'une connexion absente (Paramètres › Connexions) :
 * où créer la clé et où la déposer. Les clés se règlent dans les variables
 * d'environnement de l'hébergeur ; cette page ne les lit ni ne les affiche.
 */
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"

type HelpKey = "search_console" | "pagespeed" | "gemini" | "openai" | "perplexity" | "anthropic" | "dataforseo" | "resend"

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="break-all rounded-md border border-[var(--q-line)] bg-[var(--q-sunken)] px-1.5 py-0.5 font-mono text-xs text-[var(--q-text-2)]">
      {children}
    </code>
  )
}

function steps(key: string, property: string): React.ReactNode[] {
  switch (key as HelpKey) {
    case "search_console":
      return [
        <>Dans Google Cloud, créez un compte de service (IAM et administration › Comptes de service).</>,
        <>Activez l&apos;API Google Search Console pour ce projet (API et services › Bibliothèque).</>,
        <>Créez une clé JSON pour ce compte de service (onglet Clés › Ajouter une clé › JSON) et téléchargez le fichier.</>,
        <>
          Collez le contenu du fichier, tel quel ou encodé en base64, dans la variable <Code>GOOGLE_SERVICE_ACCOUNT_JSON</Code>.
        </>,
        <>
          Dans Search Console, ouvrez la propriété <Code>{property}</Code> › Paramètres › Utilisateurs et autorisations, puis
          ajoutez l&apos;adresse du compte de service (champ <Code>client_email</Code> du fichier) avec l&apos;autorisation
          « Restreint » : la lecture suffit.
        </>,
      ]
    case "pagespeed":
      return [
        <>Dans Google Cloud, activez l&apos;API PageSpeed Insights (API et services › Bibliothèque).</>,
        <>Créez une clé d&apos;API (API et services › Identifiants › Créer des identifiants › Clé API), de préférence limitée à l&apos;API PageSpeed Insights.</>,
        <>
          Collez-la dans la variable <Code>PAGESPEED_API_KEY</Code>.
        </>,
      ]
    case "gemini":
      return [
        <>Créez une clé d&apos;API dans Google AI Studio (rubrique « API keys »).</>,
        <>
          Collez-la dans la variable <Code>GEMINI_API_KEY</Code>.
        </>,
      ]
    case "openai":
      return [
        <>Créez une clé dans la plateforme d&apos;OpenAI (rubrique « API keys »), sur un projet doté de crédit.</>,
        <>
          Collez-la dans la variable <Code>OPENAI_API_KEY</Code>.
        </>,
      ]
    case "perplexity":
      return [
        <>Créez une clé dans les réglages de l&apos;API de Perplexity (rubrique « API »), avec du crédit sur le compte.</>,
        <>
          Collez-la dans la variable <Code>PERPLEXITY_API_KEY</Code>.
        </>,
      ]
    case "anthropic":
      return [
        <>Créez une clé dans la console d&apos;Anthropic (rubrique « API keys »), avec du crédit sur le compte.</>,
        <>
          Collez-la dans la variable <Code>ANTHROPIC_API_KEY</Code>.
        </>,
      ]
    case "dataforseo":
      return [
        <>
          Dans le tableau de bord de DataForSEO, ouvrez « API Access » : l&apos;identifiant de l&apos;API est l&apos;adresse du
          compte ; le mot de passe de l&apos;API est différent de celui du site.
        </>,
        <>
          Collez-les dans les variables <Code>DATAFORSEO_LOGIN</Code> et <Code>DATAFORSEO_PASSWORD</Code>.
        </>,
      ]
    case "resend":
      return [
        <>
          Dans Resend (rubrique « API Keys »), créez une clé. L&apos;accès « Sending access » suffit pour envoyer ; avec « Full
          access », cette page peut aussi vérifier vos domaines d&apos;envoi.
        </>,
        <>
          Collez-la dans la variable <Code>RESEND_API_KEY</Code>.
        </>,
      ]
    default:
      return []
  }
}

export function ConnectionHelp({
  open,
  onOpenChange,
  connectionKey,
  name,
  env,
  property,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  connectionKey: string
  name: string
  env: string[]
  property: string
}) {
  const list = steps(connectionKey, property)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] gap-4 overflow-y-auto sm:max-w-[560px]">
        <DialogTitle className="q-display pr-8 text-[22px] font-semibold leading-tight">Ajouter {name}</DialogTitle>
        <DialogDescription className="text-sm leading-relaxed text-[var(--q-text-3)]">
          {env.length > 1 ? "Les variables" : "La variable"}{" "}
          {env.map((v, i) => (
            <span key={v}>
              {i > 0 && " et "}
              <Code>{v}</Code>
            </span>
          ))}{" "}
          {env.length > 1 ? "se règlent" : "se règle"} chez l&apos;hébergeur du site, jamais dans cette page.
        </DialogDescription>

        {list.length > 0 && (
          <ol className="flex list-none flex-col gap-3 p-0">
            {list.map((step, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed text-[var(--q-text-2)]">
                <span
                  aria-hidden
                  className="grid size-6 shrink-0 place-items-center rounded-full bg-[var(--q-wash)] text-xs font-semibold text-[var(--q-accent-strong)]"
                >
                  {i + 1}
                </span>
                <span className="min-w-0">
                  <span className="sr-only">Étape {i + 1} : </span>
                  {step}
                </span>
              </li>
            ))}
          </ol>
        )}

        <p className="rounded-xl bg-[var(--q-surface-2)] px-3.5 py-3 text-[13px] leading-relaxed text-[var(--q-text-3)]">
          Ajoutez ensuite la variable dans Vercel › Settings › Environment Variables (environnement Production), puis
          redéployez le site : cette page la détecte au chargement suivant. Utilisez ensuite « Tester » pour vérifier
          l&apos;accès.
        </p>

        <div className="flex justify-end border-t border-[var(--q-line-soft)] pt-4">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="q-btn q-btn-secondary h-12 w-full rounded-[14px] text-[15px] md:h-10 md:w-auto md:rounded-[10px] md:text-sm"
          >
            Fermer
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
