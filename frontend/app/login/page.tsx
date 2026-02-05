"use client"

import { Suspense, useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Mail, Loader2, CheckCircle, AlertCircle, ArrowLeft } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/contexts/auth-context"

type FormState = "idle" | "loading" | "success" | "error"

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { authState } = useAuth()
  const [activeTab, setActiveTab] = useState<"signin" | "request">("signin")

  const redirect = searchParams.get("redirect") ?? "/"

  // Redirect if already authenticated
  useEffect(() => {
    if (authState === "authenticated") {
      router.push(redirect)
    }
  }, [authState, router, redirect])

  // Show loading while checking auth
  if (authState === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Don't render login form if authenticated (will redirect)
  if (authState === "authenticated") {
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container max-w-md mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon-sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="font-serif text-xl">Noeron</h1>
        </div>
      </header>

      <main className="container max-w-md mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <h2 className="font-serif text-2xl mb-2">Welcome to Noeron</h2>
          <p className="text-muted-foreground">
            Sign in with your email or request access to join.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "signin" | "request")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">Sign In</TabsTrigger>
            <TabsTrigger value="request">Request Access</TabsTrigger>
          </TabsList>

          <TabsContent value="signin" className="mt-6">
            <SignInForm redirectTo={redirect} />
          </TabsContent>

          <TabsContent value="request" className="mt-6">
            <RequestAccessForm onSuccess={() => setActiveTab("signin")} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}

interface SignInFormProps {
  redirectTo: string
}

function SignInForm({ redirectTo }: SignInFormProps) {
  const { signInWithMagicLink } = useAuth()
  const [email, setEmail] = useState("")
  const [formState, setFormState] = useState<FormState>("idle")
  const [errorMessage, setErrorMessage] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email.trim()) {
      setErrorMessage("Please enter your email address")
      setFormState("error")
      return
    }

    setFormState("loading")
    setErrorMessage("")

    const { error } = await signInWithMagicLink(email.trim(), redirectTo)

    if (error) {
      setErrorMessage(error.message)
      setFormState("error")
    } else {
      setFormState("success")
    }
  }

  if (formState === "success") {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500/10">
          <CheckCircle className="h-7 w-7 text-green-500" />
        </div>
        <div className="text-center">
          <h3 className="font-medium text-lg">Check your email</h3>
          <p className="mt-2 text-muted-foreground">
            We sent a magic link to <strong>{email}</strong>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Click the link in the email to sign in.
          </p>
        </div>
        <Button variant="outline" onClick={() => setFormState("idle")} className="mt-4">
          Try a different email
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="signin-email" className="text-sm font-medium">
          Email address
        </label>
        <Input
          id="signin-email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={formState === "loading"}
          aria-invalid={formState === "error"}
          autoFocus
        />
        {formState === "error" && (
          <p className="flex items-center gap-1 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {errorMessage}
          </p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={formState === "loading"}>
        {formState === "loading" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Sending magic link...
          </>
        ) : (
          <>
            <Mail className="h-4 w-4" />
            Send magic link
          </>
        )}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        We&apos;ll send you a magic link to sign in without a password.
      </p>
    </form>
  )
}

interface RequestAccessFormProps {
  onSuccess: () => void
}

function RequestAccessForm({ onSuccess }: RequestAccessFormProps) {
  const { requestAccess } = useAuth()
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [reason, setReason] = useState("")
  const [formState, setFormState] = useState<FormState>("idle")
  const [errorMessage, setErrorMessage] = useState("")
  const [alreadyRequested, setAlreadyRequested] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email.trim()) {
      setErrorMessage("Please enter your email address")
      setFormState("error")
      return
    }

    setFormState("loading")
    setErrorMessage("")

    const { error, alreadyRequested: wasRequested } = await requestAccess(
      email.trim(),
      name.trim() || undefined,
      reason.trim() || undefined
    )

    if (error) {
      setErrorMessage(error.message)
      setFormState("error")
    } else if (wasRequested) {
      setAlreadyRequested(true)
      setFormState("success")
    } else {
      setFormState("success")
    }
  }

  if (formState === "success") {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10">
          <CheckCircle className="h-7 w-7 text-amber-500" />
        </div>
        <div className="text-center">
          <h3 className="font-medium text-lg">
            {alreadyRequested ? "Request already submitted" : "Request submitted"}
          </h3>
          <p className="mt-2 text-muted-foreground">
            {alreadyRequested
              ? "We already have your request on file."
              : "We'll review your request and get back to you soon."}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            You&apos;ll receive an email at <strong>{email}</strong> when approved.
          </p>
        </div>
        <Button variant="outline" onClick={onSuccess} className="mt-4">
          Back to sign in
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="request-email" className="text-sm font-medium">
          Email address <span className="text-destructive">*</span>
        </label>
        <Input
          id="request-email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={formState === "loading"}
          required
          autoFocus
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="request-name" className="text-sm font-medium">
          Name <span className="text-muted-foreground">(optional)</span>
        </label>
        <Input
          id="request-name"
          type="text"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={formState === "loading"}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="request-reason" className="text-sm font-medium">
          Why are you interested? <span className="text-muted-foreground">(optional)</span>
        </label>
        <Textarea
          id="request-reason"
          placeholder="Tell us about your interest in bioelectricity research..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          disabled={formState === "loading"}
          rows={3}
        />
      </div>

      {formState === "error" && (
        <p className="flex items-center gap-1 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {errorMessage}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={formState === "loading"}>
        {formState === "loading" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Submitting request...
          </>
        ) : (
          "Request access"
        )}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Noeron is currently in invite-only beta. We&apos;ll review your request shortly.
      </p>
    </form>
  )
}

function LoginLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginLoading />}>
      <LoginContent />
    </Suspense>
  )
}
