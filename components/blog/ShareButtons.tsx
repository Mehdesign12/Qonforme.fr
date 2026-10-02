"use client"

import { useState, useEffect } from "react"
import { Link2, Check } from "lucide-react"

interface Props {
  title: string
  slug: string
}

// Inline SVG icons to avoid heavy dependencies
function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  )
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

/**
 * Boutons de partage : LinkedIn, X, copie du lien.
 * Ordinateur : colonne verticale collée au défilement. Mobile : barre fixée en bas.
 */
export default function ShareButtons({ title, slug }: Props) {
  const [copied, setCopied] = useState(false)
  const [url, setUrl] = useState("")

  useEffect(() => {
    setUrl(`${window.location.origin}/blog/${slug}`)
  }, [slug])

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const input = document.createElement("input")
      input.value = url
      document.body.appendChild(input)
      input.select()
      document.execCommand("copy")
      document.body.removeChild(input)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const encodedTitle = encodeURIComponent(title)
  const encodedUrl = encodeURIComponent(url)

  const buttons = [
    {
      label: "LinkedIn",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      icon: <LinkedInIcon className="w-3.5 h-3.5" />,
    },
    {
      label: "X",
      href: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
      icon: <XIcon className="w-3.5 h-3.5" />,
    },
  ]

  // Accent unique : survol bleu pour tous les réseaux (pas de couleurs de marque)
  const base = "flex items-center justify-center rounded-full border transition-colors duration-200"
  const idle = "border-q-line bg-q-surface text-q-text-3 hover:border-q-accent hover:bg-q-accent hover:text-white"
  const done = "border-transparent bg-q-ok-bg text-q-ok"

  return (
    <>
      {/* Ordinateur : colonne compacte, collée au défilement */}
      <aside className="sticky top-28 hidden flex-col items-center gap-2 lg:flex">
        <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-q-text-4">
          Partager
        </p>
        {buttons.map((btn) => (
          <a
            key={btn.label}
            href={btn.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Partager sur ${btn.label}`}
            className={`${base} ${idle} h-9 w-9`}
          >
            {btn.icon}
          </a>
        ))}
        <button
          type="button"
          onClick={copyLink}
          aria-label={copied ? "Lien copié" : "Copier le lien"}
          className={`${base} ${copied ? done : idle} h-9 w-9`}
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
        </button>
      </aside>

      {/* Mobile : barre fixée en bas (fond opaque, sans backdrop-filter : règle iOS) */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-q-line bg-q-surface safe-area-bottom lg:hidden">
        <div className="flex h-14 items-center justify-center gap-3 px-4">
          <span className="mr-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-q-text-4">Partager</span>
          {buttons.map((btn) => (
            <a
              key={btn.label}
              href={btn.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Partager sur ${btn.label}`}
              className={`${base} ${idle} h-10 w-10`}
            >
              {btn.icon}
            </a>
          ))}
          <button
            type="button"
            onClick={copyLink}
            aria-label={copied ? "Lien copié" : "Copier le lien"}
            className={`${base} ${copied ? done : idle} h-10 w-10`}
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </>
  )
}
