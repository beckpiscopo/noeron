"use client"

import { useState } from "react"
import { User, Bot, Loader2, ImageIcon, Download, BookmarkPlus, Brain, ChevronDown, ChevronRight } from "lucide-react"
import { ChatSources } from "./chat-sources"
import { MarkdownContent } from "@/components/ui/markdown-content"
import { Button } from "@/components/ui/button"
import type { ChatMessage as ChatMessageType } from "@/lib/chat-types"

interface ChatMessageProps {
  message: ChatMessageType
  onViewPaper?: (paperId: string) => void
  onBookmarkImage?: (imageUrl: string, caption?: string) => void
}

export function ChatMessage({ message, onViewPaper, onBookmarkImage }: ChatMessageProps) {
  const isUser = message.role === "user"
  const [isThinkingExpanded, setIsThinkingExpanded] = useState(false)

  const handleDownloadImage = () => {
    if (message.image?.image_url) {
      window.open(message.image.image_url, '_blank')
    }
  }

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      {/* Avatar */}
      <div
        className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser
            ? "bg-[var(--golden-chestnut)]/20 text-[var(--golden-chestnut)]"
            : "bg-foreground/10 text-foreground/70"
        }`}
      >
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>

      {/* Message bubble */}
      <div
        className={`flex-1 max-w-[85%] ${isUser ? "flex flex-col items-end" : ""}`}
      >
        <div
          className={`rounded-lg px-4 py-3 ${
            isUser
              ? "bg-[var(--golden-chestnut)] text-background"
              : "bg-card border border-border"
          }`}
        >
          {message.isLoading && !message.isThinking && !message.content ? (
            // Initial loading state before any content arrives
            <div className="flex items-center gap-2 text-foreground/60">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Thinking...</span>
            </div>
          ) : isUser ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {message.content}
            </p>
          ) : (
            <>
              {/* Thinking traces section - auto-expanded while streaming */}
              {(message.thinking || message.isThinking) && (
                <div className="mb-3">
                  <button
                    onClick={() => setIsThinkingExpanded(!isThinkingExpanded)}
                    className="flex items-center gap-1.5 text-xs text-foreground/50 hover:text-foreground/70 transition-colors"
                  >
                    {message.isThinking ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--golden-chestnut)]" />
                    ) : (
                      <Brain className="w-3.5 h-3.5" />
                    )}
                    <span className={message.isThinking ? "text-[var(--golden-chestnut)]" : ""}>
                      {message.isThinking ? "Reasoning..." : "Reasoning"}
                    </span>
                    {(isThinkingExpanded || message.isThinking) ? (
                      <ChevronDown className="w-3 h-3" />
                    ) : (
                      <ChevronRight className="w-3 h-3" />
                    )}
                  </button>
                  {/* Auto-expand while thinking, otherwise respect user toggle */}
                  {(isThinkingExpanded || message.isThinking) && message.thinking && (
                    <div className="mt-2 pl-3 border-l-2 border-foreground/10">
                      <p className="text-xs text-foreground/60 whitespace-pre-wrap leading-relaxed">
                        {message.thinking}
                        {message.isThinking && (
                          <span className="inline-block w-2 h-3 bg-[var(--golden-chestnut)]/50 animate-pulse ml-0.5" />
                        )}
                      </p>
                    </div>
                  )}
                </div>
              )}
              {/* Response content with streaming cursor */}
              {message.content && (
                <div className="relative">
                  <MarkdownContent content={message.content} variant="chat" />
                  {message.isStreaming && (
                    <span className="inline-block w-2 h-4 bg-foreground/30 animate-pulse ml-0.5 align-middle" />
                  )}
                </div>
              )}

              {/* Generated Image Display */}
              {message.image?.image_url && (
                <div className="mt-3 space-y-2">
                  <div className="relative group">
                    <img
                      src={message.image.image_url}
                      alt={message.image.caption || "Generated visualization"}
                      className="w-full max-w-md rounded-lg border border-border/50"
                    />
                    {/* Image overlay actions */}
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-8 w-8 p-0 bg-background/80 backdrop-blur-sm"
                        onClick={handleDownloadImage}
                        title="Open in new tab"
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      {onBookmarkImage && (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-8 w-8 p-0 bg-background/80 backdrop-blur-sm"
                          onClick={() => onBookmarkImage(
                            message.image!.image_url,
                            message.image!.caption
                          )}
                          title="Save to notebook"
                        >
                          <BookmarkPlus className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  {message.image.caption && (
                    <p className="text-xs text-foreground/60 italic flex items-center gap-1">
                      <ImageIcon className="w-3 h-3" />
                      {message.image.caption}
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Sources for assistant messages */}
        {!isUser && !message.isLoading && message.sources && (
          <ChatSources sources={message.sources} onViewPaper={onViewPaper} />
        )}

        {/* Error indicator */}
        {message.error && !message.isLoading && (
          <p className="mt-1 text-xs text-red-400">
            Error: {message.error}
          </p>
        )}

        {/* Timestamp */}
        <p className="mt-1 text-[10px] text-foreground/40">
          {message.timestamp.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  )
}
