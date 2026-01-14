"use client"

import { useState, useRef, useEffect, type KeyboardEvent } from "react"
import { Send, Loader2, Sparkles } from "lucide-react"

interface ChatInputProps {
  onSend: (message: string) => void
  isLoading: boolean
  placeholder?: string
}

export function ChatInput({
  onSend,
  isLoading,
  placeholder = "Ask about this episode...",
}: ChatInputProps) {
  const [input, setInput] = useState("")
  const [isFocused, setIsFocused] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = "auto"
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`
    }
  }, [input])

  const handleSubmit = () => {
    if (input.trim() && !isLoading) {
      onSend(input)
      setInput("")
      // Reset height after sending
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto"
      }
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="relative">
      {/* Corner brackets - subtle frame */}
      <div className={`absolute -top-px -left-px w-3 h-3 border-l border-t transition-colors duration-200 ${isFocused ? 'border-[var(--golden-chestnut)]/60' : 'border-[var(--golden-chestnut)]/20'}`} />
      <div className={`absolute -top-px -right-px w-3 h-3 border-r border-t transition-colors duration-200 ${isFocused ? 'border-[var(--golden-chestnut)]/60' : 'border-[var(--golden-chestnut)]/20'}`} />
      <div className={`absolute -bottom-px -left-px w-3 h-3 border-l border-b transition-colors duration-200 ${isFocused ? 'border-[var(--golden-chestnut)]/60' : 'border-[var(--golden-chestnut)]/20'}`} />
      <div className={`absolute -bottom-px -right-px w-3 h-3 border-r border-b transition-colors duration-200 ${isFocused ? 'border-[var(--golden-chestnut)]/60' : 'border-[var(--golden-chestnut)]/20'}`} />

      <div className={`flex items-end gap-2 bg-card/50 border p-2.5 transition-all duration-200 ${
        isFocused
          ? 'border-[var(--golden-chestnut)]/40 shadow-[0_0_20px_rgba(190,124,77,0.1)]'
          : 'border-border'
      }`}>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          disabled={isLoading}
          rows={1}
          className="flex-1 min-h-[40px] max-h-[120px] px-3 py-2 bg-transparent text-sm resize-none focus:outline-none placeholder:text-foreground/40 disabled:opacity-50"
        />
        <button
          onClick={handleSubmit}
          disabled={!input.trim() || isLoading}
          className={`shrink-0 h-10 w-10 flex items-center justify-center border transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed ${
            input.trim() && !isLoading
              ? 'border-[var(--golden-chestnut)] bg-[var(--golden-chestnut)]/10 hover:bg-[var(--golden-chestnut)]/20 text-[var(--golden-chestnut)]'
              : 'border-border bg-transparent text-foreground/30'
          }`}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Hint text */}
      <div className="flex items-center justify-between mt-2 px-1">
        <span className="text-[10px] text-foreground/30 mono tracking-wide">
          PRESS ENTER TO SEND
        </span>
        {isLoading && (
          <span className="text-[10px] text-[var(--golden-chestnut)] mono tracking-wide flex items-center gap-1">
            <Sparkles className="w-3 h-3 animate-pulse" />
            PROCESSING
          </span>
        )}
      </div>
    </div>
  )
}
