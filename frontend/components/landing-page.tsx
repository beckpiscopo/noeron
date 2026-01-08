"use client"

import { useState, useEffect, useCallback } from "react"
import { Play } from "lucide-react"
import { ThemeToggle } from "./theme-toggle"

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
    <div className="noeron-theme bg-background text-foreground overflow-hidden h-screen">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 px-6 md:px-[60px] py-5 flex justify-between items-center z-[1000] bg-background border-b border-border">
        <div className="text-2xl font-normal tracking-[-0.5px] text-foreground" style={{ fontFamily: "'Russo One', sans-serif" }}>
          Noeron
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <button
            onClick={() => goToSection(5)}
            className="btn-noeron-secondary !py-2.5 !px-6 !text-sm"
          >
            Access Demo →
          </button>
        </div>
      </nav>

      {/* Slider Container */}
      <div
        className="fixed top-0 left-0 w-full h-screen flex transition-transform duration-[800ms] ease-[cubic-bezier(0.65,0,0.35,1)]"
        style={{ transform: `translateX(-${currentSection * 100}vw)` }}
      >

{/* Section 1: Hero */}
      <section className="min-w-[100vw] h-screen flex flex-col justify-center items-center px-6 md:px-[60px] py-[100px] pb-[120px] relative overflow-hidden bg-background">
          {/* Layered background effects */}
          <div className="blueprint-pattern opacity-[0.15]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_hsl(var(--background))_0%,_#000000_100%)] opacity-40 dark:opacity-40" />

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

            <h1 className="text-[clamp(4rem,12vw,9rem)] font-normal tracking-[-2px] mb-10 text-foreground leading-[0.95] animate-fade-in-up" style={{ fontFamily: "'Russo One', sans-serif", animationDelay: "0.1s" }}>
              Noeron
            </h1>

            <div className="animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
              <p className="text-xl md:text-2xl font-light leading-relaxed text-foreground mb-3">
                The <i>knowledge layer</i> for podcasts.
              </p>
              <p className="text-base md:text-lg font-light leading-relaxed text-foreground/70 mb-12">
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
            <div className="w-full max-w-[400px] mx-auto h-1 bg-foreground/10 rounded-full mb-16 overflow-hidden animate-fade-in-up" style={{ animationDelay: ".4s" }}>
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
        <section className="min-w-[100vw] h-screen flex flex-col justify-start items-center px-6 md:px-[60px] pt-[120px] pb-[80px] relative overflow-y-auto bg-background">
          {/* Enhanced grid background */}
          <div className="absolute inset-0 opacity-[0.15]" style={{
            backgroundImage: 'linear-gradient(to right, var(--parchment) 1px, transparent 1px), linear-gradient(to bottom, var(--parchment) 1px, transparent 1px)',
            backgroundSize: '60px 60px'
          }} />
          <div className="absolute inset-0 bg-gradient-to-b from-background via-transparent to-background" />

          <div className="max-w-[1200px] w-full relative z-10">
            {/* Header row with stronger hierarchy */}
            <div className="flex justify-between items-start mb-6">
              <div>
                <div className="mono text-sm tracking-[0.2em] text-[var(--golden-chestnut)] mb-4 font-medium">
                  SEC. 02 // SYSTEM DIAGNOSTICS
                </div>
                <h2 className="display text-5xl md:text-6xl font-normal tracking-[-1px] text-foreground">THE PROBLEM</h2>
              </div>
              <div className="text-right hidden md:block">
                <div className="inline-block border-2 border-[#be5a38] bg-[#be5a38]/10 px-4 py-2 shadow-[0_0_20px_rgba(216,71,39,0.3)]">
                  <div className="mono text-xs text-[#be5a38]/70 tracking-wider">STATUS</div>
                  <div className="mono text-lg text-[#be5a38] font-bold tracking-wider">CRITICAL</div>
                </div>
              </div>
            </div>

            {/* Main content grid */}
            <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-10 mt-8 items-start">
              {/* Left column */}
              <div>
                <h3 className="text-3xl md:text-4xl font-normal mb-6 leading-tight text-foreground">
                  The Information Gap in <span className="text-[var(--golden-chestnut)]">Audio Media</span>
                </h3>

                <p className="text-lg leading-[1.8] text-foreground/90 mb-8 border-l-4 border-[var(--golden-chestnut)] pl-6 bg-[var(--golden-chestnut)]/5 py-4 pr-4">
                  While podcast consumption is at an all-time high, the bridge between spoken assertions and verifiable facts remains nonexistent. Listeners are passive consumers of unverified data streams, creating a critical vulnerability in global information architecture.
                </p>

                {/* Stats box - enhanced with shadows and stronger borders */}
                <div className="bg-card border-2 border-foreground/20 p-6 mb-8 shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="bg-card p-5 border border-foreground/10">
                      <div className="mono text-xs tracking-[0.15em] text-foreground/40 uppercase mb-3">Monthly Listeners</div>
                      <div className="mono text-4xl font-bold text-foreground mb-2">150M+</div>
                      <div className="mono text-xs text-[var(--golden-chestnut)]">Global Audio Data</div>
                    </div>
                    <div className="bg-card p-5 border border-[#be5a38]/30">
                      <div className="mono text-xs tracking-[0.15em] text-foreground/40 uppercase mb-3">Real-Time Verification</div>
                      <div className="mono text-4xl font-bold text-[#be5a38] mb-2">0.0%</div>
                      <div className="mono text-xs text-[#be5a38]/70">System Failure</div>
                    </div>
                  </div>
                </div>

                {/* Diagnostic Report - enhanced cards */}
                <div className="mono text-sm tracking-[0.2em] text-[var(--golden-chestnut)] uppercase mb-5 font-medium">
                  Failure Points
                </div>

                <div className="space-y-4">
                  {[
                    { num: "01", title: "Citation Void", desc: "Audio content lacks immediate, clickable citations, leaving claims stranded without proof.", color: "golden-chestnut" },
                    { num: "02", title: "Hallucination Risk", desc: "AI transcription and summary tools amplify errors rather than correcting them.", color: "D84727" },
                    { num: "03", title: "Ephemeral Context", desc: "Context is lost the moment audio is played. Historical data becomes inaccessible.", color: "golden-chestnut" },
                  ].map((item) => (
                    <div key={item.num} className="bg-card border border-foreground/10 p-5 flex gap-5 items-start hover:border-foreground/30 transition-colors shadow-[0_2px_12px_rgba(0,0,0,0.3)]">
                      <div className={`w-12 h-12 flex-shrink-0 flex items-center justify-center border-2 ${item.color === 'D84727' ? 'border-[#be5a38] bg-[#be5a38]/10' : 'border-[var(--golden-chestnut)] bg-[var(--golden-chestnut)]/10'}`}>
                        <span className={`mono text-lg font-bold ${item.color === 'D84727' ? 'text-[#be5a38]' : 'text-[var(--golden-chestnut)]'}`}>{item.num}</span>
                      </div>
                      <div>
                        <div className="text-lg font-medium text-foreground mb-1">{item.title}</div>
                        <p className="text-base text-foreground/60 leading-relaxed">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right column - Signal Loss Diagram - HERO treatment */}
              <div className="border-2 border-foreground/20 bg-card p-8 relative hidden lg:block shadow-[0_8px_32px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.05)]">
                <div className="mono text-sm tracking-[0.2em] text-[var(--golden-chestnut)] mb-8 font-medium">
                  FIG 1.1 // SIGNAL LOSS
                </div>

                {/* Diagram container */}
                <div className="relative h-[360px]">
                  {/* Enhanced grid */}
                  <div className="absolute inset-0 opacity-30" style={{
                    backgroundImage: 'linear-gradient(to right, var(--parchment) 1px, transparent 1px), linear-gradient(to bottom, var(--parchment) 1px, transparent 1px)',
                    backgroundSize: '30px 30px'
                  }} />

                  {/* Audio Input box - LARGER */}
                  <div className="absolute top-4 left-1/2 -translate-x-1/2">
                    <div className="w-24 h-24 border-2 border-[var(--golden-chestnut)] bg-background flex items-center justify-center shadow-[0_0_30px_rgba(253,169,43,0.3)]">
                      <svg className="w-10 h-10 text-[var(--golden-chestnut)]" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                        <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                      </svg>
                    </div>
                    <div className="mono text-sm text-center mt-3 text-foreground uppercase tracking-wider font-medium">Audio Input</div>
                    {/* RAW_DATA label */}
                    <div className="absolute -right-24 top-1/2 -translate-y-1/2 flex items-center gap-2">
                      <div className="w-12 h-[2px] bg-[var(--golden-chestnut)]" />
                      <span className="mono text-sm text-[var(--golden-chestnut)] font-medium">RAW_DATA</span>
                    </div>
                  </div>

                  {/* Disconnected label - PROMINENT */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                    <div className="border-2 border-[#be5a38] px-6 py-3 bg-[#be5a38]/10 shadow-[0_0_30px_rgba(216,71,39,0.4)]">
                      <span className="mono text-base text-[#be5a38] tracking-wider font-bold">DISCONNECTED</span>
                    </div>
                  </div>

                  {/* Thicker dashed connection lines */}
                  <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
                    <line x1="50%" y1="130" x2="50%" y2="155" stroke="#be5a38" strokeOpacity="0.6" strokeWidth="3" strokeDasharray="8 6" />
                    <line x1="50%" y1="205" x2="50%" y2="250" stroke="#be5a38" strokeOpacity="0.6" strokeWidth="3" strokeDasharray="8 6" />
                  </svg>

                  {/* Truth Layer box - LARGER, faded */}
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
                    <div className="w-24 h-24 border-2 border-dashed border-foreground/30 bg-background/50 flex items-center justify-center">
                      <svg className="w-8 h-8 text-foreground/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="mono text-sm text-center mt-3 text-foreground/40 uppercase tracking-wider">Truth Layer</div>
                  </div>

                  {/* Corner markers - larger */}
                  <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-foreground/40" />
                  <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-foreground/40" />
                  <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-foreground/40" />
                  <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-foreground/40" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: How It Works */}
        <section className="min-w-[100vw] h-screen flex flex-col justify-start items-center px-6 md:px-[60px] pt-[120px] pb-[80px] relative overflow-y-auto bg-background">
          {/* Enhanced grid background */}
          <div className="absolute inset-0 opacity-[0.12]" style={{
            backgroundImage: 'linear-gradient(to right, var(--parchment) 1px, transparent 1px), linear-gradient(to bottom, var(--parchment) 1px, transparent 1px)',
            backgroundSize: '50px 50px'
          }} />
          <div className="absolute inset-0 bg-gradient-to-b from-background via-transparent to-background" />

          <div className="max-w-[1200px] w-full relative z-10">
            {/* Header row */}
            <div className="flex justify-between items-start mb-10">
              <div>
                <div className="mono text-sm tracking-[0.2em] text-[var(--golden-chestnut)] mb-4 font-medium">
                  SEC. 03 // PROCESS FLOW
                </div>
                <h2 className="display text-5xl md:text-6xl font-normal tracking-[-1px] text-foreground">HOW IT WORKS</h2>
              </div>
              <div className="text-right hidden md:block">
                <div className="inline-block border-2 border-[var(--golden-chestnut)] bg-[var(--golden-chestnut)]/10 px-4 py-2">
                  <div className="mono text-xs text-[var(--golden-chestnut)]/70 tracking-wider">LATENCY</div>
                  <div className="mono text-xl text-[var(--golden-chestnut)] font-bold tracking-wider">&lt; 3s</div>
                </div>
              </div>
            </div>

            {/* Pipeline visualization - HERO TREATMENT */}
            <div className="relative mt-8">
              {/* BOLD Connection line - desktop */}
              <div className="hidden md:block absolute top-[80px] left-[16.66%] right-[16.66%] h-[6px] z-0">
                <div className="w-full h-full bg-gradient-to-r from-[var(--golden-chestnut)] via-[#be5a38] to-[var(--golden-chestnut)] shadow-[0_0_20px_rgba(253,169,43,0.5)]" />
                {/* Arrow indicators */}
                <div className="absolute top-1/2 left-[33%] -translate-y-1/2">
                  <div className="w-4 h-4 rotate-45 bg-[#be5a38] border-2 border-[#be5a38] shadow-[0_0_15px_rgba(216,71,39,0.6)]" />
                </div>
                <div className="absolute top-1/2 left-[66%] -translate-y-1/2">
                  <div className="w-4 h-4 rotate-45 bg-[#be5a38] border-2 border-[#be5a38] shadow-[0_0_15px_rgba(216,71,39,0.6)]" />
                </div>
              </div>

              {/* Pipeline nodes */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                    color: "golden-chestnut",
                    icon: (
                      <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24">
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
                      { label: "MODEL", value: "Gemini 3 Pro" },
                      { label: "CORPUS", value: "500+ Papers" },
                      { label: "METHOD", value: "Semantic Search" },
                    ],
                    color: "vermillion",
                    icon: (
                      <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
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
                    color: "golden-chestnut",
                    icon: (
                      <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    ),
                  },
                ].map((step, index) => (
                  <div key={step.num} className="relative z-10">
                    {/* Node circle - LARGER, BOLDER */}
                    <div className="flex justify-center mb-6">
                      <div className={`w-[160px] h-[160px] rounded-full border-4 ${step.color === 'vermillion' ? 'border-[#be5a38] shadow-[0_0_40px_rgba(216,71,39,0.4)]' : 'border-[var(--golden-chestnut)] shadow-[0_0_40px_rgba(253,169,43,0.3)]'} bg-card flex items-center justify-center relative`}>
                        <div className="absolute inset-3 rounded-full border-2 border-foreground/10" />
                        <div className={step.color === 'vermillion' ? 'text-[#be5a38]' : 'text-[var(--golden-chestnut)]'}>
                          {step.icon}
                        </div>
                        {/* Step number badge - LARGER */}
                        <div className={`absolute -top-3 -right-3 w-12 h-12 rounded-full ${step.color === 'vermillion' ? 'bg-[#be5a38]' : 'bg-[var(--golden-chestnut)]'} flex items-center justify-center shadow-lg`}>
                          <span className="mono text-lg font-bold text-background">{step.num}</span>
                        </div>
                      </div>
                    </div>

                    {/* Content card - ENHANCED */}
                    <div className="border-2 border-foreground/15 bg-card p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.03)]">
                      <div className="text-center mb-5">
                        <div className="display text-2xl text-foreground mb-2 font-medium">{step.title}</div>
                        <div className={`mono text-sm tracking-[0.15em] ${step.color === 'vermillion' ? 'text-[#be5a38]' : 'text-[var(--golden-chestnut)]'} uppercase font-medium`}>{step.subtitle}</div>
                      </div>

                      <p className="text-base leading-relaxed text-foreground/70 text-center mb-6 min-h-[48px]">
                        {step.benefit}
                      </p>

                      {/* Technical specs - ENHANCED */}
                      <div className="bg-card border border-foreground/10 p-4 space-y-3">
                        {step.specs.map((spec) => (
                          <div key={spec.label} className="flex justify-between items-center">
                            <span className="mono text-xs tracking-[0.15em] text-foreground/30 uppercase">{spec.label}</span>
                            <span className="mono text-sm text-foreground font-medium">{spec.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Mobile connector - BOLDER */}
                    {index < 2 && (
                      <div className="md:hidden flex justify-center my-6">
                        <div className="w-[4px] h-12 bg-gradient-to-b from-[var(--golden-chestnut)] via-[#be5a38] to-[var(--golden-chestnut)]/30 shadow-[0_0_10px_rgba(253,169,43,0.4)]" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

          </div>
        </section>

        {/* Section 4: Gemini 3 Integration */}
        <section className="min-w-[100vw] h-screen flex flex-col justify-start items-center px-6 md:px-[60px] pt-[120px] pb-[80px] relative overflow-y-auto bg-[#EBE2D2] dark:bg-background">
          <div className="blueprint-pattern opacity-[0.08] dark:opacity-[0.15]" />
          <div className="hidden dark:block absolute inset-0 bg-gradient-to-b from-background via-transparent to-background" />

          <div className="max-w-[1200px] w-full relative z-10">
            {/* Header */}
            <div className="flex justify-between items-start mb-8">
              <div>
                <div className="mono text-sm tracking-[0.1em] text-[#D84727] dark:text-[var(--golden-chestnut)] mb-4 font-medium">
                  SEC. 04 // AI ENGINE
                </div>
                <h2 className="display text-5xl md:text-6xl font-normal tracking-[-1px] text-[#2C3138] dark:text-foreground">POWERED BY GEMINI 3</h2>
              </div>
              <div className="text-right hidden md:block">
                <div className="inline-block bg-[#D84727] dark:bg-[var(--golden-chestnut)]/10 dark:border-2 dark:border-[var(--golden-chestnut)] px-5 py-3 rounded-lg shadow-lg">
                  <div className="mono text-[10px] text-white/70 dark:text-[var(--golden-chestnut)]/70 tracking-[0.1em] uppercase">COST REDUCTION</div>
                  <div className="mono text-[28px] text-white dark:text-[var(--golden-chestnut)] font-medium tracking-wider leading-none">25×</div>
                </div>
              </div>
            </div>

            <p className="text-lg leading-[1.7] text-[#2C3138]/70 dark:text-foreground/80 max-w-[700px] mb-10">
              Why Gemini 3 makes this possible — capabilities that transform how we bridge podcasts and papers.
            </p>

            {/* Gemini 3 capabilities grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
              {[
                {
                  title: "1M Token Context",
                  value: "150+ Papers",
                  desc: "Load entire podcast transcripts alongside the full research corpus in a single context window",
                  icon: (
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  ),
                },
                {
                  title: "Context Caching",
                  value: "$2 / 1K queries",
                  desc: "Process the paper corpus once, then query thousands of times — making real-time responses economically viable",
                  icon: (
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                    </svg>
                  ),
                },
                {
                  title: "Thinking Levels",
                  value: "Medium → High",
                  desc: "Adaptive reasoning depth: fast claim detection with medium thinking, deep synthesis with high thinking",
                  icon: (
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  ),
                },
                {
                  title: "Structured Outputs",
                  value: "JSON Schema",
                  desc: "Generate context cards with proper citations, confidence scores, and provenance tracking automatically",
                  icon: (
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  ),
                },
              ].map((item) => (
                <div key={item.title} className="bg-white dark:!bg-[#2A2B2D] border border-[#2C3138]/10 dark:border-foreground/15 p-6 shadow-[0_1px_2px_rgba(44,49,56,0.04),0_4px_16px_rgba(44,49,56,0.06)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.4)] hover:shadow-[0_2px_4px_rgba(44,49,56,0.06),0_8px_24px_rgba(44,49,56,0.1)] hover:-translate-y-0.5 transition-all duration-200 rounded-lg dark:rounded-none dark:hover:border-[var(--golden-chestnut)]/30">
                  <div className="text-[#2C3138]/70 dark:text-[var(--golden-chestnut)] mb-4">{item.icon}</div>
                  <div className="mono text-[11px] tracking-[0.08em] text-[#2C3138]/50 dark:text-foreground/40 uppercase mb-2">{item.title}</div>
                  <div className="text-2xl font-medium text-[#2C3138] dark:text-foreground mb-3">{item.value}</div>
                  <p className="text-sm text-[#2C3138]/70 dark:text-foreground/60 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>

            {/* Two-pass architecture diagram - Always dark for contrast */}
            <div className="bg-[#2C3138] p-8 rounded-xl dark:rounded-none shadow-[0_8px_32px_rgba(0,0,0,0.3)] dark:border-2 dark:border-[var(--golden-chestnut)]/30">
              <div className="mono text-sm tracking-[0.1em] text-[#FDA92B] dark:text-[var(--golden-chestnut)] mb-6 font-medium">
                TWO-PASS GEMINI ARCHITECTURE
              </div>
              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-6 items-center">
                {/* Pass 1 */}
                <div className="bg-[#EBE2D2]/5 border border-[#EBE2D2]/15 rounded-lg dark:rounded-none p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-7 h-7 rounded-full bg-[#D84727] dark:bg-[var(--golden-chestnut)]/10 dark:border-2 dark:border-[var(--golden-chestnut)] flex items-center justify-center">
                      <span className="mono text-xs font-medium text-white dark:text-[var(--golden-chestnut)]">01</span>
                    </div>
                    <div>
                      <div className="text-base font-medium text-[#EBE2D2]">Claim Detection</div>
                      <div className="mono text-[11px] text-[#FDA92B] dark:text-[var(--golden-chestnut)]">gemini-3-flash-preview</div>
                    </div>
                  </div>
                  <div className="mono text-sm text-[#EBE2D2]/60 leading-relaxed">
                    <span className="text-[#EBE2D2]/40">thinking_level:</span> <span className="text-[#FDA92B] dark:text-[var(--golden-chestnut)]">'medium'</span><br />
                    <span className="text-[#EBE2D2]/40">input:</span> <span className="text-[#EBE2D2]">60s transcript window</span><br />
                    <span className="text-[#EBE2D2]/40">output:</span> <span className="text-[#EBE2D2]">claims + context tags</span>
                  </div>
                </div>

                {/* Arrow */}
                <div className="hidden md:flex items-center justify-center">
                  <div className="w-12 h-[3px] bg-gradient-to-r from-[#FDA92B] dark:from-[var(--golden-chestnut)] to-[#D84727] dark:to-[#be5a38]" />
                  <div className="w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-l-[10px] border-l-[#D84727] dark:border-l-[#be5a38]" />
                </div>

                {/* Pass 2 */}
                <div className="bg-[#EBE2D2]/5 border border-[#EBE2D2]/15 dark:border-[#be5a38]/30 rounded-lg dark:rounded-none p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-7 h-7 rounded-full bg-[#D84727] dark:bg-[#be5a38]/10 dark:border-2 dark:border-[#be5a38] flex items-center justify-center">
                      <span className="mono text-xs font-medium text-white dark:text-[#be5a38]">02</span>
                    </div>
                    <div>
                      <div className="text-base font-medium text-[#EBE2D2]">Context Synthesis</div>
                      <div className="mono text-[11px] text-[#FDA92B] dark:text-[#be5a38]">gemini-3-pro-preview + cache</div>
                    </div>
                  </div>
                  <div className="mono text-sm text-[#EBE2D2]/60 leading-relaxed">
                    <span className="text-[#EBE2D2]/40">thinking_level:</span> <span className="text-[#FDA92B] dark:text-[#be5a38]">'high'</span><br />
                    <span className="text-[#EBE2D2]/40">cached:</span> <span className="text-[#EBE2D2]">150+ paper corpus</span><br />
                    <span className="text-[#EBE2D2]/40">output:</span> <span className="text-[#EBE2D2]">context cards + citations</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 5: Technical Architecture */}
        <section className="min-w-[100vw] h-screen flex flex-col justify-start items-center px-6 md:px-[60px] pt-[120px] pb-[80px] relative overflow-y-auto bg-background">
          {/* Enhanced grid background */}
          <div className="absolute inset-0 opacity-[0.12]" style={{
            backgroundImage: 'linear-gradient(to right, var(--parchment) 1px, transparent 1px), linear-gradient(to bottom, var(--parchment) 1px, transparent 1px)',
            backgroundSize: '50px 50px'
          }} />
          <div className="absolute inset-0 bg-gradient-to-b from-background via-transparent to-background" />

          <div className="max-w-[1200px] w-full relative z-10">
            {/* Header row */}
            <div className="flex justify-between items-start mb-8">
              <div>
                <div className="mono text-sm tracking-[0.2em] text-[var(--golden-chestnut)] mb-4 font-medium">
                  SEC. 05 // SYSTEM ARCHITECTURE
                </div>
                <h2 className="display text-5xl md:text-6xl font-normal tracking-[-1px] text-foreground">TECHNICAL STACK</h2>
              </div>
              <div className="text-right hidden md:block">
                <div className="inline-block border-2 border-[var(--golden-chestnut)] bg-[var(--golden-chestnut)]/10 px-4 py-2">
                  <div className="mono text-xs text-[var(--golden-chestnut)]/70 tracking-wider">PROTOCOL</div>
                  <div className="mono text-xl text-[var(--golden-chestnut)] font-bold tracking-wider">MCP</div>
                </div>
              </div>
            </div>

            {/* Main content grid */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-8 mt-6">
              {/* Left column - Pipeline - HERO */}
              <div className="border-2 border-foreground/20 bg-card p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.03)]">
                <div className="mono text-sm tracking-[0.2em] text-[var(--golden-chestnut)] mb-6 font-medium">
                  DATA PIPELINE
                </div>
                <div className="space-y-0">
                  {[
                    { step: "01", label: "INGEST", desc: "Semantic Scholar + ArXiv", color: "golden" },
                    { step: "02", label: "EXTRACT", desc: "GROBID TEI Processing", color: "golden" },
                    { step: "03", label: "TRANSCRIBE", desc: "AssemblyAI + Diarization", color: "vermillion" },
                    { step: "04", label: "CHUNK", desc: "400 tokens / 50 overlap", color: "golden" },
                    { step: "05", label: "EMBED", desc: "all-MiniLM-L6-v2", color: "golden" },
                    { step: "06", label: "INDEX", desc: "ChromaDB Vector Store", color: "vermillion" },
                    { step: "07", label: "DETECT", desc: "Gemini Claim Extraction", color: "vermillion" },
                    { step: "08", label: "VERIFY", desc: "RAG + Citation Scoring", color: "golden" },
                  ].map((item, i, arr) => (
                    <div key={item.step} className="flex items-stretch gap-4">
                      <div className="flex flex-col items-center">
                        <div className={`w-10 h-10 rounded-full border-2 ${item.color === 'vermillion' ? 'border-[#be5a38] bg-[#be5a38]/10' : 'border-[var(--golden-chestnut)] bg-[var(--golden-chestnut)]/10'} flex items-center justify-center flex-shrink-0`}>
                          <span className={`mono text-sm font-bold ${item.color === 'vermillion' ? 'text-[#be5a38]' : 'text-[var(--golden-chestnut)]'}`}>{item.step}</span>
                        </div>
                        {i < arr.length - 1 && <div className={`w-[3px] flex-1 min-h-[20px] ${item.color === 'vermillion' ? 'bg-gradient-to-b from-[#be5a38] to-[var(--golden-chestnut)]' : 'bg-[var(--golden-chestnut)]/40'}`} />}
                      </div>
                      <div className="flex-1 py-2 border-b border-foreground/5 last:border-0">
                        <div className="flex justify-between items-baseline gap-4">
                          <span className="mono text-sm text-foreground font-medium">{item.label}</span>
                          <span className="text-sm text-foreground/50">{item.desc}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right column - Tech specs grid */}
              <div className="space-y-5">
                {/* Architecture boxes - ENHANCED */}
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: "Backend", value: "Python + FastMCP", desc: "MCP protocol server with HTTP adapter", color: "golden" },
                    { label: "Frontend", value: "Next.js + React", desc: "Real-time sync via API proxy routes", color: "golden" },
                    { label: "Vector Store", value: "ChromaDB", desc: "Persistent embeddings + metadata", color: "vermillion" },
                    { label: "AI Engine", value: "Gemini 3 Pro", desc: "Claim detection + synthesis", color: "vermillion" },
                  ].map((item) => (
                    <div key={item.label} className={`border-2 ${item.color === 'vermillion' ? 'border-[#be5a38]/30' : 'border-foreground/15'} bg-card p-5 shadow-[0_4px_20px_rgba(0,0,0,0.4)]`}>
                      <div className="mono text-xs tracking-[0.15em] text-foreground/30 uppercase mb-2">{item.label}</div>
                      <div className={`text-xl font-medium mb-2 ${item.color === 'vermillion' ? 'text-[#be5a38]' : 'text-foreground'}`}>{item.value}</div>
                      <div className="text-sm text-foreground/50">{item.desc}</div>
                    </div>
                  ))}
                </div>

                {/* Stats row - BOLDER */}
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { value: "500+", label: "Papers Indexed", color: "golden" },
                    { value: "< 3s", label: "Query Latency", color: "vermillion" },
                    { value: "384", label: "Embedding Dims", color: "golden" },
                  ].map((stat) => (
                    <div key={stat.label} className="border-2 border-foreground/15 bg-card p-5 text-center shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
                      <div className={`mono text-3xl font-bold ${stat.color === 'vermillion' ? 'text-[#be5a38]' : 'text-[var(--golden-chestnut)]'}`}>{stat.value}</div>
                      <div className="mono text-xs text-foreground/30 uppercase mt-2 tracking-wider">{stat.label}</div>
                    </div>
                  ))}
                </div>

                {/* MCP Tools - ENHANCED */}
                <div className="border-2 border-[var(--golden-chestnut)]/30 bg-card p-5 shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
                  <div className="mono text-sm tracking-[0.2em] text-[var(--golden-chestnut)] mb-5 font-medium">
                    EXPOSED MCP TOOLS
                  </div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                    {[
                      { name: "rag_search", primary: true },
                      { name: "save_paper", primary: false },
                      { name: "save_author_papers", primary: false },
                      { name: "get_saved_paper", primary: false },
                      { name: "list_saved_papers", primary: false },
                      { name: "rag_stats", primary: true },
                    ].map((tool) => (
                      <div key={tool.name} className="flex items-center gap-3">
                        <div className={`w-2.5 h-2.5 rounded-full ${tool.primary ? 'bg-[var(--golden-chestnut)] shadow-[0_0_8px_rgba(253,169,43,0.5)]' : 'bg-foreground/30'}`} />
                        <span className={`mono text-sm ${tool.primary ? 'text-foreground font-medium' : 'text-foreground/60'}`}>{tool.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 6: Live Demo */}
        <section className="min-w-[100vw] h-screen flex flex-col justify-center items-center px-6 md:px-[60px] py-[100px] pb-[120px] relative overflow-y-auto bg-background">
          <div className="blueprint-pattern" />
          <div className="max-w-[1200px] w-full relative z-10">
            <h2 className="display text-4xl md:text-5xl font-normal mb-10 tracking-[-0.5px] text-center">EXPERIENCE IT YOURSELF</h2>
            <div className="text-center mt-[60px]">
              <div className="w-full max-w-[900px] aspect-video bg-[rgba(29,30,32,0.4)] border border-foreground/20 flex items-center justify-center mx-auto mb-10 mono text-sm text-foreground/50">
                [ 16:9 DEMO VIDEO PLACEHOLDER ]
              </div>
              <div className="mono text-sm leading-[2] text-foreground/70 text-left max-w-[500px] mx-auto mb-10">
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
        <section className="min-w-[100vw] h-screen flex flex-col justify-center items-center px-6 md:px-[60px] py-[100px] pb-[120px] relative overflow-y-auto bg-card text-foreground">
          <div className="max-w-[1200px] w-full relative z-10">
            <h2 className="display text-4xl md:text-5xl font-normal mb-10 tracking-[-0.5px] text-foreground">THE OPPORTUNITY</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mt-[60px]">
              {[
                { stat: "10-30M", label: "Monthly addressable listeners" },
                { stat: "3-5 RESEARCHERS", label: "Vertical focus (Levin, Friston, Bach)" },
                { stat: "$0 → $XXk", label: "Revenue potential Year 1-2" },
                { stat: "ONE → THOUSANDS", label: "Synthesis amortization multiplier" },
              ].map((item) => (
                <div key={item.stat} className="p-10 border border-border">
                  <div className="mono text-3xl font-medium text-[var(--golden-chestnut)] mb-2.5">{item.stat}</div>
                  <div className="text-sm text-foreground/70">{item.label}</div>
                </div>
              ))}
            </div>
            <div className="text-lg leading-[1.7] text-foreground mt-[60px]">
              <strong>Vertical scaling strategy:</strong><br />
              Focus on prolific researchers with engaged audiences<br />
              → Michael Levin (bioelectricity, morphogenesis)<br />
              → Expand to adjacent deep science podcasters<br />
              → Platform partnerships with networks
            </div>
            <p className="text-lg leading-[1.7] text-foreground mt-8 italic">
              "Sunk cost of cognitive labor, amortized across many consumers"<br />
              One person's deep research synthesis → reusable knowledge infrastructure
            </p>
          </div>
        </section>

        {/* Section 8: Roadmap */}
        <section className="min-w-[100vw] h-screen flex flex-col justify-center items-center px-6 md:px-[60px] py-[100px] pb-[120px] relative overflow-y-auto bg-background">
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
                <div key={card.quarter} className="p-10 border border-foreground/20 bg-card">
                  <div className="mono text-lg text-[var(--golden-chestnut)] mb-4">{card.quarter}</div>
                  <div className="display text-2xl mb-5">{card.title}</div>
                  <ul className="list-none text-sm leading-[1.8] text-foreground/80">
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
      <footer className="fixed bottom-0 left-0 right-0 h-10 bg-background border-t border-foreground/10 flex items-center justify-end px-6 md:px-[60px] z-[1000]">
        <span className="mono text-sm text-foreground/60 tracking-wide">
          &lt;/&gt; Built for Gemini 3 Global Hackathon
        </span>
      </footer>
    </div>
  )
}
