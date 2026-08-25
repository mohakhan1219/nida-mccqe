export function supabaseEnv() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  }
}

export function isSupabaseConfigured() {
  const { url, anonKey } = supabaseEnv()
  if (!url || !anonKey) return false
  if (url.includes("your-project") || url.includes("placeholder")) return false
  if (anonKey.includes("your-anon-key") || anonKey.includes("placeholder")) return false
  return url.startsWith("https://") && anonKey.length > 20
}
