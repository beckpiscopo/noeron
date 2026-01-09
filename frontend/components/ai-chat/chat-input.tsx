"use client"

import { useState, useRef, useEffect, type KeyboardEvent } from "react"
import { Send, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

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
    <div className="flex items-end gap-2 bg-card border border-border rounded-lg p-2">
      <textarea
        ref={textareaRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={isLoading}
        rows={1}
        className="flex-1 min-h-[40px] max-h-[120px] px-3 py-2 bg-transparent text-sm resize-none focus:outline-none placeholder:text-foreground/40 disabled:opacity-50"
      />
      <Button
        onClick={handleSubmit}
        disabled={!input.trim() || isLoading}
        size="icon"
        className="shrink-0 h-10 w-10 rounded-full bg-[var(--golden-chestnut)] hover:bg-[var(--golden-chestnut)]/90 text-background disabled:opacity-50"
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Send className="w-4 h-4" />
        )}
      </Button>
    </div>
  )
}
