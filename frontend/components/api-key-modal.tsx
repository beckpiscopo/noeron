"use client"

import { useState, useEffect } from "react"
import { Key, Loader2, CheckCircle, AlertCircle, ExternalLink, Eye, EyeOff, Trash2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useGeminiKey } from "@/contexts/gemini-key-context"

interface ApiKeyModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type FormState = "idle" | "validating" | "success" | "error"

export function ApiKeyModal({ open, onOpenChange }: ApiKeyModalProps) {
  const { geminiKey, hasKey, setGeminiKey, clearGeminiKey, validateKey, isValidating } = useGeminiKey()
  const [inputKey, setInputKey] = useState("")
  const [showKey, setShowKey] = useState(false)
  const [formState, setFormState] = useState<FormState>("idle")
  const [errorMessage, setErrorMessage] = useState("")

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setInputKey("")
      setFormState("idle")
      setErrorMessage("")
      setShowKey(false)
    }
  }, [open])

  const handleValidateAndSave = async () => {
    if (!inputKey.trim()) {
      setErrorMessage("Please enter an API key")
      setFormState("error")
      return
    }

    setFormState("validating")
    setErrorMessage("")

    const { valid, error } = await validateKey(inputKey.trim())

    if (valid) {
      setGeminiKey(inputKey.trim())
      setFormState("success")
      // Close modal after short delay on success
      setTimeout(() => {
        onOpenChange(false)
      }, 1500)
    } else {
      setErrorMessage(error || "Invalid API key")
      setFormState("error")
    }
  }

  const handleRemoveKey = () => {
    clearGeminiKey()
    setInputKey("")
    setFormState("idle")
  }

  const maskedKey = geminiKey
    ? `${geminiKey.slice(0, 8)}${"*".repeat(20)}${geminiKey.slice(-4)}`
    : ""

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Gemini API Key
          </DialogTitle>
          <DialogDescription>
            Add your own Gemini API key to use AI features. Your key is stored locally in your browser.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current key status */}
          {hasKey && (
            <div className="rounded-lg border bg-muted/50 p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Current API Key</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {showKey ? geminiKey : maskedKey}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setShowKey(!showKey)}
                    title={showKey ? "Hide key" : "Show key"}
                  >
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={handleRemoveKey}
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
            <label htmlFor="api-key" className="text-sm font-medium">
              {hasKey ? "Replace with new key" : "Enter your API key"}
            </label>
            <Input
              id="api-key"
              type={showKey ? "text" : "password"}
              placeholder="AIza..."
              value={inputKey}
              onChange={(e) => {
                setInputKey(e.target.value)
                if (formState === "error") setFormState("idle")
              }}
              disabled={formState === "validating"}
              aria-invalid={formState === "error"}
            />
            {formState === "error" && (
              <p className="flex items-center gap-1 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                {errorMessage}
              </p>
            )}
            {formState === "success" && (
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

          {/* Privacy note */}
          <p className="text-xs text-muted-foreground">
            Your API key is stored only in your browser&apos;s local storage and sent directly to Google&apos;s API.
            We never store or log your API key on our servers.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleValidateAndSave}
            disabled={!inputKey.trim() || formState === "validating"}
          >
            {formState === "validating" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Validating...
              </>
            ) : (
              "Save API Key"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
