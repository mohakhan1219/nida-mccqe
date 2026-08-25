import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { supabaseEnv } from "@/lib/supabase/config"

export async function createServerSupabase() {
  const { url, anonKey } = supabaseEnv()
  const cookieStore = await cookies()
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          /* called from a Server Component */
        }
      },
    },
  })
}
