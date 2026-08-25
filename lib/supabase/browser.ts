import { createBrowserClient } from "@supabase/ssr"
import { supabaseEnv } from "@/lib/supabase/config"

export function createClient() {
  const { url, anonKey } = supabaseEnv()
  return createBrowserClient(url, anonKey)
}
