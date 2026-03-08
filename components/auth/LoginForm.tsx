'use client'

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { createClient } from "@/lib/supabase/client"

export default function LoginForm() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail]       = useState("")
  const [password, setPassword] = useState("")
  const [errors, setErrors]     = useState<{ email?: string; password?: string }>({})
  const [loading, setLoading]         = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  /* Validation */
  const validate = () => {
    const errs: typeof errors = {}
    if (!email.trim())                        errs.email    = "Email requis"
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = "Email invalide"
    if (!password)                            errs.password = "Mot de passe requis"
    else if (password.length < 8)            errs.password = "8 caractères minimum"
    return errs
  }

  /* Connexion email/password */
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setErrors({})
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        // Messages d'erreur lisibles
        if (error.message.includes("Invalid login credentials") || error.message.includes("invalid_credentials")) {
          toast.error("Email ou mot de passe incorrect.")
        } else if (error.message.includes("Email not confirmed")) {
          toast.error("Vérifie ta boîte mail pour confirmer ton email.")
        } else if (error.message.includes("too many requests") || error.message.includes("rate limit")) {
          toast.error("Trop de tentatives. Patiente quelques minutes.")
        } else {
          toast.error(error.message)
        }
        return
      }
      toast.success("Connexion réussie !")
      router.push("/dashboard")
      router.refresh()
    } catch {
      toast.error("Erreur réseau. Réessaie.")
    } finally {
      setLoading(false)
    }
  }

  /* Google OAuth */
  const handleGoogle = async () => {
    setGoogleLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/api/auth/callback` },
    })
    if (error) {
      toast.error("Erreur lors de la connexion Google")
      setGoogleLoading(false)
    }
  }

  return (
    <div className="space-y-4">

      {/* Google OAuth */}
      <Button
        type="button"
        variant="outline"
        className="w-full gap-2"
        onClick={handleGoogle}
        disabled={googleLoading}
      >
        {googleLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
        )}
        Continuer avec Google
      </Button>

      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs text-slate-400">ou</span>
        <Separator className="flex-1" />
      </div>

      {/* Email / Password */}
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="jean@exemple.fr"
            className={`mt-1 ${errors.email ? "border-red-400 focus-visible:ring-red-400" : ""}`}
            value={email}
            onChange={e => { setEmail(e.target.value); if (errors.email) setErrors(p => ({ ...p, email: undefined })) }}
            autoComplete="email"
          />
          {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <Label htmlFor="password">Mot de passe</Label>
            <a href="#" className="text-xs text-[#2563EB] hover:underline">Mot de passe oublié ?</a>
          </div>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            className={errors.password ? "border-red-400 focus-visible:ring-red-400" : ""}
            value={password}
            onChange={e => { setPassword(e.target.value); if (errors.password) setErrors(p => ({ ...p, password: undefined })) }}
            autoComplete="current-password"
          />
          {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
        </div>

        <Button
          type="submit"
          className="w-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
          disabled={loading}
        >
          {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {loading ? "Connexion…" : "Se connecter"}
        </Button>
      </form>
    </div>
  )
}
