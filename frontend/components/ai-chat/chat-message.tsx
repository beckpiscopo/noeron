"use client"

import { User, Bot, Loader2 } from "lucide-react"
import { ChatSources } from "./chat-sources"
import type { ChatMessage as ChatMessageType } from "@/lib/chat-types"

interface ChatMessageProps {
  message: ChatMessageType
  onViewPaper?: (paperId: string) => void
}

export function ChatMessage({ message, onViewPaper }: ChatMessageProps) {
  const isUser = message.role === "user"

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
          {message.isLoading ? (
            <div className="flex items-center gap-2 text-foreground/60">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Thinking...</span>
            </div>
          ) : (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {message.content}
            </p>
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
