"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";
import type { PostHog } from "posthog-js";
import { currentConsent, isTrackingPage } from "@/lib/consent";
import { useConsent } from "@/components/consent/use-consent";
import { SESSION_RECORDING_CONFIG } from "@/lib/replay";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;

/**
 * posthog-js (~56 Ko) n'est plus dans le JavaScript initial de chaque page
 * (LCP mobile, PushRank) : il se charge après l'affichage, et pas du tout
 * quand la clé n'est pas configurée au build. Il ne se charge non plus qu'après
 * l'accord du visiteur (bandeau de cookies, lib/consent.ts) : posthog-js garde un
 * identifiant dans le navigateur.
 */
let client: Promise<PostHog> | null = null;

function loadPostHog(): Promise<PostHog> | null {
  const key = POSTHOG_KEY;
  if (!key || typeof window === "undefined") return null;
  client ??= import("posthog-js").then(({ default: posthog }) => {
    posthog.init(key, {
      api_host: "https://us.i.posthog.com",
      person_profiles: "identified_only",
      capture_pageview: false, // on le fait manuellement ci-dessous
      capture_pageleave: true,
      // Pages vues seulement : le texte des liens et boutons (noms de clients, montants)
      // ne part jamais dans un événement. Les clics se voient dans l'enregistrement.
      autocapture: false,
      disable_surveys: true,
      // Enregistrement des sessions : champs et données masqués (lib/replay.ts).
      // À activer aussi dans PostHog : Paramètres du projet › Session replay.
      session_recording: SESSION_RECORDING_CONFIG,
      // Page de règlement (/regler/<jeton>) : le jeton donne accès à une facture,
      // il ne part jamais chez un tiers. Aucun événement n'est envoyé depuis cette page.
      before_send: (event) =>
        event && /\/regler\/[A-Za-z0-9_-]{20,}/.test(String(event.properties?.$current_url ?? "")) ? null : event,
    });
    return posthog;
  });
  return client;
}

function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Relance l'effet quand le choix change ; la valeur utilisée est relue dans l'effet
  // (le hook vaut null à l'hydratation, même pour un visiteur qui a déjà accepté).
  const consent = useConsent();

  useEffect(() => {
    if (!pathname) return;
    if (currentConsent() !== "accepted") {
      // Refus ou retrait de l'accord : plus rien ne part (si posthog-js était chargé)
      client?.then((ph) => ph.opt_out_capturing()).catch(() => {});
      return;
    }
    if (!isTrackingPage(pathname)) return;
    let url = window.origin + pathname;
    if (searchParams.toString()) {
      url += "?" + searchParams.toString();
    }
    loadPostHog()
      ?.then((ph) => {
        if (ph.has_opted_out_capturing()) ph.opt_in_capturing({ captureEventName: false });
        ph.capture("$pageview", { $current_url: url });
      })
      .catch(() => {});
  }, [pathname, searchParams, consent]);

  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  if (!POSTHOG_KEY) {
    return <>{children}</>;
  }

  return (
    <>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      {children}
    </>
  );
}
