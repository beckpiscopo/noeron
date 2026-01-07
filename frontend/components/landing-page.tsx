"use client"

import { useState, useEffect, useCallback } from "react"
import { Play } from "lucide-react"

interface LandingPageProps {
  onGetStarted: () => void
}

export function LandingPage({ onGetStarted }: LandingPageProps) {
  const [currentSection, setCurrentSection] = useState(0)
  const totalSections = 8

  const goToSection = useCallback((index: number) => {
    if (index < 0 || index >= totalSections) return
    setCurrentSection(index)
  }, [totalSections])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        goToSection(currentSection + 1)
      } else if (e.key === "ArrowLeft") {
        goToSection(currentSection - 1)
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [currentSection, goToSection])

  // Touch swipe support
  useEffect(() => {
    let touchStartX = 0
    let touchEndX = 0

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX = e.changedTouches[0].screenX
    }

    const handleTouchEnd = (e: TouchEvent) => {
      touchEndX = e.changedTouches[0].screenX
      if (touchStartX - touchEndX > 50) {
        goToSection(currentSection + 1)
      }
      if (touchEndX - touchStartX > 50) {
        goToSection(currentSection - 1)
      }
    }

    document.addEventListener("touchstart", handleTouchStart)
    document.addEventListener("touchend", handleTouchEnd)
    return () => {
      document.removeEventListener("touchstart", handleTouchStart)
      document.removeEventListener("touchend", handleTouchEnd)
    }
  }, [currentSection, goToSection])

  return (
    <div className="noeron-theme bg-[var(--carbon-black)] text-[var(--parchment)] overflow-hidden h-screen">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 px-6 md:px-[60px] py-5 flex justify-between items-center z-[1000] backdrop-blur-[10px] bg-[var(--carbon-black)] border-b border-[var(--parchment)]/10">
        <div className="display text-lg font-medium tracking-[2px] text-[var(--parchment)]">
          NOERON
        </div>
        <button
          onClick={() => goToSection(5)}
          className="btn-noeron-secondary !py-2.5 !px-6 !text-sm"
        >
          Access Demo →
        </button>
      </nav>

      {/* Slider Container */}
      <div
        className="fixed top-0 left-0 w-full h-screen flex transition-transform duration-[800ms] ease-[cubic-bezier(0.65,0,0.35,1)]"
        style={{ transform: `translateX(-${currentSection * 100}vw)` }}
      >

{/* Section 1: Hero */}
      <section className="min-w-[100vw] h-screen flex flex-col justify-center items-center px-6 md:px-[60px] py-[100px] pb-[120px] relative overflow-hidden bg-[var(--carbon-black)]">
          {/* Layered background effects */}
          <div className="blueprint-pattern opacity-[0.15]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--carbon-black)_0%,_#000000_100%)] opacity-40" />

          {/* Subtle vignette */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_0%,_rgba(0,0,0,0.3)_100%)]" />

          <div className="max-w-[1200px] w-full relative z-10 text-center">
            {/* Improved tagline with geometric lines */}
            <div className="flex items-center justify-center gap-4 mb-12 animate-fade-in">
              <div className="h-[1px] w-16 bg-gradient-to-r from-transparent to-[var(--golden-chestnut)]" />
              <span className="eyebrow tracking-[0.2em] text-[var(--golden-chestnut)]">
                EPISTEMOLOGICAL INFRASTRUCTURE
              </span>
              <div className="h-[1px] w-16 bg-gradient-to-l from-transparent to-[var(--golden-chestnut)]" />
            </div>

            <h1 className="text-[clamp(4rem,12vw,9rem)] font-normal tracking-[-2px] mb-10 text-[var(--parchment)] leading-[0.95] animate-fade-in-up" style={{ fontFamily: "'Russo One', sans-serif", animationDelay: "0.1s" }}>
              Noeron
            </h1>

            <div className="animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
              <p className="text-xl md:text-2xl font-light leading-relaxed text-[var(--parchment)] mb-3">
                The <i>knowledge layer</i> for podcasts.
              </p>
              <p className="text-base md:text-lg font-light leading-relaxed text-[var(--parchment)]/70 mb-12">
              Real-time synchronization between conversation and research.
              </p>
            </div>

            {/* Enhanced loading animation with progress bar */}
            <div className="mono text-xs leading-[1.8] mb-4 max-w-[450px] mx-auto animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
              <div className="animate-typing text-[var(--golden-chestnut)]/80 mb-1">
                // PARSING AUDIO STREAMS
              </div>
              <div className="animate-typing text-[var(--golden-chestnut)]/80 mb-1" style={{ animationDelay: "0.4s" }}>
                // VERIFYING FACTS WITH GEMINI 3
              </div>
              <div className="animate-typing text-[var(--golden-chestnut)]/80 flex items-center justify-center gap-2" style={{ animationDelay: "0.7s" }}>
                // GENERATING KNOWLEDGE GRAPH...
                <span className="animate-pulse inline-block w-2 h-3 bg-[var(--golden-chestnut)]" />
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full max-w-[400px] mx-auto h-1 bg-[var(--parchment)]/10 rounded-full mb-16 overflow-hidden animate-fade-in-up" style={{ animationDelay: ".4s" }}>
              <div className="h-full bg-gradient-to-r from-[var(--golden-chestnut)] to-[var(--golden-chestnut)]/70 animate-progress rounded-full shadow-[0_0_12px_rgba(253,169,43,0.4)]" />
            </div>

            {/* Improved buttons with better hover states */}
            <div className="flex gap-5 justify-center flex-wrap animate-fade-in-up" style={{ animationDelay: "0.5s" }}>
              <button 
                onClick={onGetStarted} 
                className="btn-noeron btn-noeron-primary group relative overflow-hidden"
              >
                <span className="relative z-10">Try Live Demo</span>
                <div className="absolute inset-0 bg-gradient-to-r from-[var(--golden-chestnut)]/0 via-[var(--golden-chestnut)]/10 to-[var(--golden-chestnut)]/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
              </button>
              <button className="btn-noeron btn-noeron-secondary flex items-center gap-2.5 group">
                <Play className="w-3 h-3 fill-current group-hover:scale-110 transition-transform" />
                <span>Demo Video</span>
                <span className="mono text-xs opacity-60">3M</span>
              </button>
            </div>
          </div>

        </section>

        {/* Section 2: The Problem */}
        <section className="min-w-[100vw] h-screen flex flex-col justify-start items-center px-6 md:px-[60px] pt-[120px] pb-[80px] relative overflow-y-auto bg-[var(--carbon-black)]">
          <div className="blueprint-pattern opacity-[0.08]" />
          <div className="max-w-[1200px] w-full relative z-10">
            {/* Header row */}
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="mono text-xs tracking-[0.15em] text-[var(--golden-chestnut)] mb-3">
                  SEC. 02 // SYSTEM DIAGNOSTICS
                </div>
                <h2 className="display text-4xl md:text-5xl font-normal tracking-[-0.5px]">THE PROBLEM</h2>
              </div>
              <div className="text-right mono text-xs text-[var(--parchment)]/60 leading-relaxed hidden md:block">
                <div>STATUS: <span className="text-[var(--parchment)]">CRITICAL</span></div>
                <div>ERR_CODE: <span className="text-[var(--parchment)]">404_VERACITY</span></div>
              </div>
            </div>

            {/* Main content grid */}
            <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-12 mt-10 items-start">
              {/* Left column */}
              <div>
                <h3 className="text-2xl md:text-3xl font-normal mb-6 leading-tight">
                  The Information Gap in <span className="text-[var(--golden-chestnut)]">Audio Media</span>
                </h3>

                <p className="text-base leading-[1.8] text-[var(--parchment)]/85 mb-8 border-l-2 border-[var(--parchment)]/20 pl-5">
                  While podcast consumption is at an all-time high, the bridge between spoken assertions and verifiable facts remains nonexistent. Listeners are passive consumers of unverified data streams, creating a critical vulnerability in global information architecture.
                </p>

                {/* Stats box */}
                <div className="bg-[#2a2b2d] border border-[var(--parchment)]/10 p-6 mb-8">
                  <div className="grid grid-cols-2 divide-x divide-[var(--parchment)]/10">
                    <div className="pr-6">
                      <div className="flex items-center gap-2 mb-2">
                        <svg className="w-4 h-4 text-[var(--parchment)]/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M9 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="mono text-xs tracking-[0.1em] text-[var(--parchment)]/60 uppercase">Monthly Listeners</span>
                      </div>
                      <div className="mono text-3xl font-medium text-[var(--parchment)] mb-1">150M+</div>
                      <div className="mono text-xs text-[var(--parchment)]/50 uppercase">Source: Global Audio Data</div>
                    </div>
                    <div className="pl-6">
                      <div className="flex items-center gap-2 mb-2">
                        <svg className="w-4 h-4 text-[var(--parchment)]/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="mono text-xs tracking-[0.1em] text-[var(--parchment)]/60 uppercase">Real-Time Verification</span>
                      </div>
                      <div className="mono text-3xl font-medium text-[var(--golden-chestnut)] mb-1">0.0%</div>
                      <div className="mono text-xs text-[var(--parchment)]/50 uppercase">Status: System Failure</div>
                    </div>
                  </div>
                </div>

                {/* Diagnostic Report */}
                <div className="mono text-xs tracking-[0.15em] text-[var(--parchment)]/50 uppercase mb-4">
                  Diagnostic Report // Failure Points
                </div>

                <div className="space-y-5">
                  <div>
                    <div className="flex items-baseline gap-3 mb-1">
                      <span className="mono text-sm text-[var(--golden-chestnut)]">01</span>
                      <span className="font-medium text-[var(--parchment)]">Citation Void</span>
                    </div>
                    <p className="text-base leading-relaxed text-[var(--parchment)]/70 ml-7">
                      Unlike academic papers or journalism, audio content lacks immediate, clickable citations, leaving claims stranded without proof.
                    </p>
                  </div>
                  <div>
                    <div className="flex items-baseline gap-3 mb-1">
                      <span className="mono text-sm text-[var(--golden-chestnut)]">02</span>
                      <span className="font-medium text-[var(--parchment)]">Hallucination Risk</span>
                    </div>
                    <p className="text-base leading-relaxed text-[var(--parchment)]/70 ml-7">
                      Without real-time grounding, AI transcription and summary tools amplify errors rather than correcting them.
                    </p>
                  </div>
                  <div>
                    <div className="flex items-baseline gap-3 mb-1">
                      <span className="mono text-sm text-[var(--golden-chestnut)]">03</span>
                      <span className="font-medium text-[var(--parchment)]">Ephemeral Context</span>
                    </div>
                    <p className="text-base leading-relaxed text-[var(--parchment)]/70 ml-7">
                      Context is lost the moment audio is played. Historical data and counter-arguments are inaccessible during playback.
                    </p>
                  </div>
                </div>
              </div>

              {/* Right column - Signal Loss Diagram */}
              <div className="border border-[var(--parchment)]/10 bg-[#232426] p-6 relative hidden lg:block">
                <div className="mono text-xs tracking-[0.15em] text-[var(--golden-chestnut)] mb-6">
                  FIG 1.1 // SIGNAL LOSS
                </div>

                {/* Diagram container */}
                <div className="relative h-[380px]">
                  {/* Grid lines */}
                  <div className="absolute inset-0 opacity-20">
                    <div className="w-full h-full" style={{
                      backgroundImage: 'linear-gradient(to right, var(--parchment) 1px, transparent 1px), linear-gradient(to bottom, var(--parchment) 1px, transparent 1px)',
                      backgroundSize: '40px 40px'
                    }} />
                  </div>

                  {/* Audio Input box */}
                  <div className="absolute top-4 left-1/2 -translate-x-1/2">
                    <div className="w-16 h-16 border border-[var(--parchment)]/30 bg-[var(--carbon-black)] flex items-center justify-center">
                      <svg className="w-6 h-6 text-[var(--golden-chestnut)]" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                        <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                      </svg>
                    </div>
                    <div className="mono text-xs text-center mt-2 text-[var(--parchment)]/70 uppercase tracking-wider">Audio Input</div>
                    {/* RAW_DATA label */}
                    <div className="absolute -right-20 top-1/2 -translate-y-1/2 flex items-center gap-2">
                      <div className="w-8 h-[1px] bg-[var(--parchment)]/30" />
                      <span className="mono text-sm text-[var(--golden-chestnut)]">RAW_DATA</span>
                    </div>
                  </div>

                  {/* Disconnected label */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                    <div className="border border-[var(--golden-chestnut)] px-3 py-1 bg-[var(--carbon-black)]">
                      <span className="mono text-xs text-[var(--golden-chestnut)] tracking-wider">DISCONNECTED</span>
                    </div>
                  </div>

                  {/* Dashed connection lines */}
                  <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
                    <line x1="50%" y1="100" x2="50%" y2="160" stroke="var(--parchment)" strokeOpacity="0.2" strokeDasharray="4 4" />
                    <line x1="50%" y1="200" x2="50%" y2="280" stroke="var(--parchment)" strokeOpacity="0.2" strokeDasharray="4 4" />
                  </svg>

                  {/* Truth Layer box */}
                  <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
                    <div className="w-16 h-16 border border-dashed border-[var(--parchment)]/30 bg-[var(--carbon-black)] flex items-center justify-center">
                      <svg className="w-5 h-5 text-[var(--parchment)]/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="mono text-xs text-center mt-2 text-[var(--parchment)]/50 uppercase tracking-wider">Truth Layer</div>
                  </div>

                  {/* Scale indicator */}
                  <div className="absolute bottom-0 right-0 mono text-sm text-[var(--parchment)]/40">
                    SCALE 1:1
                  </div>

                  {/* Corner markers */}
                  <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-[var(--parchment)]/30" />
                  <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-[var(--parchment)]/30" />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-between items-center mt-10 pt-6 border-t border-[var(--parchment)]/10">
              <div className="mono text-sm text-[var(--parchment)]/40 uppercase tracking-wider">
                Noeron Systems // Div. 02
              </div>
              <div className="mono text-sm text-[var(--parchment)]/40 uppercase tracking-wider">
                Gemini 3 Hackathon Build
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: How It Works */}
        <section className="min-w-[100vw] h-screen flex flex-col justify-start items-center px-6 md:px-[60px] pt-[120px] pb-[80px] relative overflow-y-auto bg-[var(--carbon-black)]">
          <div className="blueprint-pattern opacity-[0.08]" />
          <div className="max-w-[1200px] w-full relative z-10">
            {/* Header row */}
            <div className="flex justify-between items-start mb-8">
              <div>
                <div className="mono text-xs tracking-[0.15em] text-[var(--golden-chestnut)] mb-3">
                  SEC. 03 // SYSTEM ARCHITECTURE
                </div>
                <h2 className="display text-4xl md:text-5xl font-normal tracking-[-0.5px]">HOW IT WORKS</h2>
              </div>
              <div className="text-right mono text-xs text-[var(--parchment)]/60 leading-relaxed hidden md:block">
                <div>MODE: <span className="text-[var(--parchment)]">REAL-TIME</span></div>
                <div>LATENCY: <span className="text-[var(--golden-chestnut)]">&lt; 3s</span></div>
              </div>
            </div>

            {/* Pipeline visualization */}
            <div className="relative mt-12">
              {/* Connection line - desktop */}
              <div className="hidden md:block absolute top-[60px] left-[16.66%] right-[16.66%] h-[2px]">
                <div className="w-full h-full bg-gradient-to-r from-[var(--golden-chestnut)]/60 via-[var(--golden-chestnut)] to-[var(--golden-chestnut)]/60" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-[33%] w-full justify-center">
                  <div className="w-2 h-2 rotate-45 bg-[var(--golden-chestnut)] border border-[var(--golden-chestnut)]" />
                  <div className="w-2 h-2 rotate-45 bg-[var(--golden-chestnut)] border border-[var(--golden-chestnut)]" />
                </div>
              </div>

              {/* Pipeline nodes */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {[
                  {
                    num: "01",
                    title: "LISTEN",
                    subtitle: "Audio Ingestion",
                    benefit: "Podcast plays naturally while we process every word in real-time",
                    specs: [
                      { label: "INPUT", value: "Audio Stream" },
                      { label: "ENGINE", value: "AssemblyAI" },
                      { label: "OUTPUT", value: "Timestamped Transcript" },
                    ],
                    icon: (
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                        <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                      </svg>
                    ),
                  },
                  {
                    num: "02",
                    title: "DETECT",
                    subtitle: "Claim Extraction",
                    benefit: "AI identifies scientific assertions and maps them to verifiable sources",
                    specs: [
                      { label: "MODEL", value: "Gemini 2.5 Pro" },
                      { label: "CORPUS", value: "500+ Papers" },
                      { label: "METHOD", value: "Semantic Search" },
                    ],
                    icon: (
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    ),
                  },
                  {
                    num: "03",
                    title: "VERIFY",
                    subtitle: "Evidence Synthesis",
                    benefit: "Research surfaces synchronized with the conversation, fully contextualized",
                    specs: [
                      { label: "SYNC", value: "Real-time" },
                      { label: "VISUAL", value: "Knowledge Graph" },
                      { label: "DEPTH", value: "Cross-Episode" },
                    ],
                    icon: (
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    ),
                  },
                ].map((step, index) => (
                  <div key={step.num} className="relative">
                    {/* Node circle */}
                    <div className="flex justify-center mb-6">
                      <div className="w-[120px] h-[120px] rounded-full border-2 border-[var(--golden-chestnut)] bg-[var(--carbon-black)] flex items-center justify-center relative">
                        <div className="absolute inset-2 rounded-full border border-[var(--parchment)]/10" />
                        <div className="text-[var(--golden-chestnut)]">
                          {step.icon}
                        </div>
                        {/* Step number badge */}
                        <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-[var(--golden-chestnut)] flex items-center justify-center">
                          <span className="mono text-xs font-bold text-[var(--carbon-black)]">{step.num}</span>
                        </div>
                      </div>
                    </div>

                    {/* Content card */}
                    <div className="border border-[var(--parchment)]/10 bg-[#1d1e20] p-6">
                      <div className="text-center mb-4">
                        <div className="display text-xl text-[var(--parchment)] mb-1">{step.title}</div>
                        <div className="mono text-xs tracking-[0.1em] text-[var(--golden-chestnut)] uppercase">{step.subtitle}</div>
                      </div>

                      <p className="text-base leading-relaxed text-[var(--parchment)]/80 text-center mb-5 min-h-[48px]">
                        {step.benefit}
                      </p>

                      {/* Technical specs */}
                      <div className="border-t border-[var(--parchment)]/10 pt-4 space-y-2">
                        {step.specs.map((spec) => (
                          <div key={spec.label} className="flex justify-between items-center">
                            <span className="mono text-sm tracking-[0.1em] text-[var(--parchment)]/50 uppercase">{spec.label}</span>
                            <span className="mono text-sm text-[var(--parchment)]">{spec.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Mobile connector */}
                    {index < 2 && (
                      <div className="md:hidden flex justify-center my-4">
                        <div className="w-[2px] h-8 bg-gradient-to-b from-[var(--golden-chestnut)] to-[var(--golden-chestnut)]/30" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

          </div>
        </section>

        {/* Section 4: Gemini 3 Integration */}
        <section className="min-w-[100vw] h-screen flex flex-col justify-center items-center px-6 md:px-[60px] py-[100px] pb-[120px] relative overflow-y-auto bg-[var(--carbon-black)]">
          <div className="blueprint-pattern" />
          <div className="max-w-[1200px] w-full relative z-10">
            <h2 className="display text-4xl md:text-5xl font-normal mb-10 tracking-[-0.5px]">POWERED BY GEMINI 3</h2>
            <p className="text-lg leading-[1.7] text-[var(--parchment)]/90 text-center max-w-[700px] mx-auto mb-10">
              Not just citations. Living research.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-[60px] mt-[60px]">
              <div className="p-10">
                <div className="display text-xl mb-8 pb-4 border-b border-[var(--parchment)]/20">TRADITIONAL APPROACH</div>
                <div className="text-lg leading-[1.7] text-[var(--parchment)]/90">
                  Static PDF links<br />
                  Disconnected information<br />
                  No visual context<br />
                  "Figure 3" means nothing
                </div>
              </div>
              <div className="p-10">
                <div className="display text-xl mb-8 pb-4 border-b border-[var(--parchment)]/20">NOERON + GEMINI 3</div>
                <ul className="list-none">
                  {[
                    "Real-time BETSE bioelectric simulations",
                    "Interactive voltage gradient visualizations",
                    "Dynamic morphology calculators",
                    "Cross-episode knowledge graphs",
                    "Living visual evidence",
                  ].map((item) => (
                    <li key={item} className="text-base leading-[1.8] mb-4 pl-6 relative before:content-['✓'] before:absolute before:left-0 before:text-[var(--golden-chestnut)]">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <p className="text-lg leading-[1.7] text-[var(--parchment)]/90 text-center max-w-[700px] mx-auto mt-[60px]">
              Gemini 3's multimodal capabilities transform static papers
              into interactive understanding. See the science, don't just read about it.
            </p>
          </div>
        </section>

        {/* Section 5: Technical Architecture */}
        <section className="min-w-[100vw] h-screen flex flex-col justify-start items-center px-6 md:px-[60px] pt-[120px] pb-[80px] relative overflow-y-auto bg-[var(--carbon-black)]">
          <div className="blueprint-pattern opacity-[0.08]" />
          <div className="max-w-[1200px] w-full relative z-10">
            {/* Header row */}
            <div className="flex justify-between items-start mb-8">
              <div>
                <div className="mono text-sm tracking-[0.15em] text-[var(--golden-chestnut)] mb-3">
                  SEC. 05 // SYSTEM ARCHITECTURE
                </div>
                <h2 className="display text-4xl md:text-5xl font-normal tracking-[-0.5px]">TECHNICAL STACK</h2>
              </div>
              <div className="text-right mono text-sm text-[var(--parchment)]/60 leading-relaxed hidden md:block">
                <div>PROTOCOL: <span className="text-[var(--parchment)]">MCP</span></div>
                <div>STATUS: <span className="text-[var(--golden-chestnut)]">OPERATIONAL</span></div>
              </div>
            </div>

            {/* Main content grid */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-10 mt-8">
              {/* Left column - Pipeline */}
              <div className="border border-[var(--parchment)]/10 bg-[#1d1e20] p-6">
                <div className="mono text-sm tracking-[0.15em] text-[var(--golden-chestnut)] mb-6">
                  DATA PIPELINE
                </div>
                <div className="space-y-1">
                  {[
                    { step: "01", label: "INGEST", desc: "Semantic Scholar API + ArXiv" },
                    { step: "02", label: "EXTRACT", desc: "GROBID TEI Processing" },
                    { step: "03", label: "TRANSCRIBE", desc: "AssemblyAI + Diarization" },
                    { step: "04", label: "CHUNK", desc: "400 tokens / 50 overlap" },
                    { step: "05", label: "EMBED", desc: "all-MiniLM-L6-v2" },
                    { step: "06", label: "INDEX", desc: "ChromaDB Vector Store" },
                    { step: "07", label: "DETECT", desc: "Gemini Claim Extraction" },
                    { step: "08", label: "VERIFY", desc: "RAG + Citation Scoring" },
                  ].map((item, i, arr) => (
                    <div key={item.step} className="flex items-center gap-4">
                      <div className="flex flex-col items-center">
                        <div className="w-8 h-8 rounded-full border border-[var(--golden-chestnut)] flex items-center justify-center">
                          <span className="mono text-xs text-[var(--golden-chestnut)]">{item.step}</span>
                        </div>
                        {i < arr.length - 1 && <div className="w-[1px] h-4 bg-[var(--parchment)]/20" />}
                      </div>
                      <div className="flex-1 py-2">
                        <div className="flex justify-between items-baseline">
                          <span className="mono text-sm text-[var(--parchment)]">{item.label}</span>
                          <span className="text-sm text-[var(--parchment)]/60">{item.desc}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right column - Tech specs grid */}
              <div className="space-y-6">
                {/* Architecture boxes */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="border border-[var(--parchment)]/10 bg-[#1d1e20] p-5">
                    <div className="mono text-xs tracking-[0.1em] text-[var(--parchment)]/50 uppercase mb-2">Backend</div>
                    <div className="text-lg text-[var(--parchment)] mb-1">Python + FastMCP</div>
                    <div className="text-sm text-[var(--parchment)]/60">MCP protocol server with HTTP adapter</div>
                  </div>
                  <div className="border border-[var(--parchment)]/10 bg-[#1d1e20] p-5">
                    <div className="mono text-xs tracking-[0.1em] text-[var(--parchment)]/50 uppercase mb-2">Frontend</div>
                    <div className="text-lg text-[var(--parchment)] mb-1">Next.js + React</div>
                    <div className="text-sm text-[var(--parchment)]/60">Real-time sync via API proxy routes</div>
                  </div>
                  <div className="border border-[var(--parchment)]/10 bg-[#1d1e20] p-5">
                    <div className="mono text-xs tracking-[0.1em] text-[var(--parchment)]/50 uppercase mb-2">Vector Store</div>
                    <div className="text-lg text-[var(--parchment)] mb-1">ChromaDB</div>
                    <div className="text-sm text-[var(--parchment)]/60">Persistent embeddings + metadata</div>
                  </div>
                  <div className="border border-[var(--parchment)]/10 bg-[#1d1e20] p-5">
                    <div className="mono text-xs tracking-[0.1em] text-[var(--parchment)]/50 uppercase mb-2">AI Engine</div>
                    <div className="text-lg text-[var(--parchment)] mb-1">Gemini 2.5 Pro</div>
                    <div className="text-sm text-[var(--parchment)]/60">Claim detection + synthesis</div>
                  </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="border border-[var(--parchment)]/10 bg-[#1d1e20] p-4 text-center">
                    <div className="mono text-2xl text-[var(--golden-chestnut)] font-medium">500+</div>
                    <div className="mono text-xs text-[var(--parchment)]/50 uppercase mt-1">Papers Indexed</div>
                  </div>
                  <div className="border border-[var(--parchment)]/10 bg-[#1d1e20] p-4 text-center">
                    <div className="mono text-2xl text-[var(--golden-chestnut)] font-medium">&lt; 3s</div>
                    <div className="mono text-xs text-[var(--parchment)]/50 uppercase mt-1">Query Latency</div>
                  </div>
                  <div className="border border-[var(--parchment)]/10 bg-[#1d1e20] p-4 text-center">
                    <div className="mono text-2xl text-[var(--golden-chestnut)] font-medium">384</div>
                    <div className="mono text-xs text-[var(--parchment)]/50 uppercase mt-1">Embedding Dims</div>
                  </div>
                </div>

                {/* MCP Tools */}
                <div className="border border-[var(--parchment)]/10 bg-[#1d1e20] p-5">
                  <div className="mono text-sm tracking-[0.15em] text-[var(--golden-chestnut)] mb-4">
                    EXPOSED MCP TOOLS
                  </div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                    {[
                      "rag_search",
                      "save_paper",
                      "save_author_papers",
                      "get_saved_paper",
                      "list_saved_papers",
                      "rag_stats",
                    ].map((tool) => (
                      <div key={tool} className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-[var(--golden-chestnut)]" />
                        <span className="mono text-sm text-[var(--parchment)]/80">{tool}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 6: Live Demo */}
        <section className="min-w-[100vw] h-screen flex flex-col justify-center items-center px-6 md:px-[60px] py-[100px] pb-[120px] relative overflow-y-auto bg-[var(--carbon-black)]">
          <div className="blueprint-pattern" />
          <div className="max-w-[1200px] w-full relative z-10">
            <h2 className="display text-4xl md:text-5xl font-normal mb-10 tracking-[-0.5px] text-center">EXPERIENCE IT YOURSELF</h2>
            <div className="text-center mt-[60px]">
              <div className="w-full max-w-[900px] aspect-video bg-[rgba(29,30,32,0.4)] border border-[var(--parchment)]/20 flex items-center justify-center mx-auto mb-10 mono text-sm text-[var(--parchment)]/50">
                [ 16:9 DEMO VIDEO PLACEHOLDER ]
              </div>
              <div className="mono text-sm leading-[2] text-[var(--parchment)]/70 text-left max-w-[500px] mx-auto mb-10">
                <div><span className="text-[var(--golden-chestnut)]">00:00</span> — Podcast begins</div>
                <div><span className="text-[var(--golden-chestnut)]">00:45</span> — First claim detected</div>
                <div><span className="text-[var(--golden-chestnut)]">01:30</span> — Research surfaces</div>
                <div><span className="text-[var(--golden-chestnut)]">02:15</span> — Gemini visualization generates</div>
                <div><span className="text-[var(--golden-chestnut)]">03:00</span> — Cross-episode connections emerge</div>
              </div>
              <div className="flex gap-5 justify-center flex-wrap">
                <button onClick={onGetStarted} className="btn-noeron btn-noeron-primary">
                  Try Live Demo
                </button>
                <button className="btn-noeron btn-noeron-secondary">
                  View on GitHub →
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Section 7: Market Opportunity */}
        <section className="min-w-[100vw] h-screen flex flex-col justify-center items-center px-6 md:px-[60px] py-[100px] pb-[120px] relative overflow-y-auto bg-[var(--parchment)] text-[var(--carbon-black)]">
          <div className="max-w-[1200px] w-full relative z-10">
            <h2 className="display text-4xl md:text-5xl font-normal mb-10 tracking-[-0.5px] text-[var(--carbon-black)]">THE OPPORTUNITY</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mt-[60px]">
              {[
                { stat: "10-30M", label: "Monthly addressable listeners" },
                { stat: "3-5 RESEARCHERS", label: "Vertical focus (Levin, Friston, Bach)" },
                { stat: "$0 → $XXk", label: "Revenue potential Year 1-2" },
                { stat: "ONE → THOUSANDS", label: "Synthesis amortization multiplier" },
              ].map((item) => (
                <div key={item.stat} className="p-10 border border-[var(--carbon-black)]/20">
                  <div className="mono text-3xl font-medium text-[var(--golden-chestnut)] mb-2.5">{item.stat}</div>
                  <div className="text-sm text-[var(--carbon-black)]/70">{item.label}</div>
                </div>
              ))}
            </div>
            <div className="text-lg leading-[1.7] text-[var(--carbon-black)] mt-[60px]">
              <strong>Vertical scaling strategy:</strong><br />
              Focus on prolific researchers with engaged audiences<br />
              → Michael Levin (bioelectricity, morphogenesis)<br />
              → Expand to adjacent deep science podcasters<br />
              → Platform partnerships with networks
            </div>
            <p className="text-lg leading-[1.7] text-[var(--carbon-black)] mt-8 italic">
              "Sunk cost of cognitive labor, amortized across many consumers"<br />
              One person's deep research synthesis → reusable knowledge infrastructure
            </p>
          </div>
        </section>

        {/* Section 8: Roadmap */}
        <section className="min-w-[100vw] h-screen flex flex-col justify-center items-center px-6 md:px-[60px] py-[100px] pb-[120px] relative overflow-y-auto bg-[var(--carbon-black)]">
          <div className="blueprint-pattern" />
          <div className="max-w-[1200px] w-full relative z-10">
            <h2 className="display text-4xl md:text-5xl font-normal mb-10 tracking-[-0.5px]">WHAT'S NEXT</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mt-[60px]">
              {[
                { quarter: "Q1 2025", title: "CORE DEMO", items: ["500+ paper corpus", "Gemini 3 integration", "75% accuracy"] },
                { quarter: "Q2 2025", title: "BETA LAUNCH", items: ["Partner with Levin Lab", "Test with active listeners", "Iterate on feedback"] },
                { quarter: "Q3 2025", title: "PLATFORM EXPANSION", items: ["5 researcher verticals", "Cross-domain graphs", "Educational licensing"] },
                { quarter: "Q4 2025", title: "PUBLIC LAUNCH", items: ["Open platform", "Publisher partnerships", "Research collaboration tools"] },
              ].map((card) => (
                <div key={card.quarter} className="p-10 border border-[var(--parchment)]/20 bg-[#272829]">
                  <div className="mono text-lg text-[var(--golden-chestnut)] mb-4">{card.quarter}</div>
                  <div className="display text-2xl mb-5">{card.title}</div>
                  <ul className="list-none text-sm leading-[1.8] text-[var(--parchment)]/80">
                    {card.items.map((item) => (
                      <li key={item} className="mb-2 pl-5 relative before:content-['✓'] before:absolute before:left-0 before:text-[var(--golden-chestnut)]">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

      </div>

      {/* Dot Navigation */}
      <div className="dot-nav" style={{ bottom: '60px' }}>
        {Array.from({ length: totalSections }).map((_, i) => (
          <button
            key={i}
            onClick={() => goToSection(i)}
            className={`dot ${i === currentSection ? "active" : ""}`}
            aria-label={`Section ${i + 1}`}
          />
        ))}
      </div>

      {/* Sticky Footer */}
      <footer className="fixed bottom-0 left-0 right-0 h-10 bg-black border-t border-[var(--parchment)]/10 flex items-center justify-end px-6 md:px-[60px] z-[1000]">
        <span className="mono text-sm text-[var(--parchment)]/60 tracking-wide">
          &lt;/&gt; Built for Gemini 3 Global Hackathon
        </span>
      </footer>
    </div>
  )
}
