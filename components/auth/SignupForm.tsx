'use client'

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, Eye, EyeOff } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

/* ─── classes communes ──────────────────────────────────────────────────── */
const inputBase =
  "w-full h-11 rounded-[10px] border border-[#E2E8F0] bg-white px-3.5 text-sm text-[#0F172A] placeholder:text-slate-400 outline-none transition-all focus:border-[#2563EB] focus:ring-4 focus:ring-[#2563EB]/10 disabled:opacity-50"
const inputError =
  "border-red-400 focus:border-red-400 focus:ring-red-400/10"
const labelCls  = "block text-[13px] font-semibold text-[#0F172A] mb-1.5"
const btnPrimary =
  "w-full h-11 rounded-[10px] bg-[#2563EB] hover:bg-[#1D4ED8] active:scale-[0.98] text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"

function validate(fields: {
  first_name: string; last_name: string
  email: string; password: string; confirm_password: string
}) {
  const errs: Record<string, string> = {}
  if (!fields.first_name || fields.first_name.trim().length < 2)
    errs.first_name = "Prénom requis (2 caractères min.)"
  if (!fields.last_name || fields.last_name.trim().length < 2)
    errs.last_name = "Nom requis (2 caractères min.)"
  if (!fields.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email))
    errs.email = "Email invalide"
  if (!fields.password || fields.password.length < 8)
    errs.password = "8 caractères minimum"
  if (!fields.confirm_password)
    errs.confirm_password = "Confirmation requise"
  else if (fields.password !== fields.confirm_password)
    errs.confirm_password = "Les mots de passe ne correspondent pas"
  return errs
}

export default function SignupForm() {
  const router   = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(false)
  const [errors, setErrors]   = useState<Record<string, string>>({})
  const [showPwd, setShowPwd] = useState(false)
  const [showCfm, setShowCfm] = useState(false)

  const [fields, setFields] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    confirm_password: "",
  })

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFields(prev => ({ ...prev, [key]: e.target.value }))
    if (errors[key]) setErrors(prev => { const n = { ...prev }; delete n[key]; return n })
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validate(fields)
    if (Object.keys(errs).length > 0) { setErrors(errs); return }

    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email: fields.email.trim(),
        password: fields.password,
        options: {
          data: {
            first_name: fields.first_name.trim(),
            last_name: fields.last_name.trim(),
          },
        },
      })
      if (error) {
        if (error.message.includes("already registered") || error.message.includes("User already registered")) {
          toast.error("Cet email est déjà utilisé. Connectez-vous.", { duration: 6000 })
        } else if (error.message.includes("Email rate limit") || error.message.includes("rate limit") || error.status === 429) {
          toast.error("Trop de demandes. Réessayez dans quelques minutes.", { duration: 8000 })
        } else if (error.message.includes("Signups not allowed")) {
          toast.error("Les inscriptions sont temporairement désactivées.", { duration: 8000 })
        } else {
          toast.error(`Erreur : ${error.message}`, { duration: 8000 })
        }
        setLoading(false)
        return
      }
      if (data?.user?.identities?.length === 0) {
        toast.error("Cet email est déjà utilisé. Connectez-vous.", { duration: 6000 })
        setLoading(false)
        return
      }
      toast.success("Compte créé ! Complète ton profil entreprise.")
      router.push("/signup/company")
    } catch {
      toast.error("Une erreur inattendue s'est produite. Réessayez.", { duration: 8000 })
      setLoading(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>

      {/* Prénom + Nom */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="first_name" className={labelCls}>Prénom</label>
          <input
            id="first_name"
            placeholder="Jean"
            autoComplete="given-name"
            className={`${inputBase} ${errors.first_name ? inputError : ""}`}
            value={fields.first_name}
            onChange={set("first_name")}
            disabled={loading}
          />
          {errors.first_name && <p className="text-xs text-red-500 mt-1.5">{errors.first_name}</p>}
        </div>
        <div>
          <label htmlFor="last_name" className={labelCls}>Nom</label>
          <input
            id="last_name"
            placeholder="Dupont"
            autoComplete="family-name"
            className={`${inputBase} ${errors.last_name ? inputError : ""}`}
            value={fields.last_name}
            onChange={set("last_name")}
            disabled={loading}
          />
          {errors.last_name && <p className="text-xs text-red-500 mt-1.5">{errors.last_name}</p>}
        </div>
      </div>

      {/* Email */}
      <div>
        <label htmlFor="email" className={labelCls}>Email professionnel</label>
        <input
          id="email"
          type="email"
          placeholder="jean@monentreprise.fr"
          autoComplete="email"
          className={`${inputBase} ${errors.email ? inputError : ""}`}
          value={fields.email}
          onChange={set("email")}
          disabled={loading}
        />
        {errors.email && <p className="text-xs text-red-500 mt-1.5">{errors.email}</p>}
      </div>

      {/* Mot de passe */}
      <div>
        <label htmlFor="password" className={labelCls}>Mot de passe</label>
        <div className="relative">
          <input
            id="password"
            type={showPwd ? "text" : "password"}
            placeholder="8 caractères minimum"
            autoComplete="new-password"
            className={`${inputBase} pr-11 ${errors.password ? inputError : ""}`}
            value={fields.password}
            onChange={set("password")}
            disabled={loading}
          />
          <button
            type="button" tabIndex={-1}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            onClick={() => setShowPwd(v => !v)}
            aria-label={showPwd ? "Masquer" : "Afficher"}
          >
            {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {errors.password && <p className="text-xs text-red-500 mt-1.5">{errors.password}</p>}
      </div>

      {/* Confirmation */}
      <div>
        <label htmlFor="confirm_password" className={labelCls}>Confirmer le mot de passe</label>
        <div className="relative">
          <input
            id="confirm_password"
            type={showCfm ? "text" : "password"}
            placeholder="••••••••"
            autoComplete="new-password"
            className={`${inputBase} pr-11 ${errors.confirm_password ? inputError : ""}`}
            value={fields.confirm_password}
            onChange={set("confirm_password")}
            disabled={loading}
          />
          <button
            type="button" tabIndex={-1}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            onClick={() => setShowCfm(v => !v)}
            aria-label={showCfm ? "Masquer" : "Afficher"}
          >
            {showCfm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {errors.confirm_password && <p className="text-xs text-red-500 mt-1.5">{errors.confirm_password}</p>}
      </div>

      {/* CTA */}
      <button type="submit" className={btnPrimary} disabled={loading}>
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        {loading ? "Création en cours…" : "Créer mon compte →"}
      </button>

      {/* CGU */}
      <p className="text-xs text-slate-400 text-center leading-relaxed">
        En créant un compte, tu acceptes nos{" "}
        <a href="/cgu" className="underline hover:text-slate-600">CGU</a>{" "}
        et notre{" "}
        <a href="/confidentialite" className="underline hover:text-slate-600">politique de confidentialité</a>.
      </p>
    </form>
  )
}
