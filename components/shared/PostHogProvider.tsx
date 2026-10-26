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
/**
 * Dernière page vue. Avec `capture_pageview: false`, posthog-js n'envoie `$pageleave`
 * qu'à la fermeture de l'onglet : sans celui-ci, la durée et le rebond d'une visite
 * qui change de page sans recharger (navigation interne) seraient faux.
 */
let lastUrl: string | null = null;

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

/**
 * Événement d'entonnoir (mur de paiement, choix d'une formule…), après accord du
 * visiteur seulement. Aucune donnée personnelle dans les propriétés : ni nom, ni
 * montant d'un document, ni numéro de facture, ni adresse email.
 */
export function captureEvent(name: string, properties?: Record<string, string | number | boolean>): void {
  if (typeof window === "undefined" || !POSTHOG_KEY) return;
  if (currentConsent() !== "accepted" || !isTrackingPage(window.location.pathname)) return;
  loadPostHog()
    ?.then((ph) => ph.capture(name, properties))
    .catch(() => {});
}

/**
 * Relie le visiteur anonyme au compte qu'il vient de créer (PostHog est en
 * `identified_only`) : on retrouve alors, dans la fiche du compte, la page ou l'outil
 * d'où il venait (par exemple le générateur de devis). Même règles que `captureEvent` :
 * rien sans l'accord du visiteur, rien sur une page sans traceur. On n'envoie que
 * l'identifiant du compte, jamais l'email ni le nom.
 */
export function identifyUser(userId: string | null | undefined): void {
  if (!userId || typeof window === "undefined" || !POSTHOG_KEY) return;
  if (currentConsent() !== "accepted" || !isTrackingPage(window.location.pathname)) return;
  loadPostHog()
    ?.then((ph) => {
      if (ph.get_distinct_id() !== userId) ph.identify(userId);
    })
    .catch(() => {});
}

/**
 * Compte tout juste créé, par email ou par Google : les deux arrivent sur le tableau de
 * bord avec `?bienvenue=1` (components/auth/SignupForm.tsx, app/api/auth/callback/route.ts).
 * La session est déjà dans les cookies : on la lit sans appel réseau.
 */
async function identifyCurrentUser(): Promise<void> {
  try {
    const { createClient } = await import("@/lib/supabase/client");
    const { data } = await createClient().auth.getSession();
    identifyUser(data.session?.user.id);
  } catch {
    // L'identification est un plus : sans elle, le parcours continue
  }
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
    if (!isTrackingPage(pathname)) {
      // Page sans traceur (règlement, signature, admin) atteinte depuis le site : on clôt la page
      // précédente et on arrête l'enregistrement de la session tant qu'on y reste.
      client
        ?.then((ph) => {
          if (lastUrl) ph.capture("$pageleave", { $current_url: lastUrl });
          lastUrl = null;
          ph.stopSessionRecording();
        })
        .catch(() => {});
      return;
    }
    let url = window.origin + pathname;
    if (searchParams.toString()) {
      url += "?" + searchParams.toString();
    }
    loadPostHog()
      ?.then((ph) => {
        if (ph.has_opted_out_capturing()) ph.opt_in_capturing({ captureEventName: false });
        if (lastUrl && lastUrl !== url) ph.capture("$pageleave", { $current_url: lastUrl });
        lastUrl = url;
        ph.capture("$pageview", { $current_url: url });
        if (!ph.sessionRecordingStarted()) ph.startSessionRecording();
      })
      .catch(() => {});
    if (searchParams.get("bienvenue") === "1") void identifyCurrentUser();
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
