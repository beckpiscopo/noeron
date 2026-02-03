import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') ?? '/'
  const origin = requestUrl.origin

  if (!code) {
    // No code provided, redirect to home
    return NextResponse.redirect(`${origin}/`)
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase not configured')
    return NextResponse.redirect(`${origin}/`)
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  // Exchange the code for a session
  const { data: sessionData, error: sessionError } = await supabase.auth.exchangeCodeForSession(code)

  if (sessionError || !sessionData.user) {
    console.error('Error exchanging code for session:', sessionError)
    return NextResponse.redirect(`${origin}/?error=auth_failed`)
  }

  const user = sessionData.user

  // Fetch the user's profile to check if display_name needs to be set
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('display_name')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    console.error('Error fetching user profile:', profileError)
    // Continue with redirect even if profile fetch fails
    return NextResponse.redirect(`${origin}${next}`)
  }

  // Check if display_name is the auto-generated default (email username)
  const emailUsername = user.email?.split('@')[0] ?? ''
  const isDefaultDisplayName = !profile?.display_name ||
    profile.display_name === emailUsername ||
    profile.display_name === user.user_metadata?.name

  if (isDefaultDisplayName) {
    // Redirect to settings with welcome flag
    return NextResponse.redirect(`${origin}/settings?welcome=1`)
  }

  // Normal redirect to intended destination
  return NextResponse.redirect(`${origin}${next}`)
}
