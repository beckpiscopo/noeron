"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { callMcpTool, getGeminiKeyHeader } from "@/lib/api"
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
  GenerateImageResponse,
  ChatSource,
} from "@/lib/chat-types"

function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// Detect if user wants to generate an image
function detectImageIntent(message: string): { isImageRequest: boolean; prompt: string } {
  const trimmed = message.trim()
  const lowerMessage = trimmed.toLowerCase()

  // Explicit commands: /visualize, /image
  if (lowerMessage.startsWith("/visualize ") || lowerMessage.startsWith("/image ")) {
    const prompt = trimmed.slice(trimmed.indexOf(" ") + 1).trim()
    return { isImageRequest: true, prompt }
  }

  // Natural language triggers
  const imagePatterns = [
    /^(generate|create|make|draw|show me|visualize)\s+(an?\s+)?(image|diagram|illustration|visualization|picture)/i,
    /^(can you|could you|please)\s+(generate|create|make|draw|show me|visualize)\s+(an?\s+)?(image|diagram|illustration|visualization)/i,
  ]

  for (const pattern of imagePatterns) {
    if (pattern.test(trimmed)) {
      return { isImageRequest: true, prompt: trimmed }
    }
  }

  return { isImageRequest: false, prompt: trimmed }
}

// Convert database record to ChatMessage
function dbRecordToMessage(record: ChatMessageRecord): ChatMessage {
  return {
    id: record.id,
    role: record.role as "user" | "assistant",
    content: record.content,
    timestamp: new Date(record.created_at),
    sources: record.sources,
    // Include image data if present
    image: record.image_url
      ? {
          image_url: record.image_url,
          caption: record.image_caption,
        }
      : undefined,
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
        const message = err instanceof Error ? err.message : ''
        if (!message.includes('Auth session missing') && !message.includes('Authentication error')) {
          console.error('Failed to load chat session:', err)
        }
      } finally {
        setIsLoadingHistory(false)
      }
    }

    loadSession()
  }, [context?.episode_id, context?.claim_id])

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || !context) return

      // Check for image generation intent
      const { isImageRequest, prompt } = detectImageIntent(content)

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
        content: isImageRequest ? "Generating image..." : "",
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
        if (isImageRequest) {
          // IMAGE GENERATION PATH
          const imageResponse = await callMcpTool<GenerateImageResponse>(
            "generate_image_with_context",
            {
              prompt,
              episode_id: context.episode_id,
              claim_id: context.claim_id,
              current_timestamp: context.current_timestamp,
              image_style: "auto",
            }
          )

          if (imageResponse.error || !imageResponse.image_url) {
            // Update placeholder with error
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantPlaceholder.id
                  ? {
                      ...msg,
                      content: imageResponse.error || "Failed to generate image",
                      isLoading: false,
                      error: imageResponse.error || "Image generation failed",
                    }
                  : msg
              )
            )
            setError(imageResponse.error || "Image generation failed")
          } else {
            // Update placeholder with image
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantPlaceholder.id
                  ? {
                      ...msg,
                      content: imageResponse.caption || "Here's the generated visualization:",
                      isLoading: false,
                      image: {
                        image_url: imageResponse.image_url,
                        caption: imageResponse.caption || undefined,
                        style_used: imageResponse.style_used,
                        storage_path: imageResponse.storage_path,
                      },
                    }
                  : msg
              )
            )

            // Save assistant response with image to database
            if (session) {
              saveChatMessage(session.id, {
                role: "assistant",
                content: imageResponse.caption || "Generated visualization",
                playback_timestamp: context.current_timestamp,
                image_url: imageResponse.image_url,
                image_caption: imageResponse.caption,
                model: imageResponse.model,
              }).catch((err) => console.error('Failed to save image message:', err))
            }
          }
        } else {
          // REGULAR CHAT PATH - with SSE streaming for real-time thinking
          const conversationHistory = messages.map((msg) => ({
            role: msg.role,
            content: msg.content,
          }))

          conversationHistory.push({
            role: "user",
            content: content.trim(),
          })

          const request: ChatWithContextRequest = {
            message: content.trim(),
            episode_id: context.episode_id,
            claim_id: context.claim_id,
            current_timestamp: context.current_timestamp,
            conversation_history: conversationHistory,
            n_results: 5,
            use_layered_context: true,
            include_thinking: true,
          }

          // Use SSE streaming endpoint for real-time thinking display
          const apiUrl = process.env.NEXT_PUBLIC_MCP_API_URL || "http://localhost:8000"
          const response = await fetch(`${apiUrl}/tools/chat_with_context/stream`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...getGeminiKeyHeader(),
            },
            body: JSON.stringify(request),
          })

          if (!response.ok) {
            throw new Error(`API error: ${response.status}`)
          }

          // Update placeholder to show thinking state
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantPlaceholder.id
                ? { ...msg, isThinking: true, isLoading: true }
                : msg
            )
          )

          // Read SSE stream
          const reader = response.body?.getReader()
          const decoder = new TextDecoder()
          let thinkingText = ""
          let contentText = ""
          let sources: ChatSource[] = []
          let buffer = ""

          if (reader) {
            while (true) {
              const { done, value } = await reader.read()
              if (done) break

              buffer += decoder.decode(value, { stream: true })

              // Parse SSE events from buffer
              const lines = buffer.split("\n")
              buffer = lines.pop() || "" // Keep incomplete line in buffer

              let eventType = ""
              for (const line of lines) {
                if (line.startsWith("event: ")) {
                  eventType = line.slice(7)
                } else if (line.startsWith("data: ")) {
                  const data = line.slice(6)
                  try {
                    const parsed = JSON.parse(data)

                    if (eventType === "thinking" && parsed.text) {
                      thinkingText += parsed.text
                      // Update message with accumulated thinking
                      setMessages((prev) =>
                        prev.map((msg) =>
                          msg.id === assistantPlaceholder.id
                            ? { ...msg, thinking: thinkingText, isThinking: true }
                            : msg
                        )
                      )
                    } else if (eventType === "content" && parsed.text) {
                      // Transition from thinking to content
                      contentText += parsed.text
                      setMessages((prev) =>
                        prev.map((msg) =>
                          msg.id === assistantPlaceholder.id
                            ? {
                                ...msg,
                                content: contentText,
                                isThinking: false,
                                isStreaming: true,
                              }
                            : msg
                        )
                      )
                    } else if (eventType === "sources" && parsed.sources) {
                      sources = parsed.sources
                    } else if (eventType === "done") {
                      // Finalize message
                      setMessages((prev) =>
                        prev.map((msg) =>
                          msg.id === assistantPlaceholder.id
                            ? {
                                ...msg,
                                content: contentText || parsed.response_complete,
                                thinking: thinkingText || parsed.thinking_complete,
                                sources,
                                isLoading: false,
                                isThinking: false,
                                isStreaming: false,
                              }
                            : msg
                        )
                      )

                      // Save to database
                      if (session) {
                        saveChatMessage(session.id, {
                          role: "assistant",
                          content: contentText || parsed.response_complete,
                          playback_timestamp: context.current_timestamp,
                          sources,
                          model: parsed.model,
                        }).catch((err) => console.error('Failed to save assistant message:', err))
                      }
                    } else if (eventType === "error" && parsed.error) {
                      setError(parsed.error)
                      setMessages((prev) =>
                        prev.map((msg) =>
                          msg.id === assistantPlaceholder.id
                            ? {
                                ...msg,
                                content: "Sorry, an error occurred.",
                                error: parsed.error,
                                isLoading: false,
                                isThinking: false,
                                isStreaming: false,
                              }
                            : msg
                        )
                      )
                    }
                  } catch {
                    // Ignore JSON parse errors for incomplete data
                  }
                }
              }
            }
          }
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
