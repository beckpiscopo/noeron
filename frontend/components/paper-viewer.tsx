"use client"

import { useState, useEffect } from "react"
import { ArrowLeft, Quote, ExternalLink, Loader2, AlertCircle } from "lucide-react"
import { NoeronHeader } from "./noeron-header"
import { callMcpTool } from "@/lib/api"

interface PaperData {
  paper_id: string
  title: string
  authors: string[]
  year: string | number
  venue: string
  journal: string
  citation_count: number
  doi: string
  arxiv: string
  external_url: string | null
  abstract: string
  full_text: string
  full_text_available: boolean
  source: string
  sections: {
    introduction: string
    methods: string
    results: string
    discussion: string
    conclusion: string
  }
  error?: string
}

interface PaperViewerProps {
  episode: {
    title: string
    currentTime: number
  }
  paperId?: string | null
  onBack: () => void
}

export function PaperViewer({ episode, paperId, onBack }: PaperViewerProps) {
  const [paperData, setPaperData] = useState<PaperData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!paperId) return

    const fetchPaper = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const data = await callMcpTool<PaperData>("get_paper", {
          paper_id: paperId,
        })

        if (data.error) {
          setError(data.error)
        } else {
          setPaperData(data)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load paper")
        console.error("Error fetching paper:", err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchPaper()
  }, [paperId])

  const formatAuthors = (authors: string[]) => {
    if (authors.length === 0) return "Unknown Authors"
    if (authors.length === 1) return authors[0]
    if (authors.length === 2) return authors.join(" & ")
    return `${authors[0]} et al.`
  }

  return (
    <div className="noeron-theme min-h-screen bg-[var(--carbon-black)] text-[var(--parchment)] flex flex-col">
      <NoeronHeader />

      {/* Top Navigation Bar */}
      <header className="sticky top-14 z-40 w-full border-b border-[var(--parchment)]/10 bg-[var(--carbon-black)]/95 backdrop-blur-md px-6 py-3">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="flex items-center gap-2 group text-[var(--parchment)] hover:text-[var(--golden-chestnut)] transition-colors"
            >
              <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
              <span className="text-sm font-bold uppercase tracking-wider">Back to Exploration</span>
            </button>
          </div>
          <div className="flex items-center gap-3">
            {paperData?.external_url && (
              <a
                href={paperData.external_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center h-9 px-4 rounded-none bg-[var(--golden-chestnut)] text-[var(--carbon-black)] font-bold hover:bg-[var(--golden-chestnut)]/90 transition-colors text-sm gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                <span>View Original</span>
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Loading State */}
      {isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-10 h-10 text-[var(--golden-chestnut)] animate-spin mx-auto mb-4" />
            <p className="text-[var(--parchment)]/60">Loading paper...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Failed to Load Paper</h2>
            <p className="text-[var(--parchment)]/60 mb-4">{error}</p>
            <button
              onClick={onBack}
              className="px-4 py-2 bg-[var(--parchment)]/10] hover:bg-[var(--warm-gray)] rounded-none text-sm font-medium transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
      )}

      {/* No Paper ID State */}
      {!paperId && !isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <Quote className="w-12 h-12 text-[var(--parchment)]/40 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">No Paper Selected</h2>
            <p className="text-[var(--parchment)]/60 mb-4">Select a paper from the deep dive to view its contents.</p>
            <button
              onClick={onBack}
              className="px-4 py-2 bg-[var(--parchment)]/10] hover:bg-[var(--warm-gray)] rounded-none text-sm font-medium transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      {paperData && !isLoading && !error && (
        <main className="flex-1 max-w-[1400px] mx-auto w-full p-6 lg:p-10 pb-32 gap-10 flex flex-col lg:flex-row">
          {/* Left Column: Paper Content */}
          <article className="flex-1 min-w-0 max-w-4xl mx-auto lg:mx-0">
            {/* Paper Header */}
            <div className="mb-8 border-b border-[var(--parchment)]/10 pb-8">
              <div className="flex flex-wrap gap-2 mb-4">
                {paperData.venue && (
                  <span className="px-2 py-1 rounded text-xs font-bold bg-[var(--golden-chestnut)]/20 text-[var(--golden-chestnut)] uppercase tracking-wider border border-[var(--golden-chestnut)]/30">
                    {paperData.venue}
                  </span>
                )}
                {paperData.year && (
                  <span className="px-2 py-1 rounded text-xs font-bold bg-[var(--parchment)]/10] text-[var(--parchment)]/80 uppercase tracking-wider">
                    {paperData.year}
                  </span>
                )}
                {!paperData.full_text_available && (
                  <span className="px-2 py-1 rounded text-xs font-bold bg-gray-700/50 text-[var(--parchment)]/60 uppercase tracking-wider">
                    Abstract Only
                  </span>
                )}
              </div>
              <h1 className="text-2xl md:text-4xl font-black leading-tight tracking-tight mb-6">
                {paperData.title}
              </h1>
              <div className="flex flex-wrap items-center justify-between gap-6">
                <div className="flex flex-col gap-1">
                  <p className="text-lg font-medium text-[var(--parchment)]">{formatAuthors(paperData.authors)}</p>
                  <p className="text-[var(--golden-chestnut)] text-sm font-normal">
                    {paperData.journal || paperData.venue} {paperData.year && `(${paperData.year})`}
                  </p>
                </div>
                {/* Stats */}
                <div className="flex gap-4">
                  {paperData.citation_count > 0 && (
                    <div className="text-center">
                      <span className="block text-xl font-bold text-[var(--parchment)]">{paperData.citation_count}</span>
                      <span className="text-[10px] text-[var(--parchment)]/60 uppercase font-bold">Citations</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Paper Body - Abstract */}
            <div className="text-lg">
              {paperData.abstract && (
                <div id="abstract">
                  <div className="bg-[var(--dark-gray)] p-6 rounded-none border-l-4 border-[var(--golden-chestnut)]">
                    <h3 className="text-xl font-bold mb-3 text-[var(--parchment)]">Abstract</h3>
                    <p className="text-[var(--parchment)]/80 text-base leading-relaxed whitespace-pre-wrap">
                      {paperData.abstract}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </article>

          {/* Right Column: Sidebar */}
          <aside className="w-full lg:w-80 xl:w-96 flex-shrink-0 flex flex-col gap-6">
            <div className="sticky top-24 space-y-6">
              {/* Paper Info */}
              <div className="bg-[var(--dark-gray)] border border-[var(--parchment)]/10 rounded-none p-5">
                <h4 className="text-[var(--parchment)] font-bold text-sm uppercase tracking-wider mb-4">
                  Paper Info
                </h4>
                <div className="space-y-3 text-sm">
                  {paperData.doi && (
                    <div>
                      <span className="text-[var(--parchment)]/50 block text-xs uppercase mb-1">DOI</span>
                      <a
                        href={`https://doi.org/${paperData.doi}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--golden-chestnut)] hover:underline break-all"
                      >
                        {paperData.doi}
                      </a>
                    </div>
                  )}
                  {paperData.authors.length > 0 && (
                    <div>
                      <span className="text-[var(--parchment)]/50 block text-xs uppercase mb-1">Authors</span>
                      <p className="text-[var(--parchment)]/80">{paperData.authors.join(", ")}</p>
                    </div>
                  )}
                  {paperData.source && (
                    <div>
                      <span className="text-[var(--parchment)]/50 block text-xs uppercase mb-1">Source</span>
                      <p className="text-[var(--parchment)]/60 capitalize">{paperData.source.replace(/_/g, " ")}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* External Link Button */}
              {paperData.external_url && (
                <a
                  href={paperData.external_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-3 bg-[var(--golden-chestnut)] text-[var(--carbon-black)] font-bold rounded-none hover:bg-[var(--golden-chestnut)]/90 transition-colors"
                >
                  <ExternalLink className="w-5 h-5" />
                  View Original Paper
                </a>
              )}
            </div>
          </aside>
        </main>
      )}
    </div>
  )
}
