"use client"

import { useState } from "react"
import { Play, Moon, Sun, Bookmark, Info, MessageSquare, Sparkles, Forward, Rewind, ChevronRight, Database, Brain, Zap, FileJson, Github } from "lucide-react"
import { useTheme } from "next-themes"

interface LandingPageV2Props {
  onGetStarted: () => void
}

export function LandingPageV2({ onGetStarted }: LandingPageV2Props) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Ensure component is mounted before rendering theme toggle
  useState(() => {
    setMounted(true)
  })

  return (
    <div className="bg-[#121212] text-[#E0E0E0] font-sans antialiased overflow-x-hidden scroll-smooth">
      {/* Custom styles for this page */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Fira+Code:wght@400;500&family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400;1,500&display=swap');

        .perspective-container {
          perspective: 2000px;
        }

        .rotate-3d {
          transform: rotateX(20deg) rotateY(0deg) rotateZ(-4deg) scale(0.95);
          transform-style: preserve-3d;
          box-shadow: 0 50px 100px -20px rgba(0, 0, 0, 0.9);
          transition: transform 0.5s ease-out;
        }

        .rotate-3d:hover {
          transform: rotateX(15deg) rotateY(0deg) rotateZ(-2deg) scale(0.98);
        }

        .preserve-3d {
          transform-style: preserve-3d;
        }

        .bg-bio-texture {
          background-color: #121212;
          background-image:
            radial-gradient(circle at 50% 0%, rgba(196, 139, 96, 0.08) 0%, transparent 60%),
            linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
          background-size: 100% 100%, 60px 60px, 60px 60px;
          position: relative;
        }

        .bg-bio-texture::before {
          content: "";
          position: absolute;
          inset: 0;
          background-image: repeating-linear-gradient(45deg, transparent 0, transparent 40px, rgba(196, 139, 96, 0.015) 40px, rgba(196, 139, 96, 0.015) 41px);
          pointer-events: none;
        }

        .pop-out-card {
          transform: translateZ(80px) scale(1.05) translateX(-20px) translateY(-10px);
          box-shadow: -30px 40px 60px rgba(0,0,0,0.8), 0 0 0 1px rgba(196, 139, 96, 0.2);
          z-index: 50;
          position: relative;
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }

        .pop-out-card:hover {
          transform: translateZ(90px) scale(1.06) translateX(-20px) translateY(-12px);
          box-shadow: -35px 45px 70px rgba(0,0,0,0.9), 0 0 0 1px rgba(196, 139, 96, 0.4);
        }

        .glow-effect {
          background: radial-gradient(circle at center, rgba(196, 139, 96, 0.1) 0%, transparent 70%);
        }

        @keyframes pulse-slow {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .animate-pulse-slow {
          animation: pulse-slow 2s ease-in-out infinite;
        }

        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in-up {
          animation: fade-in-up 0.6s ease-out forwards;
        }

        /* Scroll snap for sections */
        .snap-container {
          scroll-snap-type: y mandatory;
          overflow-y: scroll;
          height: 100vh;
        }

        .snap-section {
          scroll-snap-align: start;
          min-height: 100vh;
        }

        /* Custom scrollbar */
        ::-webkit-scrollbar {
          width: 6px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.1);
          border-radius: 3px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.2);
        }
      `}</style>

      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 backdrop-blur-md bg-[#121212]/80 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex-shrink-0 flex items-center gap-2">
              <span className="font-bold text-2xl tracking-tighter text-white" style={{ fontFamily: "'Inter', sans-serif" }}>
                Noeron
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="p-2 text-gray-400 hover:text-white transition-colors"
                aria-label="Toggle theme"
              >
                {mounted && theme === 'dark' ? (
                  <Sun className="w-5 h-5" />
                ) : (
                  <Moon className="w-5 h-5" />
                )}
              </button>
              <button
                onClick={onGetStarted}
                className="inline-flex items-center justify-center px-4 py-2 border border-[#C48B60] shadow-sm text-xs uppercase tracking-wide font-medium text-white bg-[#C48B60] hover:bg-[#A8744F] hover:border-[#A8744F] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#C48B60] transition-all"
              >
                Access Demo <ChevronRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Section 1: Hero */}
      <section className="snap-section relative min-h-screen flex flex-col justify-center items-center pt-20 pb-12 lg:pt-24 lg:pb-16 overflow-hidden bg-[#121212] text-white">
        {/* Bio-texture background */}
        <div className="absolute inset-0 z-0 bg-bio-texture">
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full h-full max-w-4xl glow-effect pointer-events-none" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Badge */}
          <div className="flex justify-center mb-4 animate-fade-in-up">
            <div className="inline-flex items-center px-4 py-1.5 rounded-full border border-gray-700 bg-gray-900/50 backdrop-blur-sm text-xs tracking-wider" style={{ fontFamily: "'Fira Code', monospace" }}>
              <span className="w-2 h-2 rounded-full bg-[#C48B60] mr-3 animate-pulse-slow" />
              <span className="text-[#C48B60]">EPISTEMOLOGICAL INFRASTRUCTURE // V 3.0</span>
            </div>
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-medium tracking-tight mb-6 leading-tight text-white animate-fade-in-up" style={{ animationDelay: '0.1s', fontFamily: "'Inter', sans-serif" }}>
            The{' '}
            <span className="text-[#C48B60] italic font-bold" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
              knowledge layer
            </span>
            <br className="hidden md:block" />
            {' '}for podcasts.
          </h1>

          {/* Subhead */}
          <p className="mt-3 max-w-2xl mx-auto text-sm md:text-base text-gray-400 mb-6 leading-relaxed tracking-wide" style={{ fontFamily: "'Fira Code', monospace" }}>
            Real-time synchronization between conversation and research.
            <span className="block mt-2 text-gray-500">Parsing audio streams. Verifying facts. Generating knowledge graphs.</span>
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row justify-center gap-4 mb-12 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            <button
              onClick={onGetStarted}
              className="inline-flex items-center justify-center px-8 py-3 text-xs uppercase tracking-wide font-medium text-white bg-[#C48B60] border border-[#C48B60] hover:bg-[#A8744F] hover:border-[#A8744F] md:py-4 md:text-sm transition-all shadow-lg hover:shadow-[#C48B60]/20"
            >
              Start Researching
            </button>
            <button className="inline-flex items-center justify-center px-8 py-3 text-xs uppercase tracking-wide font-medium border border-gray-600 text-gray-300 bg-transparent hover:bg-[#C48B60] hover:border-[#C48B60] hover:text-white md:py-4 md:text-sm transition-all group">
              <Play className="w-4 h-4 mr-2 text-[#C48B60] group-hover:text-white transition-colors fill-current" />
              Watch Demo
            </button>
          </div>

          {/* 3D Product Mockup */}
          <div className="perspective-container relative w-full max-w-6xl mx-auto -mb-40 lg:-mb-60 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
            <div className="rotate-3d relative rounded-xl border border-gray-700/50 bg-[#121212] shadow-2xl ring-1 ring-white/5">
              {/* Browser chrome */}
              <div className="h-8 bg-[#1a1a1a] border-b border-[#2a2a2a] flex items-center px-4 space-x-2 rounded-t-xl">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
                <div className="ml-4 flex-1 text-center text-xs text-gray-600" style={{ fontFamily: "'Fira Code', monospace" }}>
                  noeron.app — Research Stream
                </div>
              </div>

              {/* Three-panel mockup content */}
              <div className="flex h-[500px] lg:h-[700px] bg-[#121212] text-gray-200 text-left rounded-b-xl preserve-3d">
                {/* Left panel - Podcast Player */}
                <div className="w-72 lg:w-80 border-r border-[#2a2a2a] p-4 lg:p-6 flex-col hidden md:flex rounded-bl-xl bg-[#181818]">
                  <div className="aspect-square bg-black mb-4 lg:mb-6 relative overflow-hidden group rounded-sm border border-[#333]">
                    <div className="absolute inset-0 bg-gradient-to-br from-[#C48B60]/20 to-[#be5a38]/20" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <svg className="w-24 lg:w-32 h-8 lg:h-12 text-[#C48B60]" fill="none" stroke="currentColor" viewBox="0 0 100 20">
                        <path d="M0 10 Q 5 0 10 10 T 20 10 T 30 10 T 40 10 T 50 10 T 60 10 T 70 10 T 80 10 T 90 10 T 100 10" strokeWidth="2" />
                      </svg>
                    </div>
                  </div>
                  <h3 className="text-lg lg:text-xl font-bold leading-tight mb-1 text-gray-200" style={{ fontFamily: "'Inter', sans-serif" }}>
                    Biology, Life, Aliens, Evolution & Xenobots
                  </h3>
                  <p className="text-xs uppercase tracking-widest text-[#C48B60] font-bold mb-3 lg:mb-4">Episode 325</p>
                  <div className="text-sm text-gray-500 mb-4 lg:mb-6">
                    <p>Host: <span className="italic text-gray-400">Lex Fridman</span></p>
                    <p>Guest: <span className="italic text-gray-400">Michael Levin</span></p>
                  </div>
                  <div className="mt-auto">
                    <div className="h-12 lg:h-16 flex items-end gap-0.5 mb-2 opacity-60">
                      {[4, 8, 6, 10, 12, 5, 3, 6, 4, 2].map((h, i) => (
                        <div key={i} className={`w-1 ${i < 6 ? 'bg-[#C48B60]' : 'bg-gray-700'}`} style={{ height: `${h * 4}px` }} />
                      ))}
                    </div>
                    <div className="w-full bg-gray-800 h-1 rounded-full overflow-hidden">
                      <div className="bg-[#C48B60] w-1/3 h-full" />
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-500 mt-1" style={{ fontFamily: "'Fira Code', monospace" }}>
                      <span>31:32</span>
                      <span>180:00</span>
                    </div>
                    <div className="flex justify-center gap-6 mt-3 lg:mt-4 text-[#C48B60]">
                      <Rewind className="w-5 h-5 lg:w-6 lg:h-6 cursor-pointer hover:scale-110 transition-transform" />
                      <Play className="w-8 h-8 lg:w-10 lg:h-10 cursor-pointer hover:scale-110 transition-transform fill-current" />
                      <Forward className="w-5 h-5 lg:w-6 lg:h-6 cursor-pointer hover:scale-110 transition-transform" />
                    </div>
                  </div>
                </div>

                {/* Center panel - Research Stream */}
                <div className="flex-1 p-4 lg:p-8 bg-[#121212] preserve-3d">
                  <div className="text-center mb-6 lg:mb-12 relative">
                    <span className="absolute top-0 left-0 w-4 h-4 border-t border-l border-[#C48B60]/30" />
                    <span className="absolute top-0 right-0 w-4 h-4 border-t border-r border-[#C48B60]/30" />
                    <span className="absolute bottom-0 left-0 w-4 h-4 border-b border-l border-[#C48B60]/30" />
                    <span className="absolute bottom-0 right-0 w-4 h-4 border-b border-r border-[#C48B60]/30" />
                    <h2 className="text-xl lg:text-2xl text-[#C48B60] font-light mb-1">Research Stream</h2>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-gray-600">Claims Extracted As You Listen</p>
                  </div>

                  {/* Primary claim card - pop-out effect */}
                  <div className="bg-[#1E1E1E] border border-[#333] p-4 lg:p-6 mb-4 lg:mb-6 rounded shadow-sm pop-out-card relative">
                    <div className="flex justify-between items-center mb-3 lg:mb-4">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-[#C48B60] uppercase tracking-wider">Mechanism</span>
                        <span className="w-2 h-2 bg-[#C48B60] rounded-full opacity-50" />
                      </div>
                      <div className="flex items-center gap-3 text-gray-500">
                        <span className="text-xs" style={{ fontFamily: "'Fira Code', monospace" }}>31:10</span>
                        <Bookmark className="w-4 h-4 hover:text-white cursor-pointer transition-colors" />
                      </div>
                    </div>
                    <h3 className="text-base lg:text-xl font-medium text-gray-200 mb-2 lg:mb-3 leading-snug">
                      Evolution reprograms bodies by changing signals, not physical hardware
                    </h3>
                    <p className="text-gray-400 font-light leading-relaxed mb-4 lg:mb-6 text-sm lg:text-base">
                      "But much of the time it's not by changing the hardware, it's by changing the signals that the cells give to each other... It's doing what we as engineers do, which is try to convince the cells to do various things..."
                    </p>
                    <div className="flex justify-between items-center border-t border-[#333] pt-3 lg:pt-4">
                      <div className="text-xs text-gray-500 flex items-center gap-1" style={{ fontFamily: "'Fira Code', monospace" }}>
                        CONFIDENCE: <span className="text-[#C48B60] font-bold">80%</span>
                        <Info className="w-3.5 h-3.5 text-gray-600" />
                      </div>
                      <button className="text-xs uppercase tracking-wide border border-[#C48B60] text-[#C48B60] px-3 py-1.5 hover:bg-[#C48B60] hover:text-white transition-colors">
                        Dive Deeper
                      </button>
                    </div>
                  </div>

                  {/* Secondary claim card - faded */}
                  <div className="bg-[#1E1E1E] border border-[#333] p-4 lg:p-6 rounded shadow-sm opacity-60 relative">
                    <div className="flex justify-between items-center mb-3 lg:mb-4">
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Theoretical</span>
                      <div className="flex items-center gap-3 text-gray-500">
                        <span className="text-xs" style={{ fontFamily: "'Fira Code', monospace" }}>30:24 - 1 MIN AGO</span>
                        <Bookmark className="w-4 h-4" />
                      </div>
                    </div>
                    <h3 className="text-base lg:text-lg font-medium text-gray-300 mb-2 lg:mb-3">
                      Every biological level, from molecules to organs, pursues its own goals
                    </h3>
                    <p className="text-gray-500 font-light text-sm leading-relaxed mb-4">
                      "Biology uses a multi scale competency architecture, meaning that every level has goals. So molecular networks have goals, cells have goals..."
                    </p>
                    <div className="flex justify-between items-center border-t border-[#333] pt-3 lg:pt-4">
                      <div className="text-xs text-gray-600 flex items-center gap-1" style={{ fontFamily: "'Fira Code', monospace" }}>
                        CONFIDENCE: <span className="text-[#C48B60] font-bold">95%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right panel - Research Assistant */}
                <div className="w-72 lg:w-80 border-l border-[#2a2a2a] bg-[#161616] flex-col hidden lg:flex rounded-br-xl">
                  <div className="p-4 border-b border-[#2a2a2a] bg-[#1E1E1E]">
                    <div className="flex items-start gap-3">
                      <div className="p-2 border border-[#C48B60]/30 rounded text-[#C48B60] bg-[#C48B60]/10">
                        <MessageSquare className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wide text-gray-300">Research Assistant</h4>
                        <p className="text-[9px] uppercase tracking-wider text-gray-500">AI-Powered Analysis</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 lg:p-5 flex-1 flex flex-col gap-4 lg:gap-6 overflow-y-auto">
                    {/* User question */}
                    <div className="flex flex-col items-end">
                      <div className="bg-[#2a2a2a] border border-[#333] p-3 rounded-2xl rounded-tr-sm shadow-sm max-w-[90%] relative group">
                        <p className="text-xs text-gray-300 font-medium leading-relaxed">
                          What is the specific mechanism of cellular reprogramming mentioned here?
                        </p>
                        <div className="absolute -right-1 -top-1 w-2 h-2 bg-[#C48B60] rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <span className="text-[9px] text-gray-600 mt-1 mr-1" style={{ fontFamily: "'Fira Code', monospace" }}>12:42 PM</span>
                    </div>

                    {/* AI response */}
                    <div className="flex flex-col items-start">
                      <div className="flex items-center gap-2 mb-2 px-1">
                        <div className="p-1 bg-[#C48B60]/10 rounded-sm">
                          <Sparkles className="w-3 h-3 text-[#C48B60]" />
                        </div>
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Noeron AI</span>
                      </div>
                      <div className="text-[13px] text-gray-300 leading-relaxed pr-2" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                        <p className="mb-3">
                          The mechanism is fundamentally <span className="italic text-[#C48B60] font-medium">bio-electric</span>, not genetic. The guest explains that evolution uses voltage gradients as a control layer:
                        </p>
                        <ul className="space-y-2 mb-4">
                          <li className="flex items-start gap-2.5">
                            <span className="w-1 h-1 rounded-full bg-[#C48B60] mt-2 flex-shrink-0" />
                            <span className="text-gray-400">Cells communicate via ion channels to maintain specific voltage patterns.</span>
                          </li>
                          <li className="flex items-start gap-2.5">
                            <span className="w-1 h-1 rounded-full bg-[#C48B60] mt-2 flex-shrink-0" />
                            <span className="text-gray-400">These electrical states serve as "pattern memories" for the target organ shape.</span>
                          </li>
                        </ul>
                      </div>
                      <div className="inline-flex items-center gap-2 px-2.5 py-1.5 bg-[#1E1E1E] border border-[#333] rounded text-[10px] text-gray-500 hover:bg-[#252525] hover:border-[#C48B60] transition-all cursor-pointer group" style={{ fontFamily: "'Fira Code', monospace" }}>
                        <MessageSquare className="w-3 h-3 group-hover:text-[#C48B60]" />
                        <span>Source: Timestamp 31:45</span>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 space-y-2 border-t border-[#2a2a2a] bg-[#181818] rounded-br-xl">
                    <div className="text-[9px] uppercase tracking-widest text-center text-gray-600 mb-2">Suggested Prompts</div>
                    <button className="w-full text-left text-xs bg-[#1E1E1E] border border-[#333] p-3 text-gray-400 hover:border-[#C48B60] hover:text-[#C48B60] transition-colors">
                      Explain this claim in simpler terms
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: Powered by Gemini 3 */}
      <section className="snap-section relative min-h-screen flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 py-20 lg:py-28 bg-[#121212]">
        <div className="max-w-7xl mx-auto w-full">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12">
            <div>
              <p className="text-[#C48B60] text-sm tracking-[0.2em] mb-3" style={{ fontFamily: "'Fira Code', monospace" }}>
                POWERED BY GEMINI 3
              </p>
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white" style={{ fontFamily: "'Inter', sans-serif" }}>
                Why Gemini 3 makes this possible
              </h2>
            </div>
            <div className="mt-4 md:mt-0">
              <div className="inline-flex items-center px-4 py-2 bg-[#1E1E1E] border border-[#C48B60]/30 rounded">
                <span className="text-[10px] text-[#C48B60]/70 mr-2" style={{ fontFamily: "'Fira Code', monospace" }}>COST REDUCTION</span>
                <span className="text-2xl font-bold text-[#C48B60]">25x</span>
              </div>
            </div>
          </div>

          {/* Capability cards grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            {[
              {
                icon: <Database className="w-8 h-8" />,
                title: "1M Token Context",
                value: "150+ Papers",
                desc: "Load entire podcast transcripts alongside the full research corpus in a single context window"
              },
              {
                icon: <Zap className="w-8 h-8" />,
                title: "Context Caching",
                value: "$2 / 1K queries",
                desc: "Process the paper corpus once, then query thousands of times — making real-time responses economically viable"
              },
              {
                icon: <Brain className="w-8 h-8" />,
                title: "Thinking Levels",
                value: "Medium -> High",
                desc: "Adaptive reasoning depth: fast claim detection with medium thinking, deep synthesis with high thinking"
              },
              {
                icon: <FileJson className="w-8 h-8" />,
                title: "Structured Outputs",
                value: "JSON Schema",
                desc: "Generate context cards with proper citations, confidence scores, and provenance tracking automatically"
              }
            ].map((item, i) => (
              <div
                key={i}
                className="bg-[#1E1E1E] border border-[#333] p-6 hover:border-[#C48B60]/30 transition-all hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(196,139,96,0.1)]"
              >
                <div className="text-[#C48B60] mb-4">{item.icon}</div>
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-2" style={{ fontFamily: "'Fira Code', monospace" }}>
                  {item.title}
                </div>
                <div className="text-2xl font-semibold text-white mb-3">{item.value}</div>
                <p className="text-sm text-gray-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>

          {/* Two-pass architecture diagram */}
          <div className="bg-[#1E1E1E] border border-[#C48B60]/30 p-6 lg:p-8 rounded-lg">
            <div className="text-sm tracking-[0.15em] text-[#C48B60] mb-8" style={{ fontFamily: "'Fira Code', monospace" }}>
              TWO-PASS GEMINI ARCHITECTURE
            </div>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-6 items-center">
              {/* Pass 1 */}
              <div className="bg-[#121212] border border-[#333] p-6 rounded">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-full bg-[#C48B60]/10 border-2 border-[#C48B60] flex items-center justify-center">
                    <span className="text-xs font-bold text-[#C48B60]" style={{ fontFamily: "'Fira Code', monospace" }}>01</span>
                  </div>
                  <div>
                    <div className="text-base font-medium text-white">Claim Detection</div>
                    <div className="text-[11px] text-[#C48B60]" style={{ fontFamily: "'Fira Code', monospace" }}>gemini-3-flash</div>
                  </div>
                </div>
                <div className="text-sm text-gray-400 leading-relaxed space-y-1" style={{ fontFamily: "'Fira Code', monospace" }}>
                  <p><span className="text-gray-600">thinking:</span> <span className="text-[#C48B60]">'medium'</span></p>
                  <p><span className="text-gray-600">input:</span> <span className="text-white">60s window</span></p>
                  <p><span className="text-gray-600">output:</span> <span className="text-white">claims+tags</span></p>
                </div>
              </div>

              {/* Arrow */}
              <div className="hidden md:flex items-center justify-center">
                <div className="w-16 h-1 bg-gradient-to-r from-[#C48B60] to-[#be5a38]" />
                <ChevronRight className="w-6 h-6 text-[#be5a38] -ml-2" />
              </div>
              <div className="md:hidden flex justify-center">
                <ChevronRight className="w-8 h-8 text-[#C48B60] rotate-90" />
              </div>

              {/* Pass 2 */}
              <div className="bg-[#121212] border border-[#be5a38]/30 p-6 rounded">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-full bg-[#be5a38]/10 border-2 border-[#be5a38] flex items-center justify-center">
                    <span className="text-xs font-bold text-[#be5a38]" style={{ fontFamily: "'Fira Code', monospace" }}>02</span>
                  </div>
                  <div>
                    <div className="text-base font-medium text-white">Context Synthesis</div>
                    <div className="text-[11px] text-[#be5a38]" style={{ fontFamily: "'Fira Code', monospace" }}>gemini-3-pro + cache</div>
                  </div>
                </div>
                <div className="text-sm text-gray-400 leading-relaxed space-y-1" style={{ fontFamily: "'Fira Code', monospace" }}>
                  <p><span className="text-gray-600">thinking:</span> <span className="text-[#be5a38]">'high'</span></p>
                  <p><span className="text-gray-600">cached:</span> <span className="text-white">150+ papers</span></p>
                  <p><span className="text-gray-600">output:</span> <span className="text-white">cards+cites</span></p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: Technical Stack */}
      <section className="snap-section relative min-h-screen flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 py-20 lg:py-28 bg-[#0a0a0a]">
        <div className="max-w-7xl mx-auto w-full">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12">
            <div>
              <p className="text-[#C48B60] text-sm tracking-[0.2em] mb-3" style={{ fontFamily: "'Fira Code', monospace" }}>
                TECHNICAL STACK
              </p>
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white" style={{ fontFamily: "'Inter', sans-serif" }}>
                How it all fits together
              </h2>
            </div>
            <div className="mt-4 md:mt-0">
              <div className="inline-flex items-center px-4 py-2 bg-[#1E1E1E] border border-[#C48B60]/30 rounded">
                <span className="text-sm text-[#C48B60]" style={{ fontFamily: "'Fira Code', monospace" }}>MCP PROTOCOL</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.5fr] gap-8">
            {/* Left column: Data Pipeline */}
            <div className="bg-[#1E1E1E] border border-[#333] p-6 lg:p-8">
              <div className="text-sm tracking-[0.15em] text-[#C48B60] mb-8" style={{ fontFamily: "'Fira Code', monospace" }}>
                DATA PIPELINE
              </div>
              <div className="space-y-0">
                {[
                  { step: "01", label: "INGEST", desc: "Semantic Scholar + ArXiv", color: "copper" },
                  { step: "02", label: "EXTRACT", desc: "GROBID TEI Processing", color: "vermillion" },
                  { step: "03", label: "TRANSCRIBE", desc: "AssemblyAI + Diarization", color: "copper" },
                  { step: "04", label: "CHUNK", desc: "400 tokens / 50 overlap", color: "vermillion" },
                  { step: "05", label: "EMBED", desc: "Gemini text-embedding-004", color: "copper" },
                  { step: "06", label: "INDEX", desc: "Supabase pgvector", color: "vermillion" },
                  { step: "07", label: "DETECT", desc: "Gemini Claim Extraction", color: "copper" },
                  { step: "08", label: "VERIFY", desc: "RAG + Citation Scoring", color: "vermillion" },
                ].map((item, i, arr) => (
                  <div key={item.step} className="flex items-stretch gap-4">
                    <div className="flex flex-col items-center">
                      <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        item.color === 'vermillion'
                          ? 'border-[#be5a38] bg-[#be5a38]/10'
                          : 'border-[#C48B60] bg-[#C48B60]/10'
                      }`}>
                        <span className={`text-xs font-bold ${item.color === 'vermillion' ? 'text-[#be5a38]' : 'text-[#C48B60]'}`} style={{ fontFamily: "'Fira Code', monospace" }}>
                          {item.step}
                        </span>
                      </div>
                      {i < arr.length - 1 && (
                        <div className={`w-0.5 flex-1 min-h-[20px] ${
                          item.color === 'vermillion'
                            ? 'bg-gradient-to-b from-[#be5a38] to-[#C48B60]'
                            : 'bg-[#C48B60]/30'
                        }`} />
                      )}
                    </div>
                    <div className="flex-1 py-2 border-b border-[#333]/50">
                      <div className="flex justify-between items-baseline gap-4">
                        <span className="text-sm text-white font-medium" style={{ fontFamily: "'Fira Code', monospace" }}>{item.label}</span>
                        <span className="text-sm text-gray-500">{item.desc}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right column: Tech specs */}
            <div className="space-y-6">
              {/* Stack Cards */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Backend", value: "Python + FastMCP", desc: "MCP protocol server with HTTP adapter" },
                  { label: "Frontend", value: "Next.js + React", desc: "Real-time sync via API proxy routes" },
                  { label: "Vector Store", value: "Supabase pgvector", desc: "Persistent embeddings + metadata" },
                  { label: "AI Engine", value: "Gemini 3 Pro", desc: "Claim detection + synthesis" },
                ].map((item) => (
                  <div key={item.label} className="bg-[#1E1E1E] border border-[#333] p-5 hover:border-[#C48B60]/30 transition-colors">
                    <div className="text-xs text-gray-500 uppercase tracking-wider mb-2" style={{ fontFamily: "'Fira Code', monospace" }}>
                      {item.label}
                    </div>
                    <div className="text-lg font-semibold text-white mb-2">{item.value}</div>
                    <div className="text-sm text-gray-400">{item.desc}</div>
                  </div>
                ))}
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { value: "500+", label: "Papers Indexed" },
                  { value: "< 3s", label: "Query Latency" },
                  { value: "768", label: "Embedding Dims" },
                ].map((stat, i) => (
                  <div key={stat.label} className="bg-[#1E1E1E] border border-[#333] p-5 text-center">
                    <div className={`text-3xl font-bold mb-2 ${i === 1 ? 'text-[#be5a38]' : 'text-[#C48B60]'}`} style={{ fontFamily: "'Fira Code', monospace" }}>
                      {stat.value}
                    </div>
                    <div className="text-xs text-gray-500 uppercase tracking-wider" style={{ fontFamily: "'Fira Code', monospace" }}>
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>

              {/* MCP Tools */}
              <div className="bg-[#1E1E1E] border border-[#C48B60]/30 p-6">
                <div className="text-sm tracking-[0.15em] text-[#C48B60] mb-6" style={{ fontFamily: "'Fira Code', monospace" }}>
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
                      <div className={`w-2.5 h-2.5 rounded-full ${
                        tool.primary
                          ? 'bg-[#C48B60] shadow-[0_0_8px_rgba(196,139,96,0.5)]'
                          : 'bg-gray-600'
                      }`} />
                      <span className={`text-sm ${tool.primary ? 'text-white font-medium' : 'text-gray-500'}`} style={{ fontFamily: "'Fira Code', monospace" }}>
                        {tool.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 4: Demo Video */}
      <section className="snap-section relative min-h-screen flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 py-20 lg:py-28 bg-[#121212]">
        <div className="max-w-4xl mx-auto w-full text-center">
          {/* Headline */}
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4" style={{ fontFamily: "'Inter', sans-serif" }}>
            SEE IT IN ACTION
          </h2>
          <p className="text-gray-400 text-lg mb-12" style={{ fontFamily: "'Fira Code', monospace" }}>
            3 minute walkthrough
          </p>

          {/* Video placeholder */}
          <div className="relative aspect-video bg-[#1E1E1E] border border-[#333] rounded-lg mb-12 overflow-hidden group cursor-pointer hover:border-[#C48B60]/50 transition-colors">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-20 h-20 rounded-full bg-[#C48B60]/20 flex items-center justify-center group-hover:bg-[#C48B60]/30 transition-colors">
                <Play className="w-10 h-10 text-[#C48B60] fill-current ml-1" />
              </div>
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-[#121212]/80 to-transparent" />
            <div className="absolute bottom-4 left-4 text-left">
              <div className="text-xs text-gray-500" style={{ fontFamily: "'Fira Code', monospace" }}>DEMO VIDEO</div>
              <div className="text-sm text-white">Noeron Research Platform</div>
            </div>
          </div>

          {/* Timestamp markers */}
          <div className="text-left max-w-lg mx-auto mb-12 space-y-3" style={{ fontFamily: "'Fira Code', monospace" }}>
            {[
              { time: "00:00", label: "Podcast begins" },
              { time: "00:45", label: "First claim detected" },
              { time: "01:30", label: "Research surfaces" },
              { time: "02:15", label: "Knowledge graph generates" },
              { time: "03:00", label: "Cross-episode connections" },
            ].map((item) => (
              <div key={item.time} className="flex items-center gap-4 text-sm">
                <span className="text-[#C48B60]">{item.time}</span>
                <span className="text-gray-500">—</span>
                <span className="text-gray-300">{item.label}</span>
              </div>
            ))}
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <button
              onClick={onGetStarted}
              className="inline-flex items-center justify-center px-8 py-4 text-xs uppercase tracking-wide font-medium text-white bg-[#C48B60] border border-[#C48B60] hover:bg-[#A8744F] hover:border-[#A8744F] transition-all shadow-lg hover:shadow-[#C48B60]/20"
            >
              Try Live Demo
            </button>
            <button className="inline-flex items-center justify-center px-8 py-4 text-xs uppercase tracking-wide font-medium border border-gray-600 text-gray-300 bg-transparent hover:bg-[#C48B60] hover:border-[#C48B60] hover:text-white transition-all group">
              <Github className="w-4 h-4 mr-2" />
              View on GitHub
              <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 py-6 border-t border-[#1a1a1a]">
          <div className="max-w-7xl mx-auto px-4 text-center">
            <p className="text-xs text-gray-600" style={{ fontFamily: "'Fira Code', monospace" }}>
              &lt;/&gt; Built for Gemini 3 Global Hackathon
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
