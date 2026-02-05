"use client"

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react"
import { supabase } from "@/lib/supabase"
import type { User, Session, AuthError } from "@supabase/supabase-js"

type AuthState = "loading" | "unauthenticated" | "authenticated"

interface AuthContextType {
  user: User | null
  session: Session | null
  authState: AuthState
  signInWithMagicLink: (email: string, redirectTo?: string) => Promise<{ error: AuthError | null }>
  requestAccess: (email: string, name?: string, reason?: string) => Promise<{ error: Error | null; alreadyRequested?: boolean }>
  signOut: () => Promise<void>
  isAllowedEmail: (email: string) => Promise<boolean>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [authState, setAuthState] = useState<AuthState>("loading")

  useEffect(() => {
    if (!supabase) {
      // Supabase not configured - run in unauthenticated mode
      setAuthState("unauthenticated")
      return
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setAuthState(session ? "authenticated" : "unauthenticated")
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        setAuthState(session ? "authenticated" : "unauthenticated")
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const isAllowedEmail = useCallback(async (email: string): Promise<boolean> => {
    if (!supabase) return false

    const { data, error } = await supabase
      .from("allowed_emails")
      .select("email")
      .eq("email", email.toLowerCase())
      .maybeSingle()

    if (error) {
      console.error("Error checking allowed email:", error)
      return false
    }

    return !!data
  }, [])

  const signInWithMagicLink = useCallback(async (email: string, redirectTo?: string): Promise<{ error: AuthError | null }> => {
    if (!supabase) {
      return { error: { message: "Supabase not configured", name: "ConfigError" } as AuthError }
    }

    // Check if email is in allowlist first
    const allowed = await isAllowedEmail(email)
    if (!allowed) {
      return {
        error: {
          message: "This email is not on the invite list. Please request access first.",
          name: "NotAllowed"
        } as AuthError
      }
    }

    // Build the callback URL with optional redirect param
    let callbackUrl = typeof window !== "undefined"
      ? `${window.location.origin}/auth/callback`
      : undefined

    if (callbackUrl && redirectTo) {
      callbackUrl = `${callbackUrl}?next=${encodeURIComponent(redirectTo)}`
    }

    const { error } = await supabase.auth.signInWithOtp({
      email: email.toLowerCase(),
      options: {
        emailRedirectTo: callbackUrl,
      },
    })

    return { error }
  }, [isAllowedEmail])

  const requestAccess = useCallback(async (
    email: string,
    name?: string,
    reason?: string
  ): Promise<{ error: Error | null; alreadyRequested?: boolean }> => {
    if (!supabase) {
      return { error: new Error("Supabase not configured") }
    }

    // Check if already in allowlist
    const allowed = await isAllowedEmail(email)
    if (allowed) {
      return {
        error: new Error("You're already approved! Please sign in instead."),
        alreadyRequested: false
      }
    }

    // Check if already requested
    const { data: existing } = await supabase
      .from("access_requests")
      .select("id, status")
      .eq("email", email.toLowerCase())
      .maybeSingle()

    if (existing) {
      if (existing.status === "pending") {
        return { error: null, alreadyRequested: true }
      } else if (existing.status === "approved") {
        return {
          error: new Error("Your request was approved! Please sign in."),
          alreadyRequested: false
        }
      } else {
        // Denied - allow re-request by updating existing row
        const { error } = await supabase
          .from("access_requests")
          .update({
            name,
            reason,
            status: "pending",
            updated_at: new Date().toISOString()
          })
          .eq("id", existing.id)

        return { error: error ? new Error(error.message) : null }
      }
    }

    // Insert new request
    const { error } = await supabase
      .from("access_requests")
      .insert({
        email: email.toLowerCase(),
        name,
        reason,
        status: "pending",
      })

    if (error) {
      return { error: new Error(error.message) }
    }

    return { error: null }
  }, [isAllowedEmail])

  const signOut = useCallback(async () => {
    if (!supabase) return

    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
    setAuthState("unauthenticated")
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        authState,
        signInWithMagicLink,
        requestAccess,
        signOut,
        isAllowedEmail,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
