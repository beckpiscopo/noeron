"use client"

import { useEffect, useState } from "react"
import { Play, Clock, Calendar, FileText, Search, Settings, HelpCircle, Brain } from "lucide-react"
import { callMcpTool } from "@/lib/api"

export interface Episode {
  id: string
  title: string
  podcast: string
  host: string
  guest: string
  duration: string
  date: string
  papersLinked: number
  thumbnail?: string
  description?: string
}

interface EpisodeLibraryProps {
  onSelectEpisode: (episode: Episode) => void
}

const fallbackEpisodes: Episode[] = [
  {
    id: "lex_325",
    title: "Biology, Life, Aliens, Evolution, Embryogenesis & Xenobots",
    podcast: "Lex Fridman Podcast #325",
    host: "Lex Fridman",
    guest: "Michael Levin",
    duration: "3h 42m",
    date: "Oct 12, 2022",
    papersLinked: 12,
    thumbnail:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBSXr2NRFQyHckx7EOb7p-v5XeY29QTtJa4gwIiNp2h_BVaHFU2F2wfbRmTvez1GpVNkpGQDUIPcdW0MU_hx4kyDjN8tiYYDzu-oKYa4yNLqMm0wnaA5B55ST3f5VySZTmQWQIQS9bKLPcv68F5jJezZYy0zHLJYlCS2EkUmtWMeHJ4RShQtP7kl47lFWjHV9j0M11_4KJ3fAny-gAPCHOcLQP29Y2S0qdoPuXCBcsksEsbZ9YZnSpWgYTE51dYEah9lan25ybl0OQ",
  },
  {
    id: "theories_of_everything",
    title: "Consciousness, Biology, Universal Mind, Emergence, Cancer Research",
    podcast: "Theories of Everything",
    host: "Curt Jaimungal",
    guest: "Michael Levin",
    duration: "2h 18m",
    date: "Feb 14, 2023",
    papersLinked: 4,
    thumbnail:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDW9snz5fYeB2yLE_8jtpSz_11mpIfpSndnmbL_PYgbnt16oupG77F3cLxyuise3ZULKpcgM-__fUkUCeEY9E5mZvnj7sq9t4EmG6FTiaORvUD_M9rVl5JE_raLNnkpEcoia20PTreB19XatdNuzSnVUu_35NeAh8n514eAM3G5bFCsLQ-KrOTD4PpEUAuDyUwhKr0MP8vNrn6A7CB-Uulx8pWkoRNZZinMa-Yd_KKSLuuj6KN-dumoX75va5j9Bfk_BqhCGZ7Axvg",
  },
  {
    id: "mlst",
    title: "Bioelectricity and the Software of Life",
    podcast: "Machine Learning Street Talk",
    host: "Tim Scarfe",
    guest: "Michael Levin",
    duration: "2h 15m",
    date: "Jun 05, 2021",
    papersLinked: 8,
    thumbnail:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuD5tffHIm8aP_Tc_WChwbDuKUx63FqzZdt-kn31dn1bdZmtq-gVCdLsCV3_cSsRw9sUp9DxyAODkkonKgHDK41xB_qpHy4F3Q-rcVgivQVI-surpGKgD7JUNklBlBiEgBikziDH3JhtJ1NVOt1ZSqcJmEUukj6-ABU49GaPrAFd1ij6AOvcmoPKfcr3BgfRwrl-nR4Qj0iFjrpES6WtBSMARieaxCpfZjjp-bNS998a08H5hTKb-KTQfsVYHpf-Du9r13mLCKxr5T0",
  },
]

export function EpisodeLibrary({ onSelectEpisode }: EpisodeLibraryProps) {
  const [episodes, setEpisodes] = useState<Episode[]>(fallbackEpisodes)
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [highlightedEpisodeId, setHighlightedEpisodeId] = useState<string | null>(fallbackEpisodes[0]?.id ?? null)

  useEffect(() => {
    let mounted = true

    const loadEpisodes = async () => {
      setStatus("loading")
      try {
        const data = await callMcpTool<Episode[]>("list_episodes", {})
        if (!mounted) {
          return
        }

        if (data.length) {
          setEpisodes(data)
          setHighlightedEpisodeId((prev) => prev ?? data[0]?.id ?? null)
        }

        setErrorMessage(null)
        setStatus("idle")
      } catch (error) {
        if (!mounted) {
          return
        }

        setErrorMessage(error instanceof Error ? error.message : "Failed to load episodes.")
        setStatus("error")
      }
    }

    loadEpisodes()

    return () => {
      mounted = false
    }
  }, [])

  return (
    <div className="noeron-theme relative flex min-h-screen w-full flex-col bg-[var(--carbon-black)] text-[var(--parchment)]">
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 w-full border-b border-[var(--parchment)]/10 px-6 py-4 bg-[var(--carbon-black)]/85 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl flex items-center justify-between">
          {/* Branding */}
          <div className="flex items-center gap-2.5">
            <span className="display text-2xl font-medium tracking-tight text-[var(--parchment)] italic">noeron</span>
          </div>

          {/* Utilities */}
          <div className="flex items-center gap-3">
            <button className="flex items-center justify-center size-10 rounded-full bg-[var(--parchment)]/5 text-[var(--parchment)]/50 hover:bg-[var(--parchment)]/10 hover:text-[var(--parchment)] transition-colors">
              <Search className="size-5" />
            </button>
            <button className="flex items-center justify-center size-10 rounded-full bg-[var(--parchment)]/5 text-[var(--parchment)]/50 hover:bg-[var(--parchment)]/10 hover:text-[var(--parchment)] transition-colors">
              <Settings className="size-5" />
            </button>
            <button className="flex items-center justify-center size-10 rounded-full bg-[var(--parchment)]/5 text-[var(--parchment)]/50 hover:bg-[var(--parchment)]/10 hover:text-[var(--parchment)] transition-colors">
              <HelpCircle className="size-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full px-4 md:px-10 py-8">
        <div className="mx-auto max-w-[1200px]">
          {/* Page Title */}
          <div className="mb-8">
            <div className="eyebrow mb-2">Library</div>
            <h1 className="display text-3xl md:text-4xl font-normal leading-tight tracking-[-0.02em] text-[var(--parchment)] mb-2">
              Podcast Episode Library
            </h1>
            <p className="text-[var(--parchment)]/60 text-sm md:text-base font-normal">
              Podcast interviews exploring morphogenesis, bioelectricity, and collective intelligence
            </p>
          </div>

          <div className="mb-4 text-xs font-semibold uppercase tracking-[0.3em] text-[var(--parchment)]/40 mono">
            {status === "loading" && "Refreshing episode catalog…"}
            {status === "error" && `Snapshot stale (${errorMessage})`}
            {status === "idle" && "Episode catalog synced"}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {episodes.map((episode) => (
            <article
              key={episode.id}
            onClick={() => {
              setHighlightedEpisodeId(episode.id)
              onSelectEpisode(episode)
            }}
            className={`group relative flex flex-col border border-[var(--parchment)]/10 p-6 cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:bg-[var(--dark-gray)] hover:shadow-[0_0_25px_rgba(190,124,77,0.2)] hover:border-[var(--golden-chestnut)]/30 ${
              episode.id === highlightedEpisodeId ? "bg-[var(--dark-gray)]" : "bg-[var(--dark-gray)]/50"
            }`}
            >
              {/* Info Stack */}
              <div className="flex flex-1 flex-col gap-3">
                <div className="flex flex-col gap-2">
                  <span className="text-[var(--golden-chestnut)] text-xs font-bold uppercase tracking-wider mono">{episode.podcast}</span>
                  <h3 className="text-[var(--parchment)] text-lg font-bold leading-tight">{episode.title}</h3>
                </div>
                <p className="text-[var(--parchment)]/60 text-sm font-medium">
                  Host: {episode.host} • Guest: {episode.guest}
                </p>

                {/* Metadata Stack */}
                <div className="flex flex-col gap-2 mt-2 text-sm text-[var(--parchment)]/50">
                  <div className="flex items-center gap-1.5">
                    <Clock className="size-4" />
                    <span>{episode.duration}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="size-4" />
                    <span>{episode.date}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[var(--golden-chestnut)] font-medium">
                    <FileText className="size-4" />
                    <span>{episode.papersLinked} Papers Linked</span>
                  </div>
                </div>
              </div>

              {/* Play Button */}
              <div className="flex justify-end mt-4">
                <button className="flex items-center justify-center size-12 rounded-full bg-[var(--golden-chestnut)] text-[var(--carbon-black)] shadow-lg shadow-[var(--golden-chestnut)]/20 transition-all duration-300 group-hover:scale-110 group-hover:bg-[var(--parchment)] group-hover:shadow-[0_0_15px_rgba(190,124,77,0.5)]">
                  <Play className="size-5 ml-0.5 fill-current" />
                </button>
              </div>
            </article>
          ))}

          {/* Explore Section */}
          <div className="flex flex-col items-center justify-center gap-4 py-8 px-4 bg-gradient-to-b from-transparent to-[var(--dark-gray)]/50 text-center border border-[var(--parchment)]/10">
            <div className="size-12 rounded-full bg-[var(--golden-chestnut)]/10 flex items-center justify-center">
              <Brain className="size-6 text-[var(--golden-chestnut)]" />
            </div>
            <h3 className="text-lg font-bold text-[var(--parchment)]">Explore Research Papers</h3>
            <p className="text-[var(--parchment)]/60 text-sm">Dive deeper into the cited literature and hypotheses.</p>
            <button className="btn-noeron btn-noeron-secondary flex items-center gap-2">
              <span>Browse Citations</span>
              <FileText className="size-4" />
            </button>
          </div>
        </div>
      </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto py-8 text-center border-t border-[var(--parchment)]/10 bg-[var(--carbon-black)]">
        <div className="flex flex-col gap-2 items-center justify-center">
          <p className="text-[var(--parchment)]/40 text-xs font-medium tracking-wide uppercase mono">
            Built with Gemini 3 API • Designed with Google Stitch
          </p>
        </div>
      </footer>
    </div>
  )
}
