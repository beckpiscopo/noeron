"use client"

import { useRouter } from "next/navigation"
import { NotebookLibrary } from "@/components/notebook-library"

export default function NotebooksPage() {
  const router = useRouter()

  const handleSelectNotebook = (episodeId: string) => {
    router.push(`/notebook/${episodeId}`)
  }

  const handleBack = () => {
    router.push("/library")
  }

  return (
    <NotebookLibrary
      onSelectNotebook={handleSelectNotebook}
      onBack={handleBack}
    />
  )
}
