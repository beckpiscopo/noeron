"use client"

import { Suspense, useEffect, useState, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import {
  User,
  Key,
  LogOut,
  Trash2,
  Eye,
  EyeOff,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  Loader2,
  ArrowLeft,
  X,
  BarChart3,
  CreditCard
} from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { useGeminiKey } from "@/contexts/gemini-key-context"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { toast } from "sonner"

function SettingsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, authState, signOut } = useAuth()
  const { geminiKey, hasKey, setGeminiKey, clearGeminiKey, validateKey } = useGeminiKey()

  // Welcome banner state
  const isWelcome = searchParams.get("welcome") === "1"
  const [showWelcomeBanner, setShowWelcomeBanner] = useState(isWelcome)

  // Profile state
  const [displayName, setDisplayName] = useState("")
  const [originalDisplayName, setOriginalDisplayName] = useState("")
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [profileError, setProfileError] = useState("")

  // API key state
  const [apiKeyInput, setApiKeyInput] = useState("")
  const [showApiKey, setShowApiKey] = useState(false)
  const [apiKeyFormState, setApiKeyFormState] = useState<"idle" | "validating" | "success" | "error">("idle")
  const [apiKeyError, setApiKeyError] = useState("")

  // Load user profile
  useEffect(() => {
    async function loadProfile() {
      if (!user || !supabase) return

      const { data, error } = await supabase
        .from("user_profiles")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle()

      if (!error && data?.display_name) {
        setDisplayName(data.display_name)
        setOriginalDisplayName(data.display_name)
      } else {
        // Fallback to email username
        const emailUsername = user.email?.split("@")[0] ?? ""
        setDisplayName(emailUsername)
        setOriginalDisplayName(emailUsername)
      }
    }

    loadProfile()
  }, [user])

  // Redirect if not authenticated
  useEffect(() => {
    if (authState === "unauthenticated") {
      router.push("/")
    }
  }, [authState, router])

  // Save display name on blur
  const handleSaveDisplayName = useCallback(async () => {
    if (!user || !supabase || !displayName.trim()) return
    if (displayName === originalDisplayName) return

    setIsSavingProfile(true)
    setProfileError("")

    const { error } = await supabase
      .from("user_profiles")
      .upsert({
        id: user.id,
        display_name: displayName.trim(),
        updated_at: new Date().toISOString(),
      })

    setIsSavingProfile(false)

    if (error) {
      setProfileError("Failed to save display name")
      toast.error("Failed to save display name")
    } else {
      setOriginalDisplayName(displayName.trim())
      toast.success("Display name saved")
      // Dismiss welcome banner after saving
      if (showWelcomeBanner) {
        setShowWelcomeBanner(false)
      }
    }
  }, [user, displayName, originalDisplayName, showWelcomeBanner])

  // Validate and save API key
  const handleSaveApiKey = async () => {
    if (!apiKeyInput.trim()) {
      setApiKeyError("Please enter an API key")
      setApiKeyFormState("error")
      return
    }

    setApiKeyFormState("validating")
    setApiKeyError("")

    const { valid, error } = await validateKey(apiKeyInput.trim())

    if (valid) {
      setGeminiKey(apiKeyInput.trim())
      setApiKeyFormState("success")
      setApiKeyInput("")
      toast.success("API key saved")
    } else {
      setApiKeyError(error || "Invalid API key")
      setApiKeyFormState("error")
    }
  }

  const handleRemoveApiKey = () => {
    clearGeminiKey()
    setApiKeyInput("")
    setApiKeyFormState("idle")
    toast.success("API key removed")
  }

  const handleSignOut = async () => {
    await signOut()
    router.push("/")
  }

  const maskedKey = geminiKey
    ? `${geminiKey.slice(0, 8)}${"*".repeat(20)}${geminiKey.slice(-4)}`
    : ""

  // Show loading state
  if (authState === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Don't render if unauthenticated (will redirect)
  if (authState === "unauthenticated") {
    return null
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b">
          <div className="container max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon-sm">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="font-serif text-2xl">Settings</h1>
          </div>
        </header>

        <main className="container max-w-3xl mx-auto px-4 py-8 space-y-8">
          {/* Welcome Banner */}
          {showWelcomeBanner && (
            <Alert className="bg-primary/10 border-primary/20">
              <User className="h-4 w-4" />
              <AlertTitle>Welcome to Noeron!</AlertTitle>
              <AlertDescription className="flex items-center justify-between">
                <span>Set your display name to get started.</span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setShowWelcomeBanner(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Profile Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Profile
              </CardTitle>
              <CardDescription>
                Your display name is shown when sharing content with the community.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Display Name */}
              <div className="space-y-2">
                <Label htmlFor="display-name">Display name</Label>
                <div className="flex gap-2">
                  <Input
                    id="display-name"
                    value={displayName}
                    onChange={(e) => {
                      setDisplayName(e.target.value)
                      setProfileError("")
                    }}
                    onBlur={handleSaveDisplayName}
                    placeholder="Your display name"
                    disabled={isSavingProfile}
                  />
                  {isSavingProfile && (
                    <Loader2 className="h-4 w-4 animate-spin self-center text-muted-foreground" />
                  )}
                </div>
                {profileError && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {profileError}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Changes are saved automatically.
                </p>
              </div>

              <Separator />

              {/* Email (read-only) */}
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  value={user?.email ?? ""}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  Your email cannot be changed.
                </p>
              </div>

              {/* Avatar placeholder */}
              <div className="space-y-2 opacity-50">
                <Label>Avatar</Label>
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                    <User className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Avatar upload coming soon
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* API Key Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Gemini API Key
              </CardTitle>
              <CardDescription>
                Add your own Gemini API key to use AI features. Your key is stored locally in your browser.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Current key status */}
              {hasKey && (
                <div className="rounded-lg border bg-muted/50 p-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Current API Key</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {showApiKey ? geminiKey : maskedKey}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setShowApiKey(!showApiKey)}
                        title={showApiKey ? "Hide key" : "Show key"}
                      >
                        {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={handleRemoveApiKey}
                        title="Remove key"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Add/Update key form */}
              <div className="space-y-2">
                <Label htmlFor="api-key">
                  {hasKey ? "Replace with new key" : "Enter your API key"}
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="api-key"
                    type="password"
                    placeholder="AIza..."
                    value={apiKeyInput}
                    onChange={(e) => {
                      setApiKeyInput(e.target.value)
                      if (apiKeyFormState === "error") setApiKeyFormState("idle")
                    }}
                    disabled={apiKeyFormState === "validating"}
                    aria-invalid={apiKeyFormState === "error"}
                  />
                  <Button
                    onClick={handleSaveApiKey}
                    disabled={!apiKeyInput.trim() || apiKeyFormState === "validating"}
                  >
                    {apiKeyFormState === "validating" ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Validating
                      </>
                    ) : (
                      "Save"
                    )}
                  </Button>
                </div>
                {apiKeyFormState === "error" && (
                  <p className="flex items-center gap-1 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    {apiKeyError}
                  </p>
                )}
                {apiKeyFormState === "success" && (
                  <p className="flex items-center gap-1 text-sm text-green-500">
                    <CheckCircle className="h-4 w-4" />
                    API key saved successfully
                  </p>
                )}
              </div>

              {/* Instructions */}
              <div className="rounded-lg border bg-muted/30 p-4 text-sm">
                <p className="font-medium mb-2">How to get an API key:</p>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                  <li>Go to Google AI Studio</li>
                  <li>Sign in with your Google account</li>
                  <li>Click &quot;Get API key&quot; in the sidebar</li>
                  <li>Create a new API key or use an existing one</li>
                </ol>
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1 text-primary hover:underline"
                >
                  Open Google AI Studio
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              <p className="text-xs text-muted-foreground">
                Your API key is stored only in your browser&apos;s local storage and sent directly to Google&apos;s API.
                We never store or log your API key on our servers.
              </p>
            </CardContent>
          </Card>

          {/* Account Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Account
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Sign out</p>
                  <p className="text-sm text-muted-foreground">
                    Sign out of your account on this device
                  </p>
                </div>
                <Button variant="outline" onClick={handleSignOut}>
                  <LogOut className="h-4 w-4" />
                  Sign out
                </Button>
              </div>

              <Separator />

              <div className="flex items-center justify-between opacity-50">
                <div>
                  <p className="font-medium">Delete account</p>
                  <p className="text-sm text-muted-foreground">
                    Permanently delete your account and all data
                  </p>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button variant="destructive" disabled>
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Coming soon</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </CardContent>
          </Card>

          {/* Activity Section (Placeholder) */}
          <Card className="opacity-50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Activity
                  </CardTitle>
                  <CardDescription>
                    Track your learning progress
                  </CardDescription>
                </div>
                <span className="text-xs bg-muted px-2 py-1 rounded">Coming soon</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold">—</p>
                  <p className="text-xs text-muted-foreground">Episodes explored</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">—</p>
                  <p className="text-xs text-muted-foreground">Bookmarks saved</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">—</p>
                  <p className="text-xs text-muted-foreground">Slides generated</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Purchases Section (Placeholder) */}
          <Card className="opacity-50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Purchases
                  </CardTitle>
                  <CardDescription>
                    Your episode access and transaction history
                  </CardDescription>
                </div>
                <span className="text-xs bg-muted px-2 py-1 rounded">Coming soon</span>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Premium episode access and transaction history will appear here.
              </p>
            </CardContent>
          </Card>
        </main>
      </div>
    </TooltipProvider>
  )
}

function SettingsLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  )
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<SettingsLoading />}>
      <SettingsContent />
    </Suspense>
  )
}
