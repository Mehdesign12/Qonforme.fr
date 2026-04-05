import Link from "next/link"
import Image from "next/image"
import { CheckCircle2, ArrowRight, Linkedin, Mail } from "lucide-react"

const LOGO_URL = "https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Logo%20long%20simple.png"
const PICTO_Q = "https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Picto%20Q.webp"

export default function Footer() {
  return (
    <footer className="relative overflow-hidden" style={{ background: "#0F172A", borderTop: "1px solid rgba(255,255,255,0.06)" }}>

      {/* Q filigrane — eager pour éviter le layout shift */}
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none" style={{ opacity: 0.03, zIndex: 0 }}>
        <Image src={PICTO_Q} alt="" width={500} height={500} className="w-[500px]" sizes="500px" priority />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-5">
        {/* ── Mini CTA banner ── */}
        <div className="pt-14 pb-10">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-8 sm:px-10 sm:py-10 text-center">
            <h3
              className="text-2xl sm:text-3xl font-extrabold text-white tracking-[-0.02em] mb-3"
              style={{ fontFamily: "var(--font-bricolage)" }}
            >
              Prêt à devenir{" "}
              <span className="text-[#60A5FA]">conforme ?</span>
            </h3>
            <p className="text-[14px] text-slate-400 mb-6 max-w-md mx-auto">
              Rejoins les artisans et indépendants qui ont sécurisé leur facturation. Opérationnel en 5 minutes.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/signup">
                <button className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#2563EB] px-6 text-[14px] font-semibold text-white transition-all hover:bg-[#1D4ED8] active:scale-[0.98]">
                  Commencer maintenant <ArrowRight className="h-4 w-4" />
                </button>
              </Link>
              <Link href="/demo">
                <button className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/15 px-5 text-[14px] font-medium text-slate-300 transition-all hover:bg-white/5 active:scale-[0.98]">
                  Essayer la démo
                </button>
              </Link>
            </div>
          </div>
        </div>

        {/* ── 4 colonnes ── */}
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-2 lg:grid-cols-4 pb-10">
          {/* Col 1 — Marque */}
          <div className="col-span-2 sm:col-span-1">
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
            {/* Social icons */}
            <div className="flex items-center gap-3 mt-4">
              <a
                href="https://www.linkedin.com/company/qonforme"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-slate-400 transition-all hover:bg-[#0077B5]/20 hover:text-[#0077B5]"
                aria-label="LinkedIn"
              >
                <Linkedin className="h-4 w-4" />
              </a>
              <a
                href="mailto:contact@qonforme.fr"
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-slate-400 transition-all hover:bg-[#2563EB]/20 hover:text-[#60A5FA]"
                aria-label="Email"
              >
                <Mail className="h-4 w-4" />
              </a>
            </div>
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
                  <Link href={l.href} className="group text-[13px] text-slate-400 transition-colors hover:text-white">
                    <span className="bg-gradient-to-r from-white to-white bg-[length:0%_1px] bg-left-bottom bg-no-repeat transition-all duration-300 group-hover:bg-[length:100%_1px]">
                      {l.label}
                    </span>
                  </Link>
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
                { label: "Comparatifs", href: "/comparatif" },
                { label: "Glossaire", href: "/glossaire" },
              ].map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="group text-[13px] text-slate-400 transition-colors hover:text-white">
                    <span className="bg-gradient-to-r from-white to-white bg-[length:0%_1px] bg-left-bottom bg-no-repeat transition-all duration-300 group-hover:bg-[length:100%_1px]">
                      {l.label}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 4 — Légal & Contact */}
          <div>
            <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Légal & Contact</p>
            <ul className="flex flex-col gap-2.5">
              {[
                { label: "Mentions légales", href: "/mentions-legales" },
                { label: "CGU", href: "/cgu" },
                { label: "Confidentialité", href: "/confidentialite" },
              ].map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="group text-[13px] text-slate-400 transition-colors hover:text-white">
                    <span className="bg-gradient-to-r from-white to-white bg-[length:0%_1px] bg-left-bottom bg-no-repeat transition-all duration-300 group-hover:bg-[length:100%_1px]">
                      {l.label}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-5 space-y-1.5">
              <a href="mailto:contact@qonforme.fr" className="block text-[13px] text-slate-400 transition-colors hover:text-white">contact@qonforme.fr</a>
              <p className="text-[12px] text-slate-500">Lun–Ven 9h–18h</p>
            </div>
          </div>
        </div>

        {/* ── Copyright ── */}
        <div className="border-t py-5" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <p className="text-[12px] text-[#475569] text-center">
            © {new Date().getFullYear()} Qonforme — Facturation électronique conforme.
          </p>
        </div>
      </div>
    </footer>
  )
}
