"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FieldLabel } from "@/components/field"
import { createClient } from "@/lib/supabase/browser"
import { isSupabaseConfigured } from "@/lib/supabase/config"

export function UpdatePasswordView() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [message, setMessage] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isSupabaseConfigured()) return
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setMessage(error.message)
      return
    }
    router.replace("/")
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <p className="font-heading text-3xl">Set a new password</p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <div>
          <FieldLabel>New password</FieldLabel>
          <Input
            type="password"
            className="h-11"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
        </div>
        {message ? <p className="text-sm text-destructive">{message}</p> : null}
        <Button type="submit" className="h-11 w-full">
          Save password
        </Button>
      </form>
    </div>
  )
}
