"use client"

/**
 * Appels des écrans Articles vers leurs routes : JSON en entrée et en sortie,
 * message d'erreur en français rendu tel quel (jamais d'exception non gérée).
 */
export interface ApiResult<T> {
  ok: boolean
  status: number
  data: T | null
  error: string | null
  fieldErrors?: Record<string, string>
}

export async function api<T = unknown>(url: string, method: "GET" | "POST" | "PATCH" | "PUT", body?: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store",
    })
    const json = (await res.json().catch(() => null)) as (T & { error?: string; fieldErrors?: Record<string, string> }) | null
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        data: json,
        error: json?.error ?? (res.status === 401 ? "Session expirée : reconnectez-vous." : "Une erreur est survenue. Réessayez dans un instant."),
        fieldErrors: json?.fieldErrors,
      }
    }
    return { ok: true, status: res.status, data: json, error: null }
  } catch {
    return { ok: false, status: 0, data: null, error: "Connexion impossible. Vérifiez votre réseau puis réessayez." }
  }
}
