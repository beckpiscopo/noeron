"use client"

import { useState, useCallback } from "react"
import { callMcpTool } from "@/lib/api"
import type {
  ChatMessage,
  ChatContext,
  ChatWithContextRequest,
  ChatWithContextResponse,
} from "@/lib/chat-types"

function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

export function useAIChat(context: ChatContext | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || !context) return

      // Add user message immediately
      const userMessage: ChatMessage = {
        id: generateId(),
        role: "user",
        content: content.trim(),
        timestamp: new Date(),
      }

      // Add placeholder for assistant response
      const assistantPlaceholder: ChatMessage = {
        id: generateId(),
        role: "assistant",
        content: "",
        timestamp: new Date(),
        isLoading: true,
      }

      setMessages((prev) => [...prev, userMessage, assistantPlaceholder])
      setIsLoading(true)
      setError(null)

      try {
        // Build conversation history from previous messages (excluding the placeholder)
        const conversationHistory = messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        }))

        // Add the current user message to history
        conversationHistory.push({
          role: "user",
          content: content.trim(),
        })

        const request: ChatWithContextRequest = {
          message: content.trim(),
          episode_id: context.episode_id,
          claim_id: context.claim_id,
          conversation_history: conversationHistory,
          n_results: 5,
        }

        const response = await callMcpTool<ChatWithContextResponse>(
          "chat_with_context",
          request
        )

        // Update the placeholder with the actual response
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantPlaceholder.id
              ? {
                  ...msg,
                  content: response.error || response.response,
                  sources: response.sources,
                  isLoading: false,
                  error: response.error,
                }
              : msg
          )
        )

        if (response.error) {
          setError(response.error)
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to send message"

        // Update placeholder with error
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantPlaceholder.id
              ? {
                  ...msg,
                  content: "Sorry, I encountered an error. Please try again.",
                  isLoading: false,
                  error: errorMessage,
                }
              : msg
          )
        )

        setError(errorMessage)
      } finally {
        setIsLoading(false)
      }
    },
    [context, messages]
  )

  const clearHistory = useCallback(() => {
    setMessages([])
    setError(null)
  }, [])

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearHistory,
  }
}
