"use client"

import { ChevronRight, Play, Zap, FileCheck, Search, Headphones, Brain, Compass, Menu, X } from "lucide-react"
import { useEffect, useState } from "react"
import { callMcpTool } from "@/lib/api"

interface LandingPageProps {
  onGetStarted: () => void
}

interface SearchPaper {
  paperId: string
  title: string
  year?: number
  citationCount?: number
  authors?: Array<{ name?: string }>
  venue?: string
}

export function LandingPage({ onGetStarted }: LandingPageProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [featuredPapers, setFeaturedPapers] = useState<SearchPaper[]>([])
  const [searchState, setSearchState] = useState<"loading" | "idle" | "error">("loading")
  const [searchError, setSearchError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    const loadPapers = async () => {
      setSearchState("loading")

      try {
        const results = await callMcpTool<SearchPaper[]>("bioelectricity_search_papers", {
          query: "bioelectricity morphogenesis",
          limit: 3,
          response_format: "json",
        })

        if (!mounted) {
          return
        }

        setFeaturedPapers(results || [])
        setSearchState("idle")
        setSearchError(null)
      } catch (error) {
        if (!mounted) {
          return
        }

        setSearchError(error instanceof Error ? error.message : "Unable to fetch papers")
        setSearchState("error")
      }
    }

    loadPapers()

    return () => {
      mounted = false
    }
  }, [])

  return (
    <div className="relative flex min-h-screen w-full flex-col bg-[#102216] text-white">
      {/* Fixed Header */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between border-b border-[#28392e] bg-[#102216]/80 backdrop-blur-md px-6 py-4 md:px-10 lg:px-40">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center size-8 rounded bg-[#FDA92B]/20 text-[#FDA92B]">
            <Brain className="size-5" />
          </div>
          <h2 className="text-xl font-bold tracking-tight">Noeron</h2>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex flex-1 justify-center gap-8">
          <a href="#features" className="text-gray-400 hover:text-[#FDA92B] transition-colors text-sm font-medium">
            Features
          </a>
          <a href="#how-it-works" className="text-gray-400 hover:text-[#FDA92B] transition-colors text-sm font-medium">
            How it Works
          </a>
          <a href="#demo" className="text-gray-400 hover:text-[#FDA92B] transition-colors text-sm font-medium">
            Demo
          </a>
        </nav>

        {/* CTA Button */}
        <div className="flex items-center gap-4">
          <button
            onClick={onGetStarted}
            className="hidden sm:flex items-center justify-center rounded-lg h-9 px-4 bg-[#FDA92B] hover:bg-[#583D32] transition-colors text-[#102216] text-sm font-bold"
          >
            Try Live Demo
          </button>

          {/* Mobile Menu Button */}
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden text-white">
            {mobileMenuOpen ? <X className="size-6" /> : <Menu className="size-6" />}
          </button>
        </div>
      </header>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="fixed top-[73px] left-0 right-0 z-40 bg-[#1a261f] border-b border-[#28392e] p-6 md:hidden">
          <nav className="flex flex-col gap-4">
            <a
              href="#features"
              onClick={() => setMobileMenuOpen(false)}
              className="text-gray-400 hover:text-[#FDA92B] transition-colors text-sm font-medium"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              onClick={() => setMobileMenuOpen(false)}
              className="text-gray-400 hover:text-[#FDA92B] transition-colors text-sm font-medium"
            >
              How it Works
            </a>
            <a
              href="#demo"
              onClick={() => setMobileMenuOpen(false)}
              className="text-gray-400 hover:text-[#FDA92B] transition-colors text-sm font-medium"
            >
              Demo
            </a>
          </nav>
        </div>
      )}

      <main className="flex-grow pt-20">
        {/* Hero Section */}
        <section className="relative pt-20 pb-16 md:pt-32 md:pb-24 px-6 md:px-10 lg:px-40 overflow-hidden">
          {/* Ambient Background Glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[#FDA92B]/10 rounded-full blur-[120px] pointer-events-none" />

          <div className="relative z-10 mx-auto max-w-[960px] flex flex-col items-center text-center gap-8">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-[#FDA92B]">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FDA92B] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#FDA92B]" />
              </span>
              v2.0 Now Available
            </div>

            {/* Headline */}
            <div className="flex flex-col gap-4">
              <h1 className="text-5xl md:text-7xl font-black leading-tight tracking-tight">
                The knowledge layer for{" "}
                <span className="text-[#FDA92B] drop-shadow-[0_0_20px_rgba(88,61,50,0.3)]">Podcasts</span>
              </h1>
              <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto font-light leading-relaxed">
              Noeron enriches podcast episodes with contextual research, letting you explore the evidence and ideas behind every claim.
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-wrap gap-4 justify-center w-full">
              <button
                onClick={onGetStarted}
                className="flex min-w-[160px] h-12 items-center justify-center rounded-lg bg-[#FDA92B] hover:bg-[#583D32] transition-all text-[#102216] text-base font-bold shadow-[0_0_20px_-5px_rgba(88,61,50,0.4)]"
              >
                Try Live Demo
              </button>
              <button className="flex min-w-[160px] h-12 items-center justify-center rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all text-white text-base font-medium">
                <Play className="size-5 mr-2" />
                Watch Video
              </button>
            </div>

            {/* Hero Mockup */}
            <div className="mt-12 w-full relative group">
              <div className="absolute -inset-1 bg-gradient-to-b from-[#FDA92B]/20 to-transparent rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-1000" />
              <div className="relative rounded-xl border border-white/10 bg-[#1a261f] overflow-hidden shadow-[0_0_80px_-20px_rgba(88,61,50,0.15)] aspect-[16/10]">
                <img
                  src="/images/screen.png"
                  alt="Noeron dashboard interface"
                  className="w-full h-full object-cover opacity-90 hover:scale-[1.01] transition-transform duration-700"
                />

                {/* Overlay UI Elements */}
                <div className="absolute bottom-6 left-6 right-6 p-4 bg-[#1a261f]/60 backdrop-blur-xl border border-white/10 rounded-lg flex items-center gap-4">
                  <div className="size-10 rounded-full bg-[#FDA92B]/20 flex items-center justify-center text-[#FDA92B]">
                    <Zap className="size-5" />
                  </div>
                  <div className="flex-1">
                    <div className="h-2 w-3/4 bg-white/20 rounded mb-2" />
                    <div className="h-2 w-1/2 bg-white/10 rounded" />
                  </div>
                  <div className="text-xs text-[#FDA92B] font-mono">Processing...</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Dynamic Search Preview */}
        <section className="py-16 px-6 md:px-10 lg:px-40">
          <div className="mx-auto max-w-[960px]">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-8">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold">Live research snapshot</h2>
                <p className="text-gray-400 text-sm md:text-base">
                  Behind the scenes the MCP server keeps your questions aligned with the latest papers. These are the top hits for “bioelectricity morphogenesis.”
                </p>
              </div>
              <button
                className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:border-white/30 hover:bg-white/10"
                onClick={() => onGetStarted()}
              >
                View full search
                <ChevronRight className="size-4" />
              </button>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {searchState === "loading" &&
                Array.from({ length: 3 }, (_, index) => (
                  <div
                    key={`skeleton-${index}`}
                    className="h-48 rounded-2xl border border-white/10 bg-[#111b16] p-5 animate-pulse"
                  />
                ))}

              {searchState === "error" && (
                <div className="w-full rounded-2xl border border-red-500/40 bg-[#1a261f] p-6 text-sm text-red-300">
                  <p className="font-semibold text-white">Unable to fetch papers</p>
                  <p>{searchError || "The MCP server might be warming up."}</p>
                </div>
              )}

              {searchState === "idle" &&
                featuredPapers.map((paper) => {
                  const authors =
                    paper.authors
                      ?.map((author) => author?.name)
                      .filter((name): name is string => Boolean(name))
                      .slice(0, 3)
                      .join(", ") || "Unknown authors"

                  return (
                    <article
                      key={paper.paperId}
                      className="flex h-full flex-col justify-between rounded-2xl border border-white/10 bg-[#111b16] p-6 transition hover:border-[#FDA92B]/40 hover:bg-[#112619]"
                    >
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Paper</p>
                        <h3 className="mt-2 text-lg font-bold leading-snug text-white">{paper.title}</h3>
                        <p className="mt-3 text-sm text-gray-400">{authors}</p>
                      </div>
                      <div className="mt-4 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-gray-500">
                        <span>{paper.year ?? "Year unknown"}</span>
                        <span>{paper.citationCount ?? 0} cites</span>
                      </div>
                    </article>
                  )
                })}
            </div>
          </div>
        </section>

        {/* Tech Stack Marquee */}
        <section className="w-full border-y border-white/5 bg-black/20 py-8 overflow-hidden">
          <div className="flex justify-center gap-12 opacity-40 hover:opacity-60 transition-opacity duration-500">
            <div className="flex items-center gap-2 font-mono text-sm">GEMINI 1.5 PRO</div>
            <div className="flex items-center gap-2 font-mono text-sm">PYTHON</div>
            <div className="flex items-center gap-2 font-mono text-sm">PINECONE</div>
            <div className="flex items-center gap-2 font-mono text-sm">GOOGLE CLOUD</div>
            <div className="flex items-center gap-2 font-mono text-sm">NEXT.JS</div>
          </div>
        </section>

        {/* Problem Section */}
        <section className="py-20 px-6 md:px-10 lg:px-40 relative" id="features">
          <div className="mx-auto max-w-[960px]">
            <div className="mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">The Research Gap</h2>
              <p className="text-gray-400 max-w-2xl text-lg">
                We live in a golden age of audio content, yet verifying claims against rigorous academic standards
                remains a manual, disjointed process.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 relative">
              {/* Connecting Line Visualization */}
              <div className="hidden md:block absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                <div className="size-12 rounded-full bg-[#102216] border border-white/10 flex items-center justify-center text-red-500">
                  <X className="size-6" />
                </div>
              </div>

              {/* Podcast Card */}
              <div className="rounded-xl border border-white/5 bg-[#1a261f] p-8 flex flex-col h-full relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
                <div className="mb-6 size-12 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
                  <Headphones className="size-7" />
                </div>
                <h3 className="text-xl font-bold mb-2">Podcast Conversations</h3>
                <p className="text-gray-400 leading-relaxed mb-6">
                  Highly accessible and engaging, but often lacks immediate citations. Knowledge is fluid and hard to
                  fact-check in real-time.
                </p>
                <div className="mt-auto h-32 rounded-lg bg-black/40 border border-white/5 overflow-hidden relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 via-blue-500/10 to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2">
                    <div className="h-1 bg-blue-500/50 rounded-full w-2/3" />
                  </div>
                </div>
              </div>

              {/* Academic Papers Card */}
              <div className="rounded-xl border border-white/5 bg-[#1a261f] p-8 flex flex-col h-full relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
                <div className="mb-6 size-12 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
                  <FileCheck className="size-7" />
                </div>
                <h3 className="text-xl font-bold mb-2">Academic Papers</h3>
                <p className="text-gray-400 leading-relaxed mb-6">
                  Deep, verified knowledge that is dense and difficult to consume. Often locked behind paywalls or
                  complex jargon.
                </p>
                <div className="mt-auto h-32 rounded-lg bg-black/40 border border-white/5 overflow-hidden relative p-4">
                  <div className="space-y-2 opacity-50">
                    <div className="h-2 w-full bg-white/20 rounded" />
                    <div className="h-2 w-full bg-white/20 rounded" />
                    <div className="h-2 w-3/4 bg-white/20 rounded" />
                    <div className="h-2 w-1/2 bg-white/20 rounded" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Solution Section */}
        <section className="py-20 px-6 md:px-10 lg:px-40 bg-gradient-to-b from-[#102216] to-[#0a0c0b]">
          <div className="mx-auto max-w-[960px]">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold mb-4">The Noeron Solution</h2>
                <p className="text-gray-400 max-w-xl text-lg">
                  We bridge the gap using advanced LLMs to listen, synthesize, and retrieve context instantly.
                </p>
              </div>
              <div className="text-[#FDA92B] flex items-center gap-2 font-medium cursor-pointer group">
                View all features <ChevronRight className="size-5 transition-transform group-hover:translate-x-1" />
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {/* Feature 1 */}
              <div className="bg-[#1a261f]/60 backdrop-blur-xl border border-white/10 p-6 rounded-xl hover:-translate-y-1 transition-transform duration-300">
                <div className="size-10 rounded bg-[#FDA92B]/20 text-[#FDA92B] flex items-center justify-center mb-4">
                  <Zap className="size-5" />
                </div>
                <h3 className="text-lg font-bold mb-2">Real-Time Context</h3>
                <p className="text-sm text-gray-400 leading-relaxed">
                  Definitions and context cards appear instantly as concepts are mentioned in audio.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="bg-[#1a261f]/60 backdrop-blur-xl border border-white/10 p-6 rounded-xl hover:-translate-y-1 transition-transform duration-300">
                <div className="size-10 rounded bg-[#FDA92B]/20 text-[#FDA92B] flex items-center justify-center mb-4">
                  <FileCheck className="size-5" />
                </div>
                <h3 className="text-lg font-bold mb-2">Evidence Synthesis</h3>
                <p className="text-sm text-gray-400 leading-relaxed">
                  Automatically cross-reference spoken claims against a database of 200M+ papers.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="bg-[#1a261f]/60 backdrop-blur-xl border border-white/10 p-6 rounded-xl hover:-translate-y-1 transition-transform duration-300">
                <div className="size-10 rounded bg-[#FDA92B]/20 text-[#FDA92B] flex items-center justify-center mb-4">
                  <Search className="size-5" />
                </div>
                <h3 className="text-lg font-bold mb-2">Progressive Discovery</h3>
                <p className="text-sm text-gray-400 leading-relaxed">
                  Start simple and dive deeper. Click any term to expand into a full literature review.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-20 px-6 md:px-10 lg:px-40 relative overflow-hidden" id="how-it-works">
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1/3 h-full bg-gradient-to-l from-[#FDA92B]/5 to-transparent pointer-events-none" />

          <div className="mx-auto max-w-[960px]">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-16 gap-4">
              <h2 className="text-3xl md:text-4xl font-bold">How it Works</h2>
              <div className="flex flex-wrap gap-3">
                <span className="px-3 py-1 rounded-full border border-white/10 bg-white/5 text-xs text-gray-400 font-mono">
                  Built with Gemini 3
                </span>
                <span className="px-3 py-1 rounded-full border border-white/10 bg-white/5 text-xs text-gray-400 font-mono">
                  Designed with Stitch
                </span>
              </div>
            </div>

            <div className="space-y-12">
              {/* Step 1 */}
              <div className="flex gap-6 items-start">
                <div className="flex flex-col items-center flex-shrink-0">
                  <div className="size-12 rounded-full border-2 border-[#FDA92B] bg-[#102216] flex items-center justify-center">
                    <Headphones className="size-6 text-[#FDA92B]" />
                  </div>
                  <div className="w-0.5 bg-gradient-to-b from-[#FDA92B] to-white/10 h-32 mt-2" />
                </div>
                <div className="pt-2">
                  <h3 className="text-2xl font-bold mb-2">Listen & Ingest</h3>
                  <p className="text-gray-400 text-lg mb-4">
                    Simply upload a podcast audio file or paste a YouTube link. Noeron's ingestion engine transcribes
                    and segments the audio in real-time.
                  </p>
                  <div className="w-full max-w-md h-2 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-[#FDA92B] w-1/3 animate-pulse" />
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex gap-6 items-start">
                <div className="flex flex-col items-center flex-shrink-0">
                  <div className="size-12 rounded-full border-2 border-white/10 bg-[#1a261f] flex items-center justify-center">
                    <Brain className="size-6 text-white" />
                  </div>
                  <div className="w-0.5 bg-white/10 h-32 mt-2" />
                </div>
                <div className="pt-2">
                  <h3 className="text-2xl font-bold mb-2">Research & Synthesize</h3>
                  <p className="text-gray-400 text-lg">
                    Powered by Gemini 1.5 Pro, the system identifies key claims, entities, and research topics, querying
                    academic databases instantly.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex gap-6 items-start">
                <div className="flex flex-col items-center flex-shrink-0">
                  <div className="size-12 rounded-full border-2 border-white/10 bg-[#1a261f] flex items-center justify-center">
                    <Compass className="size-6 text-white" />
                  </div>
                </div>
                <div className="pt-2">
                  <h3 className="text-2xl font-bold mb-2">Explore & Learn</h3>
                  <p className="text-gray-400 text-lg">
                    Navigate the audio with an interactive sidebar. Click on topics to read summaries, view citations,
                    and save to your personal library.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Demo Section */}
        <section className="py-20 px-6 md:px-10 lg:px-40 bg-[#1a261f] border-t border-white/5" id="demo">
          <div className="mx-auto max-w-[960px] text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">See it in Action</h2>
            <p className="text-gray-400 mb-10 max-w-2xl mx-auto">
              Watch how Noeron transforms a 2-hour dense podcast into an interactive learning experience in minutes.
            </p>

            <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black border border-white/10 shadow-2xl group cursor-pointer">
              <img
                src="/images/screen.png"
                alt="Noeron demo video thumbnail"
                className="w-full h-full object-cover opacity-60 group-hover:opacity-40 transition-opacity duration-500"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="size-20 rounded-full bg-[#FDA92B]/90 text-[#102216] flex items-center justify-center hover:scale-110 transition-transform duration-300 shadow-[0_0_40px_rgba(88,61,50,0.5)]">
                  <Play className="size-10 ml-1" />
                </div>
              </div>
              <div className="absolute bottom-4 left-4 px-3 py-1 bg-black/60 backdrop-blur rounded text-xs font-mono">
                02:14 Demo Preview
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-20 px-6 md:px-10 lg:px-40 border-t border-white/5">
          <div className="mx-auto max-w-[960px] text-center">
            <h2 className="text-4xl md:text-5xl font-black tracking-tight">Ready to dive deeper?</h2>
            <p className="text-lg text-gray-400">
              Join the research revolution today. No credit card required for the beta.
            </p>
            <button
              onClick={onGetStarted}
              className="inline-flex h-14 items-center justify-center rounded-lg bg-[#FDA92B] px-8 text-lg font-bold text-[#102216] shadow-[0_0_30px_rgba(88,61,50,0.3)] transition-all hover:scale-105 hover:bg-[#583D32]"
            >
              Get Started for Free
            </button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 bg-[#0a0c0b] px-6 py-12 md:px-10 lg:px-40">
        <div className="mx-auto max-w-[960px]">
          <div className="grid gap-12 md:grid-cols-3">
            {/* Brand Section */}
            <div>
              <div className="mb-4 flex items-center gap-3">
                <div className="flex items-center justify-center size-8 rounded bg-[#FDA92B]/20 text-[#FDA92B]">
                  <Brain className="size-5" />
                </div>
                <span className="font-bold text-xl">Noeron</span>
              </div>
              <p className="text-sm text-gray-500 leading-relaxed">
                An AI Research Companion bridging the gap between casual podcast listening and rigorous academic
                standards.
              </p>
              <div className="mt-4 flex gap-3">
                <a
                  href="#"
                  className="flex size-8 items-center justify-center rounded bg-white/5 text-gray-400 transition-colors hover:bg-[#FDA92B]/20 hover:text-[#FDA92B]"
                >
                  Link 1
                </a>
                <a
                  href="#"
                  className="flex size-8 items-center justify-center rounded bg-white/5 text-gray-400 transition-colors hover:bg-[#FDA92B]/20 hover:text-[#FDA92B]"
                >
                  Link 2
                </a>
              </div>
            </div>

            {/* Product Links */}
            <div>
              <h4 className="font-semibold text-sm mb-3">Product</h4>
              <ul className="space-y-3 text-sm">
                <li>
                  <a href="#features" className="text-gray-400 transition-colors hover:text-[#FDA92B]">
                    Features
                  </a>
                </li>
                <li>
                  <a href="#" className="text-gray-400 transition-colors hover:text-[#FDA92B]">
                    Pricing
                  </a>
                </li>
                <li>
                  <a href="#" className="text-gray-400 transition-colors hover:text-[#FDA92B]">
                    Changelog
                  </a>
                </li>
                <li>
                  <a href="#" className="text-gray-400 transition-colors hover:text-[#FDA92B]">
                    More
                  </a>
                </li>
              </ul>
            </div>

            {/* Company Links */}
            <div>
              <h4 className="font-semibold text-sm mb-3">Company</h4>
              <ul className="space-y-3 text-sm">
                <li>
                  <a href="#" className="text-gray-400 transition-colors hover:text-[#FDA92B]">
                    About
                  </a>
                </li>
                <li>
                  <a href="#" className="text-gray-400 transition-colors hover:text-[#FDA92B]">
                    Blog
                  </a>
                </li>
                <li>
                  <a href="#" className="text-gray-400 transition-colors hover:text-[#FDA92B]">
                    Contact
                  </a>
                </li>
                <li>
                  <a href="#" className="text-gray-400 transition-colors hover:text-[#FDA92B]">
                    Careers
                  </a>
                </li>
              </ul>
            </div>

            {/* Legal Links */}
            <div>
              <h4 className="font-semibold text-sm mb-3">Legal</h4>
              <ul className="space-y-3 text-sm">
                <li>
                  <a href="#" className="text-gray-400 transition-colors hover:text-[#FDA92B]">
                    Privacy
                  </a>
                </li>
                <li>
                  <a href="#" className="text-gray-400 transition-colors hover:text-[#FDA92B]">
                    Terms
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-[960px] mt-12 pt-8 border-t border-white/5 text-center text-sm text-gray-500">
          © 2025 Noeron, Inc. All rights reserved.
        </div>
      </footer>
    </div>
  )
}
