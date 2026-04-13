/**
 * Meta Pixel helper — appels fbq typés et sécurisés
 * Le script fbq est chargé globalement dans app/layout.tsx (next/script afterInteractive)
 */

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void
  }
}

export function trackEvent(event: string, data?: Record<string, unknown>) {
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq('track', event, data)
  }
}
