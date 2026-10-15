import { Download, FileSpreadsheet, FileText, Printer } from "lucide-react"
import { fr } from "@/components/content/text"

/**
 * Fichiers de modèle à télécharger (Word, Excel, PDF), servis par
 * /api/outils/modeles/[nom].[format] : même contenu pour tous, sans inscription.
 * Liens simples (<a download>) : aucun JavaScript, ça marche partout.
 */
const FORMATS = [
  { ext: "docx", label: "Word", note: "à modifier", Icon: FileText },
  { ext: "xlsx", label: "Excel", note: "totaux et TVA calculés", Icon: FileSpreadsheet },
  { ext: "pdf", label: "PDF", note: "à imprimer", Icon: Printer },
] as const

export function TelechargerModele({
  fichier,
  titre,
  texte,
  id,
  className = "",
}: {
  /** Nom du fichier sans extension, tel que déclaré dans lib/modeles/fichier.ts. */
  fichier: string
  titre: string
  texte: string
  id: string
  className?: string
}) {
  return (
    <section aria-labelledby={id} className={`q-card overflow-hidden ${className}`}>
      <div className="px-5 pb-1 pt-5 sm:px-6 sm:pt-6">
        <h2 id={id} className="q-h2 flex items-center gap-2">
          <Download className="h-[18px] w-[18px] text-q-accent-strong" aria-hidden />
          {fr(titre)}
        </h2>
        <p className="mt-2 text-[14px] leading-[1.55] text-q-text-3">{fr(texte)}</p>
      </div>
      <ul className="grid gap-3 p-5 sm:grid-cols-3 sm:p-6">
        {FORMATS.map(({ ext, label, note, Icon }) => (
          <li key={ext}>
            <a
              href={`/api/outils/modeles/${fichier}.${ext}`}
              download={`${fichier}.${ext}`}
              className="group flex h-full items-center gap-3 rounded-2xl border border-q-line bg-q-surface px-4 py-3.5 transition-colors hover:border-q-accent hover:bg-q-wash"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-q-wash text-q-accent-strong">
                <Icon className="h-5 w-5" strokeWidth={1.8} aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold text-q-ink-strong">
                  {label} <span className="font-normal text-q-text-4">.{ext}</span>
                </span>
                <span className="block text-[13px] text-q-text-3">{note}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
