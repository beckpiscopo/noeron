"use client"

import { useState } from "react"
import { Mail, Loader2, CheckCircle, AlertCircle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/contexts/auth-context"

interface AuthModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type FormState = "idle" | "loading" | "success" | "error"

export function AuthModal({ open, onOpenChange }: AuthModalProps) {
  const [activeTab, setActiveTab] = useState<"signin" | "request">("signin")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Welcome to Noeron</DialogTitle>
          <DialogDescription>
            Sign in with your email or request access to join.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "signin" | "request")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">Sign In</TabsTrigger>
            <TabsTrigger value="request">Request Access</TabsTrigger>
          </TabsList>

          <TabsContent value="signin" className="mt-4">
            <SignInForm onSuccess={() => onOpenChange(false)} />
          </TabsContent>

          <TabsContent value="request" className="mt-4">
            <RequestAccessForm onSuccess={() => setActiveTab("signin")} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

interface SignInFormProps {
  onSuccess: () => void
}

function SignInForm({ onSuccess }: SignInFormProps) {
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

    const { error } = await signInWithMagicLink(email.trim())

    if (error) {
      setErrorMessage(error.message)
      setFormState("error")
    } else {
      setFormState("success")
    }
  }

  if (formState === "success") {
    return (
      <div className="flex flex-col items-center gap-4 py-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
          <CheckCircle className="h-6 w-6 text-green-500" />
        </div>
        <div className="text-center">
          <h3 className="font-medium">Check your email</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            We sent a magic link to <strong>{email}</strong>
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Click the link in the email to sign in.
          </p>
        </div>
        <Button variant="outline" onClick={() => setFormState("idle")} className="mt-2">
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
      <div className="flex flex-col items-center gap-4 py-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10">
          <CheckCircle className="h-6 w-6 text-amber-500" />
        </div>
        <div className="text-center">
          <h3 className="font-medium">
            {alreadyRequested ? "Request already submitted" : "Request submitted"}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {alreadyRequested
              ? "We already have your request on file."
              : "We'll review your request and get back to you soon."}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            You&apos;ll receive an email at <strong>{email}</strong> when approved.
          </p>
        </div>
        <Button variant="outline" onClick={onSuccess} className="mt-2">
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
