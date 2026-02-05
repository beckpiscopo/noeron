"use client"

import { ReactNode } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Notebook, MoreVertical, Search, Settings, HelpCircle, Moon, Sun, User, LogOut } from "lucide-react"
import { useTheme } from "next-themes"
import { useIsMobile } from "./ui/use-mobile"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu"
import { ThemeToggle } from "./theme-toggle"
import { Button } from "./ui/button"
import { useAuth } from "@/contexts/auth-context"

interface NoeronHeaderProps {
  onLogoClick?: () => void
  onBookmarksClick?: () => void
  onBackClick?: () => void
  actions?: ReactNode
  /** Show mobile layout with back button */
  showMobileBack?: boolean
}

export function NoeronHeader({
  onLogoClick,
  onBookmarksClick,
  onBackClick,
  actions,
  showMobileBack = false,
}: NoeronHeaderProps) {
  const router = useRouter()
  const isMobile = useIsMobile()
  const { theme, setTheme } = useTheme()
  const { user, authState, signOut } = useAuth()

  const handleLogoClick = () => {
    if (onLogoClick) {
      onLogoClick()
    } else {
      router.push("/")
    }
  }

  const handleBackClick = () => {
    if (onBackClick) {
      onBackClick()
    } else {
      router.back()
    }
  }

  // Mobile layout
  if (isMobile && showMobileBack) {
    return (
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur-xl h-12">
        <div className="flex h-full w-full items-center justify-between px-2">
          {/* Left side: Back + Logo */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleBackClick}
              className="flex h-11 w-11 items-center justify-center text-foreground/70 hover:text-foreground transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <button
              onClick={handleLogoClick}
              className="flex items-center transition-colors hover:opacity-80"
            >
              <span
                className="text-xl font-normal tracking-[-0.5px] text-foreground"
                style={{ fontFamily: "'Russo One', sans-serif" }}
              >
                Noeron
              </span>
            </button>
          </div>

          {/* Right side: Bookmarks + Overflow menu */}
          <div className="flex items-center">
            {onBookmarksClick && (
              <button
                onClick={onBookmarksClick}
                className="flex h-11 w-11 items-center justify-center text-foreground/70 hover:text-[var(--golden-chestnut)] transition-colors"
                title="Your Library"
              >
                <Notebook className="h-5 w-5" />
              </button>
            )}

            {/* Overflow menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex h-11 w-11 items-center justify-center text-foreground/70 hover:text-foreground transition-colors"
                  aria-label="More options"
                >
                  <MoreVertical className="h-5 w-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {authState === "authenticated" && user && (
                  <>
                    <DropdownMenuLabel className="font-normal">
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="gap-3" asChild>
                      <Link href="/settings">
                        <Settings className="h-4 w-4" />
                        Settings
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem className="gap-3">
                  <Search className="h-4 w-4" />
                  Search
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-3">
                  <HelpCircle className="h-4 w-4" />
                  Help
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="gap-3"
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                >
                  {theme === 'dark' ? (
                    <>
                      <Sun className="h-4 w-4" />
                      Light Mode
                    </>
                  ) : (
                    <>
                      <Moon className="h-4 w-4" />
                      Dark Mode
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {authState === "authenticated" ? (
                  <DropdownMenuItem className="gap-3 text-destructive" onClick={() => signOut()}>
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem className="gap-3" asChild>
                    <Link href="/login">
                      <User className="h-4 w-4" />
                      Sign in
                    </Link>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
    )
  }

  // Desktop layout (original)
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur-xl px-10 py-3">
      <div className="flex w-full items-center justify-between gap-2">
        <button onClick={handleLogoClick} className="flex items-center gap-2.5 transition-colors hover:opacity-80">
          <span className="text-2xl font-normal tracking-[-0.5px] text-foreground" style={{ fontFamily: "'Russo One', sans-serif" }}>
            Noeron
          </span>
        </button>
        <div className="flex items-center gap-2.5">
          {onBookmarksClick && (
            <button
              onClick={onBookmarksClick}
              className="flex h-9 w-9 items-center justify-center rounded-full text-foreground/70 transition hover:text-[var(--golden-chestnut)] hover:bg-[var(--golden-chestnut)]/10"
              title="Your Library"
            >
              <Notebook className="h-4 w-4" />
            </button>
          )}
          {actions}
          <ThemeToggle />
          {authState === "authenticated" ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex h-9 w-9 items-center justify-center rounded-full text-foreground/70 transition hover:text-foreground hover:bg-muted">
                  <User className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/settings">
                    <Settings className="h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onClick={() => signOut()}>
                  <LogOut className="h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : authState === "unauthenticated" ? (
            <Button variant="outline" size="sm" asChild>
              <Link href="/login">Sign In</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </header>
  )
}
