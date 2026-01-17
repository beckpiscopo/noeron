"use client"

import { useRouter } from "next/navigation"
import { EpisodeLibrary } from "@/components/episode-library"
import type { Episode } from "@/components/episode-library"

export default function LibraryPage() {
  const router = useRouter()

  const handleSelectEpisode = (episode: Episode) => {
    router.push(`/episode/${episode.id}`)
  }

  return <EpisodeLibrary onSelectEpisode={handleSelectEpisode} />
}
