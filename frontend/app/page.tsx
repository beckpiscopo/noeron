"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { callMcpTool } from "@/lib/api"
import { getClaimsForEpisode } from "@/lib/supabase"
import type { Claim as SupabaseClaim } from "@/lib/supabase"
import { LandingPage } from "@/components/landing-page"
import { ListeningView } from "@/components/listening-view"
import { DeepExplorationView } from "@/components/deep-exploration-view"
import { PaperViewer } from "@/components/paper-viewer"
import { EpisodeLibrary } from "@/components/episode-library"
import { EpisodeOverview } from "@/components/episode-overview"
import type { EpisodeOverviewData } from "@/components/episode-overview"
import { BookmarksLibrary } from "@/components/bookmarks-library"
import { QuizMode } from "@/components/quiz-mode"
import type { Claim, ListeningEpisode } from "@/components/listening-view"
import type { Episode as EpisodeMetadata } from "@/components/episode-library"

// Episode data
import episodesData from "../../data/episodes.json"
import episodeSummariesData from "../../data/episode_summaries.json"

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

// Compute claim density from actual claims data
interface ClaimDensityPoint {
  timestamp_ms: number
  density: number
  theme?: string
  label?: string
}

function computeClaimDensity(
  claims: Claim[],
  durationSeconds: number,
  bucketCount: number = 60
): ClaimDensityPoint[] {
  if (!claims.length || !durationSeconds) {
    return []
  }

  const durationMs = durationSeconds * 1000
  const bucketSize = durationMs / bucketCount

  // Initialize buckets
  const buckets: { count: number; themes: Record<string, number> }[] = Array.from(
    { length: bucketCount },
    () => ({ count: 0, themes: {} })
  )

  // Count claims per bucket and track themes
  for (const claim of claims) {
    const timestamp = claim.start_ms ?? (claim.timestamp ? claim.timestamp * 1000 : 0)
    if (timestamp < 0 || timestamp > durationMs) continue

    const bucketIndex = Math.min(
      Math.floor(timestamp / bucketSize),
      bucketCount - 1
    )
    buckets[bucketIndex].count++

    // Track theme from claim_type or context_tags
    const theme = claim.category || claim.claim_type ||
      (claim.context_tags as Record<string, string>)?.phenomenon ||
      (claim.context_tags as Record<string, string>)?.organism ||
      "Research"

    buckets[bucketIndex].themes[theme] = (buckets[bucketIndex].themes[theme] || 0) + 1
  }

  // Find max count for normalization
  const maxCount = Math.max(...buckets.map(b => b.count), 1)

  // Convert to density points
  return buckets.map((bucket, i) => {
    // Find dominant theme in this bucket
    let dominantTheme = ""
    let maxThemeCount = 0
    for (const [theme, count] of Object.entries(bucket.themes)) {
      if (count > maxThemeCount) {
        maxThemeCount = count
        dominantTheme = theme
      }
    }

    // Determine if this is a peak (local maximum)
    const isPeak = bucket.count > 0 &&
      (i === 0 || bucket.count >= buckets[i - 1].count) &&
      (i === buckets.length - 1 || bucket.count >= buckets[i + 1].count) &&
      bucket.count >= maxCount * 0.7  // Only label significant peaks

    return {
      timestamp_ms: i * bucketSize + bucketSize / 2,
      density: bucket.count / maxCount,
      theme: dominantTheme || undefined,
      label: isPeak && dominantTheme ? dominantTheme.toUpperCase() : undefined
    }
  })
}

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
  const router = useRouter()
  const [view, setView] = useState<"landing" | "library" | "overview" | "listening" | "exploration" | "paper" | "bookmarks" | "quiz">("landing")
  const [selectedEpisode, setSelectedEpisode] = useState<EpisodeMetadata | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [claims, setClaims] = useState<Claim[]>(fallbackClaims)
  const [selectedClaimId, setSelectedClaimId] = useState<string | number | null>(null)
  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(null)
  const [episodeSummary, setEpisodeSummary] = useState<any>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)

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

  const handleExploreGraph = (conceptName: string) => {
    router.push(`/graph?concept=${encodeURIComponent(conceptName)}`)
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
    console.log(`[Back to Podcast] currentTime state=${currentTime.toFixed(2)}s, fallbackTime=${fallbackTime.toFixed(2)}s, resumeTime=${resumeTime.toFixed(2)}s`)
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
    setView("overview") // Go to overview first, then user can start listening
  }

  const handleStartListening = (timestamp?: number) => {
    if (timestamp !== undefined) {
      const safeDuration = Math.max(durationSeconds, 1)
      const safeTime = Math.max(0, Math.min(timestamp, safeDuration))
      setCurrentTime(safeTime)
      persistPlaybackTime(activeEpisode.id, safeTime)
    }
    setView("listening")
  }

  const handleBackToLibrary = () => {
    setView("library")
  }

  const handleGoToBookmarks = () => {
    setView("bookmarks")
  }

  const handleStartQuiz = () => {
    setView("quiz")
  }

  const handleBookmarkViewClaim = (claimId: number) => {
    // Find the claim and navigate to exploration
    const claim = claims.find((c) => c.id === claimId)
    if (claim) {
      setSelectedClaimId(claimId)
      setView("exploration")
    }
  }

  const handleBookmarkViewPaper = (paperId: string) => {
    setSelectedPaperId(paperId)
    setView("paper")
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

  // Fetch episode summary when entering overview
  useEffect(() => {
    if (view !== "overview") {
      return
    }

    // Check if we already have a cached summary (from local JSON)
    const localSummary = (episodeSummariesData as Record<string, any>)[activeEpisode.id]
    if (localSummary) {
      setEpisodeSummary(localSummary)
      return
    }

    // Check if we already fetched this summary
    if (episodeSummary?.episode_id === activeEpisode.id) {
      return
    }

    // Fetch from API (will use cache or generate with Gemini)
    let cancelled = false
    setSummaryLoading(true)

    const fetchSummary = async () => {
      try {
        const response = await fetch("/api/mcp/tools/get_episode_summary/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ episode_id: activeEpisode.id })
        })

        if (!cancelled && response.ok) {
          const data = await response.json()
          if (data.summary) {
            setEpisodeSummary(data.summary)
          }
        }
      } catch (error) {
        console.warn("Failed to fetch episode summary:", error)
      } finally {
        if (!cancelled) {
          setSummaryLoading(false)
        }
      }
    }

    fetchSummary()

    return () => {
      cancelled = true
    }
  }, [view, activeEpisode.id, episodeSummary?.episode_id])

  if (view === "landing") {
    return <LandingPage onGetStarted={handleGetStarted} />
  }

  if (view === "library") {
    return <EpisodeLibrary onSelectEpisode={handleSelectEpisode} />
  }

  if (view === "overview") {
    // Find extended episode data from episodes.json
    const extendedData = (episodesData as any[]).find((ep: any) => ep.id === activeEpisode.id)

    // Use dynamically fetched summary (from local JSON or API)
    const summaryData = episodeSummary

    // Map structured summary data to our component format
    const majorThemes = summaryData?.major_themes?.map((t: any) => ({
      theme_name: t.theme_name,
      description: t.description,
      timestamps: t.timestamps
    })) || []

    const keyMoments = summaryData?.key_moments?.map((m: any) => ({
      timestamp: m.timestamp,
      description: m.description,
      quote: m.quote,
      significance: m.significance
    })) || []

    const guestThesis = summaryData?.guest_thesis ? {
      summary: summaryData.guest_thesis.core_thesis,
      key_claims: summaryData.guest_thesis.key_claims || []
    } : undefined

    // Compute claim density from actual claims data
    const claimDensity = computeClaimDensity(claims, durationSeconds, 60)

    const overviewData: EpisodeOverviewData = {
      id: activeEpisode.id,
      title: activeEpisode.title,
      podcast: activeEpisode.podcast,
      host: activeEpisode.host,
      guest: activeEpisode.guest,
      duration: activeEpisode.duration,
      durationSeconds: durationSeconds,
      date: activeEpisode.date,
      papersLinked: activeEpisode.papersLinked,
      totalClaims: claims.length,
      description: extendedData?.description || activeEpisode.description,
      summary: summaryData?.narrative_arc,
      major_themes: majorThemes,
      key_moments: keyMoments,
      guest_thesis: guestThesis,
      claim_density: claimDensity.length > 0 ? claimDensity : undefined,
      isLoading: summaryLoading,
    }

    return (
      <EpisodeOverview
        episode={overviewData}
        onStartListening={handleStartListening}
        onBack={handleBackToLibrary}
      />
    )
  }

  if (view === "paper") {
    return <PaperViewer episode={paperEpisode} paperId={selectedPaperId} onBack={handleBackToExploration} />
  }

  if (view === "bookmarks") {
    return (
      <BookmarksLibrary
        onBack={() => setView("library")}
        onStartQuiz={handleStartQuiz}
        onViewClaim={handleBookmarkViewClaim}
        onViewPaper={handleBookmarkViewPaper}
      />
    )
  }

  if (view === "quiz") {
    return <QuizMode onBack={handleGoToBookmarks} />
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
      onExploreGraph={handleExploreGraph}
      onBookmarksClick={handleGoToBookmarks}
    />
  )
}
