"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FieldLabel } from "@/components/field"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { createClient } from "@/lib/supabase/browser"

export function LoginView() {
  const router = useRouter()
  const configured = isSupabaseConfigured()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [reset, setReset] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!configured) {
      setMessage("Supabase is not configured. Add keys in .env.local, or use preview mode at /.")
      return
    }
    const supabase = createClient()
    if (reset) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/auth/update-password`,
      })
      setMessage(error ? error.message : "If that email is enrolled, a reset link is on its way.")
      return
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setMessage(error.message)
      return
    }
    router.replace("/")
    router.refresh()
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <p className="font-heading text-3xl">Dr. Nida's MCCQE1 Journey</p>
      <p className="mt-2 text-sm text-muted-foreground">From MBBS to Canadian Physician 🇨🇦</p>
      <p className="mt-6 text-sm text-muted-foreground">
        Private household login. There is no public sign-up.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <div>
          <FieldLabel>Email</FieldLabel>
          <Input
            type="email"
            autoComplete="username"
            className="h-11"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        {reset ? null : (
          <div>
            <FieldLabel>Password</FieldLabel>
            <Input
              type="password"
              autoComplete="current-password"
              className="h-11"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
        )}
        {message ? <p className="text-sm text-destructive">{message}</p> : null}
        <Button type="submit" className="h-11 w-full">
          {reset ? "Send reset link" : "Sign in"}
        </Button>
        <button
          type="button"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          onClick={() => setReset((v) => !v)}
        >
          {reset ? "Back to sign in" : "Forgot password"}
        </button>
      </form>
    </div>
  )
}
