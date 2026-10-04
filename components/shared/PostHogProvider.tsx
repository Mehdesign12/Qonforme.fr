"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";
import type { PostHog } from "posthog-js";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;

/**
 * posthog-js (~56 Ko) n'est plus dans le JavaScript initial de chaque page
 * (LCP mobile, PushRank) : il se charge après l'affichage, et pas du tout
 * quand la clé n'est pas configurée au build.
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

  useEffect(() => {
    if (!pathname) return;
    let url = window.origin + pathname;
    if (searchParams.toString()) {
      url += "?" + searchParams.toString();
    }
    loadPostHog()?.then((ph) => ph.capture("$pageview", { $current_url: url })).catch(() => {});
  }, [pathname, searchParams]);

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
