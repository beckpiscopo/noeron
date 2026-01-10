"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { MessageSquare, Trash2, Sparkles, X, ChevronLeft, ChevronRight, Loader2, GripVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ChatMessage } from "./chat-message"
import { ChatInput } from "./chat-input"
import { useAIChat } from "@/hooks/use-ai-chat"
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
  const scrollRef = useRef<HTMLDivElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [width, setWidth] = useState(DEFAULT_WIDTH)
  const [isResizing, setIsResizing] = useState(false)
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null)

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

  return (
    <>
      {/* Overlay when open on mobile */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => onOpenChange(false)}
        />
      )}

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
          <div className="flex flex-col items-center py-4 gap-3 h-full">
            <button
              onClick={() => onOpenChange(true)}
              className={cn(
                "p-2.5 rounded-lg transition-colors",
                isDragOver
                  ? "bg-[var(--golden-chestnut)]/30 text-[var(--golden-chestnut)] animate-pulse"
                  : "bg-[var(--golden-chestnut)]/10 hover:bg-[var(--golden-chestnut)]/20 text-[var(--golden-chestnut)]"
              )}
              title="Open AI Research Assistant"
            >
              <MessageSquare className="w-5 h-5" />
            </button>
            {isDragOver && (
              <p className="text-[10px] text-[var(--golden-chestnut)] font-medium text-center px-1">
                Drop here
              </p>
            )}
            <div className="flex-1" />
            <button
              onClick={() => onOpenChange(true)}
              className="p-2 text-foreground/40 hover:text-foreground/60 transition-colors"
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
                <div className="bg-background/95 px-6 py-4 rounded-lg border-2 border-dashed border-[var(--golden-chestnut)] shadow-lg">
                  <p className="text-sm font-medium text-[var(--golden-chestnut)]">Drop claim to ask about it</p>
                </div>
              </div>
            )}
            {/* Header */}
            <div className="shrink-0 border-b border-border px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-[var(--golden-chestnut)]/20">
                    <MessageSquare className="w-4 h-4 text-[var(--golden-chestnut)]" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-foreground">Research Assistant</h2>
                    <p className="text-xs text-muted-foreground">
                      Ask about the podcast content
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {messages.length > 0 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={clearHistory}
                      className="h-8 w-8 text-foreground/50 hover:text-foreground"
                      title="Clear conversation"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onOpenChange(false)}
                    className="h-8 w-8 text-foreground/50 hover:text-foreground"
                    title="Collapse chat"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Context badge */}
            {context && (
              <div
                className={cn(
                  "shrink-0 px-4 py-2 border-b transition-colors",
                  onClearDroppedClaim
                    ? "bg-[#BE5A38]/15 border-[#BE5A38]/30"
                    : "bg-card/50 border-border"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs text-foreground/60 flex-1">
                    <span className="font-medium text-foreground/80">Context: </span>
                    {context.episode_title}
                    {context.current_timestamp && (
                      <span className="text-foreground/50"> @ {context.current_timestamp}</span>
                    )}
                    {context.claim_text && (
                      <span className={onClearDroppedClaim ? "text-[#BE5A38] font-medium" : "text-[var(--golden-chestnut)]"}> • Claim selected</span>
                    )}
                  </p>
                  {onClearDroppedClaim && (
                    <button
                      onClick={onClearDroppedClaim}
                      className="p-0.5 rounded hover:bg-foreground/10 text-foreground/40 hover:text-foreground/60 transition-colors"
                      title="Clear dropped claim"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {context.claim_text && onClearDroppedClaim && (
                  <p className="text-xs text-foreground/50 mt-1 line-clamp-2 italic">
                    "{context.claim_text}"
                  </p>
                )}
              </div>
            )}

            {/* Messages area - scrollable */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-4"
            >
              <div className="py-4 space-y-4">
                {isLoadingHistory ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Loader2 className="w-8 h-8 text-[var(--golden-chestnut)] animate-spin mb-4" />
                    <p className="text-sm text-foreground/60">Loading conversation...</p>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="p-4 rounded-full bg-[var(--golden-chestnut)]/10 mb-4">
                      <Sparkles className="w-8 h-8 text-[var(--golden-chestnut)]" />
                    </div>
                    <h3 className="font-medium text-foreground/80 mb-2">
                      Start a Conversation
                    </h3>
                    <p className="text-sm text-foreground/60 max-w-[280px] mb-6">
                      Ask questions about the podcast episode, claims, or related research.
                    </p>

                    {/* Suggested prompts - context-aware */}
                    <div className="w-full space-y-2">
                      <p className="text-xs text-foreground/50 uppercase tracking-wider mb-2">
                        Try asking:
                      </p>
                      {(context?.claim_text ? CLAIM_PROMPTS : EPISODE_PROMPTS).map((prompt, index) => (
                        <button
                          key={index}
                          onClick={() => sendMessage(prompt)}
                          disabled={isLoading}
                          className="w-full text-left px-3 py-2 text-sm bg-card border border-border rounded-lg hover:bg-foreground/5 hover:border-[var(--golden-chestnut)]/30 transition-colors disabled:opacity-50"
                        >
                          {prompt}
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
                    />
                  ))
                )}
              </div>
            </div>

            {/* Input footer */}
            <div className="shrink-0 border-t border-border p-4">
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
          </>
        )}
      </div>
    </>
  )
}
