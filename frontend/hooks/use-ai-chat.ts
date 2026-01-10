"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { callMcpTool } from "@/lib/api"
import {
  getOrCreateChatSession,
  getChatMessages,
  saveChatMessage,
  deleteChatSession,
  type ChatSession,
  type ChatMessageRecord,
} from "@/lib/supabase"
import type {
  ChatMessage,
  ChatContext,
  ChatWithContextRequest,
  ChatWithContextResponse,
} from "@/lib/chat-types"

function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// Convert database record to ChatMessage
function dbRecordToMessage(record: ChatMessageRecord): ChatMessage {
  return {
    id: record.id,
    role: record.role as "user" | "assistant",
    content: record.content,
    timestamp: new Date(record.created_at),
    sources: record.sources,
  }
}

export function useAIChat(context: ChatContext | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [session, setSession] = useState<ChatSession | null>(null)
  const sessionLoadedRef = useRef<string | null>(null)

  // Load session and history when context changes
  useEffect(() => {
    if (!context?.episode_id) {
      setSession(null)
      setMessages([])
      sessionLoadedRef.current = null
      return
    }

    // Create a unique key for this context to avoid duplicate loads
    const contextKey = `${context.episode_id}-${context.claim_id || 'no-claim'}`
    if (sessionLoadedRef.current === contextKey) {
      return // Already loaded for this context
    }

    const loadSession = async () => {
      setIsLoadingHistory(true)
      try {
        const chatSession = await getOrCreateChatSession(
          context.episode_id,
          context.claim_id
        )

        if (chatSession) {
          setSession(chatSession)
          sessionLoadedRef.current = contextKey

          // Load existing messages
          const records = await getChatMessages(chatSession.id)
          if (records.length > 0) {
            setMessages(records.map(dbRecordToMessage))
          }
        }
      } catch (err) {
        console.error('Failed to load chat session:', err)
      } finally {
        setIsLoadingHistory(false)
      }
    }

    loadSession()
  }, [context?.episode_id, context?.claim_id])

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

      // Save user message to database (don't await, fire and forget)
      if (session) {
        saveChatMessage(session.id, {
          role: "user",
          content: content.trim(),
          playback_timestamp: context.current_timestamp,
        }).catch((err) => console.error('Failed to save user message:', err))
      }

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
          current_timestamp: context.current_timestamp,  // Pass current playback position
          conversation_history: conversationHistory,
          n_results: 5,
          use_layered_context: true,  // Enable advanced timestamp-aware context
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

        // Save assistant response to database
        if (session && !response.error) {
          saveChatMessage(session.id, {
            role: "assistant",
            content: response.response,
            playback_timestamp: context.current_timestamp,
            sources: response.sources,
            model: response.model,
          }).catch((err) => console.error('Failed to save assistant message:', err))
        }

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
    [context, messages, session]
  )

  const clearHistory = useCallback(async () => {
    setMessages([])
    setError(null)

    // Delete the session from database (creates a new one on next message)
    if (session) {
      try {
        await deleteChatSession(session.id)
        setSession(null)
        sessionLoadedRef.current = null
      } catch (err) {
        console.error('Failed to delete chat session:', err)
      }
    }
  }, [session])

  return {
    messages,
    isLoading,
    isLoadingHistory,
    error,
    sendMessage,
    clearHistory,
    session,
  }
}
