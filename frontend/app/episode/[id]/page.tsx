"use client"

import { useEffect, useState, use } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { callMcpTool } from "@/lib/api"
import { getClaimsForEpisode } from "@/lib/supabase"
import type { Claim as SupabaseClaim } from "@/lib/supabase"
import { EpisodeOverview } from "@/components/episode-overview"
import type { EpisodeOverviewData } from "@/components/episode-overview"
import { ListeningView } from "@/components/listening-view"
import type { Claim, ListeningEpisode } from "@/components/listening-view"
import { DeepExplorationView } from "@/components/deep-exploration-view"
import { PaperViewer } from "@/components/paper-viewer"
import { QuizMode } from "@/components/quiz-mode"
import type { Episode as EpisodeMetadata } from "@/components/episode-library"

// Episode data
import episodesData from "@/data/episodes.json"
import episodeSummariesData from "@/data/episode_summaries.json"

// Fallback claims for demo
const fallbackClaims: Claim[] = [
  {
    id: "1",
    timestamp: 420,
    category: "Background",
    title: "The role of mitochondria in cellular energy production",
    description: "Mitochondria are the powerhouses of the cell, generating ATP through oxidative phosphorylation.",
    source: "Cell Biology Textbook (2020)",
    status: "past",
  },
  {
    id: "2",
    timestamp: 640,
    category: "Evidence",
    title: "Glucose metabolism affects mitochondrial function",
    description: "Studies show that glucose levels directly influence how mitochondria produce energy.",
    source: "Nature Metabolism (2022)",
    status: "past",
  },
  {
    id: "3",
    timestamp: 860,
    category: "Key Finding",
    title: "Mitochondrial efficiency drops by 40% in high-sugar environments",
    description: "Recent research demonstrates that sustained hyperglycemia leads to ROS accumulation.",
    source: "Brownlee et al., Nature (2001)",
    status: "current",
  },
]

function parseDurationLabelToSeconds(label: string): number {
  if (!label) return 0
  let total = 0
  const hoursMatch = label.match(/(\d+)\s*h/i)
  if (hoursMatch) total += Number(hoursMatch[1]) * 3600
  const minutesMatch = label.match(/(\d+)\s*m/i)
  if (minutesMatch) total += Number(minutesMatch[1]) * 60
  const secondsMatch = label.match(/(\d+)\s*s/i)
  if (secondsMatch) total += Number(secondsMatch[1])
  if (total === 0) {
    const parts = label.split(":").map((segment) => Number(segment))
    if (parts.every((value) => !Number.isNaN(value))) {
      if (parts.length === 3) total = parts[0] * 3600 + parts[1] * 60 + parts[2]
      else if (parts.length === 2) total = parts[0] * 60 + parts[1]
      else if (parts.length === 1 && parts[0] > 0) total = parts[0]
    }
  }
  return total
}

const getPlaybackStorageKey = (episodeId: string) => `playback_position:${episodeId}`

const readStoredPlaybackTime = (episodeId: string): number | null => {
  if (typeof window === "undefined") return null
  const storedValue = window.localStorage.getItem(getPlaybackStorageKey(episodeId))
  const parsed = storedValue ? Number(storedValue) : NaN
  return Number.isFinite(parsed) ? parsed : null
}

const persistPlaybackTime = (episodeId: string, time: number) => {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(getPlaybackStorageKey(episodeId), String(time))
  } catch (error) {
    console.warn("Failed to persist playback time", error)
  }
}

// Compute claim density from actual claims data
interface ClaimDensityPoint {
  timestamp_ms: number
  density: number
  theme?: string
  label?: string
  keywords?: string[]
}

function computeClaimDensity(claims: Claim[], durationSeconds: number, bucketCount: number = 60): ClaimDensityPoint[] {
  if (!claims.length || !durationSeconds) return []
  const durationMs = durationSeconds * 1000
  const bucketSize = durationMs / bucketCount
  const buckets: { count: number; themes: Record<string, number>; keywords: Record<string, number> }[] = Array.from(
    { length: bucketCount },
    () => ({ count: 0, themes: {}, keywords: {} })
  )
  for (const claim of claims) {
    const timestamp = claim.start_ms ?? (claim.timestamp ? claim.timestamp * 1000 : 0)
    if (timestamp < 0 || timestamp > durationMs) continue
    const bucketIndex = Math.min(Math.floor(timestamp / bucketSize), bucketCount - 1)
    buckets[bucketIndex].count++
    const theme = claim.category || claim.claim_type || "Research"
    buckets[bucketIndex].themes[theme] = (buckets[bucketIndex].themes[theme] || 0) + 1
    if (claim.keywords && Array.isArray(claim.keywords)) {
      for (const keyword of claim.keywords) {
        buckets[bucketIndex].keywords[keyword] = (buckets[bucketIndex].keywords[keyword] || 0) + 1
      }
    }
  }
  const maxCount = Math.max(...buckets.map(b => b.count), 1)
  return buckets.map((bucket, i) => {
    let dominantTheme = ""
    let maxThemeCount = 0
    for (const [theme, count] of Object.entries(bucket.themes)) {
      if (count > maxThemeCount) {
        maxThemeCount = count
        dominantTheme = theme
      }
    }
    const topKeywords = Object.entries(bucket.keywords)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([keyword]) => keyword)
    const isPeak = bucket.count > 0 &&
      (i === 0 || bucket.count >= buckets[i - 1].count) &&
      (i === buckets.length - 1 || bucket.count >= buckets[i + 1].count) &&
      bucket.count >= maxCount * 0.7
    return {
      timestamp_ms: i * bucketSize + bucketSize / 2,
      density: bucket.count / maxCount,
      theme: dominantTheme || undefined,
      label: isPeak && dominantTheme ? dominantTheme.toUpperCase() : undefined,
      keywords: topKeywords.length > 0 ? topKeywords : undefined
    }
  })
}

// Convert Supabase claim to frontend Claim format
const convertSupabaseClaim = (supabaseClaim: SupabaseClaim): Claim => ({
  id: supabaseClaim.id,
  segment_claim_id: supabaseClaim.segment_claim_id,
  timestamp: supabaseClaim.start_ms ? supabaseClaim.start_ms / 1000 : 0,
  claim_text: supabaseClaim.claim_text,
  distilled_claim: supabaseClaim.distilled_claim,
  distilled_word_count: supabaseClaim.distilled_word_count,
  paper_title: supabaseClaim.paper_title,
  paper_url: supabaseClaim.paper_url,
  confidence_score: supabaseClaim.confidence_score,
  start_ms: supabaseClaim.start_ms,
  end_ms: supabaseClaim.end_ms,
  keywords: supabaseClaim.keywords,
  claim_type: supabaseClaim.claim_type,
  context_tags: supabaseClaim.context_tags,
  category: supabaseClaim.claim_type || "Research Finding",
  title: supabaseClaim.distilled_claim || supabaseClaim.claim_text,
  description: supabaseClaim.claim_text,
  source: supabaseClaim.paper_title || "Unknown source",
  status: "past",
})

// Helper to convert Claim to the format expected by DeepExplorationView
const convertClaimForExploration = (claim: Claim) => ({
  id: claim.segment_claim_id || String(claim.id),
  title: claim.distilled_claim || claim.title || claim.claim_text || "Unknown claim",
  timestamp: claim.timestamp || (claim.start_ms ? claim.start_ms / 1000 : 0),
  description: claim.claim_text || claim.description || "",
  source: claim.paper_title || claim.source || "Unknown source"
})

interface EpisodePageProps {
  params: Promise<{ id: string }>
}

export default function EpisodePage({ params }: EpisodePageProps) {
  const { id } = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()

  const view = searchParams.get("view") || "overview"
  const claimId = searchParams.get("claim")
  const paperId = searchParams.get("paperId")
  const initialTime = searchParams.get("t")

  // State
  const [episode, setEpisode] = useState<EpisodeMetadata | null>(null)
  const [claims, setClaims] = useState<Claim[]>(fallbackClaims)
  const [currentTime, setCurrentTime] = useState(0)
  const [episodeSummary, setEpisodeSummary] = useState<any>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)

  // Load episode metadata
  useEffect(() => {
    const episodeData = (episodesData as EpisodeMetadata[]).find((ep) => ep.id === id)
    if (episodeData) {
      setEpisode(episodeData)
      // Restore playback position
      const durationSeconds = parseDurationLabelToSeconds(episodeData.duration)
      const storedTime = readStoredPlaybackTime(episodeData.id)
      const safeDuration = Math.max(durationSeconds, 1)
      const startTime = initialTime ? Number(initialTime) : (storedTime !== null ? Math.max(0, Math.min(storedTime, safeDuration)) : 0)
      setCurrentTime(startTime)
    }
  }, [id, initialTime])

  // Load claims
  useEffect(() => {
    if (!episode) return
    let cancelled = false

    const loadClaims = async () => {
      try {
        const supabaseClaims = await getClaimsForEpisode(episode.id)
        if (cancelled) return
        if (supabaseClaims && supabaseClaims.length > 0) {
          const convertedClaims = supabaseClaims.map(convertSupabaseClaim)
          setClaims(convertedClaims)
          return
        }
        // Fallback to MCP tool
        const mcpData = await callMcpTool<Claim[]>("get_episode_claims", { episode_id: episode.id, limit: 45 })
        if (cancelled) return
        if (Array.isArray(mcpData) && mcpData.length) {
          setClaims(mcpData)
        } else {
          setClaims(fallbackClaims)
        }
      } catch (error) {
        if (!cancelled) {
          console.warn("Failed to load episode claims", error)
          setClaims(fallbackClaims)
        }
      }
    }

    loadClaims()
    return () => { cancelled = true }
  }, [episode])

  // Load summary for overview
  useEffect(() => {
    if (view !== "overview" || !episode) return
    const localSummary = (episodeSummariesData as Record<string, any>)[episode.id]
    if (localSummary) {
      setEpisodeSummary(localSummary)
      return
    }
    if (episodeSummary?.episode_id === episode.id) return

    let cancelled = false
    setSummaryLoading(true)

    const fetchSummary = async () => {
      try {
        const response = await fetch("/api/mcp/tools/get_episode_summary/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ episode_id: episode.id })
        })
        if (!cancelled && response.ok) {
          const data = await response.json()
          if (data.summary) setEpisodeSummary(data.summary)
        }
      } catch (error) {
        console.warn("Failed to fetch episode summary:", error)
      } finally {
        if (!cancelled) setSummaryLoading(false)
      }
    }

    fetchSummary()
    return () => { cancelled = true }
  }, [view, episode, episodeSummary?.episode_id])

  if (!episode) {
    return (
      <div className="noeron-theme flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="text-center">
          <div className="text-lg text-foreground/60">Loading episode...</div>
        </div>
      </div>
    )
  }

  const durationSeconds = parseDurationLabelToSeconds(episode.duration)
  const episodeJsonData = (episodesData as any[]).find((ep: any) => ep.id === episode.id)
  const audioUrl = episodeJsonData?.audioUrl || `/api/audio/${episode.id}`

  // Navigation handlers
  const handleStartListening = (timestamp?: number) => {
    const params = new URLSearchParams()
    params.set("view", "listening")
    if (timestamp !== undefined) {
      params.set("t", String(timestamp))
      setCurrentTime(timestamp)
      persistPlaybackTime(episode.id, timestamp)
    }
    router.push(`/episode/${id}?${params.toString()}`)
  }

  const handleDiveDeeper = (selectedClaimId: string | number) => {
    router.push(`/episode/${id}?view=exploration&claim=${selectedClaimId}`)
  }

  const handleViewPaper = (selectedPaperId?: string) => {
    if (selectedPaperId) {
      router.push(`/episode/${id}?view=paper&paperId=${selectedPaperId}`)
    } else {
      router.push(`/episode/${id}?view=paper`)
    }
  }

  const handleBackToLibrary = () => {
    router.push("/library")
  }

  const handleBackToListening = () => {
    router.push(`/episode/${id}?view=listening`)
  }

  const handleBackToExploration = () => {
    if (claimId) {
      router.push(`/episode/${id}?view=exploration&claim=${claimId}`)
    } else {
      router.push(`/episode/${id}?view=listening`)
    }
  }

  const handleGoToNotebookLibrary = () => {
    router.push("/notebooks")
  }

  const handleTimeUpdate = (time: number) => {
    const safeDuration = Math.max(durationSeconds, 1)
    const clampedTime = Math.max(0, Math.min(time, safeDuration))
    setCurrentTime(clampedTime)
    persistPlaybackTime(episode.id, clampedTime)
  }

  const handleExploreGraph = (conceptName: string) => {
    router.push(`/graph?concept=${encodeURIComponent(conceptName)}`)
  }

  // Render based on view
  switch (view) {
    case "listening": {
      const listeningEpisode: ListeningEpisode = {
        id: episode.id,
        title: episode.title,
        podcast: episode.podcast,
        host: episode.host,
        guest: episode.guest,
        durationSeconds,
        durationLabel: episode.duration,
        currentTime,
        audioUrl,
      }
      return (
        <ListeningView
          episode={listeningEpisode}
          claims={claims}
          onDiveDeeper={handleDiveDeeper}
          onViewSource={handleDiveDeeper}
          onAskQuestion={(q) => console.log("User asked:", q)}
          onTimeUpdate={handleTimeUpdate}
          onBookmarksClick={handleGoToNotebookLibrary}
          onViewPaper={handleViewPaper}
        />
      )
    }

    case "exploration": {
      const selectedClaim = claimId
        ? claims.find(c => String(c.id) === claimId || c.segment_claim_id === claimId) ?? claims[0]
        : claims[0]

      if (!selectedClaim) {
        return <div className="p-8 text-center">No claim selected</div>
      }

      const explorationEpisode = {
        title: episode.title,
        host: episode.host,
        guest: episode.guest,
        category: episode.podcast,
        currentTime,
      }
      return (
        <DeepExplorationView
          episode={explorationEpisode}
          claim={convertClaimForExploration(selectedClaim)}
          episodeId={episode.id}
          onBack={handleBackToListening}
          onViewSourcePaper={handleViewPaper}
          onBookmarksClick={handleGoToNotebookLibrary}
        />
      )
    }

    case "paper": {
      const paperEpisode = {
        title: episode.title,
        currentTime,
      }
      return (
        <PaperViewer
          episode={paperEpisode}
          paperId={paperId}
          onBack={handleBackToExploration}
        />
      )
    }

    case "quiz": {
      return <QuizMode onBack={handleGoToNotebookLibrary} />
    }

    default: {
      // Overview
      const extendedData = (episodesData as any[]).find((ep: any) => ep.id === episode.id)
      const summaryData = episodeSummary
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
      const episodeOutline = summaryData?.episode_outline?.map((o: any) => ({
        timestamp: o.timestamp,
        topic: o.topic
      })) || []
      const guestThesis = summaryData?.guest_thesis ? {
        summary: summaryData.guest_thesis.core_thesis,
        key_claims: summaryData.guest_thesis.key_claims || []
      } : undefined
      const claimDensity = computeClaimDensity(claims, durationSeconds, 60)

      const overviewData: EpisodeOverviewData = {
        id: episode.id,
        title: episode.title,
        podcast: episode.podcast,
        host: episode.host,
        guest: episode.guest,
        duration: episode.duration,
        durationSeconds,
        date: episode.date,
        papersLinked: episode.papersLinked,
        totalClaims: claims.length,
        description: extendedData?.description || episode.description,
        brief_summary: summaryData?.brief_summary,
        summary: summaryData?.narrative_arc,
        major_themes: majorThemes,
        episode_outline: episodeOutline.length > 0 ? episodeOutline : undefined,
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
          onBookmarksClick={handleGoToNotebookLibrary}
          onViewPaper={handleViewPaper}
        />
      )
    }
  }
}
