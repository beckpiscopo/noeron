"use client"

import { useState, useCallback, useRef } from "react"
import { callMcpTool } from "@/lib/api"
import type { TextToSpeechResponse } from "@/lib/chat-types"

export function useChatAudio() {
  const [isGenerating, setIsGenerating] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentMessageId, setCurrentMessageId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const generateAndPlay = useCallback(async (text: string, messageId: string) => {
    // Stop any currently playing audio
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }

    setIsGenerating(true)
    setCurrentMessageId(messageId)
    setError(null)

    try {
      const response = await callMcpTool<TextToSpeechResponse>("text_to_speech", {
        text,
      })

      if (response.error || !response.audio_url) {
        setError(response.error || "Failed to generate audio")
        setIsGenerating(false)
        return
      }

      // Create and play audio
      const audio = new Audio(response.audio_url)
      audioRef.current = audio

      audio.onplay = () => {
        setIsPlaying(true)
        setIsGenerating(false)
      }

      audio.onended = () => {
        setIsPlaying(false)
        setCurrentMessageId(null)
      }

      audio.onerror = () => {
        setError("Failed to play audio")
        setIsPlaying(false)
        setIsGenerating(false)
        setCurrentMessageId(null)
      }

      await audio.play()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to generate audio"
      setError(errorMessage)
      setIsGenerating(false)
      setCurrentMessageId(null)
    }
  }, [])

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    setIsPlaying(false)
    setCurrentMessageId(null)
  }, [])

  return {
    generateAndPlay,
    stop,
    isGenerating,
    isPlaying,
    currentMessageId,
    error,
  }
}
