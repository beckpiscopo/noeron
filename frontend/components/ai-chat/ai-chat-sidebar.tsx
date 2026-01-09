"use client"

import { useEffect, useRef } from "react"
import { MessageSquare, Trash2, Sparkles, X, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ChatMessage } from "./chat-message"
import { ChatInput } from "./chat-input"
import { useAIChat } from "@/hooks/use-ai-chat"
import type { ChatContext } from "@/lib/chat-types"
import { cn } from "@/lib/utils"

interface AIChatSidebarProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  context: ChatContext | null
  onViewPaper?: (paperId: string) => void
}

const SUGGESTED_PROMPTS = [
  "What are the key findings discussed?",
  "Explain this in simpler terms",
  "What evidence supports this claim?",
  "What are the implications?",
]

export function AIChatSidebar({
  open,
  onOpenChange,
  context,
  onViewPaper,
}: AIChatSidebarProps) {
  const { messages, isLoading, sendMessage, clearHistory } = useAIChat(context)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

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
        className={cn(
          "fixed right-0 z-50 flex flex-col bg-background border-l border-border transition-all duration-300 ease-in-out",
          "top-[60px] h-[calc(100vh-60px)]", // Below navbar
          open ? "w-[400px] sm:w-[440px]" : "w-[52px]"
        )}
      >
        {/* Collapsed state - slim sidebar */}
        {!open && (
          <div className="flex flex-col items-center py-4 gap-3 h-full">
            <button
              onClick={() => onOpenChange(true)}
              className="p-2.5 rounded-lg bg-[var(--golden-chestnut)]/10 hover:bg-[var(--golden-chestnut)]/20 text-[var(--golden-chestnut)] transition-colors"
              title="Open AI Research Assistant"
            >
              <MessageSquare className="w-5 h-5" />
            </button>
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
              <div className="shrink-0 px-4 py-2 border-b border-border bg-card/50">
                <p className="text-xs text-foreground/60">
                  <span className="font-medium text-foreground/80">Context: </span>
                  {context.episode_title}
                  {context.current_timestamp && (
                    <span className="text-foreground/50"> @ {context.current_timestamp}</span>
                  )}
                  {context.claim_text && (
                    <span className="text-[var(--golden-chestnut)]"> • Claim selected</span>
                  )}
                </p>
              </div>
            )}

            {/* Messages area - scrollable */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-4"
            >
              <div className="py-4 space-y-4">
                {messages.length === 0 ? (
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

                    {/* Suggested prompts */}
                    <div className="w-full space-y-2">
                      <p className="text-xs text-foreground/50 uppercase tracking-wider mb-2">
                        Try asking:
                      </p>
                      {SUGGESTED_PROMPTS.map((prompt, index) => (
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
