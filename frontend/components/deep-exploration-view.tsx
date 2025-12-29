"use client"

import { useState } from "react"
import {
  ArrowLeft,
  Quote,
  Sparkles,
  HelpCircle,
  TrendingUp,
  FlaskConical,
  ChevronLeft,
  ChevronRight,
  Plus,
  ExternalLink,
  GitBranch,
  Scissors,
  Mic,
  ArrowUp,
} from "lucide-react"
import { NoeronHeader } from "./noeron-header"

interface DeepExplorationViewProps {
  episode: {
    title: string
    host: string
    category: string
    currentTime: number
  }
  claim: {
    title: string
    timestamp: number
    description: string
    source: string
  }
  onBack: () => void
  onViewSourcePaper: () => void // Added prop for onClick handler
}

export function DeepExplorationView({ episode, claim, onBack, onViewSourcePaper }: DeepExplorationViewProps) {
  const [synthesisMode, setSynthesisMode] = useState<"simplified" | "technical" | "raw">("technical")

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const evidenceThreads = [
    {
      type: "primary",
      title: "Brownlee et al., Nature (2001)",
      description: "The foundational paper linking hyperglycemia to superoxide overproduction.",
      highlighted: true,
    },
    {
      type: "replication",
      title: "Ceriello et al. (2018)",
      description: "Confirmed ROS accumulation in human endothelial cells.",
      highlighted: false,
    },
    {
      type: "counter",
      title: "Smith & Jones (2020)",
      description: "Proposed alternative pathway independent of ROS in neurons.",
      highlighted: false,
    },
  ]

  const relatedConcepts = [
    {
      title: "Krebs Cycle",
      description: "The sequence of reactions by which most living cells generate energy.",
      icon: FlaskConical,
      image: "/chemical-reaction-cycle-diagram-abstract.jpg",
    },
    {
      title: "Reactive Oxygen Species",
      description: "A type of unstable molecule that contains oxygen and that easily reacts with other molecules.",
      icon: FlaskConical,
      image: "/microscope-cell-view-molecular-structure.jpg",
    },
    {
      title: "Electron Transport Chain",
      description: "A series of protein complexes that couple redox reactions.",
      icon: FlaskConical,
      image: "/molecular-structure-protein-complex-3d.jpg",
    },
  ]

  const guidedPrompts = [
    { icon: HelpCircle, text: "What is the specific mechanism of Complex I inhibition?" },
    { icon: TrendingUp, text: "Show me the glucose vs. efficiency graph" },
    { icon: FlaskConical, text: "Are there mitigating compounds?" },
  ]

  return (
    <div className="min-h-screen bg-[#102216] text-white flex flex-col">
      {/* Noeron Header */}
      <NoeronHeader />

      {/* Header */}
      <header className="sticky top-14 z-40 flex items-center justify-between border-b border-[#28392e] bg-[#102216]/95 backdrop-blur-sm px-6 py-3 lg:px-10">
        <div className="flex items-center gap-4">
          <div className="size-6 text-[#FDA92B]">
            <FlaskConical className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold leading-tight">{episode.title}</h2>
            <p className="text-xs text-gray-400">Episode 42 • {episode.category}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-3 bg-[#182d21] py-1.5 px-3 rounded-lg border border-[#28392e]">
            <div className="size-2 rounded-full bg-[#FDA92B] animate-pulse" />
            <span className="text-xs font-medium text-gray-300">Paused at {formatTime(episode.currentTime)}</span>
          </div>
          <button
            onClick={onBack}
            className="flex items-center justify-center gap-2 rounded-lg h-9 px-4 bg-[#FDA92B] hover:bg-[#FDA92B]/90 transition-colors text-[#111813] text-sm font-bold shadow-[0_0_10px_rgba(88,61,50,0.2)]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back to Podcast</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-[1280px] mx-auto px-4 md:px-10 py-8 pb-32 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Core Exploration */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* Anchor Claim */}
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#182d21] to-[#102216] border border-[#28392e] shadow-lg">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Quote className="w-36 h-36" />
            </div>
            <div className="p-6 md:p-8 relative z-10">
              <div className="flex items-center gap-2 mb-4">
                <span className="px-2 py-1 rounded bg-red-500/20 text-red-400 text-xs font-bold uppercase tracking-wider border border-red-500/30">
                  Anchor Claim
                </span>
                <span className="text-xs text-gray-400">Triggered at {formatTime(claim.timestamp)}</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold leading-tight mb-4">"{claim.title}"</h1>
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-gray-700" />
                <p className="text-sm font-medium text-gray-300">
                  {episode.host} • <span className="text-gray-500">Host</span>
                </p>
              </div>
            </div>
          </div>

          {/* Synthesis Section */}
          <div className="bg-[#111813] border border-[#28392e] rounded-xl p-6 md:p-8 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#FDA92B]" />
                Synthesis
              </h3>

              {/* Segmented Control */}
              <div className="flex p-1 bg-[#1e2e24] rounded-lg">
                <button
                  onClick={() => setSynthesisMode("simplified")}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    synthesisMode === "simplified"
                      ? "bg-[#102216] text-white shadow-sm"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  Simplified
                </button>
                <button
                  onClick={() => setSynthesisMode("technical")}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    synthesisMode === "technical"
                      ? "bg-[#102216] text-white shadow-sm"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  Technical
                </button>
                <button
                  onClick={() => setSynthesisMode("raw")}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    synthesisMode === "raw" ? "bg-[#102216] text-white shadow-sm" : "text-gray-400 hover:text-white"
                  }`}
                >
                  Raw Data
                </button>
              </div>
            </div>

            <div className="space-y-4 text-gray-300 leading-relaxed">
              <p>
                At a technical level, the claim refers to the inhibition of the{" "}
                <span className="text-[#FDA92B] border-b border-[#FDA92B]/30 cursor-help">
                  Electron Transport Chain
                </span>{" "}
                (ETC), specifically complexes I and III.
              </p>
              <p>
                Recent analysis suggests that sustained hyperglycemic spikes lead to an accumulation of{" "}
                <strong className="text-white">Reactive Oxygen Species (ROS)</strong>. This oxidative stress damages the
                inner mitochondrial membrane, increasing proton leak and decoupling respiration from ATP synthesis.
              </p>
              <div className="bg-[#1e2e24] border-l-4 border-[#FDA92B] p-4 rounded-r-lg my-6">
                <p className="text-sm italic">
                  "Think of it like a car engine running too rich—fuel (sugar) is abundant, but the combustion process
                  becomes dirty, clogging the engine (mitochondria) with soot (ROS)."
                </p>
              </div>
              <p>
                Data from the 2023 Meta-Analysis indicates a non-linear correlation: efficiency remains stable up to
                120mg/dL glucose, then precipitates rapidly.
              </p>
            </div>
          </div>

          {/* Guided Prompts */}
          <div>
            <h4 className="text-sm uppercase tracking-wider text-gray-500 font-semibold mb-3">
              Deepen Your Understanding
            </h4>
            <div className="flex flex-wrap gap-3">
              {guidedPrompts.map((prompt, index) => {
                const Icon = prompt.icon
                return (
                  <button
                    key={index}
                    className="flex items-center gap-2 bg-[#1e2e24] hover:bg-[#28392e] text-[#FDA92B] hover:text-white border border-[#28392e] px-4 py-2.5 rounded-full text-sm font-medium transition-all group"
                  >
                    <Icon className="w-4 h-4" />
                    {prompt.text}
                    <ExternalLink className="w-4 h-4 opacity-0 group-hover:opacity-100 -ml-2 group-hover:ml-0 transition-all" />
                  </button>
                )
              })}
            </div>
          </div>

          {/* Related Concepts Carousel */}
          <div className="pt-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-bold text-lg">Related Concepts</h4>
              <div className="flex gap-2">
                <button className="size-8 rounded-full bg-[#1e2e24] flex items-center justify-center hover:bg-[#FDA92B] hover:text-[#102216] transition-colors">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button className="size-8 rounded-full bg-[#1e2e24] flex items-center justify-center hover:bg-[#FDA92B] hover:text-[#102216] transition-colors">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex overflow-x-auto gap-4 pb-4 snap-x scrollbar-hide">
              {relatedConcepts.map((concept, index) => {
                const Icon = concept.icon
                return (
                  <div
                    key={index}
                    className="snap-start min-w-[240px] w-[240px] h-[300px] rounded-xl relative group cursor-pointer overflow-hidden border border-[#28392e]"
                    style={{
                      backgroundImage: `linear-gradient(to top, rgba(16, 34, 22, 0.95), rgba(16, 34, 22, 0.3)), url('${concept.image}')`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  >
                    <div className="absolute inset-0 bg-[#FDA92B]/0 group-hover:bg-[#FDA92B]/10 transition-colors" />
                    <div className="absolute bottom-0 left-0 p-4 w-full">
                      <div className="mb-2 size-8 rounded bg-[#FDA92B]/20 flex items-center justify-center text-[#FDA92B] backdrop-blur-sm">
                        <Icon className="w-5 h-5" />
                      </div>
                      <h5 className="font-bold text-lg leading-tight mb-1">{concept.title}</h5>
                      <p className="text-gray-400 text-xs line-clamp-2">{concept.description}</p>
                    </div>
                  </div>
                )
              })}
              {/* Add More Card */}
              <div className="snap-start min-w-[240px] w-[240px] h-[300px] bg-[#1e2e24] rounded-xl relative group cursor-pointer overflow-hidden border border-[#28392e] flex flex-col justify-center items-center text-center p-6">
                <div className="size-12 rounded-full bg-[#FDA92B]/10 flex items-center justify-center text-[#FDA92B] mb-4 group-hover:scale-110 transition-transform">
                  <Plus className="w-6 h-6" />
                </div>
                <h5 className="font-bold text-lg">Explore All Concepts</h5>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Evidence & Actions */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* Evidence Threads */}
          <div className="bg-[#111813] border border-[#28392e] rounded-xl p-5 h-fit">
            <div className="flex items-center gap-2 mb-4">
              <GitBranch className="w-5 h-5 text-[#FDA92B]" />
              <h3 className="font-bold text-lg">Evidence Threads</h3>
            </div>
            <div className="relative pl-2 border-l border-[#28392e] ml-2 space-y-6">
              {evidenceThreads.map((thread, index) => (
                <div
                  key={index}
                  className={`relative pl-6 group cursor-pointer ${thread.highlighted ? "" : "opacity-70 hover:opacity-100"} transition-opacity`}
                >
                  {thread.highlighted ? (
                    <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-[#FDA92B] border-4 border-[#102216] shadow-[0_0_0_1px_#FDA92B]" />
                  ) : (
                    <div className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-[#3d5646]" />
                  )}
                  <p className="text-[10px] font-mono text-[#FDA92B] mb-1 tracking-wider uppercase">
                    {thread.type === "primary"
                      ? "Primary Source"
                      : thread.type === "replication"
                        ? "Replication"
                        : "Counter-Evidence"}
                  </p>
                  <h4 className="font-medium text-sm mb-1 group-hover:text-[#FDA92B] transition-colors">
                    {thread.title}
                  </h4>
                  <p className="text-gray-400 text-xs">{thread.description}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 pt-4 border-t border-[#28392e]">
              <button className="w-full py-2 flex items-center justify-center gap-2 text-xs font-medium text-gray-400 hover:text-white transition-colors">
                <span>View Full Citation Map</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Source Material Card */}
          <div className="bg-gradient-to-br from-[#182d21] to-[#111813] border border-[#28392e] rounded-xl p-5">
            <div className="flex items-start gap-4 mb-4">
              <div className="size-10 rounded bg-white/5 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <div>
                <h4 className="font-bold text-sm">Source Material</h4>
                <p className="text-gray-400 text-xs mt-1">Access the original PDF cited in this segment.</p>
              </div>
            </div>
            <button
              onClick={onViewSourcePaper}
              className="w-full flex items-center justify-center gap-2 bg-[#FDA92B] hover:bg-[#FDA92B]/90 text-[#111813] font-bold py-3 px-4 rounded-lg transition-all shadow-[0_4px_14px_rgba(88,61,50,0.2)]"
            >
              <span>View Source Paper</span>
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#111813] p-3 rounded-lg border border-[#28392e]">
              <p className="text-gray-500 text-[10px] uppercase font-bold tracking-wider mb-1">Confidence</p>
              <p className="text-lg font-bold flex items-center gap-1">
                High
                <span className="size-2 rounded-full bg-green-500 inline-block" />
              </p>
            </div>
            <div className="bg-[#111813] p-3 rounded-lg border border-[#28392e]">
              <p className="text-gray-500 text-[10px] uppercase font-bold tracking-wider mb-1">Consensus</p>
              <p className="text-lg font-bold">85%</p>
            </div>
          </div>
        </div>
      </main>

      {/* Sticky Chat Box Footer */}
      <footer className="fixed bottom-0 left-0 right-0 z-50 bg-[#102216]/95 backdrop-blur-lg border-t border-[#28392e] px-6 py-4">
        <div className="max-w-[1280px] mx-auto">
          <div className="flex items-center gap-3 bg-[#1a261f] rounded-xl border border-[#28392e] p-3 focus-within:border-[#FDA92B] transition-colors">
            <button className="p-2 rounded-lg bg-[#28392e] hover:bg-[#364b3d] transition-colors text-white">
              <Scissors className="w-4 h-4" />
            </button>
            <input
              type="text"
              placeholder="Ask AI about this segment..."
              className="flex-1 bg-transparent text-white placeholder-gray-500 focus:outline-none text-sm"
            />
            <button className="p-2 rounded-lg bg-transparent hover:bg-[#28392e] transition-colors text-gray-400 hover:text-white">
              <Mic className="w-4 h-4" />
            </button>
            <button className="p-2 rounded-full bg-[#FDA92B] hover:bg-[#FDA92B]/90 transition-colors text-[#102216]">
              <ArrowUp className="w-4 h-4" />
            </button>
          </div>
        </div>
      </footer>
    </div>
  )
}
