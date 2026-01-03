"use client"

import { useEffect, useState } from "react"
import { callMcpTool } from "@/lib/api"
import { getClaimsForEpisode } from "@/lib/supabase"
import type { Claim as SupabaseClaim } from "@/lib/supabase"
import { LandingPage } from "@/components/landing-page"
import { ListeningView } from "@/components/listening-view"
import { DeepExplorationView } from "@/components/deep-exploration-view"
import { PaperViewer } from "@/components/paper-viewer"
import { EpisodeLibrary } from "@/components/episode-library"
import type { Claim, ListeningEpisode } from "@/components/listening-view"
import type { Episode as EpisodeMetadata } from "@/components/episode-library"

const fallbackEpisode: EpisodeMetadata = {
  id: "lex_325",
  title: "Biology, Life, Aliens, Evolution, Embryogenesis & Xenobots",
  podcast: "Lex Fridman Podcast #325",
  host: "Lex Fridman",
  guest: "Michael Levin",
  duration: "3h 42m",
  date: "2022-10-12",
  papersLinked: 12,
  description: "Microscale control, bioelectricity, and collective intelligence converging with robotic biology.",
}

const fallbackClaims: Claim[] = [
  {
    id: "1",
    timestamp: 420, // 7:00
    category: "Background",
    title: "The role of mitochondria in cellular energy production",
    description:
      "Mitochondria are the powerhouses of the cell, generating ATP through oxidative phosphorylation. This fundamental process is essential for all cellular activities.",
    source: "Cell Biology Textbook (2020)",
    status: "past",
  },
  {
    id: "2",
    timestamp: 640, // 10:40
    category: "Evidence",
    title: "Glucose metabolism affects mitochondrial function",
    description:
      "Studies show that glucose levels directly influence how mitochondria produce energy, with significant implications for metabolic health.",
    source: "Nature Metabolism (2022)",
    status: "past",
  },
  {
    id: "3",
    timestamp: 860, // 14:20
    category: "Key Finding",
    title: "Mitochondrial efficiency drops by 40% in high-sugar environments, directly impacting ATP output",
    description:
      "Recent research demonstrates that sustained hyperglycemia leads to reactive oxygen species accumulation, damaging the mitochondrial membrane and reducing ATP output by up to 40%.",
    source: "Brownlee et al., Nature (2001)",
    status: "current",
  },
  {
    id: "4",
    timestamp: 1200, // 20:00
    category: "Mechanism",
    title: "Electron transport chain inhibition under oxidative stress",
    description:
      "High glucose environments lead to ROS accumulation which specifically inhibits complexes I and III of the electron transport chain.",
    source: "Upcoming segment",
    status: "future",
  },
  {
    id: "5",
    timestamp: 1560, // 26:00
    category: "Intervention",
    title: "Potential therapeutic approaches to restore mitochondrial health",
    description:
      "Discussion of compounds and lifestyle interventions that can help mitigate oxidative stress and restore mitochondrial efficiency.",
    source: "Upcoming segment",
    status: "future",
  },
]

function parseDurationLabelToSeconds(label: string): number {
  if (!label) {
    return 0
  }

  let total = 0

  const hoursMatch = label.match(/(\d+)\s*h/i)
  if (hoursMatch) {
    total += Number(hoursMatch[1]) * 3600
  }

  const minutesMatch = label.match(/(\d+)\s*m/i)
  if (minutesMatch) {
    total += Number(minutesMatch[1]) * 60
  }

  const secondsMatch = label.match(/(\d+)\s*s/i)
  if (secondsMatch) {
    total += Number(secondsMatch[1])
  }

  if (total === 0) {
    const parts = label.split(":").map((segment) => Number(segment))
    if (parts.every((value) => !Number.isNaN(value))) {
      if (parts.length === 3) {
        total = parts[0] * 3600 + parts[1] * 60 + parts[2]
      } else if (parts.length === 2) {
        total = parts[0] * 60 + parts[1]
      } else if (parts.length === 1 && parts[0] > 0) {
        total = parts[0]
      }
    }
  }

  return total
}

const getPlaybackStorageKey = (episodeId: string) => `playback_position:${episodeId}`

const readStoredPlaybackTime = (episodeId: string): number | null => {
  if (typeof window === "undefined") {
    return null
  }

  const storedValue = window.localStorage.getItem(getPlaybackStorageKey(episodeId))
  const parsed = storedValue ? Number(storedValue) : NaN
  return Number.isFinite(parsed) ? parsed : null
}

const persistPlaybackTime = (episodeId: string, time: number) => {
  if (typeof window === "undefined") {
    return
  }

  try {
    window.localStorage.setItem(getPlaybackStorageKey(episodeId), String(time))
  } catch (error) {
    console.warn("Failed to persist playback time", error)
  }
}

export default function Home() {
  const [view, setView] = useState<"landing" | "library" | "listening" | "exploration" | "paper">("landing")
  const [selectedEpisode, setSelectedEpisode] = useState<EpisodeMetadata | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [claims, setClaims] = useState<Claim[]>(fallbackClaims)
  const [selectedClaimId, setSelectedClaimId] = useState<string | number | null>(null)
  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(null)

  const activeEpisode = selectedEpisode ?? fallbackEpisode
  const durationSeconds = parseDurationLabelToSeconds(activeEpisode.duration)
  const listeningEpisode: ListeningEpisode = {
    id: activeEpisode.id,
    title: activeEpisode.title,
    podcast: activeEpisode.podcast,
    host: activeEpisode.host,
    guest: activeEpisode.guest,
    durationSeconds,
    durationLabel: activeEpisode.duration,
    currentTime,
    audioUrl: `/api/audio/${activeEpisode.id}`,
  }
  const explorationEpisode = {
    title: activeEpisode.title,
    host: activeEpisode.host,
    guest: activeEpisode.guest,
    category: activeEpisode.podcast,
    currentTime,
  }
  const paperEpisode = {
    title: activeEpisode.title,
    currentTime,
  }
  
  // Helper to convert Claim to the format expected by DeepExplorationView
  const convertClaimForExploration = (claim: Claim) => ({
    id: claim.segment_claim_id || String(claim.id), // Use segment_claim_id if available, otherwise fall back to numeric ID
    title: claim.distilled_claim || claim.title || claim.claim_text || "Unknown claim",
    timestamp: claim.timestamp || (claim.start_ms ? claim.start_ms / 1000 : 0),
    description: claim.claim_text || claim.description || "",
    source: claim.paper_title || claim.source || "Unknown source"
  })
  
  // Find the selected claim or fall back to a default
  const selectedClaim = selectedClaimId 
    ? claims.find(c => c.id === selectedClaimId) ?? claims[2] ?? claims[0] ?? fallbackClaims[0]
    : claims[2] ?? claims[0] ?? fallbackClaims[0]
  
  const currentExplorationClaim = convertClaimForExploration(selectedClaim)

  const handleGetStarted = () => {
    setView("library")
  }

  const handleDiveDeeper = (claimId: string | number) => {
    setSelectedClaimId(claimId)
    setView("exploration")
  }

  const handleViewSource = (claimId: string | number) => {
    setView("paper")
  }

  const handleAskQuestion = (question: string) => {
    console.log("User asked:", question)
    // Send question to AI
  }

  const handleTimeUpdate = (time: number) => {
    const safeDuration = Math.max(durationSeconds, 1)
    const clampedTime = Math.max(0, Math.min(time, safeDuration))
    setCurrentTime(clampedTime)
    persistPlaybackTime(activeEpisode.id, clampedTime)
  }

  const handleBackToListening = () => {
    const fallbackTime = currentExplorationClaim.timestamp || 0
    const safeDuration = Math.max(durationSeconds, 1)
    const resumeTime = Math.max(0, Math.min(currentTime > 0 ? currentTime : fallbackTime, safeDuration))
    setCurrentTime(resumeTime)
    persistPlaybackTime(activeEpisode.id, resumeTime)
    setView("listening")
  }

  const handleBackToExploration = () => {
    setView("exploration")
  }

  const handleViewPaper = (paperId?: string) => {
    if (paperId) {
      setSelectedPaperId(paperId)
    }
    setView("paper")
  }

  const handleSelectEpisode = (episode: EpisodeMetadata) => {
    setSelectedEpisode(episode)
    const nextDurationSeconds = parseDurationLabelToSeconds(episode.duration)
    const storedTime = readStoredPlaybackTime(episode.id)
    const safeDuration = Math.max(nextDurationSeconds, 1)
    const startTime = storedTime !== null ? Math.max(0, Math.min(storedTime, safeDuration)) : 0
    setCurrentTime(startTime)
    setView("listening")
  }

  // Convert Supabase claim to frontend Claim format
  const convertSupabaseClaim = (supabaseClaim: SupabaseClaim): Claim => ({
    id: supabaseClaim.id,
    segment_claim_id: supabaseClaim.segment_claim_id,
    timestamp: supabaseClaim.start_ms ? supabaseClaim.start_ms / 1000 : 0,
    // Supabase fields
    claim_text: supabaseClaim.claim_text,
    distilled_claim: supabaseClaim.distilled_claim,
    distilled_word_count: supabaseClaim.distilled_word_count,
    paper_title: supabaseClaim.paper_title,
    paper_url: supabaseClaim.paper_url,
    confidence_score: supabaseClaim.confidence_score,
    start_ms: supabaseClaim.start_ms,
    end_ms: supabaseClaim.end_ms,
    // Legacy fields for backward compatibility
    category: supabaseClaim.claim_type || "Research Finding",
    title: supabaseClaim.distilled_claim || supabaseClaim.claim_text,
    description: supabaseClaim.claim_text,
    source: supabaseClaim.paper_title || "Unknown source",
    status: "past",
  })

  useEffect(() => {
    if (!selectedEpisode) {
      setClaims(fallbackClaims)
      return
    }

    let cancelled = false

    const loadClaims = async () => {
      try {
        // Try loading from Supabase first
        const supabaseClaims = await getClaimsForEpisode(selectedEpisode.id)

        if (cancelled) {
          return
        }

        if (supabaseClaims && supabaseClaims.length > 0) {
          console.log(`Loaded ${supabaseClaims.length} claims from Supabase`)
          const convertedClaims = supabaseClaims.map(convertSupabaseClaim)
          setClaims(convertedClaims)
          return
        }

        // Fallback to MCP tool if Supabase has no data
        console.log("No Supabase data, falling back to MCP tool")
        const mcpData = await callMcpTool<Claim[]>("get_episode_claims", {
          episode_id: selectedEpisode.id,
          limit: 45,
        })

        if (cancelled) {
          return
        }

        if (Array.isArray(mcpData) && mcpData.length) {
          setClaims(mcpData)
        } else {
          setClaims(fallbackClaims)
        }
      } catch (error) {
        if (!cancelled) {
          console.warn("Failed to load episode claims", error)
          
          // Try MCP tool as final fallback
          try {
            const mcpData = await callMcpTool<Claim[]>("get_episode_claims", {
              episode_id: selectedEpisode.id,
              limit: 45,
            })
            if (!cancelled && Array.isArray(mcpData) && mcpData.length) {
              setClaims(mcpData)
              return
            }
          } catch (mcpError) {
            console.warn("MCP tool also failed", mcpError)
          }
          
          setClaims(fallbackClaims)
        }
      }
    }

    loadClaims()

    return () => {
      cancelled = true
    }
  }, [selectedEpisode])

  useEffect(() => {
    const storedTime = readStoredPlaybackTime(activeEpisode.id)
    if (storedTime !== null) {
      const safeDuration = Math.max(durationSeconds, 1)
      setCurrentTime(Math.max(0, Math.min(storedTime, safeDuration)))
    }
  }, [activeEpisode.id, durationSeconds])

  if (view === "landing") {
    return <LandingPage onGetStarted={handleGetStarted} />
  }

  if (view === "library") {
    return <EpisodeLibrary onSelectEpisode={handleSelectEpisode} />
  }

  if (view === "paper") {
    return <PaperViewer episode={paperEpisode} paperId={selectedPaperId} onBack={handleBackToExploration} />
  }

  if (view === "exploration") {
    return (
      <DeepExplorationView
        episode={explorationEpisode}
        claim={currentExplorationClaim}
        episodeId={activeEpisode.id}
        onBack={handleBackToListening}
        onViewSourcePaper={handleViewPaper}
      />
    )
  }

  return (
    <ListeningView
      episode={listeningEpisode}
      claims={claims}
      onDiveDeeper={handleDiveDeeper}
      onViewSource={handleViewSource}
      onAskQuestion={handleAskQuestion}
      onTimeUpdate={handleTimeUpdate}
    />
  )
}
