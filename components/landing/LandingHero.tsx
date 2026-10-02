"use client";

import Link from "next/link";
import { ArrowRight, Check, Play } from "lucide-react";
import { motion, useScroll, useTransform } from "motion/react";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { MacBook, IPhone, SCREENS } from "@/components/landing/devices";
import { RevealWords } from "@/components/landing/motion";

/**
 * Héros de l'accueil : variante « Clair sobre » validée (DECISIONS § 6).
 * Fond blanc, texte et boutons centrés, vrai produit dans un ordinateur et un
 * téléphone qui se redressent au défilement.
 *
 * Le titre validé finit par « conforme de bout en bout ». Il reviendra quand la
 * transmission par plateforme agréée sera livrée ; d'ici là, on ne promet que
 * ce que le produit fait déjà.
 */

const PROMISES = ["Devis gratuits et illimités", "Sans carte bancaire", "Sans engagement"];

function HeroDevices() {
  // Défilement de la page en pixels : l'ordinateur, incliné au chargement, se
  // redresse sur les 520 premiers pixels ; le téléphone monte plus vite que lui.
  const { scrollY } = useScroll();
  const rotateX = useTransform(scrollY, [0, 520], [14, 0]);
  const scale = useTransform(scrollY, [0, 520], [0.94, 1]);
  const phoneY = useTransform(scrollY, [0, 700], [60, -50]);
  const phoneRotate = useTransform(scrollY, [0, 700], [4, 0]);

  return (
    <div className="relative mx-auto mt-12 w-full max-w-[1120px] px-4 pb-16 sm:mt-14 sm:px-6 sm:pb-24">
      <div className="lp-fade-up" style={{ animationDelay: ".55s" }}>
        <motion.div
          className="lp-motion"
          style={{ rotateX, scale, transformPerspective: 1600, transformOrigin: "50% 100%" }}
        >
          <MacBook
            screen={{ ...SCREENS.tableauDeBord, sizes: "(min-width: 1120px) 920px, 86vw", priority: true }}
          />
        </motion.div>
      </div>

      <div
        className="lp-fade-up absolute bottom-[8%] right-[5%] w-[23%] max-w-[230px] sm:bottom-[10%] sm:right-[4%] sm:w-[19%]"
        style={{ animationDelay: ".8s" }}
      >
        <motion.div className="lp-motion" style={{ y: phoneY, rotate: phoneRotate }}>
          <IPhone screen={{ ...SCREENS.mobileDevis, sizes: "(min-width: 1120px) 230px, 25vw" }} />
        </motion.div>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden bg-white">
      <div className="mx-auto flex max-w-6xl flex-col items-center px-4 pt-[116px] text-center sm:px-5 sm:pt-[148px]">
        <p className="lp-fade-up inline-flex max-w-full items-center gap-2.5 rounded-full border border-[#E6E9F0] bg-white py-1 pl-1 pr-3.5 text-left text-[13px] text-[#334155] shadow-[0_1px_2px_rgba(10,17,34,.05)]">
          <span className="shrink-0 rounded-full bg-[#0A1122] px-2.5 py-1 text-[12px] font-semibold text-white">1er sept. 2027</span>
          <span className="min-w-0 sm:hidden">Facture électronique obligatoire pour les TPE</span>
          <span className="hidden min-w-0 sm:inline">Émission de factures électroniques obligatoire pour les TPE</span>
        </p>

        <RevealWords
          as="h1"
          immediate
          delay={0.1}
          text={"La facturation des pros du bâtiment,\nsimple dès le premier devis."}
          className="mt-7 max-w-[1100px] text-[clamp(36px,5.6vw,68px)] font-semibold leading-[1.04] tracking-[-0.04em] text-[#0A1122] [text-wrap:balance]"
          style={{ fontFamily: "var(--font-bricolage)" }}
        />

        <p
          className="lp-fade-up mt-6 max-w-[600px] text-[17px] leading-relaxed text-[#475569] sm:text-[18px]"
          style={{ animationDelay: ".45s" }}
        >
          Devis, factures, relances et suivi des paiements, au bureau comme sur le chantier.
          Vos devis sont gratuits&nbsp;: vous payez quand vous facturez.
        </p>

        <div
          className="lp-fade-up mt-9 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row"
          style={{ animationDelay: ".55s" }}
        >
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

        <ul
          className="lp-fade-up mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-[14px] text-[#475569]"
          style={{ animationDelay: ".65s" }}
        >
          {PROMISES.map((p) => (
            <li key={p} className="flex items-center gap-2">
              <Check className="h-4 w-4 text-[#2563EB]" strokeWidth={1.75} />
              {p}
            </li>
          ))}
        </ul>
      </div>

      <HeroDevices />
    </section>
  );
}

export function LandingHero() {
  return (
    <>
      <PublicHeader isLandingPage />
      <Hero />
    </>
  );
}
