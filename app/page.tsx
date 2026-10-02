"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight, ArrowRightLeft, BellRing, Check, ChevronDown, CircleDashed, ClipboardList,
  Download, FileMinus, FileText, FolderOpen, Package, Palette, Play, ReceiptText,
  RotateCcw, Send, Smartphone, Unlock, Users,
} from "lucide-react";
import { AnimatePresence, MotionConfig, motion, useInView, useScroll, useTransform } from "motion/react";

import { LandingHero } from "@/components/landing/LandingHero";
import { MacBook, IPhone, SCREENS } from "@/components/landing/devices";
import { Parallax, Reveal, RevealWords, ScrollLine } from "@/components/landing/motion";
import Footer from "@/components/layout/Footer";
import PricingSelector from "@/components/billing/PricingSelector";
import { PLANS } from "@/lib/stripe/plans";
import { GUARANTEE_DAYS } from "@/lib/stripe/access";
import { PHOTOS, type LandingPhoto } from "@/lib/landing/photos";
import { cn } from "@/lib/utils";

/*
 * Accueil — refonte du 02/10/2026.
 *
 * Règles (CLAUDE.md, DECISIONS-STRATEGIQUES.md § 2 et § 6) :
 *  - aucun avis, chiffre, client ou certification inventés ; ce qui n'existe pas
 *    encore est dit « en préparation » ou « bientôt » ;
 *  - vouvoiement, fond blanc ou gris neutre, jamais de dégradé bleu ni de halo ;
 *  - icônes en trait fin, sans pastille ; pas de surtitre décoratif ;
 *  - captures : le vrai produit (pages de démo, données d'exemple) ;
 *  - photos : illustrations d'artisans, jamais présentées comme des clients.
 */

const BRICOLAGE = { fontFamily: "var(--font-bricolage)" } as const;
const ICON = { strokeWidth: 1.25 } as const;
const essentiel = PLANS.starter;

/* ─────────────────────────────────────────────────────────
   Titre de section
───────────────────────────────────────────────────────── */
function SectionTitle({
  title,
  sub,
  align = "center",
  dark = false,
  className,
}: {
  title: string;
  sub?: string;
  align?: "center" | "left";
  dark?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex max-w-[760px] flex-col gap-4", align === "center" && "mx-auto items-center text-center", className)}>
      <RevealWords
        text={title}
        className={cn(
          "text-[clamp(30px,4.2vw,50px)] font-semibold leading-[1.07] tracking-[-0.035em] [text-wrap:balance]",
          dark ? "text-white" : "text-[#0A1122]",
        )}
        style={BRICOLAGE}
      />
      {sub && (
        <Reveal delay={0.15}>
          <p className={cn("text-[17px] leading-relaxed sm:text-[18px]", dark ? "text-[#AAB4C3]" : "text-[#475569]")}>{sub}</p>
        </Reveal>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   1 — La réforme, en deux dates
───────────────────────────────────────────────────────── */
const REFORM = [
  {
    date: "1er sept. 2026",
    title: "Recevoir",
    text: "Depuis cette date, toute entreprise doit pouvoir recevoir des factures électroniques de ses fournisseurs.",
  },
  {
    date: "1er sept. 2027",
    title: "Émettre",
    text: "Les TPE et PME, donc la plupart des artisans, émettent à leur tour leurs factures entre entreprises en électronique, par une plateforme agréée.",
  },
];

function ReformSection() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 75%", "end 60%"] });

  return (
    <section id="reforme" className="bg-[#F6F7F9] py-24 sm:py-32">
      <div className="mx-auto grid max-w-6xl gap-16 px-4 sm:px-5 lg:grid-cols-2 lg:gap-20">
        <div>
          <SectionTitle
            align="left"
            title="La facture électronique arrive dans le bâtiment."
            sub="Deux dates à retenir. Le reste, c'est le travail de votre logiciel."
          />
          <Reveal delay={0.2} className="mt-10 rounded-[22px] border border-[#E6E9F0] bg-white p-6 sm:p-7">
            <p className="text-[15px] font-semibold text-[#0A1122]">Où en est Qonforme</p>
            <ul className="mt-4 flex flex-col gap-3.5 text-[15px] leading-relaxed text-[#334155]">
              <li className="flex gap-3">
                <Check className="mt-1 h-4 w-4 shrink-0 text-[#2563EB]" strokeWidth={1.75} />
                Devis et factures avec les mentions obligatoires, numérotés à la suite.
              </li>
              <li className="flex gap-3">
                <Check className="mt-1 h-4 w-4 shrink-0 text-[#2563EB]" strokeWidth={1.75} />
                Une facture envoyée ne se modifie plus&nbsp;: une erreur se corrige par un avoir, comme la loi le demande.
              </li>
              <li className="flex gap-3">
                <CircleDashed className="mt-1 h-4 w-4 shrink-0 text-[#64748B]" strokeWidth={1.75} />
                <span>
                  Envoi et réception par une plateforme agréée, depuis Qonforme&nbsp;:{" "}
                  <strong className="font-semibold text-[#0A1122]">en préparation</strong>.
                </span>
              </li>
            </ul>
          </Reveal>
        </div>

        <div>
        <div ref={ref} className="relative pl-12 sm:pl-16">
          <span aria-hidden className="absolute bottom-3 left-[11px] top-3 w-px bg-[#DCE0E7] sm:left-[15px]" />
          <ScrollLine progress={scrollYProgress} className="absolute bottom-3 left-[11px] top-3 w-px bg-[#2563EB] sm:left-[15px]" />
          {REFORM.map((step, i) => (
            <Reveal key={step.date} delay={i * 0.1} className={cn("relative", i < REFORM.length - 1 && "pb-16")}>
              <span aria-hidden className="absolute -left-12 top-0.5 grid h-[23px] w-[23px] place-items-center rounded-full border border-[#DCE0E7] bg-white sm:-left-16 sm:h-[31px] sm:w-[31px]">
                <span className="h-2 w-2 rounded-full bg-[#2563EB]" />
              </span>
              <p className="text-[15px] font-semibold text-[#2563EB]">{step.date}</p>
              <h3 className="mt-2 text-[32px] font-semibold leading-tight tracking-[-0.03em] text-[#0A1122] sm:text-[40px]" style={BRICOLAGE}>
                {step.title}
              </h3>
              <p className="mt-3 max-w-[440px] text-[16px] leading-relaxed text-[#475569] sm:text-[17px]">{step.text}</p>
            </Reveal>
          ))}
        </div>
          <p className="mt-12 pl-12 text-[13px] text-[#64748B] sm:pl-16">Calendrier officiel de la réforme, publié par l&apos;administration fiscale.</p>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────
   2 — Du devis au paiement (écran fixe qui change au défilement)
───────────────────────────────────────────────────────── */
const STORY = [
  {
    n: "01",
    title: "Un devis propre, en quelques minutes",
    text: "Votre entreprise se remplit avec votre numéro SIREN. Vos prestations vont dans un catalogue, puis dans vos devis en un clic, avec la TVA à 5,5, 10 ou 20 % ligne par ligne.",
    screen: SCREENS.devis,
    mobile: SCREENS.mobileDevis,
  },
  {
    n: "02",
    title: "Le devis accepté devient une facture",
    text: "Un clic, et toutes les lignes passent sur la facture. Rien à ressaisir, et la numérotation se suit toute seule.",
    screen: SCREENS.facture,
    mobile: SCREENS.mobileFacture,
  },
  {
    n: "03",
    title: "Envoyée par email, relancée sans vous",
    text: "La facture part en PDF à votre client, avec votre IBAN. Si elle reste impayée, Qonforme relance votre client 30 puis 45 jours après l'échéance.",
    screen: SCREENS.factures,
    mobile: SCREENS.mobileFactures,
  },
  {
    n: "04",
    title: "Vous savez où vous en êtes",
    text: "Encaissé, en attente, en retard : votre tableau de bord vous le dit d'un coup d'œil. L'export FEC est prêt pour votre comptable.",
    screen: SCREENS.tableauDeBord,
    mobile: SCREENS.mobileTableauDeBord,
  },
];

function StoryStep({ step, index, active, onActive }: { step: (typeof STORY)[number]; index: number; active: boolean; onActive: (i: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-45% 0px -45% 0px" });
  useEffect(() => {
    if (inView) onActive(index);
  }, [inView, index, onActive]);

  return (
    <div ref={ref} className="flex flex-col justify-center py-12 lg:min-h-[80vh] lg:py-0">
      <div className={cn("transition-opacity duration-500", active ? "opacity-100" : "lg:opacity-[.32]")}>
        <p className="text-[15px] font-semibold text-[#2563EB]">{step.n}</p>
        <h3 className="mt-3 text-[clamp(26px,3vw,38px)] font-semibold leading-[1.1] tracking-[-0.03em] text-[#0A1122] [text-wrap:balance]" style={BRICOLAGE}>
          {step.title}
        </h3>
        <p className="mt-4 max-w-[460px] text-[17px] leading-relaxed text-[#475569]">{step.text}</p>
      </div>
      {/* Sur téléphone, la capture mobile du même écran : lisible à cette taille */}
      <Reveal className="mx-auto mt-10 w-[64%] max-w-[300px] lg:hidden">
        <IPhone screen={{ ...step.mobile, sizes: "64vw" }} />
      </Reveal>
    </div>
  );
}

function StorySection() {
  const [active, setActive] = useState(0);

  return (
    <section id="features" className="bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-5">
        <SectionTitle
          title="Du premier devis au dernier paiement."
          sub="Quatre étapes, un seul outil. Voici le vrai Qonforme, avec des données d'exemple."
        />

        <div className="mt-10 grid lg:mt-6 lg:grid-cols-[0.7fr_1.3fr] lg:gap-12">
          <div>
            {STORY.map((step, i) => (
              <StoryStep key={step.n} step={step} index={i} active={active === i} onActive={setActive} />
            ))}
          </div>

          {/* Écran fixe (ordinateur) : les captures se succèdent en fondu */}
          <div className="hidden lg:block">
            <div className="sticky top-0 flex h-screen items-center">
              <div className="w-full">
                <MacBook>
                  {STORY.map((step, i) => (
                    <motion.div
                      key={step.n}
                      className="absolute inset-0"
                      initial={false}
                      animate={{ opacity: active === i ? 1 : 0, scale: active === i ? 1 : 1.025 }}
                      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <Image
                        src={step.screen.src}
                        alt={step.screen.alt}
                        width={step.screen.width}
                        height={step.screen.height}
                        sizes="(min-width: 1280px) 760px, 60vw"
                        loading="lazy"
                        className="h-full w-full object-cover object-top"
                      />
                    </motion.div>
                  ))}
                </MacBook>
                <div className="mt-8 flex justify-center gap-2" aria-hidden>
                  {STORY.map((step, i) => (
                    <span key={step.n} className={cn("h-1.5 rounded-full transition-all duration-500", active === i ? "w-8 bg-[#2563EB]" : "w-1.5 bg-[#CBD2DC]")} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────
   Photo pleine largeur avec effet de profondeur (si générée)
───────────────────────────────────────────────────────── */
function PhotoBand({ photo }: { photo: LandingPhoto }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["-8%", "8%"]);

  return (
    <section ref={ref} className="relative h-[62vh] min-h-[380px] overflow-hidden bg-[#0A1122] sm:h-[78vh]">
      <motion.div className="lp-motion absolute inset-[-10%_0]" style={{ y }}>
        <Image src={photo.src} alt={photo.alt} fill sizes="100vw" loading="lazy" className="object-cover" />
      </motion.div>
      <div aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,17,34,0)_40%,rgba(10,17,34,.72)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 mx-auto max-w-6xl px-4 pb-12 sm:px-5 sm:pb-16">
        <RevealWords
          as="p"
          text={"Pensé pour ceux qui travaillent sur les chantiers,\npas derrière un bureau."}
          className="max-w-[820px] text-[clamp(26px,3.6vw,46px)] font-semibold leading-[1.1] tracking-[-0.03em] text-white"
          style={BRICOLAGE}
        />
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────
   3 — Les trois profils (DECISIONS § 4)
───────────────────────────────────────────────────────── */
const PROFILES: { title: string; text: string; plan: string; soon?: boolean; photo: LandingPhoto | null }[] = [
  {
    title: "Vous vous installez",
    text: "Un devis et une facture professionnels dès votre premier chantier, avec les bonnes mentions. Gratuit tant que vous ne facturez pas.",
    plan: "Version gratuite, puis Essentiel",
    photo: PHOTOS.nouvelInstalle,
  },
  {
    title: "Vous facturez encore sur Word ou Excel",
    text: "Vos clients, vos prestations et vos documents au même endroit. Plus de numéro en double, plus de facture oubliée.",
    plan: "Essentiel",
    photo: PHOTOS.sansLogiciel,
  },
  {
    title: "Votre entreprise grandit",
    text: "Situations de travaux, retenue de garantie, autoliquidation et plusieurs utilisateurs arrivent avec la formule Artisan.",
    plan: "Artisan",
    soon: true,
    photo: PHOTOS.entrepriseGrandit,
  },
];

function ProfilesSection() {
  return (
    <section className="bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-5">
        <SectionTitle
          title="Votre premier logiciel de facturation. Et le dernier."
          sub="Qonforme suit votre entreprise, du premier chantier à la première embauche."
        />
        <div className="mt-14 grid gap-5 md:grid-cols-3 md:gap-6">
          {PROFILES.map((p, i) => (
            <div key={p.title} className={cn(i === 1 && "md:translate-y-10")}>
            <Reveal delay={i * 0.12} className="h-full">
              <article className="group flex h-full flex-col overflow-hidden rounded-[26px] border border-[#E6E9F0] bg-white">
                {p.photo && (
                  <div className="relative aspect-[4/5] overflow-hidden bg-[#EEF0F3]">
                    <Image
                      src={p.photo.src}
                      alt={p.photo.alt}
                      fill
                      sizes="(min-width: 768px) 33vw, 100vw"
                      loading="lazy"
                      className="object-cover transition-transform [transition-duration:1200ms] [transition-timing-function:cubic-bezier(.22,1,.36,1)] group-hover:scale-[1.04]"
                    />
                  </div>
                )}
                <div className="flex flex-1 flex-col p-7">
                  <p className="text-[15px] font-semibold text-[#2563EB]">0{i + 1}</p>
                  <h3 className="mt-3 text-[24px] font-semibold leading-tight tracking-[-0.025em] text-[#0A1122]" style={BRICOLAGE}>
                    {p.title}
                  </h3>
                  <p className="mt-3 flex-1 text-[16px] leading-relaxed text-[#475569]">{p.text}</p>
                  <p className="mt-6 flex items-center gap-2 border-t border-[#EEF1F5] pt-5 text-[14px] font-medium text-[#0A1122]">
                    {p.plan}
                    {p.soon && <span className="rounded-full bg-[#F1F3F6] px-2 py-0.5 text-[12px] font-medium text-[#475569]">Bientôt</span>}
                  </p>
                </div>
              </article>
            </Reveal>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────
   4 — Sur le téléphone (site installable, pas d'app native)
───────────────────────────────────────────────────────── */
function MobileSection() {
  return (
    <section className="overflow-hidden bg-[#0A1122] py-24 sm:py-32">
      <div className="mx-auto grid max-w-6xl items-center gap-16 px-4 sm:px-5 lg:grid-cols-2">
        <div>
          <SectionTitle
            dark
            align="left"
            title="Sur le chantier aussi."
            sub="Qonforme s'ouvre dans le navigateur de votre téléphone et s'ajoute à l'écran d'accueil comme une application. Rien à télécharger."
          />
          <ul className="mt-10 flex flex-col gap-4 text-[16px] text-[#D5DBE5]">
            {[
              "Le devis se fait devant le client",
              "Vos factures et leurs statuts dans la poche",
              "Le même compte sur l'ordinateur et le téléphone",
            ].map((t, i) => (
              <Reveal key={t} delay={0.1 + i * 0.08} as="li" className="flex items-center gap-3">
                <Check className="h-4 w-4 shrink-0 text-[#60A5FA]" strokeWidth={1.75} />
                {t}
              </Reveal>
            ))}
          </ul>
        </div>

        <div className="relative mx-auto flex w-full max-w-[520px] items-start justify-center gap-[6%] pt-6">
          <Parallax distance={110} className="w-[44%]">
            <IPhone screen={{ ...SCREENS.mobileTableauDeBord, sizes: "(min-width: 1024px) 230px, 44vw" }} />
          </Parallax>
          <Parallax distance={-90} className="mt-[18%] w-[44%]">
            <IPhone screen={{ ...SCREENS.mobileFactures, sizes: "(min-width: 1024px) 230px, 44vw" }} />
          </Parallax>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────
   5 — Ce qui est inclus (uniquement ce qui existe)
───────────────────────────────────────────────────────── */
const INCLUDED = [
  { icon: FileText, title: "Devis illimités", text: "Gratuits, même sans formule." },
  { icon: ReceiptText, title: "Factures", text: "Mentions obligatoires, TVA par ligne." },
  { icon: ArrowRightLeft, title: "Devis en facture", text: "En un clic, sans ressaisie." },
  { icon: Users, title: "Clients", text: "Fiches réutilisables, SIREN contrôlé." },
  { icon: Package, title: "Catalogue", text: "Vos prestations et vos prix." },
  { icon: Send, title: "Envoi par email", text: "PDF joint, IBAN dans le message." },
  { icon: BellRing, title: "Relances automatiques", text: "30 et 45 jours après l'échéance." },
  { icon: FileMinus, title: "Avoirs", text: "Pour corriger une facture émise." },
  { icon: ClipboardList, title: "Bons de commande", text: "Quand votre client en demande un." },
  { icon: Download, title: "Export FEC", text: "Prêt pour votre comptable." },
  { icon: Palette, title: "Votre logo, votre couleur", text: "Sur chaque devis et facture." },
  { icon: Smartphone, title: "Sur téléphone", text: "Installable sur l'écran d'accueil." },
];

function IncludedSection() {
  return (
    <section className="bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-5">
        <SectionTitle title="Tout ce qu'il faut. Rien de superflu." />
        <ul className="mt-14 grid grid-cols-2 gap-x-5 gap-y-8 sm:gap-x-8 sm:gap-y-9 lg:grid-cols-4">
          {INCLUDED.map((f, i) => (
            <Reveal key={f.title} as="li" delay={(i % 4) * 0.06} y={18} className="flex flex-col gap-3 border-t border-[#E6E9F0] pt-5 sm:pt-6">
              <f.icon className="h-6 w-6 text-[#0A1122]" {...ICON} />
              <div>
                <p className="text-[15px] font-semibold leading-snug text-[#0A1122] sm:text-[16px]">{f.title}</p>
                <p className="mt-1 text-[14px] leading-relaxed text-[#64748B] sm:text-[15px]">{f.text}</p>
              </div>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────
   6 — Tarifs (grille partagée avec /pricing : lib/stripe/plans.ts)
───────────────────────────────────────────────────────── */
function PricingSection() {
  return (
    <section id="pricing" className="bg-[#F6F7F9] py-24 sm:py-32">
      <div className="mx-auto max-w-5xl px-4 sm:px-5">
        <SectionTitle
          title="Vos devis sont gratuits. Vous payez quand vous facturez."
          sub="Commencez sans carte bancaire. La formule se choisit au moment d'envoyer votre première facture."
          className="mb-12"
        />
        <Reveal delay={0.1}>
          <PricingSelector />
        </Reveal>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────
   7 — Engagements
───────────────────────────────────────────────────────── */
const COMMITMENTS = [
  {
    icon: FolderOpen,
    title: "Vos documents restent à vous",
    text: "Consultation, téléchargement et export, avec ou sans formule, même après une résiliation.",
  },
  {
    icon: RotateCcw,
    title: `Satisfait ou remboursé ${GUARANTEE_DAYS} jours`,
    text: "Le remboursement se demande depuis vos paramètres, sans justification, une fois par compte.",
  },
  {
    icon: Unlock,
    title: "Sans engagement",
    text: "La résiliation se fait depuis vos paramètres, sans frais, à tout moment.",
  },
];

function CommitmentsSection() {
  return (
    <section className="bg-white py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-5">
        <SectionTitle title="Nos engagements." />
        <div className="mt-14 grid gap-10 md:grid-cols-3">
          {COMMITMENTS.map((c, i) => (
            <Reveal key={c.title} delay={i * 0.1} className="flex flex-col items-center gap-4 text-center">
              <c.icon className="h-7 w-7 text-[#2563EB]" {...ICON} />
              <h3 className="text-[20px] font-semibold tracking-[-0.02em] text-[#0A1122]" style={BRICOLAGE}>{c.title}</h3>
              <p className="max-w-[320px] text-[15px] leading-relaxed text-[#475569]">{c.text}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────
   8 — Questions fréquentes (reprises telles quelles dans le JSON-LD)
───────────────────────────────────────────────────────── */
const FAQ_ITEMS = [
  {
    q: "Qonforme est-il gratuit ?",
    a: `Les devis, les clients, le catalogue et les factures en brouillon sont gratuits, sans limite de durée. Une formule n'est demandée qu'au moment d'envoyer une facture : ${essentiel.name}, ${essentiel.monthlyPrice} € HT par mois ou ${essentiel.yearlyPrice} € HT par an.`,
  },
  {
    q: "Que change la facture électronique pour un artisan ?",
    a: "Depuis le 1er septembre 2026, toute entreprise doit pouvoir recevoir des factures électroniques. À partir du 1er septembre 2027, les TPE et PME doivent aussi émettre leurs factures entre entreprises en électronique, par une plateforme agréée. Pour les ventes aux particuliers, seules certaines données sont transmises à l'administration.",
  },
  {
    q: "Qonforme est-il une plateforme agréée ?",
    a: "Non. Qonforme est un logiciel de facturation. Le raccordement à une plateforme agréée, pour envoyer et recevoir vos factures électroniques depuis Qonforme, est en préparation.",
  },
  {
    q: "Je suis en franchise de TVA. Est-ce prévu ?",
    a: "Oui. La mention « TVA non applicable, art. 293 B du CGI » s'ajoute à vos documents depuis Paramètres, à partir d'un modèle prêt à l'emploi.",
  },
  {
    q: "Mon client est un particulier, sans SIREN. Est-ce un problème ?",
    a: "Non. Un client particulier se crée sans SIREN, et ses devis et factures se font comme les autres.",
  },
  {
    q: "Puis-je résilier à tout moment ?",
    a: `Oui, sans engagement ni frais, depuis vos paramètres. Vos documents restent consultables, téléchargeables et exportables après la résiliation. Et si Qonforme ne vous convient pas, vous êtes remboursé dans les ${GUARANTEE_DAYS} jours.`,
  },
  {
    q: "Faut-il installer une application ?",
    a: "Non. Qonforme fonctionne dans le navigateur, sur ordinateur comme sur téléphone. Sur téléphone, vous pouvez l'ajouter à l'écran d'accueil pour l'ouvrir comme une application.",
  },
];

const FAQ_JSONLD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_ITEMS.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: { "@type": "Answer", text: item.a },
  })),
};

function FAQSection() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="bg-[#F6F7F9] py-24 sm:py-32">
      <div className="mx-auto max-w-3xl px-4 sm:px-5">
        <SectionTitle title="Vos questions." className="mb-12" />
        <div className="flex flex-col gap-3">
          {FAQ_ITEMS.map((item, i) => {
            const isOpen = open === i;
            return (
              <Reveal key={item.q} delay={Math.min(i, 4) * 0.05} y={14}>
                <div className="rounded-[20px] border border-[#E6E9F0] bg-white">
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                  >
                    <span className="text-[16px] font-semibold text-[#0A1122]">{item.q}</span>
                    <ChevronDown
                      className={cn("h-5 w-5 shrink-0 text-[#64748B] transition-transform duration-300", isOpen && "rotate-180")}
                      strokeWidth={1.5}
                    />
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                        className="overflow-hidden"
                      >
                        <p className="px-6 pb-6 text-[15px] leading-relaxed text-[#475569]">{item.a}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────
   9 — Métiers et ressources (maillage interne pSEO)
───────────────────────────────────────────────────────── */
const TRADES = [
  { slug: "plombier", nom: "Plombier" },
  { slug: "electricien", nom: "Électricien" },
  { slug: "macon", nom: "Maçon" },
  { slug: "peintre", nom: "Peintre en bâtiment" },
  { slug: "carreleur", nom: "Carreleur" },
  { slug: "menuisier", nom: "Menuisier" },
  { slug: "couvreur", nom: "Couvreur" },
  { slug: "plaquiste", nom: "Plaquiste" },
  { slug: "chauffagiste", nom: "Chauffagiste" },
  { slug: "serrurier", nom: "Serrurier" },
  { slug: "paysagiste", nom: "Paysagiste" },
];

const GUIDES = [
  { href: "/guide/premiere-facture", label: "Faire sa première facture" },
  { href: "/guide/mentions-obligatoires-facture", label: "Mentions obligatoires sur une facture" },
  { href: "/guide/facture-electronique-2026", label: "La facture électronique" },
  { href: "/guide", label: "Tous les guides" },
];

const TEMPLATES = [
  { href: "/modele/devis-travaux", label: "Modèle de devis travaux" },
  { href: "/modele/facture-classique", label: "Modèle de facture" },
  { href: "/modele/facture-auto-entrepreneur", label: "Modèle de facture auto-entrepreneur" },
  { href: "/modele", label: "Tous les modèles" },
];

const TOOLS = [
  { href: "/outils/calculateur-tva", label: "Calculateur de TVA" },
  { href: "/outils/verification-siret", label: "Vérification de SIRET" },
  { href: "/outils/generateur-devis-gratuit", label: "Générateur de devis" },
  { href: "/outils", label: "Tous les outils gratuits" },
];

function TradeChip({ slug, nom }: { slug: string; nom: string }) {
  return (
    <Link
      href={`/facturation/${slug}`}
      className="mx-1.5 inline-flex h-12 shrink-0 items-center rounded-full border border-[#E6E9F0] bg-white px-6 text-[15px] font-medium text-[#0A1122] transition-colors hover:border-[#2563EB]/40 hover:text-[#2563EB]"
    >
      {nom}
    </Link>
  );
}

function ResourcesSection() {
  const columns = [
    { title: "Guides", links: GUIDES },
    { title: "Modèles gratuits", links: TEMPLATES },
    { title: "Outils gratuits", links: TOOLS },
  ];
  return (
    <section className="bg-white py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-5">
        <SectionTitle title="Pensé pour les métiers du bâtiment." />
      </div>

      <div className="lp-marquee mt-12 overflow-hidden">
        <div className="lp-marquee-track">
          {[0, 1].map((copy) => (
            <div key={copy} className="flex" aria-hidden={copy === 1 || undefined}>
              {TRADES.map((t) => (
                copy === 0 ? <TradeChip key={t.slug} {...t} /> : (
                  <span key={t.slug} className="mx-1.5 inline-flex h-12 shrink-0 items-center rounded-full border border-[#E6E9F0] bg-white px-6 text-[15px] font-medium text-[#0A1122]">
                    {t.nom}
                  </span>
                )
              ))}
            </div>
          ))}
        </div>
      </div>
      <p className="mt-6 text-center">
        <Link href="/facturation" className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-[#2563EB] hover:underline">
          Tous les métiers <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
        </Link>
      </p>

      <div className="mx-auto mt-20 grid max-w-6xl gap-10 px-4 sm:grid-cols-3 sm:px-5">
        {columns.map((col, i) => (
          <Reveal key={col.title} delay={i * 0.08}>
            <p className="text-[15px] font-semibold text-[#0A1122]">{col.title}</p>
            <ul className="mt-4 flex flex-col gap-3">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-[15px] text-[#475569] transition-colors hover:text-[#2563EB]">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────
   10 — Appel final (fond blanc, ou photo si générée)
───────────────────────────────────────────────────────── */
function FinalCta() {
  const photo = PHOTOS.finDeJournee;
  const buttons = (
    <div className="mt-9 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row">
      <Link href="/signup" className="lp-btn-p w-full max-w-[340px] sm:w-auto">
        Créer mon premier devis
        <ArrowRight className="lp-btn-arrow h-[18px] w-[18px]" strokeWidth={2} />
      </Link>
      <Link href="/demo" className="lp-btn-s w-full max-w-[340px] sm:w-auto">
        <span className="lp-btn-s-ic">
          <Play className="h-3 w-3 fill-current" strokeWidth={0} />
        </span>
        Voir la démo
      </Link>
    </div>
  );

  if (photo) {
    return (
      <section className="bg-white px-3 py-3 sm:px-5 sm:py-5">
        <div className="relative isolate overflow-hidden rounded-[28px] bg-[#0A1122] px-5 py-28 text-center sm:py-36">
          <Parallax distance={80} className="absolute inset-[-8%_0] -z-10">
            <Image src={photo.src} alt={photo.alt} fill sizes="100vw" loading="lazy" className="object-cover opacity-55" />
          </Parallax>
          <div className="mx-auto flex max-w-[760px] flex-col items-center">
            <SectionTitle dark title="Votre premier devis en quelques minutes." sub="Gratuit, sans carte bancaire. Vous ne payez qu'à votre première facture." />
            {buttons}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="border-t border-[#EEF1F5] bg-white py-24 sm:py-32">
      <div className="mx-auto flex max-w-[760px] flex-col items-center px-4 text-center sm:px-5">
        <SectionTitle title="Votre premier devis en quelques minutes." sub="Gratuit, sans carte bancaire. Vous ne payez qu'à votre première facture." />
        <Reveal delay={0.2} className="w-full sm:w-auto">{buttons}</Reveal>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────
   PAGE
───────────────────────────────────────────────────────── */
export default function HomePage() {
  return (
    // reducedMotion="user" : avec « Réduire les animations », les déplacements
    // deviennent instantanés et seuls les fondus restent (voir components/landing/motion.tsx).
    <MotionConfig reducedMotion="user">
    <div className="min-h-screen overflow-x-clip bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSONLD) }} />
      <LandingHero />
      <ReformSection />
      <StorySection />
      {PHOTOS.chantier && <PhotoBand photo={PHOTOS.chantier} />}
      <ProfilesSection />
      <MobileSection />
      <IncludedSection />
      <PricingSection />
      <CommitmentsSection />
      <FAQSection />
      <ResourcesSection />
      <FinalCta />
      <Footer showCta={false} />
    </div>
    </MotionConfig>
  );
}
