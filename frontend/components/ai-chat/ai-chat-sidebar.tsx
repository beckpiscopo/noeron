"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Drawer as DrawerPrimitive } from "vaul"
import { MessageSquare, Trash2, Sparkles, X, ChevronLeft, ChevronRight, Loader2, GripVertical, Circle } from "lucide-react"
import { ChatMessage } from "./chat-message"
import { ChatInput } from "./chat-input"
import { useAIChat } from "@/hooks/use-ai-chat"
import { useBookmarks } from "@/hooks/use-bookmarks"
import { useChatAudio } from "@/hooks/use-chat-audio"
import { useIsMobile } from "@/components/ui/use-mobile"
import type { ChatContext } from "@/lib/chat-types"
import { cn } from "@/lib/utils"

const MIN_WIDTH = 320
const MAX_WIDTH = 700
const DEFAULT_WIDTH = 440
const COLLAPSED_WIDTH = 52

interface AIChatSidebarProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  context: ChatContext | null
  onViewPaper?: (paperId: string) => void
  onClaimDrop?: (claim: { id: string | number; segment_claim_id?: string; claim_text?: string; distilled_claim?: string }) => void
  onClearDroppedClaim?: () => void
  onWidthChange?: (width: number) => void
}

// Prompts when viewing an episode (no specific claim selected)
const EPISODE_PROMPTS = [
  "What are the main topics covered in this episode?",
  "Summarize the key scientific claims made",
  "What research papers are referenced?",
  "What's the guest's main argument?",
]

// Prompts when a specific claim is selected
const CLAIM_PROMPTS = [
  "Explain this claim in simpler terms",
  "What evidence supports this claim?",
  "Is this claim controversial or well-established?",
  "What are the implications of this?",
]

export function AIChatSidebar({
  open,
  onOpenChange,
  context,
  onViewPaper,
  onClaimDrop,
  onClearDroppedClaim,
  onWidthChange,
}: AIChatSidebarProps) {
  const { messages, isLoading, isLoadingHistory, sendMessage, clearHistory } = useAIChat(context)
  const { addImageBookmark } = useBookmarks()
  const {
    generateAndPlay: generateAudio,
    stop: stopAudio,
    isGenerating: isGeneratingAudio,
    isPlaying: isPlayingAudio,
    currentMessageId: audioMessageId,
  } = useChatAudio()
  const isMobile = useIsMobile()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [width, setWidth] = useState(DEFAULT_WIDTH)
  const [isResizing, setIsResizing] = useState(false)
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null)

  // Handle image bookmark
  const handleBookmarkImage = useCallback(
    async (imageUrl: string, caption?: string) => {
      if (!context?.episode_id) return
      await addImageBookmark(
        context.episode_id,
        imageUrl,
        caption,
        caption || "AI Generated Visualization"
      )
    },
    [context?.episode_id, addImageBookmark]
  )

  // Notify parent of width changes
  useEffect(() => {
    onWidthChange?.(open ? width : COLLAPSED_WIDTH)
  }, [width, open, onWidthChange])

  // Handle resize mouse events
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
    resizeRef.current = { startX: e.clientX, startWidth: width }
  }, [width])

  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeRef.current) return
      // Dragging left increases width (sidebar is on the right)
      const delta = resizeRef.current.startX - e.clientX
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, resizeRef.current.startWidth + delta))
      setWidth(newWidth)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      resizeRef.current = null
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    // Only set to false if we're leaving the sidebar entirely
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)

    try {
      const claimData = JSON.parse(e.dataTransfer.getData('application/json'))
      if (claimData && onClaimDrop) {
        onClaimDrop(claimData)
        // Auto-open if closed
        if (!open) {
          onOpenChange(true)
        }
      }
    } catch (err) {
      console.error('Failed to parse dropped claim data:', err)
    }
  }

  // Shared chat content component
  const ChatContent = ({ isMobileSheet = false }: { isMobileSheet?: boolean }) => (
    <>
      {/* Header with corner brackets */}
      <div className={cn(
        "shrink-0 border-b border-border bg-gradient-to-r from-card/80 to-card/40 relative",
        isMobileSheet && "pt-0"
      )}>
        {/* Corner accents - hide on mobile sheet */}
        {!isMobileSheet && (
          <>
            <div className="absolute top-0 left-0 w-4 h-4 border-l-2 border-t-2 border-[var(--golden-chestnut)]/40" />
            <div className="absolute top-0 right-0 w-4 h-4 border-r-2 border-t-2 border-[var(--golden-chestnut)]/40" />
          </>
        )}

        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="p-2 border border-[var(--golden-chestnut)]/30 bg-[var(--golden-chestnut)]/10">
                  <MessageSquare className="w-4 h-4 text-[var(--golden-chestnut)]" />
                </div>
                {/* Active indicator */}
                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[var(--golden-chestnut)] rounded-full animate-pulse" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground tracking-wide uppercase">
                  {isMobileSheet ? "AI Research Assistant" : "Research Assistant"}
                </h2>
                <p className="text-[10px] text-foreground/50 mono tracking-[0.1em]">
                  AI-POWERED ANALYSIS
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  onClick={clearHistory}
                  className="h-8 w-8 flex items-center justify-center text-foreground/40 hover:text-[var(--golden-chestnut)] hover:bg-[var(--golden-chestnut)]/10 transition-colors"
                  title="Clear conversation"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => onOpenChange(false)}
                className="h-8 w-8 flex items-center justify-center text-foreground/40 hover:text-foreground transition-colors"
                title={isMobileSheet ? "Close chat" : "Collapse chat"}
              >
                {isMobileSheet ? <X className="w-5 h-5" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Context badge */}
      {context && (
        <div
          className={cn(
            "shrink-0 px-4 py-2.5 border-b transition-all duration-200",
            onClearDroppedClaim
              ? "bg-[#BE5A38]/10 border-[#BE5A38]/30"
              : "bg-card/30 border-border"
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Circle className={cn(
                "w-2 h-2 shrink-0",
                onClearDroppedClaim ? "text-[#BE5A38] fill-current" : "text-[var(--golden-chestnut)] fill-current"
              )} />
              <p className="text-xs text-foreground/70 truncate">
                {context.episode_title}
                {context.current_timestamp && (
                  <span className="text-foreground/40 mono"> @ {context.current_timestamp}</span>
                )}
              </p>
            </div>
            {onClearDroppedClaim && (
              <button
                onClick={onClearDroppedClaim}
                className="p-1 hover:bg-foreground/10 text-foreground/40 hover:text-foreground/60 transition-colors"
                title="Clear dropped claim"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          {context.claim_text && (
            <p className={cn(
              "text-[11px] mt-1.5 leading-relaxed line-clamp-2",
              onClearDroppedClaim ? "text-[#BE5A38]/80" : "text-foreground/50 italic"
            )}>
              "{context.claim_text}"
            </p>
          )}
        </div>
      )}

      {/* Messages area - scrollable */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto"
      >
        <div className="px-4 py-4 space-y-4">
          {isLoadingHistory ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="relative">
                <Loader2 className="w-8 h-8 text-[var(--golden-chestnut)] animate-spin" />
                <div className="absolute inset-0 w-8 h-8 rounded-full bg-[var(--golden-chestnut)]/20 animate-ping" />
              </div>
              <p className="text-xs text-foreground/50 mt-4 mono tracking-wide">LOADING HISTORY...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              {/* Decorative element */}
              <div className="relative mb-6">
                <div className="absolute -inset-3 border border-[var(--golden-chestnut)]/20" />
                <div className="absolute -inset-1 border border-[var(--golden-chestnut)]/10" />
                <div className="p-4 bg-[var(--golden-chestnut)]/10 border border-[var(--golden-chestnut)]/30">
                  <Sparkles className="w-8 h-8 text-[var(--golden-chestnut)]" />
                </div>
              </div>

              <h3 className="text-sm font-bold text-foreground tracking-wide uppercase mb-2">
                Start a Conversation
              </h3>
              <p className="text-xs text-foreground/50 max-w-[260px] mb-8 leading-relaxed">
                Ask questions about the podcast episode, scientific claims, or related research papers.
              </p>

              {/* Suggested prompts - context-aware */}
              <div className="w-full space-y-2">
                <p className="text-[10px] text-foreground/40 mono tracking-[0.15em] mb-3">
                  SUGGESTED PROMPTS
                </p>
                {(context?.claim_text ? CLAIM_PROMPTS : EPISODE_PROMPTS).map((prompt, index) => (
                  <button
                    key={index}
                    onClick={() => sendMessage(prompt)}
                    disabled={isLoading}
                    className={cn(
                      "w-full text-left px-4 py-3 text-sm transition-all duration-200",
                      "border border-border bg-card/30",
                      "hover:border-[var(--golden-chestnut)]/40 hover:bg-[var(--golden-chestnut)]/5",
                      "hover:text-[var(--golden-chestnut)]",
                      "disabled:opacity-50 disabled:cursor-not-allowed",
                      "group"
                    )}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-1 h-1 bg-foreground/20 group-hover:bg-[var(--golden-chestnut)] transition-colors" />
                      {prompt}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                onViewPaper={onViewPaper}
                onBookmarkImage={handleBookmarkImage}
                onSpeak={generateAudio}
                onStopAudio={stopAudio}
                isGeneratingAudio={isGeneratingAudio}
                isPlayingAudio={isPlayingAudio}
                audioMessageId={audioMessageId}
              />
            ))
          )}
        </div>
      </div>

      {/* Input footer with refined styling */}
      <div className={cn(
        "shrink-0 border-t border-border bg-gradient-to-t from-card/50 to-transparent",
        isMobileSheet && "pb-safe" // Safe area for mobile
      )}>
        {/* Decorative line */}
        <div className="h-px bg-gradient-to-r from-transparent via-[var(--golden-chestnut)]/30 to-transparent" />
        <div className="p-4">
          <ChatInput
            onSend={sendMessage}
            isLoading={isLoading}
            placeholder={
              context?.claim_text
                ? "Ask about this claim..."
                : "Ask about this episode..."
            }
          />
        </div>
      </div>
    </>
  )

  // Mobile: Bottom sheet layout
  if (isMobile) {
    return (
      <DrawerPrimitive.Root open={open} onOpenChange={onOpenChange}>
        <DrawerPrimitive.Portal>
          <DrawerPrimitive.Overlay
            className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          />
          <DrawerPrimitive.Content
            className={cn(
              "fixed inset-x-0 bottom-0 z-50 flex flex-col bg-background rounded-t-xl border-t border-border",
              "data-[state=open]:animate-in data-[state=closed]:animate-out",
              "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
              "h-[85vh]"
            )}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-12 h-1.5 rounded-full bg-muted-foreground/20" />
            </div>

            <ChatContent isMobileSheet />
          </DrawerPrimitive.Content>
        </DrawerPrimitive.Portal>
      </DrawerPrimitive.Root>
    )
  }

  // Desktop: Sidebar layout
  return (
    <>
      {/* Sidebar container - positioned below navbar */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{ width: open ? `${width}px` : `${COLLAPSED_WIDTH}px` }}
        className={cn(
          "fixed right-0 z-50 flex flex-col bg-background border-l",
          "top-[60px] h-[calc(100vh-60px)]", // Below navbar
          !isResizing && "transition-all duration-300 ease-in-out",
          isDragOver
            ? "border-[var(--golden-chestnut)] border-2 bg-[var(--golden-chestnut)]/5"
            : "border-border"
        )}
      >
        {/* Resize handle - only visible when open */}
        {open && (
          <div
            onMouseDown={handleResizeStart}
            className={cn(
              "absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize group z-10",
              "hover:bg-[var(--golden-chestnut)]/30",
              isResizing && "bg-[var(--golden-chestnut)]/50"
            )}
          >
            {/* Visual grip indicator */}
            <div className={cn(
              "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
              "opacity-0 group-hover:opacity-100 transition-opacity",
              isResizing && "opacity-100"
            )}>
              <GripVertical className="w-3 h-3 text-[var(--golden-chestnut)]" />
            </div>
          </div>
        )}

        {/* Collapsed state - slim sidebar */}
        {!open && (
          <div className="flex flex-col items-center py-4 gap-3 h-full bg-gradient-to-b from-card/50 to-transparent">
            <button
              onClick={() => onOpenChange(true)}
              className={cn(
                "p-2.5 transition-all duration-200",
                "border border-[var(--golden-chestnut)]/30 bg-[var(--golden-chestnut)]/10",
                "hover:bg-[var(--golden-chestnut)]/20 hover:border-[var(--golden-chestnut)]/50",
                "text-[var(--golden-chestnut)]",
                isDragOver && "bg-[var(--golden-chestnut)]/30 border-[var(--golden-chestnut)] animate-pulse"
              )}
              title="Open AI Research Assistant"
            >
              <MessageSquare className="w-5 h-5" />
            </button>
            {isDragOver && (
              <p className="text-[10px] text-[var(--golden-chestnut)] font-medium text-center px-1 mono tracking-wide">
                DROP HERE
              </p>
            )}
            <div className="flex-1" />
            <button
              onClick={() => onOpenChange(true)}
              className="p-2 text-foreground/40 hover:text-[var(--golden-chestnut)] transition-colors"
              title="Expand chat"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Expanded state - full chat */}
        {open && (
          <>
            {/* Drop overlay indicator */}
            {isDragOver && (
              <div className="absolute inset-0 bg-[var(--golden-chestnut)]/10 flex items-center justify-center z-10 pointer-events-none">
                <div className="bg-background/95 px-6 py-4 border-2 border-dashed border-[var(--golden-chestnut)] shadow-lg">
                  <p className="text-sm font-medium text-[var(--golden-chestnut)] mono tracking-wide">
                    DROP CLAIM TO ANALYZE
                  </p>
                </div>
              </div>
            )}

            <ChatContent />
          </>
        )}
      </div>
    </>
  )
}
