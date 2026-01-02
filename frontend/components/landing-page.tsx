"use client"

import { useState, useEffect, useCallback } from "react"
import { Play } from "lucide-react"

interface LandingPageProps {
  onGetStarted: () => void
}

export function LandingPage({ onGetStarted }: LandingPageProps) {
  const [currentSection, setCurrentSection] = useState(0)
  const totalSections = 9

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
          className="btn-noeron-secondary !py-2.5 !px-6 !text-[13px]"
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
                <span className="mono text-[10px] opacity-60">3M</span>
              </button>
            </div>
          </div>

        </section>

        {/* Section 2: The Problem */}
        <section className="min-w-[100vw] h-screen flex flex-col justify-center items-center px-6 md:px-[60px] py-[100px] pb-[120px] relative overflow-y-auto bg-[var(--dark-gray)]">
          <div className="blueprint-pattern" />
          <div className="max-w-[1200px] w-full relative z-10">
            <h2 className="display text-4xl md:text-5xl font-normal mb-10 tracking-[-0.5px]">THE PROBLEM</h2>
            <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-[60px] items-center">
              <div>
                <p className="text-lg leading-[1.7] text-[var(--parchment)]/90 mb-8">
                  Podcasts make research accessible, but citations invisible.
                </p>
                <div className="bg-[rgba(42,43,45,0.6)] border border-[var(--golden-chestnut)]/30 p-8 my-8">
                  <div className="mono text-2xl font-medium text-[var(--golden-chestnut)] mb-2">150M+ MONTHLY LISTENERS</div>
                  <div className="text-sm text-[var(--parchment)]/70 mb-5">Deep science podcast ecosystem</div>
                  <div className="mono text-2xl font-medium text-[var(--golden-chestnut)] mb-2">0% REAL-TIME VERIFICATION</div>
                  <div className="text-sm text-[var(--parchment)]/70">Citations buried or non-existent</div>
                </div>
                <p className="text-lg leading-[1.7] text-[var(--parchment)]/90 mb-8">
                  When Michael Levin says "bioelectric gradients control morphogenesis,"
                  where's the evidence?
                </p>
                <p className="text-lg leading-[1.7] text-[var(--parchment)]/90">
                  Traditional approach:<br />
                  → Hope listeners Google it later (they don't)<br />
                  → Trust without verification<br />
                  → Knowledge remains disconnected from source
                </p>
              </div>
              <div className="flex items-center justify-center p-[60px] border border-dashed border-[var(--parchment)]/30">
                <div className="mono text-sm text-[var(--parchment)]/50 text-center">
                  [ VISUAL: Podcast → ??? → Research Paper ]
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: How It Works */}
        <section className="min-w-[100vw] h-screen flex flex-col justify-center items-center px-6 md:px-[60px] py-[100px] pb-[120px] relative overflow-y-auto bg-[var(--parchment)] text-[var(--carbon-black)]">
          <div className="max-w-[1200px] w-full relative z-10">
            <h2 className="display text-4xl md:text-5xl font-normal mb-10 tracking-[-0.5px] text-[var(--carbon-black)]">HOW IT WORKS</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mt-[60px]">
              {[
                { num: "01", title: "LISTEN", text: "Podcast plays naturally\nReal-time transcript processing\nAssemblyAI integration" },
                { num: "02", title: "DETECT", text: "AI identifies scientific claims\nSemantic search across 500+ papers\nGemini 3 powered detection" },
                { num: "03", title: "VERIFY", text: "Research appears synchronized\nInteractive visualizations\nCross-episode connections" },
              ].map((panel) => (
                <div key={panel.num} className="p-10 border border-[var(--carbon-black)]/10 bg-[var(--carbon-black)]/[0.02]">
                  <div className="mono text-4xl font-light text-[var(--golden-chestnut)] mb-5">{panel.num}</div>
                  <div className="display text-2xl mb-4 text-[var(--carbon-black)]">{panel.title}</div>
                  <div className="text-base leading-relaxed text-[var(--carbon-black)]/80 whitespace-pre-line">{panel.text}</div>
                </div>
              ))}
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
        <section className="min-w-[100vw] h-screen flex flex-col justify-center items-center px-6 md:px-[60px] py-[100px] pb-[120px] relative overflow-y-auto bg-[var(--parchment)] text-[var(--carbon-black)]">
          <div className="max-w-[1200px] w-full relative z-10">
            <h2 className="display text-4xl md:text-5xl font-normal mb-10 tracking-[-0.5px] text-[var(--carbon-black)]">TECHNICAL IMPLEMENTATION</h2>
            <div className="text-center my-[60px] mono text-sm leading-[2]">
              {["AssemblyAI Transcription", "Gemini 3 Claim Detection", "Semantic Scholar API", "ChromaDB Vector Search", "Paper Retrieval & Ranking", "Gemini 3 Synthesis", "Visual Generation + Knowledge Graph"].map((step, i, arr) => (
                <div key={step}>
                  <div className="text-[var(--carbon-black)]">{step}</div>
                  {i < arr.length - 1 && <div className="text-[var(--golden-chestnut)]">↓</div>}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
              {[
                { label: "CORPUS", value: "500+", extra: "papers\n1993-2025" },
                { label: "ACCURACY", value: "75%", extra: "claim-to-paper\nmatching" },
                { label: "LATENCY", value: "< 3s", extra: "query-result" },
                { label: "EMBEDDINGS", value: "", extra: "SentenceTransformer\nall-MiniLM-L6-v2" },
                { label: "ARCHITECTURE", value: "", extra: "FastMCP Server\nRESTful API" },
                { label: "PROCESSING", value: "", extra: "GROBID PDF extraction\nRolling 3-min windows" },
              ].map((spec) => (
                <div key={spec.label} className="p-8 border border-[var(--carbon-black)]/20 bg-[var(--carbon-black)]/[0.02]">
                  <div className="mono text-[11px] uppercase tracking-[1px] text-[var(--carbon-black)]/60 mb-2.5">{spec.label}</div>
                  <div className="mono text-base text-[var(--carbon-black)] leading-[1.5] whitespace-pre-line">
                    {spec.value && <span className="text-[var(--golden-chestnut)] font-medium">{spec.value}</span>}
                    {spec.value && " "}{spec.extra}
                  </div>
                </div>
              ))}
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
                <div key={card.quarter} className="p-10 border border-[var(--parchment)]/20 bg-[rgba(42,43,45,0.3)]">
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

        {/* Section 9: Final CTA */}
        <section className="min-w-[100vw] h-screen flex flex-col justify-center items-center px-6 md:px-[60px] py-[100px] pb-[120px] relative overflow-y-auto bg-[var(--carbon-black)]">
          <div className="blueprint-pattern" />
          <div className="max-w-[1200px] w-full relative z-10 text-center">
            <div className="eyebrow eyebrow-ornament mb-[60px]">
              Built for Gemini 3 Global Hackathon
            </div>
            <h2 className="display text-4xl md:text-[56px] font-normal mb-8 text-[var(--parchment)] leading-[1.2]">
              Transform how knowledge flows<br />
              from conversation to evidence.
            </h2>
            <p className="text-xl text-[var(--parchment)]/85 mb-12 leading-relaxed">
              Bridging the gap between accessible conversation<br />
              and rigorous evidence.
            </p>
            <div className="flex gap-5 justify-center flex-wrap">
              <button className="btn-noeron btn-noeron-primary">
                Watch 3-Min Demo
              </button>
              <button onClick={onGetStarted} className="btn-noeron btn-noeron-secondary">
                Try Live Demo
              </button>
            </div>
            <div className="mt-[60px] text-sm text-[var(--parchment)]/60">
              Created by Beck Piscopo<br />
              Atlanta, GA
            </div>
          </div>
        </section>
      </div>

      {/* Dot Navigation */}
      <div className="dot-nav">
        {Array.from({ length: totalSections }).map((_, i) => (
          <button
            key={i}
            onClick={() => goToSection(i)}
            className={`dot ${i === currentSection ? "active" : ""}`}
            aria-label={`Section ${i + 1}`}
          />
        ))}
      </div>
    </div>
  )
}
