import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && data?.session) {
      const pToken = data.session.provider_token;
      const pRefreshToken = data.session.provider_refresh_token;
      
      const forwardedHost = request.headers.get('x-forwarded-host') 
      const isLocalEnv = process.env.NODE_ENV === 'development'
      
      let baseUrl = origin;
      if (!isLocalEnv && forwardedHost) {
        baseUrl = `https://${forwardedHost}`;
      }
      
      let redirectUrl = `${baseUrl}${next}`;
      if (pToken) {
        redirectUrl += `#provider_token=${pToken}&provider_refresh_token=${pRefreshToken}`;
      }
      
      return NextResponse.redirect(redirectUrl)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=true`)
}
