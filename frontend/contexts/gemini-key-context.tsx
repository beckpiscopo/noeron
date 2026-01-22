"use client"

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react"

const STORAGE_KEY = "noeron_gemini_api_key"

interface GeminiKeyContextType {
  geminiKey: string | null
  hasKey: boolean
  setGeminiKey: (key: string) => void
  clearGeminiKey: () => void
  validateKey: (key: string) => Promise<{ valid: boolean; error?: string }>
  isValidating: boolean
}

const GeminiKeyContext = createContext<GeminiKeyContextType | undefined>(undefined)

export function GeminiKeyProvider({ children }: { children: ReactNode }) {
  const [geminiKey, setGeminiKeyState] = useState<string | null>(null)
  const [isValidating, setIsValidating] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Load key from localStorage
    const savedKey = localStorage.getItem(STORAGE_KEY)
    if (savedKey) {
      setGeminiKeyState(savedKey)
    }
  }, [])

  const setGeminiKey = useCallback((key: string) => {
    if (!mounted) return

    const trimmedKey = key.trim()
    if (trimmedKey) {
      localStorage.setItem(STORAGE_KEY, trimmedKey)
      setGeminiKeyState(trimmedKey)
    }
  }, [mounted])

  const clearGeminiKey = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setGeminiKeyState(null)
  }, [])

  const validateKey = useCallback(async (key: string): Promise<{ valid: boolean; error?: string }> => {
    const trimmedKey = key.trim()

    // Basic format validation
    if (!trimmedKey) {
      return { valid: false, error: "API key is required" }
    }

    // Gemini API keys typically start with "AIza"
    if (!trimmedKey.startsWith("AIza")) {
      return { valid: false, error: "Invalid API key format. Gemini API keys start with 'AIza'" }
    }

    if (trimmedKey.length < 30) {
      return { valid: false, error: "API key is too short" }
    }

    setIsValidating(true)

    try {
      // Test the key by making a simple request to the Gemini API
      // We'll use the models.list endpoint which requires minimal resources
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${trimmedKey}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      )

      if (response.ok) {
        return { valid: true }
      }

      const errorData = await response.json().catch(() => ({}))
      const errorMessage = errorData?.error?.message || `API returned status ${response.status}`

      if (response.status === 400) {
        return { valid: false, error: "Invalid API key" }
      } else if (response.status === 403) {
        return { valid: false, error: "API key does not have permission. Check your Google Cloud project settings." }
      } else if (response.status === 429) {
        // Rate limited but key is valid
        return { valid: true }
      }

      return { valid: false, error: errorMessage }
    } catch (error) {
      console.error("Error validating API key:", error)
      return { valid: false, error: "Failed to validate API key. Check your network connection." }
    } finally {
      setIsValidating(false)
    }
  }, [])

  return (
    <GeminiKeyContext.Provider
      value={{
        geminiKey,
        hasKey: !!geminiKey,
        setGeminiKey,
        clearGeminiKey,
        validateKey,
        isValidating,
      }}
    >
      {children}
    </GeminiKeyContext.Provider>
  )
}

export function useGeminiKey() {
  const context = useContext(GeminiKeyContext)
  if (context === undefined) {
    throw new Error("useGeminiKey must be used within a GeminiKeyProvider")
  }
  return context
}
