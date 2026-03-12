import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Mentions légales — Qonforme' }

const LOGO_LONG_BLEU = 'https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Logo%20long%20bleu.webp'
const PICTO_Q        = 'https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Logo%20bleu%20Qonforme%20PNG.webp'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-base font-semibold text-[#0F172A] mb-3 pb-2 border-b border-[#E2E8F0]">
        {title}
      </h2>
      <div className="text-sm text-[#475569] leading-relaxed space-y-2">
        {children}
      </div>
    </section>
  )
}

export default function MentionsLegalesPage() {
  return (
    <div className="relative min-h-[100dvh] flex flex-col overflow-x-hidden">

      {/* Fond dégradé */}
      <div aria-hidden className="pointer-events-none select-none fixed inset-0 z-0"
        style={{ background: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 30%, #EEF2FF 60%, #F0F9FF 85%, #F8FAFC 100%)' }}
      />
      <div aria-hidden className="pointer-events-none select-none fixed -top-32 -left-32 z-0 w-[480px] h-[480px] rounded-full"
        style={{ background: 'radial-gradient(circle at center, rgba(37,99,235,0.13) 0%, rgba(37,99,235,0.04) 55%, transparent 75%)' }}
      />
      <div aria-hidden className="pointer-events-none select-none fixed -bottom-24 -right-24 z-0 w-[420px] h-[420px] rounded-full"
        style={{ background: 'radial-gradient(circle at center, rgba(99,102,241,0.10) 0%, rgba(37,99,235,0.04) 50%, transparent 72%)' }}
      />
      <div aria-hidden className="pointer-events-none select-none fixed inset-0 z-0 hidden sm:block"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(37,99,235,0.08) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)',
        }}
      />
      <div aria-hidden className="pointer-events-none select-none fixed inset-0 z-0 flex items-center justify-center" style={{ opacity: 0.045 }}>
        <Image src={PICTO_Q} alt="" width={900} height={900} className="w-[340px] sm:w-[560px] lg:w-[900px]" unoptimized priority />
      </div>

      {/* Header */}
      <div
        className="relative z-10 flex flex-col items-center px-4"
        style={{ paddingTop: 'max(28px, env(safe-area-inset-top, 28px))' }}
      >
        <Link href="/" aria-label="Retour à l'accueil" className="mb-8">
          <Image
            src={LOGO_LONG_BLEU}
            alt="Qonforme"
            width={180}
            height={44}
            className="h-8 lg:h-10 w-auto drop-shadow-sm"
            priority
            unoptimized
          />
        </Link>
      </div>

      {/* Contenu */}
      <div className="relative z-10 flex-1 w-full max-w-[780px] mx-auto px-4 sm:px-6 pb-16">

        {/* Carte principale */}
        <div
          className="rounded-2xl p-6 sm:p-10"
          style={{
            background: 'rgba(255,255,255,0.88)',
            backdropFilter: 'blur(16px)',
            boxShadow: '0 4px 32px rgba(37,99,235,0.08), 0 1px 4px rgba(0,0,0,0.04)',
            border: '1px solid rgba(226,232,240,0.8)',
          }}
        >
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0F172A] mb-1">
            Mentions légales
          </h1>
          <p className="text-sm text-[#94A3B8] mb-8">Dernière mise à jour : mars 2025</p>

          <Section title="1. Éditeur du site">
            <p><span className="font-medium text-[#0F172A]">Raison sociale :</span> Qonforme</p>
            <p><span className="font-medium text-[#0F172A]">Forme juridique :</span> [À compléter — ex. SAS, SARL, auto-entrepreneur]</p>
            <p><span className="font-medium text-[#0F172A]">Capital social :</span> [À compléter]</p>
            <p><span className="font-medium text-[#0F172A]">SIRET :</span> [À compléter]</p>
            <p><span className="font-medium text-[#0F172A]">Siège social :</span> [Adresse complète]</p>
            <p><span className="font-medium text-[#0F172A]">Email :</span>{' '}
              <a href="mailto:contact@qonforme.fr" className="text-[#2563EB] hover:underline">
                contact@qonforme.fr
              </a>
            </p>
          </Section>

          <Section title="2. Directeur de la publication">
            <p>[Nom et prénom du représentant légal]</p>
          </Section>

          <Section title="3. Hébergement">
            <p><span className="font-medium text-[#0F172A]">Hébergeur :</span> Vercel Inc.</p>
            <p><span className="font-medium text-[#0F172A]">Adresse :</span> 340 Pine Street, Suite 701, San Francisco, CA 94104, États-Unis</p>
            <p><span className="font-medium text-[#0F172A]">Site :</span>{' '}
              <a href="https://vercel.com" target="_blank" rel="noopener noreferrer" className="text-[#2563EB] hover:underline">
                vercel.com
              </a>
            </p>
          </Section>

          <Section title="4. Propriété intellectuelle">
            <p>
              L&apos;ensemble du contenu de ce site — textes, graphiques, logos, icônes, images et logiciels —
              est la propriété exclusive de Qonforme ou de ses partenaires, et est protégé par les lois
              françaises et internationales relatives à la propriété intellectuelle.
            </p>
            <p>
              Toute reproduction, distribution, modification ou utilisation de ces éléments, sans autorisation
              préalable écrite de Qonforme, est strictement interdite.
            </p>
          </Section>

          <Section title="5. Protection des données personnelles">
            <p>
              Qonforme collecte et traite des données personnelles dans le cadre de la fourniture de ses services,
              conformément au Règlement Général sur la Protection des Données (RGPD — UE 2016/679) et à la
              loi Informatique et Libertés.
            </p>
            <p>
              <span className="font-medium text-[#0F172A]">Responsable du traitement :</span> Qonforme —
              contact@qonforme.fr
            </p>
            <p>
              <span className="font-medium text-[#0F172A]">Données collectées :</span> adresse e-mail, informations
              d&apos;entreprise (raison sociale, SIREN/SIRET), données de facturation.
            </p>
            <p>
              <span className="font-medium text-[#0F172A]">Finalité :</span> création et gestion de compte,
              émission et transmission de factures électroniques, archivage légal (10 ans), communication
              relative au service.
            </p>
            <p>
              <span className="font-medium text-[#0F172A]">Droits :</span> vous disposez d&apos;un droit d&apos;accès,
              de rectification, d&apos;effacement et de portabilité de vos données. Pour exercer ces droits,
              contactez-nous à{' '}
              <a href="mailto:contact@qonforme.fr" className="text-[#2563EB] hover:underline">
                contact@qonforme.fr
              </a>.
            </p>
          </Section>

          <Section title="6. Cookies">
            <p>
              Qonforme utilise des cookies strictement nécessaires au fonctionnement du service (session
              d&apos;authentification). Aucun cookie publicitaire ou de tracking tiers n&apos;est déposé sans
              votre consentement.
            </p>
          </Section>

          <Section title="7. Limitation de responsabilité">
            <p>
              Qonforme s&apos;efforce d&apos;assurer l&apos;exactitude et la mise à jour des informations diffusées sur ce
              site. Toutefois, Qonforme ne peut garantir l&apos;exactitude, la complétude ou l&apos;actualité des
              informations publiées.
            </p>
            <p>
              Qonforme ne saurait être tenue responsable des dommages directs ou indirects résultant de
              l&apos;utilisation de ce site ou de l&apos;impossibilité d&apos;y accéder.
            </p>
          </Section>

          <Section title="8. Droit applicable">
            <p>
              Les présentes mentions légales sont soumises au droit français. En cas de litige, les tribunaux
              français seront seuls compétents.
            </p>
          </Section>

          {/* Retour */}
          <div className="mt-8 pt-6 border-t border-[#E2E8F0]">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm font-medium text-[#2563EB] hover:text-[#1D4ED8] transition-colors"
            >
              ← Retour à l&apos;accueil
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
