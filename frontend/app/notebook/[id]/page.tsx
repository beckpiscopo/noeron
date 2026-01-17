"use client"

import { use } from "react"
import { useRouter } from "next/navigation"
import { NotebookView } from "@/components/notebook-view"

interface NotebookPageProps {
  params: Promise<{ id: string }>
}

export default function NotebookPage({ params }: NotebookPageProps) {
  const { id } = use(params)
  const router = useRouter()

  const handleBack = () => {
    router.push("/notebooks")
  }

  const handleViewClaim = (claimId: number) => {
    // Navigate to exploration view for this claim
    // The episodeId here is the notebook's episodeId
    router.push(`/episode/${id}?view=exploration&claim=${claimId}`)
  }

  const handleViewPaper = (paperId: string) => {
    router.push(`/episode/${id}?view=paper&paperId=${paperId}`)
  }

  const handleStartQuiz = () => {
    router.push(`/episode/${id}?view=quiz`)
  }

  const handleBookmarksClick = () => {
    router.push("/notebooks")
  }

  return (
    <NotebookView
      episodeId={id}
      onBack={handleBack}
      onViewClaim={handleViewClaim}
      onViewPaper={handleViewPaper}
      onStartQuiz={handleStartQuiz}
      onBookmarksClick={handleBookmarksClick}
    />
  )
}
