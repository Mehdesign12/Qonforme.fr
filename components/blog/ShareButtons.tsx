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
 * Share buttons: LinkedIn, X/Twitter, copy link.
 * Desktop: compact vertical sidebar sticky. Mobile: horizontal bar fixed bottom.
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
      hoverClass: "hover:bg-[#0077B5] hover:text-white hover:border-[#0077B5]",
    },
    {
      label: "X",
      href: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
      icon: <XIcon className="w-3.5 h-3.5" />,
      hoverClass: "hover:bg-[#0F172A] hover:text-white hover:border-[#0F172A]",
    },
  ]

  return (
    <>
      {/* Desktop — compact vertical sidebar sticky */}
      <aside className="hidden lg:flex flex-col items-center gap-1.5 sticky top-24">
        <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">
          Partager
        </p>
        {buttons.map((btn) => (
          <a
            key={btn.label}
            href={btn.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Partager sur ${btn.label}`}
            className={`w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-all duration-200 ${btn.hoverClass}`}
          >
            {btn.icon}
          </a>
        ))}
        <button
          onClick={copyLink}
          aria-label="Copier le lien"
          className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-all duration-200 ${
            copied
              ? "bg-emerald-50 border-emerald-200 text-emerald-600"
              : "border-slate-200 bg-white text-slate-500 hover:bg-[#2563EB] hover:text-white hover:border-[#2563EB]"
          }`}
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
        </button>
      </aside>

      {/* Mobile — fixed bottom bar */}
      <div className="fixed bottom-0 inset-x-0 z-40 lg:hidden border-t border-slate-200 bg-white/95 safe-area-bottom">
        <div className="flex items-center justify-center gap-3 h-12 px-4">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mr-1">Partager</span>
          {buttons.map((btn) => (
            <a
              key={btn.label}
              href={btn.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Partager sur ${btn.label}`}
              className={`w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-all duration-200 ${btn.hoverClass}`}
            >
              {btn.icon}
            </a>
          ))}
          <button
            onClick={copyLink}
            aria-label="Copier le lien"
            className={`w-9 h-9 flex items-center justify-center rounded-lg border transition-all duration-200 ${
              copied
                ? "bg-emerald-50 border-emerald-200 text-emerald-600"
                : "border-slate-200 bg-white text-slate-500 hover:bg-[#2563EB] hover:text-white hover:border-[#2563EB]"
            }`}
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </>
  )
}
