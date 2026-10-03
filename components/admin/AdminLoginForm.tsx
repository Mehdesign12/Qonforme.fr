'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { AUTH_INPUT, AuthSubmit, Field, PasswordInput } from '@/components/auth/fields'

/** Formulaire de connexion admin : mêmes champs que la connexion de l'application (16 px, règle iOS). */
export default function AdminLoginForm() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors]     = useState<{ email?: string; password?: string }>({})
  const [loading, setLoading]   = useState(false)

  const validate = () => {
    const errs: typeof errors = {}
    if (!email.trim())    errs.email    = 'Adresse email requise'
    if (!password.trim()) errs.password = 'Mot de passe requis'
    return errs
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setErrors({})
    setLoading(true)
    try {
      const res = await fetch('/api/admin/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password }),
      })
      if (res.status === 401) {
        toast.error('Identifiants incorrects')
        return
      }
      if (!res.ok) {
        toast.error('Erreur serveur. Réessayez.')
        return
      }
      window.location.href = '/admin'
    } catch {
      toast.error('Erreur réseau. Réessayez.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4" noValidate>
      <Field id="admin-email" label="Adresse email" error={errors.email}>
        <input
          id="admin-email"
          type="email"
          placeholder="admin@exemple.fr"
          autoComplete="email"
          inputMode="email"
          className={AUTH_INPUT}
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? 'admin-email-error' : undefined}
          value={email}
          onChange={e => { setEmail(e.target.value); if (errors.email) setErrors(p => ({ ...p, email: undefined })) }}
          disabled={loading}
        />
      </Field>

      <Field id="admin-password" label="Mot de passe" error={errors.password}>
        <PasswordInput
          id="admin-password"
          autoComplete="current-password"
          error={errors.password}
          value={password}
          onChange={e => { setPassword(e.target.value); if (errors.password) setErrors(p => ({ ...p, password: undefined })) }}
          disabled={loading}
        />
      </Field>

      <AuthSubmit loading={loading} loadingLabel="Connexion…" className="mt-1.5">
        Accéder à l&apos;espace admin
      </AuthSubmit>
    </form>
  )
}
