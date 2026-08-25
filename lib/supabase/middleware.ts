import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { isSupabaseConfigured, supabaseEnv } from "@/lib/supabase/config"

export async function updateSession(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.next({ request })
  }

  const { url, anonKey } = supabaseEnv()
  let response = NextResponse.next({ request })

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        )
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const publicPath =
    path.startsWith("/login") ||
    path.startsWith("/auth") ||
    path.startsWith("/manifest") ||
    path === "/sw.js" ||
    path.startsWith("/icons")

  if (!user && !publicPath) {
    const login = request.nextUrl.clone()
    login.pathname = "/login"
    login.searchParams.set("next", path)
    return NextResponse.redirect(login)
  }

  if (user && path.startsWith("/login")) {
    const home = request.nextUrl.clone()
    home.pathname = "/"
    return NextResponse.redirect(home)
  }

  return response
}
