"use client"

import { ArrowLeft, Bookmark, Download, Share2, Quote, Plus, Play, Scissors, Mic, ArrowUp } from "lucide-react"
import { NoeronHeader } from "./noeron-header"

interface PaperViewerProps {
  episode: {
    title: string
    currentTime: number
  }
  onBack: () => void
}

export function PaperViewer({ episode, onBack }: PaperViewerProps) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const tableOfContents = [
    { title: "Abstract", active: false },
    { title: "1. Introduction", active: false },
    { title: "2. Methodology", active: true },
    { title: "3. Results", active: false },
    { title: "4. Conclusion", active: false },
  ]

  return (
    <div className="min-h-screen bg-[#102216] text-white flex flex-col">
      <NoeronHeader />

      {/* Top Navigation Bar */}
      <header className="sticky top-14 z-40 w-full border-b border-[#28392e] bg-[#102216]/95 backdrop-blur-md px-6 py-3">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="flex items-center gap-2 group text-white hover:text-[#FDA92B] transition-colors"
            >
              <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
              <span className="text-sm font-bold uppercase tracking-wider">Back to Exploration</span>
            </button>
            <div className="h-6 w-px bg-[#28392e] mx-2" />
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-full bg-[#FDA92B]/20 flex items-center justify-center text-[#FDA92B]">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </svg>
              </div>
              <h2 className="text-lg font-bold leading-tight tracking-tight hidden sm:block">Paper Viewer</h2>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="hidden md:flex items-center justify-center h-9 px-4 rounded-lg bg-[#28392e] hover:bg-[#364b3d] transition-colors text-sm font-medium gap-2">
              <Bookmark className="w-4 h-4" />
              <span>Save</span>
            </button>
            <button className="flex items-center justify-center h-9 px-4 rounded-lg bg-[#FDA92B] text-[#102216] font-bold hover:bg-[#FDA92B]/90 transition-colors text-sm gap-2">
              <Download className="w-4 h-4" />
              <span>Download PDF</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Layout */}
      <main className="flex-1 max-w-[1400px] mx-auto w-full p-6 lg:p-10 pb-32 gap-10 flex flex-col lg:flex-row">
        {/* Left Column: Paper Content */}
        <article className="flex-1 min-w-0 max-w-4xl mx-auto lg:mx-0">
          {/* Paper Header */}
          <div className="mb-8 border-b border-[#28392e] pb-8">
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="px-2 py-1 rounded text-xs font-bold bg-[#FDA92B]/20 text-[#FDA92B] uppercase tracking-wider border border-[#FDA92B]/30">
                Neuroscience
              </span>
              <span className="px-2 py-1 rounded text-xs font-bold bg-[#28392e] text-gray-300 uppercase tracking-wider">
                Original Research
              </span>
            </div>
            <h1 className="text-3xl md:text-5xl font-black leading-[1.1] tracking-tight mb-6">
              Neural Correlates of Auditory Perception in Complex Environments
            </h1>
            <div className="flex flex-wrap items-center justify-between gap-6">
              <div className="flex flex-col gap-1">
                <p className="text-lg font-medium text-white">Dr. A. Smith, Dr. J. Doe, et al.</p>
                <p className="text-[#FDA92B] text-sm font-normal">Nature Neuroscience • Vol 24 • October 2023</p>
              </div>
              {/* Action Bar */}
              <div className="flex gap-2">
                <button className="flex flex-col items-center gap-1 group">
                  <div className="p-2 rounded-full bg-[#28392e] group-hover:bg-[#FDA92B]/20 transition-colors text-white group-hover:text-[#FDA92B]">
                    <Share2 className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Share</span>
                </button>
                <button className="flex flex-col items-center gap-1 group">
                  <div className="p-2 rounded-full bg-[#28392e] group-hover:bg-[#FDA92B]/20 transition-colors text-white group-hover:text-[#FDA92B]">
                    <Quote className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Cite</span>
                </button>
                <button className="flex flex-col items-center gap-1 group">
                  <div className="p-2 rounded-full bg-[#28392e] group-hover:bg-[#FDA92B]/20 transition-colors text-white group-hover:text-[#FDA92B]">
                    <Plus className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Add</span>
                </button>
              </div>
            </div>
          </div>

          {/* Paper Body */}
          <div className="text-lg space-y-6">
            {/* Abstract */}
            <div className="bg-[#182a1e] p-6 rounded-xl border-l-4 border-[#28392e]">
              <h3 className="text-xl font-bold mb-2 text-white">Abstract</h3>
              <p className="text-gray-300 text-base italic leading-relaxed">
                This study explores the relationship between neural firing patterns and auditory stimuli processing in
                chaotic environments. By utilizing high-density EEG arrays, we mapped the cortical responses of 50
                participants exposed to multi-layered soundscapes. Our findings suggest a distinct filtering mechanism
                in the primary auditory cortex that suppresses background noise while amplifying target frequencies.
              </p>
            </div>

            {/* 1. Introduction */}
            <div>
              <h3 className="text-2xl font-bold mt-10 mb-4 text-white">1. Introduction</h3>
              <p className="text-gray-300 leading-relaxed mb-6">
                The human auditory system possesses a remarkable ability to isolate specific sound sources within
                complex acoustic scenes, a phenomenon often referred to as the "cocktail party effect." While the
                perceptual aspects of this ability are well-documented, the underlying neural mechanisms remain a
                subject of intense debate.
              </p>
              <p className="text-gray-300 leading-relaxed">
                Previous studies have implicated the superior temporal gyrus in phonological processing, yet the
                temporal dynamics of attentional modulation in this region are not fully understood. In this paper, we
                propose a new model for auditory stream segregation based on temporal coherence.
              </p>
            </div>

            {/* 2. Methodology */}
            <div>
              <h3 className="text-2xl font-bold mt-10 mb-4 text-white">2. Methodology</h3>
              <p className="text-gray-300 leading-relaxed mb-6">
                Participants (n=50, age 18-35) were seated in a sound-attenuated chamber. Stimuli consisted of
                synthesized speech mixed with varying levels of babble noise. Neural activity was recorded using a
                128-channel EEG system with a sampling rate of 1000 Hz.
              </p>

              {/* Contextual Highlight Section */}
              <div className="bg-[#FDA92B]/10 border-l-4 border-[#FDA92B] p-6 rounded-r-lg my-8 relative group">
                <div className="absolute -left-[3px] top-4 bg-[#FDA92B] text-[#102216] text-[10px] font-bold px-2 py-0.5 rounded-r uppercase tracking-wider shadow-sm">
                  Mentioned in Podcast (14:20)
                </div>
                <p className="text-white mb-2">
                  <strong className="text-[#FDA92B] block mb-1 text-lg">Key Finding: Gamma Wave Spikes</strong>
                  We observed a significant spike in gamma wave oscillations (30-80 Hz) localized to the auditory cortex
                  precisely 200ms before participants successfully identified a target word in high-noise conditions.
                  This suggests a predictive coding mechanism where the brain "pre-tunes" to expected frequencies.
                </p>
                <div className="flex gap-2 mt-3">
                  <button className="flex items-center gap-1 text-xs font-bold text-[#FDA92B] hover:underline">
                    <Play className="w-4 h-4" />
                    Play Segment
                  </button>
                  <button className="flex items-center gap-1 text-xs font-bold text-gray-400 hover:text-white transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                    Copy Text
                  </button>
                </div>
              </div>
            </div>

            {/* 3. Results and Discussion */}
            <div>
              <h3 className="text-2xl font-bold mt-10 mb-4 text-white">3. Results and Discussion</h3>
              <p className="text-gray-300 leading-relaxed mb-6">
                The data indicates a strong correlation between the amplitude of gamma oscillations and the
                signal-to-noise ratio of the stimulus. Interestingly, this effect was diminished when participants were
                distracted by a visual task, highlighting the critical role of top-down attention.
              </p>
              <p className="text-gray-300 leading-relaxed mb-8">
                Furthermore, functional connectivity analysis revealed strengthened pathways between the frontal lobe
                and the auditory cortex during successful recognition trials. This supports the hypothesis that auditory
                perception is an active, reconstructive process rather than a passive reception of signals.
              </p>

              {/* Simulated Chart */}
              <div className="my-8 p-4 bg-black/20 rounded-lg flex flex-col items-center">
                <div className="w-full h-64 rounded bg-[#0d1a12] flex items-center justify-center relative overflow-hidden border border-[#28392e]">
                  <div className="absolute inset-0 flex items-end px-10 pb-10 gap-2 opacity-60">
                    <div className="w-[8%] h-[20%] bg-[#FDA92B]/30 rounded-t" />
                    <div className="w-[8%] h-[35%] bg-[#FDA92B]/40 rounded-t" />
                    <div className="w-[8%] h-[25%] bg-[#FDA92B]/30 rounded-t" />
                    <div className="w-[8%] h-[50%] bg-[#FDA92B]/60 rounded-t" />
                    <div className="w-[8%] h-[85%] bg-[#FDA92B] rounded-t shadow-[0_0_15px_rgba(88,61,50,0.5)]" />
                    <div className="w-[8%] h-[60%] bg-[#FDA92B]/60 rounded-t" />
                    <div className="w-[8%] h-[30%] bg-[#FDA92B]/30 rounded-t" />
                    <div className="w-[8%] h-[20%] bg-[#FDA92B]/20 rounded-t" />
                  </div>
                </div>
                <p className="text-sm text-gray-500 mt-2 font-mono">
                  Fig 1. Gamma oscillation amplitude during target recognition.
                </p>
              </div>
            </div>

            {/* 4. Conclusion */}
            <div>
              <h3 className="text-2xl font-bold mt-10 mb-4 text-white">4. Conclusion</h3>
              <p className="text-gray-300 leading-relaxed">
                In conclusion, our study provides robust evidence for the role of gamma oscillations in auditory stream
                segregation. Future research should investigate how these mechanisms are altered in individuals with
                auditory processing disorders.
              </p>
            </div>
          </div>
        </article>

        {/* Right Column: Sidebar Context */}
        <aside className="w-full lg:w-80 xl:w-96 flex-shrink-0 flex flex-col gap-6">
          <div className="sticky top-24 space-y-6">
            {/* Podcast Player Card */}
            <div className="bg-[#182a1e] border border-[#28392e] rounded-xl overflow-hidden shadow-2xl">
              <div
                className="relative h-48 bg-cover bg-center"
                style={{
                  backgroundImage:
                    'linear-gradient(0deg, rgba(16, 34, 22, 0.9) 0%, rgba(16, 34, 22, 0) 100%), url("/abstract-sound-waves-visualization-green-neon.jpg")',
                }}
              >
                <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm text-white text-xs font-bold px-2 py-1 rounded flex items-center gap-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
                  </svg>
                  Podcast
                </div>
                <div className="absolute bottom-0 left-0 w-full p-4">
                  <p className="text-[#FDA92B] text-xs font-bold uppercase tracking-wider mb-1">Now Viewing Context</p>
                  <h3 className="text-white text-xl font-bold leading-tight">Neural Spikes & Attention</h3>
                </div>
              </div>
              <div className="p-4 flex flex-col gap-4">
                <div className="flex items-center justify-between text-gray-400 text-sm">
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    {formatTime(episode.currentTime)}
                  </span>
                  <span>Ep. 42 • BrainWaves</span>
                </div>
                <p className="text-gray-300 text-sm leading-snug">
                  Discussion on the "Gamma Wave Spike" mentioned in the methodology section. How prediction shapes our
                  hearing.
                </p>
                {/* Player Controls */}
                <div className="bg-[#111813] rounded-lg p-3 flex items-center gap-3 border border-[#28392e]">
                  <button className="size-10 rounded-full bg-[#FDA92B] flex items-center justify-center text-[#102216] hover:scale-105 transition-transform">
                    <Play className="w-5 h-5 ml-0.5" fill="currentColor" />
                  </button>
                  <div className="flex-1">
                    <div className="h-1 bg-[#28392e] rounded-full w-full overflow-hidden">
                      <div className="h-full bg-[#FDA92B] w-1/3" />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-[10px] text-[#FDA92B] font-mono">{formatTime(episode.currentTime)}</span>
                      <span className="text-[10px] text-gray-500 font-mono">18:45</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Table of Contents */}
            <div className="bg-transparent border border-[#28392e] rounded-xl p-5">
              <h4 className="text-white font-bold text-sm uppercase tracking-wider mb-4 border-b border-[#28392e] pb-2">
                Table of Contents
              </h4>
              <nav className="flex flex-col gap-1">
                {tableOfContents.map((item, index) => (
                  <a
                    key={index}
                    href="#"
                    className={`px-3 py-2 rounded text-sm transition-colors flex items-center justify-between group ${
                      item.active
                        ? "text-white bg-[#28392e] font-medium border-l-2 border-[#FDA92B]"
                        : "text-gray-400 hover:text-white hover:bg-[#28392e]"
                    }`}
                  >
                    {item.title}
                    {item.active ? (
                      <svg className="w-4 h-4 text-[#FDA92B]" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M3 22v-20l18 10-18 10z" />
                      </svg>
                    ) : (
                      <svg
                        className="w-4 h-4 opacity-0 group-hover:opacity-100 text-[#FDA92B]"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    )}
                  </a>
                ))}
              </nav>
            </div>

            {/* Citations Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#182a1e] p-3 rounded-lg text-center border border-[#28392e]">
                <span className="block text-2xl font-bold text-white">245</span>
                <span className="text-xs text-gray-400 uppercase font-bold">Citations</span>
              </div>
              <div className="bg-[#182a1e] p-3 rounded-lg text-center border border-[#28392e]">
                <span className="block text-2xl font-bold text-white">4.8</span>
                <span className="text-xs text-gray-400 uppercase font-bold">Impact Factor</span>
              </div>
            </div>
          </div>
        </aside>
      </main>

      {/* Sticky Chat Box Footer */}
      <footer className="fixed bottom-0 left-0 right-0 z-50 bg-[#102216]/95 backdrop-blur-lg border-t border-[#28392e] px-6 py-4">
        <div className="max-w-[1400px] mx-auto">
          <div className="flex items-center gap-3 bg-[#1a261f] rounded-xl border border-[#28392e] p-3 focus-within:border-[#FDA92B] transition-colors">
            <button className="p-2 rounded-lg bg-[#28392e] hover:bg-[#364b3d] transition-colors text-white">
              <Scissors className="w-4 h-4" />
            </button>
            <input
              type="text"
              placeholder="Ask AI about this paper..."
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
