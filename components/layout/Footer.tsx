import Link from "next/link"
import Image from "next/image"
import { CheckCircle2 } from "lucide-react"

const LOGO_URL = "https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Logo%20long%20simple.png"
const PICTO_Q = "https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Picto%20Q.webp"

export default function Footer() {
  return (
    <footer className="relative overflow-hidden" style={{ background: "#0F172A", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
      {/* Q géant centré en fond */}
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none" style={{ opacity: 0.03, zIndex: 0 }}>
        <Image src={PICTO_Q} alt="" width={600} height={600} className="w-[600px]" sizes="600px" loading="lazy" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-5 pt-16 pb-10">
        {/* 4 colonnes */}
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-5 mb-12">
          {/* Col 1 — Marque */}
          <div className="lg:col-span-1">
            <Link href="/">
              <Image src={LOGO_URL} alt="Qonforme" width={130} height={32} className="h-7 w-auto object-contain mb-4" sizes="130px" loading="lazy" />
            </Link>
            <p className="text-[13px] leading-relaxed text-slate-400 mb-4">
              Facturation électronique conforme à la réglementation française 2026.
            </p>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-slate-400">
              <CheckCircle2 className="h-3 w-3 text-[#10B981]" />
              Conforme PPF · DGFiP
            </span>
          </div>

          {/* Col 2 — Produit */}
          <div>
            <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Produit</p>
            <ul className="flex flex-col gap-2.5">
              {[
                { label: "Fonctionnalités", href: "/#features" },
                { label: "Tarifs", href: "/pricing" },
                { label: "Démo interactive", href: "/demo" },
                { label: "Blog", href: "/blog" },
              ].map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-[13px] text-slate-400 transition-colors hover:text-white">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 3 — Ressources */}
          <div>
            <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Ressources</p>
            <ul className="flex flex-col gap-2.5">
              {[
                { label: "Facturation par métier", href: "/facturation" },
                { label: "Guides pratiques", href: "/guide" },
                { label: "Modèles gratuits", href: "/modele" },
                { label: "Mentions obligatoires", href: "/guide/mentions-obligatoires-facture" },
                { label: "Facture électronique 2026", href: "/guide/facture-electronique-2026" },
                { label: "Comparatifs", href: "/comparatif" },
              ].map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-[13px] text-slate-400 transition-colors hover:text-white">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 4 — Légal */}
          <div>
            <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Légal</p>
            <ul className="flex flex-col gap-2.5">
              {[
                { label: "Mentions légales", href: "/mentions-legales" },
                { label: "CGU", href: "/cgu" },
                { label: "Politique de confidentialité", href: "/confidentialite" },
              ].map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-[13px] text-slate-400 transition-colors hover:text-white">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 4 — Contact */}
          <div>
            <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Contact</p>
            <ul className="flex flex-col gap-2.5">
              <li>
                <a href="mailto:contact@qonforme.fr" className="text-[13px] text-slate-400 transition-colors hover:text-white">contact@qonforme.fr</a>
              </li>
              <li>
                <p className="text-[13px] text-slate-500">Lun–Ven 9h–18h</p>
              </li>
              <li>
                <a href="https://www.linkedin.com/company/qonforme" target="_blank" rel="noopener noreferrer" className="text-[13px] text-slate-400 transition-colors hover:text-white">LinkedIn Qonforme</a>
              </li>
            </ul>
          </div>
        </div>

        {/* Barre copyright */}
        <div className="border-t pt-6" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-[13px] text-[#475569] text-center sm:text-left">
              © {new Date().getFullYear()} Qonforme — Conforme à la réglementation française de facturation électronique.
            </p>
            <div className="flex items-center gap-4 text-[13px] text-[#475569]">
              <Link href="/mentions-legales" className="hover:text-white transition-colors">Mentions légales</Link>
              <span className="text-slate-700">·</span>
              <Link href="/cgu" className="hover:text-white transition-colors">CGU</Link>
              <span className="text-slate-700">·</span>
              <Link href="/confidentialite" className="hover:text-white transition-colors">Confidentialité</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
