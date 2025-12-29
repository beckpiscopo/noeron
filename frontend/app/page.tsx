"use client"

import { useEffect, useState } from "react"
import { callMcpTool } from "@/lib/api"
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

export default function Home() {
  const [view, setView] = useState<"landing" | "library" | "listening" | "exploration" | "paper">("landing")
  const [selectedEpisode, setSelectedEpisode] = useState<EpisodeMetadata | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [claims, setClaims] = useState<Claim[]>(fallbackClaims)

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
    category: activeEpisode.podcast,
    currentTime,
  }
  const paperEpisode = {
    title: activeEpisode.title,
    currentTime,
  }
  const currentExplorationClaim = claims[2] ?? claims[0] ?? fallbackClaims[0]

  const handleGetStarted = () => {
    setView("library")
  }

  const handleDiveDeeper = (claimId: string) => {
    setView("exploration")
  }

  const handleViewSource = (claimId: string) => {
    setView("paper")
  }

  const handleAskQuestion = (question: string) => {
    console.log("User asked:", question)
    // Send question to AI
  }

  const handleTimeUpdate = (time: number) => {
    const safeDuration = Math.max(durationSeconds, 1)
    setCurrentTime(Math.max(0, Math.min(time, safeDuration)))
  }

  const handleBackToListening = () => {
    setView("listening")
  }

  const handleBackToExploration = () => {
    setView("exploration")
  }

  const handleSelectEpisode = (episode: EpisodeMetadata) => {
    setSelectedEpisode(episode)
    setCurrentTime(0)
    setView("listening")
  }

  useEffect(() => {
    if (!selectedEpisode) {
      setClaims(fallbackClaims)
      return
    }

    let cancelled = false

    const loadClaims = async () => {
      try {
        const data = await callMcpTool<Claim[]>("get_episode_claims", {
          episode_id: selectedEpisode.id,
          limit: 45,
        })

        if (cancelled) {
          return
        }

        if (Array.isArray(data) && data.length) {
          setClaims(data)
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

    return () => {
      cancelled = true
    }
  }, [selectedEpisode])

  if (view === "landing") {
    return <LandingPage onGetStarted={handleGetStarted} />
  }

  if (view === "library") {
    return <EpisodeLibrary onSelectEpisode={handleSelectEpisode} />
  }

  if (view === "paper") {
    return <PaperViewer episode={paperEpisode} onBack={handleBackToExploration} />
  }

  if (view === "exploration") {
    return (
      <DeepExplorationView
        episode={explorationEpisode}
        claim={currentExplorationClaim}
        onBack={handleBackToListening}
        onViewSourcePaper={() => setView("paper")}
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
