'use client'

import { useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Loader2, ArrowLeft, Mail, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function ForgotPasswordForm() {
  const [email, setEmail]         = useState("")
  const [error, setError]         = useState<string | null>(null)
  const [loading, setLoading]     = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const validate = (): string | null => {
    if (!email.trim())                               return "L'adresse email est requise"
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Adresse email invalide"
    return null
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const err = validate()
    if (err) { setError(err); return }
    setError(null)
    setLoading(true)

    try {
      // On appelle notre propre API qui génère le lien Supabase
      // et envoie l'email brandé Qonforme via Resend.
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })

      if (!res.ok) {
        // Erreur réseau ou serveur — message générique
        console.error("reset-password API status:", res.status)
        toast.error("Une erreur est survenue. Réessaie dans quelques instants.")
        return
      }

      // Toujours afficher la confirmation, même si l'email n'existe pas
      // (sécurité : éviter l'énumération d'emails)
      setSubmitted(true)
    } catch {
      toast.error("Erreur réseau. Vérifie ta connexion et réessaie.")
    } finally {
      setLoading(false)
    }
  }

  // ── État : email envoyé ──────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-[#D1FAE5] flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-[#10B981]" />
          </div>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-[#0F172A]">Vérifie ta boîte mail</h2>
          <p className="text-sm text-slate-500 mt-2 leading-relaxed">
            Si un compte existe pour{" "}
            <span className="font-medium text-[#0F172A]">{email}</span>,
            tu recevras un email avec un lien de réinitialisation dans quelques minutes.
          </p>
          <p className="text-xs text-slate-400 mt-3">
            Pense à vérifier tes spams si tu ne le vois pas.
          </p>
        </div>
        <div className="pt-2 space-y-2">
          <Button
            type="button"
            variant="outline"
            className="w-full gap-2"
            onClick={() => { setSubmitted(false); setEmail("") }}
          >
            <Mail className="w-4 h-4" />
            Utiliser une autre adresse
          </Button>
          <Link href="/login" className="block">
            <Button type="button" variant="ghost" className="w-full gap-2 text-slate-500">
              <ArrowLeft className="w-4 h-4" />
              Retour à la connexion
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  // ── État : formulaire ────────────────────────────────────────────────────
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div>
        <Label htmlFor="email">Adresse email</Label>
        <Input
          id="email"
          type="email"
          placeholder="jean@exemple.fr"
          autoComplete="email"
          autoFocus
          className={`mt-1 ${error ? "border-red-400 focus-visible:ring-red-400" : ""}`}
          value={email}
          onChange={e => {
            setEmail(e.target.value)
            if (error) setError(null)
          }}
          disabled={loading}
        />
        {error && (
          <p className="text-xs text-red-500 mt-1">{error}</p>
        )}
      </div>

      <Button
        type="submit"
        className="w-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
        disabled={loading}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Envoi en cours…
          </>
        ) : (
          "Envoyer le lien de réinitialisation"
        )}
      </Button>

      <Link href="/login" className="block">
        <Button type="button" variant="ghost" className="w-full gap-2 text-slate-500">
          <ArrowLeft className="w-4 h-4" />
          Retour à la connexion
        </Button>
      </Link>
    </form>
  )
}
