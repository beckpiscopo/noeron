"use client"

import { useState } from "react"
import { User, LogOut, Key, Settings, ChevronDown, CheckCircle } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
import { useGeminiKey } from "@/contexts/gemini-key-context"
import { AuthModal } from "@/components/auth-modal"
import { ApiKeyModal } from "@/components/api-key-modal"

export function UserMenu() {
  const { user, authState, signOut } = useAuth()
  const { hasKey } = useGeminiKey()
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false)

  // Show sign in button if not authenticated
  if (authState === "unauthenticated") {
    return (
      <>
        <Button variant="outline" size="sm" onClick={() => setAuthModalOpen(true)}>
          Sign In
        </Button>
        <AuthModal open={authModalOpen} onOpenChange={setAuthModalOpen} />
      </>
    )
  }

  // Show loading state
  if (authState === "loading") {
    return (
      <Button variant="ghost" size="sm" disabled>
        <User className="h-4 w-4" />
      </Button>
    )
  }

  // Get user display info
  const email = user?.email || "User"
  const displayName = user?.user_metadata?.name || email.split("@")[0]

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline max-w-[150px] truncate">{displayName}</span>
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">{displayName}</p>
              <p className="text-xs leading-none text-muted-foreground">{email}</p>
            </div>
          </DropdownMenuLabel>

          <DropdownMenuSeparator />

          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => setApiKeyModalOpen(true)}>
              <Key className="h-4 w-4" />
              <span>API Key</span>
              {hasKey && (
                <CheckCircle className="ml-auto h-3 w-3 text-green-500" />
              )}
            </DropdownMenuItem>

            <DropdownMenuItem disabled>
              <Settings className="h-4 w-4" />
              <span>Settings</span>
            </DropdownMenuItem>
          </DropdownMenuGroup>

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={() => signOut()} variant="destructive">
            <LogOut className="h-4 w-4" />
            <span>Sign out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ApiKeyModal open={apiKeyModalOpen} onOpenChange={setApiKeyModalOpen} />
    </>
  )
}

/**
 * Compact version for use in navigation bars where space is limited
 */
export function UserMenuCompact() {
  const { user, authState, signOut } = useAuth()
  const { hasKey } = useGeminiKey()
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false)

  if (authState === "unauthenticated") {
    return (
      <>
        <Button variant="ghost" size="icon-sm" onClick={() => setAuthModalOpen(true)}>
          <User className="h-4 w-4" />
        </Button>
        <AuthModal open={authModalOpen} onOpenChange={setAuthModalOpen} />
      </>
    )
  }

  if (authState === "loading") {
    return (
      <Button variant="ghost" size="icon-sm" disabled>
        <User className="h-4 w-4" />
      </Button>
    )
  }

  const email = user?.email || "User"

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm">
            <User className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <p className="text-xs leading-none text-muted-foreground truncate">{email}</p>
          </DropdownMenuLabel>

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={() => setApiKeyModalOpen(true)}>
            <Key className="h-4 w-4" />
            <span>API Key</span>
            {hasKey && (
              <CheckCircle className="ml-auto h-3 w-3 text-green-500" />
            )}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={() => signOut()} variant="destructive">
            <LogOut className="h-4 w-4" />
            <span>Sign out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ApiKeyModal open={apiKeyModalOpen} onOpenChange={setApiKeyModalOpen} />
    </>
  )
}
